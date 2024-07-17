import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import { generateOTP, sendOTPEmail } from '../services/otpService.js';
import { generateToken } from '../utils/generateToken.js';
import client from '../utils/redisClient.js';

export const signUp = async (req, res) => {
  const { name, email, phoneNumber, dateOfBirth, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phoneNumber,
      dateOfBirth,
      password: hashedPassword,
      verified: false,
    });

    const otp = generateOTP();
    user.otp = otp;
    await user.save();

    await sendOTPEmail(email, otp);

    const token = generateToken({ userId: user._id }, '1h');

    res.status(201).json({ message: 'User created, OTP sent', token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    let user = await User.findOne({ email });

    if (!user || user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    user.verified = true;
    user.otp = null;

    await user.save();

    res.status(200).json({ message: 'User verified' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resendOTP = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const newOtp = generateOTP();
    user.otp = newOtp;
    await user.save();
    await sendOTPEmail(email, newOtp);

    res.status(200).json({ message: "OTP resent" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    let cachedUser = await client.get(email); // Use Redis to get the cached user
    let user;

    if (cachedUser) {
      cachedUser = JSON.parse(cachedUser);
      const dbUser = await User.findOne({ email });
      if (!dbUser) {
        return res.status(400).json({ message: 'User not exists' });
      }

      // Ensure both cache and database have the same verified status
      if (cachedUser.verified && dbUser.verified) {
        user = dbUser; // Use the verified user from the database
      } else {
        // Handle discrepancy or unverified status
        const otp = generateOTP();
        dbUser.otp = otp;
        await dbUser.save();
        await sendOTPEmail(email, otp);
        await client.set(email, JSON.stringify(dbUser), { EX: 3600 });
        const token = generateToken({ userId: dbUser._id }, '1h');
        return res.status(400).json({ message: 'User not verified. OTP resent.', token });
      }
    } else {
      user = await User.findOne({ email });
      if (user) {
        await client.set(email, JSON.stringify(user), { EX: 3600 }); // Cache the user
      } else {
        return res.status(400).json({ message: 'User not exists' });
      }
    }

    // Proceed with password check and login
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken({ userId: user._id }, '1d');
    res.status(200).json({ token, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};