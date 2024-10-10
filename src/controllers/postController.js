import Post from '../models/postModel.js';
import catchAsync from '../middleware/catchAsync.js';
import User from '../models/userModel.js';
import upload from '../utils/uploadImages.js';
import multer from 'multer';
import client, { isRedisConnected } from '../utils/redisClient.js';


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

  // Delete Redis entries after successful post creation
  if (await isRedisConnected()) {
    const deletePromises = [
      client.del(`user_${postedBy}`),
      client.keys(`user_${postedBy}_allPosts_page_*`).then(keys => {
        if (keys.length > 0) return client.del(keys);
      }),
      client.keys(`user_${postedBy}_userPosts_page_*`).then(keys => {
        if (keys.length > 0) return client.del(keys);
      })
    ];
    
    await Promise.all(deletePromises).catch(console.error);
  }
});


// Upload multiple images for a post
export const uploadPostImages = catchAsync(async (req, res) => {
  const postId = req.params.postId;
  const maxImages = 3;
  const uploadMultiple = upload.array('images', maxImages);

  uploadMultiple(req, res, async function(err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: `Too many images. Maximum allowed is ${maxImages}.` });
      } else if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size limit exceeded. Maximum allowed is 5MB per image.' });
      }
      // Other Multer errors
      return res.status(400).json({ message: err.message });
    } else if (err) {
      // An unknown error occurred when uploading.
      return res.status(500).json({ message: err.message });
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
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const cacheKey = `user_${userId}_allPosts_page_${page}`;

  // Check if Redis is connected
  const redisConnected = await isRedisConnected();

  if (redisConnected) {
    const cachedResults = await client.get(cacheKey);
    if (cachedResults) {
      return res.status(200).json(JSON.parse(cachedResults));
    }
  }

  const totalCount = await Post.countDocuments();
  const totalPages = Math.ceil(totalCount / limit);

  const posts = await Post.find({})
    .populate('postedBy', 'name')
    .skip(skip)
    .limit(limit)
    .lean();

  if (posts.length === 0) {
    return res.status(404).json({ message: "No posts found" });
  }

  const responseData = {
    posts,
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


// Get All Posts by users
export const getUserPosts = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const cacheKey = `user_${userId}_userPosts_page_${page}`;

  // Check if Redis is connected
  const redisConnected = await isRedisConnected();

  if (redisConnected) {
    const cachedResults = await client.get(cacheKey);
    if (cachedResults) {
      return res.status(200).json(JSON.parse(cachedResults));
    }
  }

  const totalCount = await Post.countDocuments({ postedBy: userId });
  const totalPages = Math.ceil(totalCount / limit);

  const userPosts = await Post.find({ postedBy: userId })
    .populate('postedBy', 'name')
    .skip(skip)
    .limit(limit)
    .lean();

  if (userPosts.length === 0) {
    return res.status(404).json({ message: "No posts found" });
  }

  const responseData = {
    posts: userPosts,
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

export { upload };


// Get Post Details by ID
export const getPostDetails = catchAsync(async (req, res) => {
    const postId = req.params.id;
    const cacheKey = `post_${postId}`;

    // Check if Redis is connected and try to get cached data
    const cachedPost = await isRedisConnected() && await client.get(cacheKey).catch(() => null);
    if (cachedPost) {
        return res.status(200).json(JSON.parse(cachedPost));
    }

    const post = await Post.findById(postId)
        .select('id caption createdAt likes savedBy comments postedBy')
        .populate('postedBy', 'id name username')
        .lean();

    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    const postDetails = {
        ...post,
        likes: post.likes?.length || 0,
        savedBy: post.savedBy?.length || 0,
        comments: {
            _id: post._id,
            comments: post.comments || []
        }
    };

    // Cache the post details asynchronously
    if (await isRedisConnected()) {
        client.set(cacheKey, JSON.stringify(postDetails), { EX: 3600 }).catch(() => {});
    }

    res.status(200).json(postDetails);
});