const axios = require('axios');
require('dotenv').config();

async function sendMail({ to, subject, html }) {
  const from = `${process.env.MAIL_FROM_NAME || 'SAVR FoodBank'} <${process.env.MAIL_FROM_ADDRESS || 'onboarding@resend.dev'}>`;

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
}

module.exports = { sendMail };
