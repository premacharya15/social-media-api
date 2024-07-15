import jwt from 'jsonwebtoken';

export const generateToken = (payload, expiresIn = '1h') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

export const generateTokenAndSetCookie = (payload, res, expiresIn = '15d') => {
  const token = generateToken(payload, expiresIn);

  res.cookie('jwt', token, {
    maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV !== 'development',
  });

  return token;
};