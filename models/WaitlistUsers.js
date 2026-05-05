import mongoose from 'mongoose';

const waitlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  }
}, { timestamps: true });

const WaitlistUsers = mongoose.model('WaitlistUsers', waitlistSchema);

export default WaitlistUsers;

