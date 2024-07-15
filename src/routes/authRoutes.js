import express from 'express';
import { signUp, verifyOTP, login } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', signUp);
router.post('/verify', protect, verifyOTP);
router.post('/login', login);

export default router;