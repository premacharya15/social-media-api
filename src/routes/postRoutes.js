import express from 'express';
import { createPost, upload, getAllPosts, getUserPosts } from '../controllers/postController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/all', protect, getAllPosts);
router.get('/user-posts', protect, getUserPosts);
router.post('/new', protect, upload.single('image'), createPost);

export default router;