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
    let user = await client.get(email); // Use Redis to get the cached user
    if (user) {
      user = JSON.parse(user);
      // Check if the user is verified in the cache
      if (!user.verified) {
        // Fetch the user from the database to confirm verification status
        const dbUser = await User.findOne({ email });
        if (dbUser && !dbUser.verified) {
          // If the user is still not verified in the database, resend OTP
          const otp = generateOTP();
          dbUser.otp = otp;
          await dbUser.save();
          await sendOTPEmail(email, otp);
          const token = generateToken({ userId: dbUser._id }, '1h');
          return res.status(400).json({ message: 'User not verified. OTP resent.', token });
        }
        user = dbUser; // Update the user object to the one from the database
      }
    } else {
      user = await User.findOne({ email });
      if (user) {
        await client.set(email, JSON.stringify(user), { EX: 3600 }); // Cache the user
      }
    }

    if (!user) {
      return res.status(400).json({ message: 'User not exists' });
    }

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