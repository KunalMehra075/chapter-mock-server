import mongoose, { Document, Schema, Types } from "mongoose";
import { ROLES } from "../constants/roles.js";

export type AdminGroupRole = typeof ROLES.OPERATOR | typeof ROLES.PARTNER;

export interface IAdminGroup extends Document {
  name: string;
  role: AdminGroupRole;
  tags: string[];
  access: string[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const adminGroupSchema = new Schema<IAdminGroup>(
  {
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: [ROLES.OPERATOR, ROLES.PARTNER],
      required: true,
    },
    tags: { type: [String], default: [] },
    access: { type: [String], default: [] },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "ChapterAdmins",
      required: true,
    },
  },
  { timestamps: true }
);

adminGroupSchema.index({ name: 1, role: 1 }, { unique: true });

const AdminGroups = mongoose.model<IAdminGroup>(
  "AdminGroups",
  adminGroupSchema
);

export default AdminGroups;
