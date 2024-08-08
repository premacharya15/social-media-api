import User from '../models/userModel.js';
import catchAsync from '../middleware/catchAsync.js';
import client from '../utils/redisClient.js'; // Ensure you have this import if not already present

export const getAccountDetails = catchAsync(async (req, res) => {
    // Attempt to retrieve user data from Redis cache
    const cachedUser = await client.get(`user_${req.user._id}`);
    let user = cachedUser ? JSON.parse(cachedUser) : null;

    // If user data is not in Redis, retrieve from database
    if (!user) {
        user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Cache the user data in Redis for future requests
        await client.set(`user_${user._id}`, JSON.stringify(user), { EX: 3600 }); // Cache for 1 hour
    }

    res.status(200).json(user);
});

export const deleteProfile = catchAsync(async (req, res) => {
    const user = await User.findByIdAndDelete(req.user._id);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Delete the user's data from Redis cache
    await client.del(user.email);
    await client.del(`user_${user._id}`);

    res.status(200).json({ message: 'Profile deleted successfully' });
});

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
        return getUsernameSuggestions(req, res, username);
    }

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