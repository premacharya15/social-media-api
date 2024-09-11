import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { updateUsername, getUsernameSuggestions, getAccountDetails, deleteProfile, updateProfile, upload, logoutUser, discoverPeople, getUserDetails, followUser, searchUsers } from '../controllers/userController.js';

const router = express.Router();

router.put('/update-username', protect, updateUsername);
router.get('/username-suggestions', protect, getUsernameSuggestions);
router.get('/logout', protect, logoutUser);
router.get('/discover', protect, discoverPeople);

router.route('/me')
    .get(protect, getAccountDetails)
    .put(protect, upload.single('avatar'), updateProfile)
    .delete(protect, deleteProfile);

router.get('/search', protect, searchUsers);

router.get('/:username', protect, getUserDetails);

router.get('/follow/:id', protect, followUser);

export default router;