import mongoose, { Document, Schema } from "mongoose";

export interface IRevokedToken extends Document {
  jti: string;
  expiresAt: Date;
}

const revokedTokenSchema = new Schema<IRevokedToken>(
  {
    jti: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

const RevokedTokens = mongoose.model<IRevokedToken>(
  "RevokedTokens",
  revokedTokenSchema
);

export default RevokedTokens;
