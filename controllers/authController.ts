import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import ChapterAdmins from "../models/ChapterAdmins.js";
import RevokedTokens from "../models/RevokedTokens.js";
import {
  signAccessToken,
  signRefreshToken,
  signFirstLoginToken,
  verifyRefreshToken,
  verifyFirstLoginToken,
} from "../utils/jwt.js";
import { generateResetToken, hashResetToken } from "../utils/resetToken.js";
import {
  sendEmail,
  passwordResetTemplate,
} from "../email/index.js";

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
const MIN_PASSWORD_LENGTH = 8;
const RESET_TOKEN_TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MIN || "10", 10);

const issueSession = (user: {
  id: string;
  email: string;
  role: "operator" | "superuser" | "admin";
}) => {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = signRefreshToken({
    sub: user.id,
    jti: crypto.randomUUID(),
  });
  return { accessToken, refreshToken };
};

const isStrongEnough = (password: string): boolean =>
  typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const user = await ChapterAdmins.findOne({ email: email.toLowerCase().trim() })
      .select("+password");
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const matched = await bcrypt.compare(password, user.password);
    if (!matched) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (user.mustChangePassword) {
      if (user.inviteExpiresAt && user.inviteExpiresAt.getTime() < Date.now()) {
        res.status(410).json({
          error: "Invitation expired. Please contact an administrator to resend.",
        });
        return;
      }

      const firstLoginToken = signFirstLoginToken({ sub: String(user._id) });
      res.json({
        mustChangePassword: true,
        firstLoginToken,
        user: { email: user.email, role: user.role },
      });
      return;
    }

    const tokens = issueSession({
      id: String(user._id),
      email: user.email,
      role: user.role,
    });
    res.json({
      ...tokens,
      user: { email: user.email, role: user.role, access: user.access },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const completeInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstLoginToken, newPassword } = req.body as {
      firstLoginToken?: string;
      newPassword?: string;
    };
    if (!firstLoginToken || !newPassword) {
      res.status(400).json({ error: "firstLoginToken and newPassword are required" });
      return;
    }
    if (!isStrongEnough(newPassword)) {
      res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
      return;
    }

    let payload;
    try {
      payload = verifyFirstLoginToken(firstLoginToken);
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const user = await ChapterAdmins.findById(payload.sub);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!user.mustChangePassword) {
      res.status(400).json({ error: "Account is already activated" });
      return;
    }

    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.mustChangePassword = false;
    user.inviteExpiresAt = null;
    await user.save();

    const tokens = issueSession({
      id: String(user._id),
      email: user.email,
      role: user.role,
    });
    res.json({
      ...tokens,
      user: { email: user.email, role: user.role, access: user.access },
    });
  } catch (error) {
    console.error("Error completing invite:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: "refreshToken is required" });
      return;
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    const revoked = await RevokedTokens.findOne({ jti: payload.jti });
    if (revoked) {
      res.status(401).json({ error: "Refresh token has been revoked" });
      return;
    }

    const user = await ChapterAdmins.findById(payload.sub);
    if (!user) {
      res.status(401).json({ error: "User no longer exists" });
      return;
    }
    if (user.mustChangePassword) {
      res.status(403).json({ error: "Password change required" });
      return;
    }

    const tokens = issueSession({
      id: String(user._id),
      email: user.email,
      role: user.role,
    });
    res.json(tokens);
  } catch (error) {
    console.error("Error refreshing token:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: "refreshToken is required" });
      return;
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      res.json({ message: "Logged out" });
      return;
    }

    const expiresAt = new Date(((payload as { exp?: number }).exp ?? 0) * 1000);
    await RevokedTokens.updateOne(
      { jti: payload.jti },
      { jti: payload.jti, expiresAt: isNaN(expiresAt.getTime()) ? new Date() : expiresAt },
      { upsert: true }
    );
    res.json({ message: "Logged out" });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const user = await ChapterAdmins.findById(req.user.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      data: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        access: user.access,
      },
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const requestPasswordReset = async (
  req: Request,
  res: Response
): Promise<void> => {
  const generic = { message: "If the email exists, a reset link has been sent." };
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const user = await ChapterAdmins.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.mustChangePassword) {
      res.json(generic);
      return;
    }

    const { rawToken, tokenHash, expiresAt } = generateResetToken();
    user.resetTokenHash = tokenHash;
    user.resetTokenExpiresAt = expiresAt;
    await user.save();

    const frontendUrl = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your Chapter Admin password",
      html: passwordResetTemplate({
        resetUrl,
        expiresInMinutes: RESET_TOKEN_TTL_MIN,
      }),
    });

    res.json(generic);
  } catch (error) {
    console.error("Error requesting password reset:", error);
    res.json(generic);
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body as {
      token?: string;
      newPassword?: string;
    };
    if (!token || !newPassword) {
      res.status(400).json({ error: "token and newPassword are required" });
      return;
    }
    if (!isStrongEnough(newPassword)) {
      res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
      return;
    }

    const tokenHash = hashResetToken(token);
    const user = await ChapterAdmins.findOne({
      resetTokenHash: tokenHash,
    }).select("+resetTokenHash +resetTokenExpiresAt");

    if (
      !user ||
      !user.resetTokenExpiresAt ||
      user.resetTokenExpiresAt.getTime() < Date.now()
    ) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }

    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    await user.save();

    res.json({ message: "Password updated. You can now sign in." });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Server error" });
  }
};
