import Post from '../models/postModel.js';
import catchAsync from '../middleware/catchAsync.js';
import User from '../models/userModel.js';
import upload from '../utils/uploadImages.js';
import multer from 'multer';

// Create New Post
export const createPost = catchAsync(async (req, res) => {
  const { caption } = req.body;
  const postedBy = req.user._id;

  const newPost = await Post.create({ caption, postedBy });

  // Add post ID to user's posts array
  await User.findByIdAndUpdate(postedBy, {
    $push: { posts: newPost._id }
  });

  res.status(201).json({
    message: 'Post created successfully!',
    postId: newPost._id,
    userId: postedBy
  });
});

// Upload multiple images for a post
export const uploadPostImages = catchAsync(async (req, res) => {
  const postId = req.params.postId;
  const uploadMultiple = upload.array('images', 3);

  uploadMultiple(req, res, async function(err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      return res.status(400).json({ message: err.message });
    } else if (err) {
      // An unknown error occurred when uploading.
      return res.status(500).json({ message: 'An error occurred while uploading images.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded.' });
    }

    const uploadedFiles = req.files.map(file => file.originalname);

    res.status(200).json({
      message: 'Images uploaded successfully',
      postId,
      uploadedFiles
    });
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

  const userPosts = await Post.find({ postedBy: userId })
                              .skip(skip)
                              .limit(limit)
                              .populate('postedBy', 'name');

  res.status(200).json(userPosts);
});

export { upload };