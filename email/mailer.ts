import nodemailer, { Transporter } from "nodemailer";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (transporter) return transporter;

  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Missing SMTP_USERNAME or SMTP_PASSWORD env var");
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
};

export const sendEmail = async ({
  to,
  subject,
  html,
}: SendEmailParams): Promise<void> => {
  const from = process.env.SMTP_USERNAME;
  await getTransporter().sendMail({ from, to, subject, html });
};
