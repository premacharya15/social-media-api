import jwt from 'jsonwebtoken';
import User from '../models/userModel.js'

export const protect = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header is missing' });
  }

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    const token = parts[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id)
      next();
    } catch (error) {
      res.status(401).json({ message: 'Token is not valid' });
    }
  } else {
    return res.status(401).json({ message: 'Token format is incorrect' });
  }
};