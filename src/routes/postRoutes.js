import express from 'express';
import { createPost, uploadPostImages, getAllPosts, getUserPosts, getPostDetails, likeUnlikePost, saveUnsavePost } from '../controllers/postController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/all', protect, getAllPosts); // get all posts
router.get('/user-posts', protect, getUserPosts); // get logged in user's posts
router.post('/new', protect, createPost); // create a new post
router.post('/upload/:postId', protect, uploadPostImages); // upload images for a post
router.get('/detail/:id', protect, getPostDetails); // get post details by ID
router.route('/:id')
    .get(protect, likeUnlikePost) // like or unlike a post
    .post(protect, saveUnsavePost); // save or unsave a post

export default router;