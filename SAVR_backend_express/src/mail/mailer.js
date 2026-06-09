const nodemailer = require('nodemailer');
require('dotenv').config();

const mailPort = parseInt(process.env.MAIL_PORT) || 587;

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: mailPort,
  secure: mailPort === 465,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

async function sendMail({ to, subject, html }) {
  try {
    return await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME || 'SAVR FoodBank'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    throw new Error(`SMTP error: ${err.message}`);
  }
}

module.exports = { sendMail };
