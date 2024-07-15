import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateOTP, sendOTPEmail } from '../services/otpService.js';

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

    res.status(201).json({ message: 'User created, OTP sent' });
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
      return res.status(400).json({ message: 'Invalid credentials' });
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

      return res.status(400).json({ message: 'User not verified. OTP resent.' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
