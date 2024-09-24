import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import { generateOTP, sendOTPEmail } from '../services/mailService.js';
import { generateToken } from '../utils/generateToken.js';
import client, { isRedisConnected } from '../utils/redisClient.js';
import catchAsync from '../middleware/catchAsync.js';
import { generateUniqueUsername } from '../utils/generateUniqueUsername.js';


// SignUp 
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

    // Send OTP email asynchronously to avoid blocking the response
    sendOTPEmail(email, otp)
      .then(() => {
        console.log(`otp: ${otp}`);
        console.log(' ');
      })
      .catch((error) => {
        console.error('Error sending OTP email:', error);
      });

    const token = generateToken({ userId: user._id }, '1h');
    res.status(201).json({ message: 'User created, OTP sent!', token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Verify OTP 
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
    
    res.status(200).json({ message: 'User verified!', token});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Resend OTP
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

    // Send OTP email asynchronously to avoid blocking the response
    sendOTPEmail(email, newOtp, "OTP Resend", "Here is your OTP to verify your email address")
      .then(() => {
        console.log(`resendotp: ${newOtp}`);
        console.log(' ');
      })
      .catch((error) => {
        console.error('Error sending OTP email:', error);
      });

    res.status(200).json({ message: "OTP resent!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Login 
export const login = catchAsync (async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = null;
    const redisConnected = await isRedisConnected();

    if (redisConnected) {
      const cachedUser = await client.get(email);
      user = cachedUser ? JSON.parse(cachedUser) : null;
    }

    // If not in Redis or Redis is not connected, retrieve from database
    if (!user) {
      user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(404).json({ message: 'User does not exist!' });
      }
    }

    // Check if user is verified
    if (!user.verified) {
      const otp = generateOTP();
      user.otp = otp;
      await user.save();
      await sendOTPEmail(email, otp);
      const token = generateToken({ userId: user._id }, '2h');
      return res.status(400).json({ message: 'User not verified. OTP resent.', token });
    }

    // Proceed with password check and login
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials!' });
    }

    const token = generateToken({ userId: user._id }, '2d'); // Expires in 2 days

    // Store user data in Redis cache if Redis is connected and user was not already cached
    if (redisConnected && !user.cachedUser) {
      await client.set(email, JSON.stringify(user), { EX: 432000 }); // Expires in 5 days
    }

    res.status(200).json({ message: 'Login successful!', token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Forgot Password
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
    if (await isRedisConnected()) {
      await client.set(`otp_verified_${user._id}`, 'false', { EX: 300 }); // Expires in 5 minutes
    }

    res.status(200).json({ message: "OTP sent to your email address!" });
  } catch (error) {
    res.status(500).json({ message: "Error sending OTP", error: error.message });
  }
});


// Verify Forgot Password OTP
export const verifyForgotPasswordOTP = catchAsync (async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    let isOtpVerified = false;
    if (await isRedisConnected()) {
      isOtpVerified = await client.get(`otp_verified_${user._id}`);
    }
    if (!isOtpVerified) {
      user.otp = null; // Clear the OTP as it's no longer valid
      await user.save();
      return res.status(400).json({ message: "OTP has expired. please try again." });
    }

    if (user.otp === otp) {
      if (await isRedisConnected()) {
        await client.set(`otp_verified_${user._id}`, 'true', { EX: 300 }); // OTP verified, allow password reset for 5 minutes
      }
      res.status(200).json({ message: "OTP verified!" });
    } else {
      res.status(400).json({ message: "Invalid OTP!" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Reset Password
export const resetPassword = catchAsync (async (req, res) => {
  const { email, password, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    // Check if Redis is connected before performing cache operations
    if (await isRedisConnected()) {
      // Check if OTP is verified
      const isOtpVerified = await client.get(`otp_verified_${user._id}`);
      if (!isOtpVerified || isOtpVerified === 'false') {
        return res.status(400).json({ message: 'OTP verification failed or expired!' });
      }
    } else {
      return res.status(500).json({ message: "Redis connection error" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    user.otp = null;
    await user.save();

    if (await isRedisConnected()) {
      await client.del(`otp_verified_${user._id}`);
    }

    res.status(200).json({ message: "Password reset successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Invalid or expired token!" });
  }
});


// Verify Token
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