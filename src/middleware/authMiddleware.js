import jwt from 'jsonwebtoken';
import User from '../models/userModel.js'
import catchAsync from './catchAsync.js';

export const protect = catchAsync(async (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header is missing' });
  }

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    const token = parts[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // console.log('Decoded JWT:', decoded);

      if (!decoded.userId) {
        return res.status(401).json({ message: 'Token does not contain user ID' });
      }
      req.user = await User.findById(decoded.userId);
      if (!req.user) {
        return res.status(404).json({ message: 'User not found' });
      }
      next();
    } catch (error) {
      res.status(401).json({ message: 'Token is not valid' });
    }
  } else {
    return res.status(401).json({ message: 'Token format is incorrect' });
  }
});