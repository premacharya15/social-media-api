import mongoose from 'mongoose';

const userSchema = mongoose.Schema({
  username: { type: String, unique: true},
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: false },
  dateOfBirth: { type: Date, required: true },
  password: { type: String, required: true },
  verified: { type: Boolean, default: false },
  otp: { type: String }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;