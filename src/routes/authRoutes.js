import express from 'express';
import { signUp, verifyOTP, login, resendOTP } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/signup', signUp);
router.post('/verify', protect, verifyOTP);
router.post('/resend-otp', resendOTP);

export default router;