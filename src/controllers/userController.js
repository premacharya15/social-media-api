import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import User from '../models/userModel.js';
import catchAsync from '../middleware/catchAsync.js';
import client, { isRedisConnected } from '../utils/redisClient.js';
import Post from '../models/postModel.js';
import { rm } from 'fs/promises';

// Convert URL to path for __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure directory exists
const ensureDirSync = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};


// Set up storage for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', 'uploads', `user_${req.user._id}`);
        ensureDirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Use a fixed filename 'avatar' with the original file extension
        const avatarFilename = `avatar.png`;
        cb(null, avatarFilename);
    }
});

const upload = multer({ storage: storage });


// Get User Details --Logged In User
export const getAccountDetails = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const cacheKey = `user_${userId}`;

    let userData;

    // Try to get data from Redis cache first
    if (await isRedisConnected()) {
        const cachedUser = await client.get(cacheKey);
        if (cachedUser) {
            userData = JSON.parse(cachedUser);
            return res.status(200).json({ user: userData });
        }
    }

    // If not in cache, fetch from database
    const user = await User.findById(userId)
        .select('username name bio website avatar')
        .lean();

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Get counts using aggregation for better performance
    const [counts] = await User.aggregate([
        { $match: { _id: userId } },
        {
            $project: {
                postCount: { $size: "$posts" },
                followingCount: { $size: "$following" },
                followersCount: { $size: "$followers" }
            }
        }
    ]);

    userData = {
        ...user,
        postCount: counts.postCount,
        followingCount: counts.followingCount,
        followersCount: counts.followersCount
    };

    // Cache the user data in Redis for future requests
    if (await isRedisConnected()) {
        await client.set(cacheKey, JSON.stringify(userData), { EX: 7200 }); // Expire after 2 hours
    }

    res.status(200).json({ user: userData });
});


// delete User Profile
export const deleteProfile = catchAsync(async (req, res) => {
    const userId = req.user._id;

    // Start multiple asynchronous operations
    const [user, userPosts] = await Promise.all([
        User.findById(userId),
        Post.find({ postedBy: userId })
    ]);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Prepare deletion operations
    const deleteOperations = [
        // Delete user's upload directory
        (async () => {
            const uploadPath = path.join(__dirname, '..', 'uploads', `user_${userId}`);
            try {
                await rm(uploadPath, { recursive: true, force: true });
            } catch (err) {
                console.error(`Error deleting user upload directory: ${err}`);
            }
        })(),

        // Delete user's posts and update related collections
        ...userPosts.map(post => 
            Promise.all([
                Post.findByIdAndDelete(post._id),
                User.updateMany(
                    { $or: [{ posts: post._id }, { saved: post._id }] },
                    { $pull: { posts: post._id, saved: post._id } }
                )
            ])
        ),

        // Remove user from other users' followers and following lists
        User.updateMany(
            { $or: [{ followers: userId }, { following: userId }] },
            { $pull: { followers: userId, following: userId } }
        ),

        // Remove user's likes and comments from all posts
        Post.updateMany(
            { $or: [{ likes: userId }, { 'comments.user': userId }, { savedBy: userId }] },
            { 
                $pull: { 
                    likes: userId, 
                    comments: { user: userId },
                    savedBy: userId
                } 
            }
        ),

        // Delete the user
        User.findByIdAndDelete(userId),

        // Delete the user's data from Redis cache if Redis is connected
        (async () => {
            if (await isRedisConnected()) {
                await Promise.all([
                    client.del(user.email),
                    client.del(`user_${userId}`)
                ]);
            }
        })()
    ];

    // Execute all deletion operations concurrently
    await Promise.all(deleteOperations);

    // Send response immediately after initiating deletion operations
    res.status(200).json({ message: 'Profile deletion initiated. All associated data will be removed shortly.' });
});


// Update Username
export const updateUsername = catchAsync(async (req, res) => {
    const { username } = req.body;
    const userId = req.user._id;

    // Perform all database operations concurrently
    const [user, existingUser] = await Promise.all([
        User.findById(userId),
        User.findOne({ username })
    ]);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (username === user.username) {
        return res.status(200).json({ message: 'No change in username.' });
    }

    if (existingUser) {
        // Initiate username suggestions asynchronously
        getUsernameSuggestions(req, res, username);
        return;
    }

    // Update username
    user.username = username;
    user.save().then(() => {
        res.status(200).json({ message: 'Username updated successfully!' });
    }).catch(error => {
        res.status(500).json({ message: 'Error updating username', error: error.message });
    });
});


