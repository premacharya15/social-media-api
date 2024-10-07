import express from 'express';
import { createPost, uploadPostImages, getAllPosts, getUserPosts } from '../controllers/postController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/all', protect, getAllPosts);
router.get('/user-posts', protect, getUserPosts);
router.post('/new', protect, createPost);
router.post('/:postId/upload-images', protect, uploadPostImages);

export default router;