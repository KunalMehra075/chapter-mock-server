import mongoose, { Document, Schema } from "mongoose";
import { ROLES, Role } from "../constants/roles.js";

export interface IChapterAdmin extends Document {
  name: string;
  email: string;
  password: string;
  phone: string | null;
  address: string | null;
  role: Role;
  access: string[];
  inviteExpiresAt: Date | null;
  mustChangePassword: boolean;
  resetTokenHash: string | null;
  resetTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const chapterAdminSchema = new Schema<IChapterAdmin>(
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
    password: {
      type: String,
      required: true,
      select: false,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    address: {
      type: String,
      default: null,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    access: {
      type: [String],
      default: [],
    },
    inviteExpiresAt: {
      type: Date,
      default: null,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    resetTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    resetTokenExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

const ChapterAdmins = mongoose.model<IChapterAdmin>(
  "ChapterAdmins",
  chapterAdminSchema
);

export default ChapterAdmins;
