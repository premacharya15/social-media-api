import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import User from '../models/userModel.js';
import catchAsync from '../middleware/catchAsync.js';
import client from '../utils/redisClient.js';
import Post from '../models/postModel.js';
import { count } from 'console';

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

    // Attempt to retrieve user data from Redis cache
    const cachedUser = await client.get(`user_${userId}`);
    let user = cachedUser ? JSON.parse(cachedUser) : null;
    let postCount;

    // If user data is not in Redis, retrieve from database and update cache
    if (!user) {
        // Retrieve user from database without sensitive and unnecessary fields
        user = await User.findById(userId).select('-password -otp -posts -saved -followers -following -__v').populate('posts');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get post count
        postCount = user.posts.length; // Use the length of the posts array

        // Cache the user data along with post count in Redis for future requests
        const userData = { ...user.toObject(), postCount };
        await client.set(`user_${userId}`, JSON.stringify(userData), { EX: 3600 });
    } else {
        postCount = user.postCount;
    }

    // Prepare a clean user object for response
    const userData = {
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        dateOfBirth: user.dateOfBirth,
        verified: user.verified,
        bio: user.bio,
        website: user.website,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        postCount
    };

    res.status(200).json({ user: userData });
});


// delete User Profile
export const deleteProfile = catchAsync(async (req, res) => {
    const user = await User.findByIdAndDelete(req.user._id);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Delete the user's data from Redis cache
    await client.del(user.email);
    await client.del(`user_${user._id}`);

    res.status(200).json({ message: 'Profile deleted successfully' });
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

  // Update the user data in Redis cache
  const userDataToCache = {
    ...user.toObject(),
    postCount
  };
  await client.set(`user_${userId}`, JSON.stringify(userDataToCache), { EX: 3600 }); // Cache for 1 hour

  res.status(200).json({
    message: 'Profile updated successfully!',
    user: {
      ...userDataToCache
    }
  });
});

export { upload };


// Logout User
export const logoutUser = catchAsync(async (req, res) => {
    const userId = req.user._id;

    // Delete the user's session data from Redis
    await client.del(`user_${userId}`);

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

    // Try to get data from Redis first
    const cachedData = await client.get(redisKey);
    if (cachedData) {
        return res.status(200).json({ user: JSON.parse(cachedData) });
    }

    // Fetch from database if not in cache
    const user = await User.findOne({ username }).select('-password -otp -posts -saved -followers -following -email -dateOfBirth -verified -createdAt -updatedAt -__v');
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Get post count
    const postCount = await Post.countDocuments({ postedBy: user._id });

    // Cache the user data in Redis and return response
    const userData = { ...user.toObject(), postCount };
    await client.set(redisKey, JSON.stringify(userData), { EX: 3600 }); // Cache for 1 hour
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
        res.status(200).json({ message: "User unfollowed successfully" });
    } else {
        // Follow user
        await User.findByIdAndUpdate(userId, { $addToSet: { following: targetUserId } });
        await User.findByIdAndUpdate(targetUserId, { $addToSet: { followers: userId } });
        res.status(200).json({ message: "User followed successfully" });
    }
});