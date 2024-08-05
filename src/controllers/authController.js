import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import { generateOTP, sendOTPEmail } from '../services/mailService.js';
import { generateToken } from '../utils/generateToken.js';
import client from '../utils/redisClient.js';
import catchAsync from '../middleware/catchAsync.js';
import { generateUniqueUsername } from '../utils/generateUniqueUsername.js';

export const signUp = catchAsync (async (req, res) => {
  const { name, email, phoneNumber, dateOfBirth, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a unique username based on the name
    const baseUsername = name.trim().toLowerCase().replace(/\s+/g, '_');
    const uniqueUsername = await generateUniqueUsername(baseUsername); // Ensure this function handles null or empty baseUsername gracefully

    const user = await User.create({
      name,
      username: uniqueUsername,
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
    console.log(`otp: ${otp}`);
    console.log(' ');
    res.status(201).json({ message: 'User created, OTP sent!', token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export const verifyOTP = catchAsync (async (req, res) => {
  const { email, otp } = req.body;

  try {
    let user = await User.findOne({ email });

    if (!user || user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP!' });
    }

    user.verified = true;
    user.otp = null;
    await user.save();

    const token = generateToken({ userId: user._id }, '1h');
    
    res.status(200).json({ message: 'User verified!', username: user.username, token});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export const resendOTP = catchAsync (async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found!" });
    }

    const newOtp = generateOTP();
    user.otp = newOtp;
    await user.save();
    await sendOTPEmail(email, newOtp, "OTP Resend", "Here is your OTP to verify your email address");

    res.status(200).json({ message: "OTP resent!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export const login = catchAsync (async (req, res) => {
  const { email, password } = req.body;

  try {

    const cachedUser = await client.get(email);
    let user = cachedUser ? JSON.parse(cachedUser) : null;

    // If not in Redis, retrieve from database and check if user exists
    if (!user) {
      user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'User does not exist!' });
      }
    }

    // Check if user is verified
    if (!user.verified) {
      const otp = generateOTP();
      user.otp = otp;
      await user.save();
      await sendOTPEmail(email, otp);
      const token = generateToken({ userId: user._id }, '1h');
      return res.status(400).json({ message: 'User not verified. OTP resent.', token });
    }

    // Proceed with password check and login
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials!' });
    }

    const token = generateToken({ userId: user._id }, '1m');

    // Store user data in Redis cache if it was not already cached
    if (!cachedUser) {
      await client.set(email, JSON.stringify(user), { EX: 432000 }); // Expires in 5 days
    }

    res.status(200).json({ token, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export const forgotPassword = catchAsync (async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    const otp = generateOTP();
    user.otp = otp;
    await user.save();
    await sendOTPEmail(email, otp, "Password Reset OTP", "Here is your OTP to reset your password");

    // Set a temporary flag in Redis to verify OTP before allowing password reset
    await client.set(`otp_verified_${user._id}`, 'false', { EX: 300 }); // Expires in 5 minutes

    res.status(200).json({ message: "OTP sent to your email address!" });
  } catch (error) {
    res.status(500).json({ message: "Error sending OTP", error: error.message });
  }
});

export const verifyForgotPasswordOTP = catchAsync (async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    const isOtpVerified = await client.get(`otp_verified_${user._id}`);
    if (!isOtpVerified) {
      user.otp = null; // Clear the OTP as it's no longer valid
      await user.save();
      return res.status(400).json({ message: "OTP has expired. please try again." });
    }

    if (user.otp === otp) {
      await client.set(`otp_verified_${user._id}`, 'true', { EX: 300 }); // OTP verified, allow password reset for 5 minutes
      res.status(200).json({ message: "OTP verified!" });
    } else {
      res.status(400).json({ message: "Invalid OTP!" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export const resetPassword = catchAsync (async (req, res) => {
  const { email, password, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    // Check if OTP is verified
    const isOtpVerified = await client.get(`otp_verified_${user._id}`);
    if (!isOtpVerified || isOtpVerified === 'false') {
      return res.status(400).json({ message: 'OTP verification failed or expired!' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    user.otp = null;
    await user.save();

    await client.del(`otp_verified_${user._id}`);

    res.status(200).json({ message: "Password reset successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Invalid or expired token!" });
  }
});

export const verifyToken = catchAsync(async (req, res) => {
  // If the middleware passes, the token is still valid
  const user = req.user; // User is attached to the request in the middleware
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Generate a new token for continued session
  const newToken = generateToken({ userId: user._id }, '1d');

  res.status(200).json({
    message: 'Token is valid!',
    token: newToken
  });
});