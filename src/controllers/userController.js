import User from '../models/userModel.js';
import { generateToken } from '../utils/generateToken.js';
import catchAsync from '../middleware/catchAsync.js';

export const updateUsername = catchAsync(async (req, res) => {
    const { username } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Check if the new username is already taken
    const existingUser = await User.findOne({ username });
    if (existingUser) {
        return res.status(400).json({ message: 'Username is already taken' });
    }

    user.username = username;
    await user.save();
    res.status(200).json({ message: 'Username updated successfully' });
});

export const getUsernameSuggestions = catchAsync(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    const baseUsername = user.name.toLowerCase().replace(/\s+/g, '_');
    const suggestions = [];
    let attempts = 0;

    while (suggestions.length < 3 && attempts < 10) {
        const potentialUsername = `${baseUsername}_${Math.floor(Math.random() * 1000)}`;
        const existingUser = await User.findOne({ username: potentialUsername });
        if (!existingUser) {
            suggestions.push(potentialUsername);
        }
        attempts++;
    }

    if (suggestions.length < 3) {
        return res.status(500).json({ message: 'Unable to generate unique username suggestions at this time.' });
    }

    res.status(200).json({ suggestions });
});