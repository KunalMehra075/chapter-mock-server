import mongoose, { Document, Schema } from "mongoose";

export interface IBottleMessageUser extends Document {
  email: string;
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const bottleMessageUserSchema = new Schema<IBottleMessageUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

const BottleMessageUsers = mongoose.model<IBottleMessageUser>(
  "BottleMessageUsers",
  bottleMessageUserSchema
);

export default BottleMessageUsers;
