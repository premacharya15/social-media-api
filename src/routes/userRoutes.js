import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { updateUsername, getUsernameSuggestions } from '../controllers/userController.js';

const router = express.Router();

router.put('/username', protect, updateUsername);
router.get('/username-suggestions', protect, getUsernameSuggestions);

export default router;