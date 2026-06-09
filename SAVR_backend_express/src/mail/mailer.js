const axios = require('axios');
require('dotenv').config();

async function sendMail({ to, subject, html }) {
  try {
    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: process.env.MAIL_FROM_NAME || 'SAVR FoodBank',
          email: process.env.MAIL_FROM_ADDRESS || 'khristianjosedp@gmail.com',
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          'api-key': process.env.MAIL_PASS,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
  } catch (err) {
    const detail = err.response?.data?.message || err.message;
    throw new Error(`Brevo error: ${detail}`);
  }
}

module.exports = { sendMail };
