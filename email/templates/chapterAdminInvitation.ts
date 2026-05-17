import { Role } from "../../constants/roles.js";

interface InvitationTemplateParams {
  name: string;
  email: string;
  tempPassword: string;
  role: Role;
  loginUrl: string;
  expiresInHours: number;
}

const roleLabel = (role: Role): string => {
  if (role === "operator") return "an Operator";
  if (role === "superuser") return "a SuperUser";
  return "an Admin";
};

export const chapterAdminInvitationTemplate = ({
  name,
  email,
  tempPassword,
  role,
  loginUrl,
  expiresInHours,
}: InvitationTemplateParams): string => `
  <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; max-width: 560px;">
    <h2 style="color: #007BFF;">Welcome to Chapter Admin, ${name}</h2>
    <p>You have been invited as ${roleLabel(role)} on the Chapter admin dashboard.</p>
    <p>Use the credentials below to sign in. You will be required to set your own password on first login.</p>
    <div style="background:#f5f7fa;border:1px solid #e1e5ea;border-radius:6px;padding:16px;margin:16px 0;font-family:Menlo,Consolas,monospace;font-size:14px;">
      <div><strong>Email:</strong> ${email}</div>
      <div><strong>Initial password:</strong> ${tempPassword}</div>
    </div>
    <p>
      <a href="${loginUrl}" style="display:inline-block;background:#007BFF;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;">
        Sign in to Chapter Admin
      </a>
    </p>
    <p style="color:#666;font-size:13px;">This invitation expires in ${expiresInHours} hours. If it expires, ask the administrator who invited you to resend it.</p>
    <p>Best regards,<br>The Chapter Team</p>
  </div>
`;
