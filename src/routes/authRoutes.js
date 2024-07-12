import express from 'express';
import { signUp, verifyOTP, login } from '../controllers/authController.js';

const router = express.Router();

router.post('/signup', signUp);
router.post('/verify', verifyOTP);
router.post('/login', login);

export default router;
