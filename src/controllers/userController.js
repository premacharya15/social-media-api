import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import User from '../models/userModel.js';
import catchAsync from '../middleware/catchAsync.js';
import client from '../utils/redisClient.js';


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
    // Attempt to retrieve user data from Redis cache
    const cachedUser = await client.get(`user_${req.user._id}`);
    let user = cachedUser ? JSON.parse(cachedUser) : null;

    // If user data is not in Redis, retrieve from database
    if (!user) {
        user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Cache the user data in Redis for future requests
        await client.set(`user_${user._id}`, JSON.stringify(user), { EX: 3600 }); // Cache for 1 hour
    }

    res.status(200).json(user);
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
  const user = await User.findById(req.user._id);
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

  // Update the user data in Redis cache
  const userDataToCache = {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    bio: user.bio,
    website: user.website,
    avatar: user.avatar
  };
  await client.set(`user_${user._id}`, JSON.stringify(userDataToCache), { EX: 3600 }); // Cache for 1 hour

  await user.save();
//   console.log('Updated user data:', user);
  res.status(200).json({ message: 'Profile updated successfully!', user });
});

export { upload };