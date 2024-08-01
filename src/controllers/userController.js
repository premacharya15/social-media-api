import User from '../models/userModel.js';
import catchAsync from '../middleware/catchAsync.js';

export const updateUsername = catchAsync(async (req, res) => {
    const { username } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (username === user.username) {
        return res.status(200).json({ message: 'No change in username.' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {

        // console.log(`Requested username '${username}' is already taken. Generating suggestions...`);
        return getUsernameSuggestions(req, res, username); // Pass the attempted username for clarity
    }

    // Update username and clear Redis entry
    user.username = username;
    await user.save();
    res.status(200).json({ message: 'Username updated successfully!' });
});

export const getUsernameSuggestions = catchAsync(async (req, res, attemptedUsername) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ message: 'User not found!' });
    }

    const baseUsername = (typeof attemptedUsername === 'string' ? attemptedUsername : user.username).toLowerCase().replace(/\s+/g, '_');
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
    // console.log(`Username already taken, Suggestions: ${suggestions}`);
    res.status(409).json({ message: 'Username already taken!', suggestions });
});