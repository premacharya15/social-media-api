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
        await client.set(cacheKey, JSON.stringify(userData), { EX: 3600 });
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
    const user = await User.findById(req.user._id);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (username === user.username) {
        return res.status(200).json({ message: 'No change in username.' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
        return getUsernameSuggestions(req, res, username);
    }

    user.username = username;
    await user.save();
    res.status(200).json({ message: 'Username updated successfully!' });
});

// Username Suggestions
export const getUsernameSuggestions = catchAsync(async (req, res, attemptedUsername) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ message: 'User not found!' });
    }

    const baseUsername = (typeof attemptedUsername === 'string' ? attemptedUsername : user.username).toLowerCase().replace(/\s+/g, '_');
    const suggestions = [];
    let attempts = 0;

    while (suggestions.length < 3 && attempts < 10) {
        const potentialUsername = `${baseUsername}_${Math.floor(Math.random() * 1000)}`;
        const existingUser = await User.findOne({ username: potentialUsername });
        if (!existingUser) {
            suggestions.push(potentialUsername);
        }
        attempts++;
    }

    if (suggestions.length < 3) {
        return res.status(500).json({ message: 'Unable to generate unique username suggestions at this time.' });
    }
    // console.log(`Username already taken, Suggestions: ${suggestions}`);
    res.status(409).json({ message: 'Username already taken!', suggestions });
});


// Update Profile
export const updateProfile = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Update user fields if provided
  user.name = req.body.name || user.name;
  user.username = req.body.username || user.username;
  user.bio = req.body.bio || user.bio;
  user.website = req.body.website || user.website;

  // Handle avatar update
  if (req.file) {
    const uploadPath = path.join(__dirname, '..', 'uploads', `user_${req.user._id}`);
    ensureDirSync(uploadPath); // Ensure the directory exists
    const avatarFilename = `avatar.png`;
    const fullPath = path.join(uploadPath, avatarFilename);
    fs.renameSync(req.file.path, fullPath); // Move the file to the new path
    
    // Convert full path to a relative path with backslashes
    const relativePath = path.relative(path.join(__dirname, '..'), fullPath).replace(/\//g, '\\');
    user.avatar = relativePath;
  }

  await user.save();

  // Get post count
  const postCount = await Post.countDocuments({ postedBy: userId });

  // Update the user data in Redis cache if Redis is connected
  if (await isRedisConnected()) {
    const userDataToCache = {
      ...user.toObject(),
      postCount
    };
    await client.set(`user_${userId}`, JSON.stringify(userDataToCache), { EX: 3600 }); // Cache for 1 hour
  }

  res.status(200).json({
    message: 'Profile updated successfully!',
    user: {
      ...user.toObject(),
      postCount
    }
  });
});

export { upload };


// Logout User
export const logoutUser = catchAsync(async (req, res) => {
    const userId = req.user._id;

    // Check if Redis is connected before performing cache operations
    if (await isRedisConnected()) {
        // Delete the user's session data from Redis
        await client.del(`user_${userId}`);
    }

    res.status(200).json({ message: 'Logged out successfully!' });
});


// Discover People | Mutual Followers 
export const discoverPeople = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch a list of user IDs that the current user is following
    const user = await User.findById(userId).populate('following', '_id');
    const followingIds = user.following.map(user => user._id);

    // Find users that the current user is not following
    const potentialPeople = await User.find({
        _id: { $nin: [userId, ...followingIds] } // Exclude self and already followed users
    })
    .select('_id name avatar followers')
    .skip(skip)
    .limit(limit)
    .lean(); // Use lean() for faster performance as we only read data

    // Enhance potentialPeople with mutual followers information
    const enhancedPeople = await Promise.all(potentialPeople.map(async person => {
        // Find mutual followers
        const mutualFollowers = await User.find({
            _id: { $in: person.followers },
            followers: userId
        }).select('username');

        // Map usernames of mutual followers
        const mutuals = mutualFollowers.map(follower => follower.username);
        let mutualFollowersText = 'No mutual followers';
        if (mutuals.length > 0) {
            mutualFollowersText = `Followed by ${mutuals[0]}`;
            if (mutuals.length > 1) {
                mutualFollowersText += ` +${mutuals.length - 1} more`;
            }
        }

        return {
            ...person,
            mutualFollowers: mutualFollowersText
        };
    }));

    res.status(200).json({
        message: 'People you may know',
        data: enhancedPeople
    });
});


// get userdetils with username
export const getUserDetails = catchAsync(async (req, res) => {
    const { username } = req.params;
    const redisKey = `user_details_${username}`;

    // Check if Redis is connected
    const redisConnected = await isRedisConnected();

    if (redisConnected) {
        // Try to get data from Redis first
        const cachedData = await client.get(redisKey);
        if (cachedData) {
            return res.status(200).json({ user: JSON.parse(cachedData) });
        }
    }

    // Fetch from database if not in cache or Redis is not connected
    const user = await User.findOne({ username }).select('-password -otp -posts -saved -followers -following -email -dateOfBirth -verified -createdAt -updatedAt -__v');
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Get post count
    const postCount = await Post.countDocuments({ postedBy: user._id });

    // Cache the user data in Redis if connected and return response
    const userData = { ...user.toObject(), postCount };
    if (redisConnected) {
        await client.set(redisKey, JSON.stringify(userData), { EX: 3600 }); // Cache for 1 hour
    }
    res.status(200).json({ userData });
});


// Follow | Unfollow User
export const followUser = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const targetUserId = req.params.id;

    if (userId === targetUserId) {
        return res.status(400).json({ message: "You cannot follow yourself." });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
    }

    const isFollowing = req.user.following.includes(targetUserId);
    if (isFollowing) {
        // Unfollow user
        await User.findByIdAndUpdate(userId, { $pull: { following: targetUserId } });
        await User.findByIdAndUpdate(targetUserId, { $pull: { followers: userId } });
        res.status(200).json({ message: "User unfollowed" });
    } else {
        // Follow user
        await User.findByIdAndUpdate(userId, { $addToSet: { following: targetUserId } });
        await User.findByIdAndUpdate(targetUserId, { $addToSet: { followers: userId } });
        res.status(200).json({ message: "User followed" });
    }
});


// User Search
export const searchUsers = catchAsync(async (req, res, next) => {
    const { keyword } = req.query;
    const userId = req.user._id;
    if (!keyword) {
        return res.status(400).json({ message: "Keyword is required" });
    }

    const regexPattern = `^${keyword}`;
    const cacheKey = `search_${keyword}_${userId}`;

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

    const users = await User.find({
        $and: [
            { _id: { $ne: userId } }, // Exclude the current user
            { _id: { $nin: followingIds } }, // Exclude users already followed
            {
                $or: [
                    { name: { $regex: regexPattern, $options: "i" } },
                    { username: { $regex: regexPattern, $options: "i" } }
                ]
            }
        ]
    }).select('name username avatar followers').limit(10).lean();

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
            userResponse.mutualFollowers = mutualFollowersText;
            // Conditionally add followers field based on mutual followers text
            // if (mutualFollowersText === `Followed by ${mutuals[0]}`) {
            //     userResponse.followers = userId;
            // }
        }

        return userResponse;
    }));

    // Cache the results for future requests if Redis is connected
    if (redisConnected) {
        await client.set(cacheKey, JSON.stringify(enhancedUsers), { EX: 3600 }); // Cache for 1 hour
    }

    res.status(200).json({
        users: enhancedUsers,
    });
});