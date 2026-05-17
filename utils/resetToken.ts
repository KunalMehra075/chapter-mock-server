import crypto from "crypto";

export interface ResetTokenPair {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

export const generateResetToken = (): ResetTokenPair => {
  const ttlMin = parseInt(process.env.RESET_TOKEN_TTL_MIN || "10", 10);
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);
  return { rawToken, tokenHash, expiresAt };
};

export const hashResetToken = (rawToken: string): string =>
  crypto.createHash("sha256").update(rawToken).digest("hex");
