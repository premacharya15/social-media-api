import Post from '../models/postModel.js';
import catchAsync from '../middleware/catchAsync.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  const userId = req.user._id; // User ID from the token
  const userPosts = await Post.find({ postedBy: userId });
  res.status(200).json(userPosts);
});

export { upload };