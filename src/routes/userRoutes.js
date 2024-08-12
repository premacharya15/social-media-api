import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { updateUsername, getUsernameSuggestions, getAccountDetails, deleteProfile, updateProfile, upload } from '../controllers/userController.js';

const router = express.Router();

router.put('/update-username', protect, updateUsername);
router.get('/username-suggestions', protect, getUsernameSuggestions);

router.route('/me')
    .get(protect, getAccountDetails)
    .put(protect, upload.single('avatar'), updateProfile)
    .delete(protect, deleteProfile);

export default router;