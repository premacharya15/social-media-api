import Post from '../models/postModel.js';
import catchAsync from '../middleware/catchAsync.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
    const uploadPath = path.join(__dirname, '..', 'uploads', `user_${req.user._id}`, 'posts');
    ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Use the original file name
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Create New Post
export const createPost = catchAsync(async (req, res) => {
  const { caption } = req.body;
  const postedBy = req.user._id;
  const fullPath = req.file.path;

  // Convert full path to a relative path with backslashes
  const relativePath = path.relative(path.join(__dirname, '..'), fullPath).replace(/\//g, '\\');

  const newPost = await Post.create({
    caption,
    image: relativePath,
    postedBy
  });

  // Invalidate Redis cache for the user's posts
  const redisKeyPattern = `user_posts_${postedBy}_*`;
  const keys = await client.keys(redisKeyPattern); 
  await Promise.all(keys.map(key => client.del(key)));

  // Update post count in user's Redis entry
  const cachedUser = await client.get(`user_${postedBy}`);
  if (cachedUser) {
    const userData = JSON.parse(cachedUser);
    userData.postCount = (userData.postCount) + 1;
    await client.set(`user_${postedBy}`, JSON.stringify(userData), { EX: 3600 });

    // Update user details cache as well
    const username = userData.username;
    const userDetailKey = `user_details_${username}`;
    const cachedUserDetails = await client.get(userDetailKey);
    if (cachedUserDetails) {
      const userDetails = JSON.parse(cachedUserDetails);
      userDetails.postCount = userData.postCount;
      await client.set(userDetailKey, JSON.stringify(userDetails), { EX: 3600 });
    }
  }

  res.status(201).json({
    message: 'Post created successfully!'
  });
});


// Get All Posts
export const getAllPosts = catchAsync(async (req, res) => {
  const posts = await Post.find({}).populate('postedBy', 'name');
  res.status(200).json(posts);
});


// Get All Posts by users
export const getUserPosts = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Redis key to store cached data
  const redisKey = `user_posts_${userId}_page_${page}`;

  // Try to fetch data from Redis first
  const cachedPosts = await client.get(redisKey);

  if (cachedPosts) {
    // If data is found in Redis, return it
    return res.status(200).json(JSON.parse(cachedPosts));
  }

  // If not in Redis, fetch from database
  const userPosts = await Post.find({ postedBy: userId })
                              .skip(skip)
                              .limit(limit)
                              .populate('postedBy', 'name');

  // Cache the result in Redis
  await client.set(redisKey, JSON.stringify(userPosts), { EX: 3600 }); // Cache for 1 hour

  res.status(200).json(userPosts);
});

export { upload };