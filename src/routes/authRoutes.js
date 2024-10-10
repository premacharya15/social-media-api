import express from 'express';
import { signUp, verifyOTP, login, resendOTP, forgotPassword, resetPassword, verifyForgotPasswordOTP, verifyToken } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', login); // login
router.post('/signup', signUp); // signup
router.post('/verify', protect, verifyOTP); // verify OTP
router.post('/resend-otp', resendOTP); // resend OTP
router.post('/forgot-password', forgotPassword); // forgot password
router.post('/verify-forgot-password-otp', verifyForgotPasswordOTP); // verify forgot password OTP
router.post('/reset-password', protect, resetPassword); // reset password
router.get('/verify-token', protect, verifyToken); // verify token

export default router;