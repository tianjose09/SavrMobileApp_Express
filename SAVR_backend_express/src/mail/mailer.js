const axios = require('axios');
require('dotenv').config();

async function sendMail({ to, subject, html }) {
  const from = `${process.env.MAIL_FROM_NAME || 'SAVR FoodBank'} <${process.env.MAIL_FROM_ADDRESS || 'onboarding@resend.dev'}>`;

  try {
    await axios.post(
      'https://api.resend.com/emails',
      { from, to: [to], subject, html },
      {
        headers: {
          Authorization: `Bearer ${process.env.MAIL_PASS}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
  } catch (err) {
    const detail = err.response?.data?.message || err.response?.data?.name || err.message;
    throw new Error(`Resend API error: ${detail}`);
  }
}

module.exports = { sendMail };
