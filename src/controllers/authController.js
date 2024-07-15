import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import { generateOTP, sendOTPEmail } from '../services/otpService.js';
import { generateToken } from '../utils/generateToken.js';

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

    const token = generateToken({ userId: user._id }, '10m');

    res.status(201).json({ message: 'User created, OTP sent', token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });

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

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'User not exists' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.verified) {
      // Generate a new OTP
      const otp = generateOTP();
      user.otp = otp;
      await user.save();

      // Resend the OTP email
      await sendOTPEmail(email, otp);

      const token = generateToken({ userId: user._id }, '10m');

      return res.status(400).json({ message: 'User not verified. OTP resent.', token });
    }

    const token = generateToken({ userId: user._id }, '1h');

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      dateOfBirth: user.dateOfBirth,
      verified: user.verified
    };

    res.status(200).json({ token, user: userData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};