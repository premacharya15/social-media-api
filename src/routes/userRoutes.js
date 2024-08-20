import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { updateUsername, getUsernameSuggestions, getAccountDetails, deleteProfile, updateProfile, upload, logoutUser } from '../controllers/userController.js';

const router = express.Router();

router.put('/update-username', protect, updateUsername);
router.get('/username-suggestions', protect, getUsernameSuggestions);
router.get('/logout', protect, logoutUser);

router.route('/me')
    .get(protect, getAccountDetails)
    .put(protect, upload.single('avatar'), updateProfile)
    .delete(protect, deleteProfile);

export default router;