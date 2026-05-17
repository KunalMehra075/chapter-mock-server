import mongoose, { Document, Schema } from "mongoose";

export interface IWaitlistUser extends Document {
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const waitlistSchema = new Schema<IWaitlistUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const WaitlistUsers = mongoose.model<IWaitlistUser>(
  "WaitlistUsers",
  waitlistSchema
);

export default WaitlistUsers;
