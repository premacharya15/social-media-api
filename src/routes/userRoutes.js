import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { updateUsername, getUsernameSuggestions, getAccountDetails, deleteProfile, updateProfile, logoutUser, discoverPeople, getUserDetails, followUser, searchUsers } from '../controllers/userController.js';
import upload from '../utils/uploadImages.js';

const router = express.Router();

router.put('/update-username', protect, updateUsername); // update username
router.get('/username-suggestions', protect, getUsernameSuggestions); // get username suggestions
router.get('/logout', protect, logoutUser); // logout user
router.get('/discover', protect, discoverPeople); // discover people

router.route('/me')
    .get(protect, getAccountDetails) // get account details 
    .put(protect, upload.single('avatar'), updateProfile) // update profile
    .delete(protect, deleteProfile); // delete profile

router.get('/search', protect, searchUsers); // search users

router.get('/:username', protect, getUserDetails); // get user details by username

router.get('/follow/:id', protect, followUser); // follow user  

export default router;