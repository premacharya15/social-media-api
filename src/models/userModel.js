import mongoose from 'mongoose';

const userSchema = mongoose.Schema({
  username: { type: String, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  dateOfBirth: { type: Date, required: true },
  password: { type: String, required: true },
  verified: { type: Boolean, default: false },
  bio: { type: String, required: false, default: null },
  website: { type: String, required: false, default: null },
  avatar: { type: String, required: false }, // URL to the avatar image
  otp: { type: String },
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  saved: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;