// Gửi email xác nhận/đặt lại mật khẩu qua SMTP (hộp thư của hosting). Chưa cấu hình SMTP: in liên kết ra nhật ký để thử nghiệm.
import nodemailer from "nodemailer";

const url = process.env.SMTP_URL;
const transport = url ? nodemailer.createTransport(url) : process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 465,
      secure: (process.env.SMTP_SECURE ?? "true") !== "false",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

export const mailEnabled = !!transport;

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!transport) { console.log(`[mail:console] → ${to}\n${subject}\n${text}\n`); return; }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@localhost";
  await transport.sendMail({ from, to, subject, text });
}
