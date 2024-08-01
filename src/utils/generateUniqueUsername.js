import User from '../models/userModel.js';

export const generateUniqueUsername = async (baseUsername) => {
    let attempts = 0;
    let username = baseUsername;
    const getRandomNumber = () => Math.floor(Math.random() * 1000);
    const getRandomChar = () => Math.random() < 0.5 ? '_' : '.';

    while (await User.findOne({ username }) && attempts < 10) {
        username = `${baseUsername}${getRandomChar()}${getRandomNumber()}`;
        attempts++;
    }

    return username;
};