interface PasswordResetTemplateParams {
  resetUrl: string;
  expiresInMinutes: number;
}

export const passwordResetTemplate = ({
  resetUrl,
  expiresInMinutes,
}: PasswordResetTemplateParams): string => `
  <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; max-width: 560px;">
    <h2 style="color: #007BFF;">Reset your Chapter Admin password</h2>
    <p>We received a request to reset the password for your Chapter admin account.</p>
    <p>
      <a href="${resetUrl}" style="display:inline-block;background:#007BFF;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;">
        Reset password
      </a>
    </p>
    <p style="color:#666;font-size:13px;">If the button doesn't work, paste this link into your browser:<br><span style="word-break:break-all;">${resetUrl}</span></p>
    <p style="color:#666;font-size:13px;">This link expires in ${expiresInMinutes} minutes.</p>
    <p style="color:#666;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
    <p>Best regards,<br>The Chapter Team</p>
  </div>
`;
