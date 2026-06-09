const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT) || 587,
  secure: false,
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 10000,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'Philippine FoodBank'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  });
}

module.exports = { sendMail };