// Username Suggestions
export const getUsernameSuggestions = catchAsync(async (req, res, attemptedUsername) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ message: 'User not found!' });
    }

    const baseUsername = (typeof attemptedUsername === 'string' ? attemptedUsername : user.username).toLowerCase().replace(/\s+/g, '_');
    const suggestions = [];
    const maxAttempts = 10;
    const requiredSuggestions = 3;

    // Generate all potential usernames upfront
    const potentialUsernames = Array.from({ length: maxAttempts }, () => 
        `${baseUsername}_${Math.floor(Math.random() * 1000)}`
    );

    // Check all usernames in a single database query
    const existingUsers = await User.find({ username: { $in: potentialUsernames } }).select('username');
    const existingUsernames = new Set(existingUsers.map(u => u.username));

    // Filter unique usernames
    for (const username of potentialUsernames) {
        if (!existingUsernames.has(username)) {
            suggestions.push(username);
            if (suggestions.length === requiredSuggestions) break;
        }
    }

    if (suggestions.length < requiredSuggestions) {
        return res.status(500).json({ message: 'Unable to generate unique username suggestions at this time.' });
    }
    // console.log(`Username already taken, Suggestions: ${suggestions}`);
    res.status(409).json({ message: 'Username already taken!', suggestions });
});


// Update Profile
export const updateProfile = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const updateFields = {};

  // Only update fields that are provided
  if (req.body.name) updateFields.name = req.body.name;
  if (req.body.username) updateFields.username = req.body.username;
  if (req.body.bio) updateFields.bio = req.body.bio;
  if (req.body.website) updateFields.website = req.body.website;

  // Handle avatar update
  if (req.file) {
    const uploadPath = path.join(__dirname, '..', 'uploads', `user_${userId}`);
    ensureDirSync(uploadPath);
    const avatarFilename = `avatar.png`;
    const fullPath = path.join(uploadPath, avatarFilename);
    
    // Use promises for file operations
    await fs.promises.rename(req.file.path, fullPath);
    
    // Convert full path to a relative path with backslashes
    const relativePath = path.relative(path.join(__dirname, '..'), fullPath).replace(/\//g, '\\');
    updateFields.avatar = relativePath;
  }

  // Update user and get the updated document
  const user = await User.findByIdAndUpdate(userId, updateFields, { new: true, runValidators: true });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Delete Redis cache for the user
  if (await isRedisConnected()) {
    await client.del(`user_${userId}`).catch(console.error);
  }

  res.status(200).json({
    message: 'Profile updated successfully!'
  });
});

export { upload };


// Logout User
export const logoutUser = catchAsync(async (req, res) => {
    const userId = req.user._id;

    // Check if Redis is connected before performing cache operations
    if (await isRedisConnected()) {
        // Delete the user's session data from Redis
        await client.del(`user_${userId}`).catch(console.error);
    }

    res.status(200).json({ message: 'Logged out successfully!', token: null });
});


// Discover People | Mutual Followers 
export const discoverPeople = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if Redis is connected and try to get cached data
    if (await isRedisConnected()) {
        const cacheKey = `user_${userId}_discoverPeople_page_${page}`;
        const cachedData = await client.get(cacheKey);
        if (cachedData) {
            return res.status(200).json(JSON.parse(cachedData));
        }
    }

    // Fetch a list of user IDs that the current user is following
    const user = await User.findById(userId).populate('following', '_id username');
    const followingIds = user.following.map(user => user._id);
    const followingMap = new Map(user.following.map(user => [user._id.toString(), user.username]));

    // Find users that the current user is not following
    const potentialPeople = await User.find({
        _id: { $nin: [userId, ...followingIds] } // Exclude self and already followed users
    })
    .select('_id name avatar followers following')
    .skip(skip)
    .limit(limit)
    .lean(); // Use lean() for faster performance as we only read data

    // Enhance potentialPeople with followed by information
    const enhancedPeople = potentialPeople.map(person => {
        const mutualFollowers = person.followers.filter(followerId => 
            followingMap.has(followerId.toString())
        );

        let followedBy = 'Suggest for you';
        if (mutualFollowers.length > 0) {
            if (mutualFollowers.length === 1) {
                followedBy = `Followed by ${followingMap.get(mutualFollowers[0].toString())}`;
            } else {
                const firstFollower = followingMap.get(mutualFollowers[0].toString());
                const otherCount = mutualFollowers.length - 1;
                followedBy = `Followed by ${firstFollower} + ${otherCount} more`;
            }
        }

        return {
            _id: person._id,
            name: person.name,
            avatar: person.avatar,
            followedBy
        };
    });

    const totalCount = await User.countDocuments({
        _id: { $nin: [userId, ...followingIds] }
    });

    const totalPages = Math.ceil(totalCount / limit);

    const responseData = {
        message: 'People you may know',
        data: enhancedPeople,
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount
    };

    // Cache the result in Redis if connected
    if (await isRedisConnected()) {
        const cacheKey = `user_${userId}_discoverPeople_page_${page}`;
        await client.set(cacheKey, JSON.stringify(responseData), { EX: 3600 }); // Cache for 1 hour
    }

    res.status(200).json(responseData);
});


