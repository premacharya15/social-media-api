import express from 'express';
import { createPost, uploadPostImages, getAllPosts, getUserPosts } from '../controllers/postController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/all', protect, getAllPosts); // get all posts
router.get('/user-posts', protect, getUserPosts); // get user's posts
router.post('/new', protect, createPost); // create a new post
router.post('/:postId', protect, uploadPostImages); // upload images for a post

export default router;