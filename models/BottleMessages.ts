import mongoose, { Document, Schema, Types } from "mongoose";
import crypto from "crypto";

export interface IBottleMessage extends Document {
  content: string;
  senderEmail: string;
  recipientEmail: string | null;
  senderUserId: Types.ObjectId;
  recipientUserId: Types.ObjectId | null;
  isDraft: boolean;
  shareableToken: string;
  acknowledgedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bottleMessageSchema = new Schema<IBottleMessage>(
  {
    content: {
      type: String,
      required: true,
    },
    senderEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    recipientEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    senderUserId: {
      type: Schema.Types.ObjectId,
      ref: "BottleMessageUsers",
      required: true,
    },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: "BottleMessageUsers",
      default: null,
    },
    isDraft: {
      type: Boolean,
      default: false,
    },
    shareableToken: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(16).toString("hex"),
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

bottleMessageSchema.index({ senderEmail: 1, isDraft: 1, createdAt: -1 });
bottleMessageSchema.index({ recipientEmail: 1, createdAt: -1 });

const BottleMessages = mongoose.model<IBottleMessage>(
  "BottleMessages",
  bottleMessageSchema
);

export default BottleMessages;