// get userdetils with username
export const getUserDetails = catchAsync(async (req, res) => {
    const { username } = req.params;

    const user = await User.findOne({ username })
        .select('_id name bio website username avatar')
        .lean(); // Use lean() for faster query execution

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Use aggregation for efficient counting
    const [counts] = await User.aggregate([
        { $match: { _id: user._id } },
        {
            $project: {
                postCount: { $size: "$posts" },
                followingCount: { $size: "$following" },
                followersCount: { $size: "$followers" }
            }
        }
    ]);

    // Prepare user data
    const userData = {
        ...user,
        ...counts
    };

    res.status(200).json({ user: userData });
});


// Follow | Unfollow User
export const followUser = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const targetUserId = req.params.id;

    if (userId.toString() === targetUserId) {
        return res.status(400).json({ message: "You cannot follow yourself." });
    }

    const isFollowing = await User.exists({ _id: userId, following: targetUserId });

    const updateOperations = isFollowing
        ? [
            { updateOne: { filter: { _id: userId }, update: { $pull: { following: targetUserId } } } },
            { updateOne: { filter: { _id: targetUserId }, update: { $pull: { followers: userId } } } }
          ]
        : [
            { updateOne: { filter: { _id: userId }, update: { $addToSet: { following: targetUserId } } } },
            { updateOne: { filter: { _id: targetUserId }, update: { $addToSet: { followers: userId } } } }
          ];

    const result = await User.bulkWrite(updateOperations);

    if (result.modifiedCount === 0) {
        return res.status(404).json({ message: "User not found or no changes made" });
    }

    const message = isFollowing ? "User unfollowed" : "User followed";
    res.status(200).json({ message });

    // Asynchronously handle cache deletion
    setImmediate(async () => {
        if (await isRedisConnected()) {
            const deletePromises = [
                client.del(`user_${userId}`),
                client.del(`user_${targetUserId}`),
                client.keys(`user_${userId}_discoverPeople_page_*`).then(keys => {
                    if (keys.length > 0) return client.del(keys);
                }),
                client.keys(`user_${userId}_search_*`).then(keys => {
                    if (keys.length > 0) return client.del(keys);
                })
            ];
            
            await Promise.all(deletePromises).catch(console.error);
        }
    });
});


// User Search
export const searchUsers = catchAsync(async (req, res, next) => {
    const { keyword } = req.query;
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!keyword) {
        return res.status(400).json({ message: "Keyword is required" });
    }

    const regexPattern = `^${keyword}`;
    const cacheKey = `user_${userId}_search_${keyword}_page_${page}`;

    // Check if Redis is connected
    const redisConnected = await isRedisConnected();

    if (redisConnected) {
        const cachedResults = await client.get(cacheKey);
        if (cachedResults) {
            return res.status(200).json(JSON.parse(cachedResults));
        }
    }

    // Fetch the list of user IDs the current user is following
    const currentUser = await User.findById(userId).select('following');
    const followingIds = currentUser.following.map(follow => follow.toString());

    const query = {
        $and: [
            {
                $or: [
                    { name: { $regex: regexPattern, $options: "i" } },
                    { username: { $regex: regexPattern, $options: "i" } }
                ]
            }
        ]
    };

    const totalCount = await User.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    const users = await User.find(query)
        .select('name username avatar followers')
        .skip(skip)
        .limit(limit)
        .lean();

    if (users.length === 0) {
        return res.status(404).json({ message: "No users found" });
    }

    // users with mutual followers information
    const enhancedUsers = await Promise.all(users.map(async user => {
        const mutualFollowers = await User.find({
            _id: { $in: user.followers },
            followers: userId
        }).select('username').lean();

        const mutuals = mutualFollowers.map(follower => follower.username);
        let mutualFollowersText = mutuals.length > 0 ? `Followed by ${mutuals[0]}` + (mutuals.length > 1 ? ` +${mutuals.length - 1} more` : '') : undefined;

        // Conditionally add followers field based on mutual followers count
        const userResponse = {
            name: user.name,
            username: user.username,
            avatar: user.avatar
        };

        if (mutuals.length > 0) {
            userResponse.followedBy = mutualFollowersText;
            // Conditionally add followers field based on mutual followers text
            // if (mutualFollowersText === `Followed by ${mutuals[0]}`) {
            //     userResponse.followers = userId;
            // }
        }

        return userResponse;
    }));

    const responseData = {
        users: enhancedUsers,
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount
    };

    // Cache the results for future requests if Redis is connected
    if (redisConnected) {
        await client.set(cacheKey, JSON.stringify(responseData), { EX: 3600 }); // Cache for 1 hour
    }

    res.status(200).json(responseData);
});