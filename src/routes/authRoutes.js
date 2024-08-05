import express from 'express';
import { signUp, verifyOTP, login, resendOTP, forgotPassword, resetPassword, verifyForgotPasswordOTP, verifyToken } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/signup', signUp);
router.post('/verify', protect, verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/forgot-password', forgotPassword);
router.post('/verify-forgot-password-otp', verifyForgotPasswordOTP);
router.post('/reset-password', resetPassword);
router.get('/verify-token', protect, verifyToken);

export default router;