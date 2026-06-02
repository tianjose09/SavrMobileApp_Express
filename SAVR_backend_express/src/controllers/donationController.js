const axios = require('axios');
const db = require('../db');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);
const { createNotification } = require('./notificationController');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount) {
  return parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

async function logActivity(userId, type, title, description, icon = 'financialiconyellow') {
  await db.execute(
    'INSERT INTO activity_logs (user_id, type, title, description, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
    [userId, type, title, description, icon]
  );
}

async function recalculateBadges(userId) {
  const [[foodRow]] = await db.execute(
    "SELECT COUNT(*) AS cnt FROM food_donation_records WHERE user_id = ? AND status IN ('approved','received')",
    [userId]
  );
  const [[financialRow]] = await db.execute(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM financial_donation_records WHERE user_id = ? AND status = 'paid'",
    [userId]
  );
  const [[serviceRow]] = await db.execute(
    "SELECT COUNT(*) AS cnt FROM service_donation_records WHERE user_id = ? AND status IN ('confirmed','completed')",
    [userId]
  );

  const foodCount     = parseInt(foodRow?.cnt)          || 0;
  const financialTotal = parseFloat(financialRow?.total) || 0;
  const serviceCount  = parseInt(serviceRow?.cnt)        || 0;

  const [badges] = await db.execute('SELECT * FROM badges');

  for (const badge of badges) {
    let current = 0;
    if (badge.goal_type === 'food_count') current = foodCount;
    else if (badge.goal_type === 'financial_total') current = financialTotal;
    else if (badge.goal_type === 'service_count') current = serviceCount;

    let status = 'not_started';
    if (current >= badge.goal_value) status = 'earned';
    else if (current > 0) status = 'in_progress';

    const progress = Math.min(current, badge.goal_value);

    const [existing] = await db.execute(
      'SELECT * FROM user_badges WHERE user_id = ? AND badge_id = ?',
      [userId, badge.id]
    );

    if (existing.length) {
      if (existing[0].status !== 'earned') {
        const earnedAt = status === 'earned' && !existing[0].earned_at ? new Date() : existing[0].earned_at;
        await db.execute(
          'UPDATE user_badges SET status = ?, progress = ?, earned_at = ? WHERE user_id = ? AND badge_id = ?',
          [status, progress, earnedAt, userId, badge.id]
        );
        if (status === 'earned') {
          await createNotification(userId, 'badge', `Badge Unlocked: ${badge.name}`, `Congratulations! You've earned the "${badge.name}" badge. Keep up the great work!`, true);
        }
      }
    } else {
      const earnedAt = status === 'earned' ? new Date() : null;
      await db.execute(
        'INSERT INTO user_badges (user_id, badge_id, status, progress, earned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [userId, badge.id, status, progress, earnedAt]
      );
      if (status === 'earned') {
        await createNotification(userId, 'badge', `Badge Unlocked: ${badge.name}`, `Congratulations! You've earned the "${badge.name}" badge. Keep up the great work!`, true);
      }
    }
  }
}

exports.recalculateBadges = recalculateBadges;

function parseTimeSlot(timeSlot) {
  if (!timeSlot) return { start: null, end: null };
  const parts = timeSlot.split(' - ');
  const cleanTime = (str) => (str || '').replace(/[^\x20-\x7E]/g, ' ').trim();
  const s = cleanTime(parts[0] || timeSlot);
  const e = cleanTime(parts[1] || '');

  let start = null, end = null;
  try { if (s) start = dayjs(`1970-01-01 ${s}`).format('HH:mm:ss'); } catch {}
  try {
    if (e) end = dayjs(`1970-01-01 ${e}`).format('HH:mm:ss');
    else if (start) end = dayjs(`1970-01-01 ${start}`).add(1, 'hour').format('HH:mm:ss');
  } catch {}

  return { start, end };
}

// ─── PayMongo ─────────────────────────────────────────────────────────────────

exports.createPaymongoCheckout = async (req, res) => {
  const { amount, message } = req.body;

  if (!amount || isNaN(amount) || parseFloat(amount) < 1) {
    return res.status(422).json({ success: false, errors: { amount: ['Amount must be at least 1.'] } });
  }

  const amountCentavos = Math.round(parseFloat(amount) * 100);
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  try {
    const [donationResult] = await db.execute(
      "INSERT INTO financial_donation_records (user_id, amount, payment_method, message, status, created_at, updated_at) VALUES (?, ?, 'paymongo', ?, 'pending', NOW(), NOW())",
      [req.user.id, amount, message || null]
    );
    const donationId = donationResult.insertId;

    const response = await axios.post(
      'https://api.paymongo.com/v1/checkout_sessions',
      {
        data: {
          attributes: {
            line_items: [{
              currency: 'PHP',
              amount: amountCentavos,
              name: 'SAVR Food Bank Donation',
              quantity: 1,
              description: message || 'Donation to SAVR Food Bank',
            }],
            payment_method_types: ['gcash', 'paymaya', 'card'],
            success_url: `${baseUrl}/api/payment/success?donation_id=${donationId}`,
            cancel_url: `${baseUrl}/api/payment/cancel`,
            description: 'SAVR Food Bank Donation',
          },
        },
      },
      {
        auth: { username: secretKey, password: '' },
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      }
    );

    const data = response.data.data;
    const checkoutUrl = data.attributes.checkout_url;
    const paymentId = data.id;

    await db.execute(
      'UPDATE financial_donation_records SET paymongo_payment_id = ?, paymongo_link_id = ? WHERE id = ?',
      [paymentId, checkoutUrl, donationId]
    );

    return res.json({ success: true, checkout_url: checkoutUrl, payment_id: paymentId, donation_id: donationId });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    return res.status(500).json({ success: false, message: err?.response?.data ? JSON.stringify(err.response.data) : err.message });
  }
};


exports.paymongoWebhook = async (req, res) => {
  const event = req.body?.data?.attributes?.type;
  const data = req.body?.data?.attributes?.data;

  if (event === 'checkout_session.payment.paid' || event === 'checkout_session.completed') {
    const checkoutId = data?.id;
    if (checkoutId) {
      const [rows] = await db.execute(
        "SELECT * FROM financial_donation_records WHERE paymongo_payment_id = ? AND status != 'paid'",
        [checkoutId]
      );
      const donation = rows[0];
      if (donation) {
        await db.execute("UPDATE financial_donation_records SET status = 'paid' WHERE id = ?", [donation.id]);
        await logActivity(donation.user_id, 'financial', 'Financial Donation Paid', `₱${formatAmount(donation.amount)} payment confirmed`, 'financialiconyellow');
        await createNotification(donation.user_id, 'financial', 'Payment Confirmed', `Your financial donation of ₱${formatAmount(donation.amount)} has been successfully received. Thank you for your generosity!`);
        await recalculateBadges(donation.user_id);
      }
    }
  }

  return res.json({ received: true });
};

exports.checkPaymentStatus = async (req, res) => {
  const donationId = req.params.id;
  const [rows] = await db.execute(
    'SELECT * FROM financial_donation_records WHERE id = ? AND user_id = ?',
    [donationId, req.user.id]
  );
  const donation = rows[0];

  if (!donation) {
    return res.status(404).json({ success: false, message: 'Donation not found.' });
  }

  if (donation.status === 'paid') {
    return res.json({ success: true, status: 'paid', amount: donation.amount });
  }

  if (donation.paymongo_payment_id) {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    const httpsAgent = new (require('https').Agent)({ rejectUnauthorized: false });

    try {
      const pmRes = await axios.get(
        `https://api.paymongo.com/v1/checkout_sessions/${donation.paymongo_payment_id}`,
        { auth: { username: secretKey, password: '' }, httpsAgent }
      );
      const attrs = pmRes.data?.data?.attributes;

      const sessionPaid = attrs?.status === 'completed' || attrs?.status === 'paid';
      const hasPayment = Array.isArray(attrs?.payments)
        && attrs.payments.some(p => p?.attributes?.status === 'paid');
      const piSucceeded = attrs?.payment_intent?.attributes?.status === 'succeeded';

      if (sessionPaid || hasPayment || piSucceeded) {
        await db.execute("UPDATE financial_donation_records SET status = 'paid', updated_at = NOW() WHERE id = ?", [donation.id]);
        await logActivity(donation.user_id, 'financial', 'Financial Donation Paid', `₱${formatAmount(donation.amount)} payment confirmed`, 'financialiconyellow');
        await createNotification(donation.user_id, 'financial', 'Payment Confirmed', `Your financial donation of ₱${formatAmount(donation.amount)} has been successfully received. Thank you for your generosity!`, true);
        await recalculateBadges(donation.user_id);
        return res.json({ success: true, status: 'paid', amount: donation.amount });
      }
    } catch (err) {
      console.error('[checkPaymentStatus ERROR]', err?.response?.status, err?.response?.data || err.message);
    }
  }

  return res.json({ success: true, status: donation.status, amount: donation.amount });
};

// ─── Payment Redirect Pages ───────────────────────────────────────────────────

exports.paymentSuccess = async (req, res) => {
  let paidAmount = null;
  if (req.query.donation_id) {
    const [rows] = await db.execute(
      "SELECT * FROM financial_donation_records WHERE id = ? AND status != 'paid'",
      [req.query.donation_id]
    );
    const donation = rows[0];
    if (donation) {
      await db.execute("UPDATE financial_donation_records SET status = 'paid' WHERE id = ?", [donation.id]);
      await logActivity(donation.user_id, 'financial', 'Financial Donation Paid', `₱${formatAmount(donation.amount)} payment confirmed`, 'financialiconyellow');
      await createNotification(donation.user_id, 'financial', 'Payment Confirmed', `Your financial donation of ₱${formatAmount(donation.amount)} has been successfully received. Thank you for your generosity!`);
      await recalculateBadges(donation.user_id);
      paidAmount = formatAmount(donation.amount);
    }
  }

  const amountLine = paidAmount
    ? `<p class="amount">₱ ${paidAmount}</p>`
    : '';

  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Successful – SAVR</title>
  <script>
    window.onload = function () {
      // Try all known schemes in sequence
      var schemes = ['savrmobile://', 'exp+savr-mobile://'];
      var i = 0;
      function tryNext() {
        if (i >= schemes.length) return;
        window.location.href = schemes[i++];
        setTimeout(tryNext, 1200);
      }
      tryNext();
      // Auto-close tab after 4s as last resort (works on Android)
      setTimeout(function () { window.close(); }, 4000);
    };
  </script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #F6F7F9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 28px;
      padding: 40px 32px 36px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 40px rgba(0,0,0,0.10);
    }
    .icon-circle {
      width: 88px;
      height: 88px;
      background: #E8F5E9;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 22px;
    }
    .checkmark {
      width: 44px;
      height: 44px;
      stroke: #00592d;
      stroke-width: 3;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .badge {
      display: inline-block;
      background: #E8F5E9;
      color: #00592d;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 5px 14px;
      border-radius: 999px;
      margin-bottom: 14px;
    }
    h1 {
      color: #1A1A1A;
      font-size: 26px;
      font-weight: 800;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    .subtitle {
      color: #6E6E6E;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 6px;
    }
    .amount {
      color: #00592d;
      font-size: 32px;
      font-weight: 800;
      margin: 18px 0 6px;
      letter-spacing: -1px;
    }
    .divider {
      height: 1px;
      background: #F0F0F0;
      margin: 22px 0;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 16px;
      background: #00592d;
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      border-radius: 16px;
      border: none;
      cursor: pointer;
      margin-bottom: 12px;
      transition: opacity 0.15s;
    }
    .btn:active { opacity: 0.85; }
    .btn-outline {
      display: block;
      width: 100%;
      padding: 15px;
      background: transparent;
      color: #00592d;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      border-radius: 16px;
      border: 1.5px solid #00592d;
      cursor: pointer;
    }
    .footer-note {
      color: #ABABAB;
      font-size: 11px;
      margin-top: 20px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-circle">
      <svg class="checkmark" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="22" stroke="#00592d" stroke-width="2" fill="#E8F5E9"/>
        <path d="M15 26 l8 8 l14 -14" stroke="#00592d" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <span class="badge">Payment Confirmed</span>
    <h1>Thank you for your donation!</h1>
    <p class="subtitle">Your contribution helps feed families in need.</p>
    ${amountLine}

    <div class="divider"></div>

    <a class="btn" href="savrmobile://">Return to App</a>
    <a class="btn-outline" href="savrmobile://">Go to Dashboard</a>

    <p class="footer-note">Powered by PayMongo &nbsp;·&nbsp; SAVR Philippine FoodBank</p>
  </div>
</body>
</html>`);
};

exports.paymentCancel = (req, res) => {
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Cancelled – SAVR</title>
  <script>
    window.onload = function () {
      window.location.href = 'savrmobile://';
      setTimeout(function () {
        window.location.href = 'exp+savr-mobile://';
      }, 1500);
    };
  </script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #F6F7F9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 28px;
      padding: 40px 32px 36px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 40px rgba(0,0,0,0.10);
    }
    .icon-circle {
      width: 88px;
      height: 88px;
      background: #FFF4F4;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 22px;
    }
    .badge {
      display: inline-block;
      background: #FFF0F0;
      color: #C62828;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 5px 14px;
      border-radius: 999px;
      margin-bottom: 14px;
    }
    h1 {
      color: #1A1A1A;
      font-size: 26px;
      font-weight: 800;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    .subtitle {
      color: #6E6E6E;
      font-size: 14px;
      line-height: 1.6;
    }
    .divider {
      height: 1px;
      background: #F0F0F0;
      margin: 22px 0;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 16px;
      background: #00592d;
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      border-radius: 16px;
      border: none;
      cursor: pointer;
      margin-bottom: 12px;
    }
    .btn:active { opacity: 0.85; }
    .btn-outline {
      display: block;
      width: 100%;
      padding: 15px;
      background: transparent;
      color: #00592d;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      border-radius: 16px;
      border: 1.5px solid #00592d;
      cursor: pointer;
    }
    .footer-note {
      color: #ABABAB;
      font-size: 11px;
      margin-top: 20px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-circle">
      <svg width="44" height="44" viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="22" fill="#FFF0F0" stroke="#C62828" stroke-width="2"/>
        <path d="M18 18 l16 16 M34 18 l-16 16" stroke="#C62828" stroke-width="3" stroke-linecap="round"/>
      </svg>
    </div>

    <span class="badge">Payment Cancelled</span>
    <h1>Payment was not completed</h1>
    <p class="subtitle">No charges were made. You can try again anytime from the app.</p>

    <div class="divider"></div>

    <a class="btn" href="savrmobile://">Return to App</a>
    <a class="btn-outline" href="savrmobile://">Try Again</a>

    <p class="footer-note">Powered by PayMongo &nbsp;·&nbsp; SAVR Philippine FoodBank</p>
  </div>
</body>
</html>`);
};

// ─── Food Donation ────────────────────────────────────────────────────────────

exports.submitFood = async (req, res) => {
  const { schedule_type, preferred_date, time_slot, pickup_address, pickup_latitude, pickup_longitude } = req.body;
  let foodItems;

  try {
    foodItems = typeof req.body.food_items === 'string'
      ? JSON.parse(req.body.food_items)
      : req.body.food_items;
  } catch {
    return res.status(422).json({ success: false, message: 'Invalid food items array payload.' });
  }

  if (!Array.isArray(foodItems)) {
    return res.status(422).json({ success: false, message: 'Invalid food items array payload.' });
  }
  if (!schedule_type || !['pickup', 'delivery'].includes(schedule_type)) {
    return res.status(422).json({ success: false, errors: { schedule_type: ['Must be pickup or delivery.'] } });
  }
  if (!preferred_date) {
    return res.status(422).json({ success: false, errors: { preferred_date: ['Preferred date is required.'] } });
  }

  const { start, end } = parseTimeSlot(time_slot);

  const files = req.files || [];

  const [donationResult] = await db.execute(
    `INSERT INTO food_donation_records (user_id, mode, preferred_date, time_slot_start, time_slot_end, pickup_address, pickup_lat, pickup_lng, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
    [req.user.id, schedule_type, preferred_date, start, end, pickup_address || null, pickup_latitude || null, pickup_longitude || null]
  );
  const donationId = donationResult.insertId;

  for (let i = 0; i < foodItems.length; i++) {
    const item = foodItems[i];
    const rawQty = item.quantity ?? 1;
    const numQty = parseFloat(String(rawQty).replace(/[^0-9.]/g, '')) || 1;
    const unitMatch = String(rawQty).match(/[a-zA-Z]+/);
    const unit = unitMatch ? unitMatch[0] : (item.unit || 'pcs');

    const expiryDate = item.expiryDate
      ? dayjs(item.expiryDate).format('YYYY-MM-DD')
      : item.expiry_date
        ? dayjs(item.expiry_date).format('YYYY-MM-DD')
        : dayjs().add(30, 'day').format('YYYY-MM-DD');

    const photoPath = files[i] ? files[i].path : null;

    await db.execute(
      `INSERT INTO food_donation_record_items (food_donation_record_id, food_name, quantity, unit, category, expiration_date, special_notes, photo_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [donationId, item.foodName || item.name || item.type || 'Unknown Item', numQty, unit, item.category || 'General', expiryDate, item.notes || item.special_notes || null, photoPath]
    );
  }

  const modeLabel = schedule_type === 'delivery' ? 'drop-off' : 'pickup';
  await logActivity(req.user.id, 'food', 'Food Donation Submitted', `${foodItems.length} item(s) submitted and pending admin confirmation`, 'truckicon');
  await createNotification(req.user.id, 'food', 'Food Donation Submitted', `Your food donation of ${foodItems.length} item(s) has been submitted and scheduled for ${modeLabel}. Thank you!`);
  await recalculateBadges(req.user.id);

  return res.status(201).json({ success: true, message: 'Food donation and schedule confirmed.', donation_id: donationId });
};

exports.submitSchedule = async (req, res) => {
  const { donation_id, schedule_type, preferred_date, time_slot, pickup_address, pickup_lat, pickup_lng } = req.body;

  if (!donation_id || !schedule_type || !preferred_date || !time_slot) {
    return res.status(422).json({ success: false, message: 'Required fields missing.' });
  }

  const [rows] = await db.execute(
    'SELECT * FROM food_donation_records WHERE id = ? AND user_id = ?',
    [donation_id, req.user.id]
  );
  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Donation not found.' });
  }

  const { start, end } = parseTimeSlot(time_slot);

  await db.execute(
    `UPDATE food_donation_records SET mode = ?, preferred_date = ?, time_slot_start = ?, time_slot_end = ?, pickup_address = ?, pickup_lat = ?, pickup_lng = ?, status = 'scheduled', updated_at = NOW() WHERE id = ?`,
    [schedule_type, preferred_date, start, end, pickup_address || null, pickup_lat || null, pickup_lng || null, donation_id]
  );

  const [updated] = await db.execute('SELECT * FROM food_donation_records WHERE id = ?', [donation_id]);

  await logActivity(req.user.id, 'food', `${schedule_type.charAt(0).toUpperCase() + schedule_type.slice(1)} Scheduled`, `Scheduled for ${preferred_date} at ${time_slot}`, 'truckicon');
  await recalculateBadges(req.user.id);

  return res.json({ success: true, message: `${schedule_type.charAt(0).toUpperCase() + schedule_type.slice(1)} scheduled.`, donation: updated[0] });
};

// ─── Service Donation ─────────────────────────────────────────────────────────

exports.submitService = async (req, res) => {
  const { service_type, quantity, frequency, service_date, service_time, address, contact_first_name, contact_last_name, contact_email, description } = req.body;

  if (!service_type || !quantity || !frequency || !service_date || !service_time || !address || !contact_first_name || !contact_last_name || !contact_email) {
    return res.status(422).json({ success: false, message: 'Required fields missing.' });
  }

  const cleanTime = (str) => (str || '').replace(/[^\x20-\x7E]/g, ' ').trim();
  let startsAt = null;
  try { startsAt = dayjs(`1970-01-01 ${cleanTime(service_time)}`).format('HH:mm:ss'); } catch {}

  const [result] = await db.execute(
    `INSERT INTO service_donation_records (user_id, service_tab, quantity, frequency, date, starts_at, address, first_name, last_name, email, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
    [req.user.id, service_type, quantity, frequency, service_date, startsAt, address, contact_first_name, contact_last_name, contact_email, description || null]
  );

  const [donation] = await db.execute('SELECT * FROM service_donation_records WHERE id = ?', [result.insertId]);

  await logActivity(req.user.id, 'service', 'Service Donation Submitted', `${service_type} - ${quantity} unit(s)`, 'truckicon');
  await createNotification(req.user.id, 'service', 'Service Donation Submitted', `Your ${service_type} service donation has been logged and is being processed. Thank you for volunteering!`);
  await recalculateBadges(req.user.id);

  return res.status(201).json({ success: true, message: 'Service donation submitted.', donation: donation[0] });
};

// ─── Stats ────────────────────────────────────────────────────────────────────

exports.getDonationStats = async (req, res) => {
  const uid = req.user.id;

  const [[totalFinancialRow]] = await db.execute(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM financial_donation_records WHERE user_id = ? AND status = 'paid'",
    [uid]
  );
  const [[totalFoodRow]] = await db.execute(
    'SELECT COUNT(*) AS cnt FROM food_donation_records WHERE user_id = ?',
    [uid]
  );
  const [[totalServiceRow]] = await db.execute(
    'SELECT COUNT(*) AS cnt FROM service_donation_records WHERE user_id = ?',
    [uid]
  );
  const totalFinancial = parseFloat(totalFinancialRow?.total) || 0;
  const totalFood = parseInt(totalFoodRow?.cnt) || 0;
  const totalService = parseInt(totalServiceRow?.cnt) || 0;

  const [activities] = await db.execute(
    'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
    [uid]
  );

  const recentActivities = activities.map(a => ({
    id: a.id,
    type: a.type,
    title: a.title,
    description: a.description,
    icon: a.icon,
    time_ago: dayjs(a.created_at).fromNow(),
  }));

  return res.json({
    success: true,
    total_financial: totalFinancial,
    total_food: totalFood,
    total_service: totalService,
    recent_activities: recentActivities,
  });
};

exports.getUpcomingPickups = async (req, res) => {
  try {
    const uid = req.user.id;

    const [pickups] = await db.execute(
      "SELECT * FROM food_donation_records WHERE user_id = ? AND status IN ('pending','approved') ORDER BY created_at DESC LIMIT 5",
      [uid]
    );

    return res.json({
      success: true,
      pickups: pickups.map(p => ({
        id: p.id,
        status: p.status,
        preferred_date: p.preferred_date ? dayjs(p.preferred_date).format('YYYY-MM-DD') : null,
        time_slot: p.time_slot_start + (p.time_slot_end ? ` - ${p.time_slot_end}` : ''),
        pickup_address: p.pickup_address,
        created_at: dayjs(p.created_at).format('MM/DD/YYYY'),
      })),
    });
  } catch (err) {
    console.error('[getUpcomingPickups]', err.message);
    return res.json({ success: true, pickups: [] });
  }
};

exports.updatePickup = async (req, res) => {
  const { id } = req.params;
  const { preferred_date, time_slot, pickup_address, schedule_type } = req.body;

  const [rows] = await db.execute(
    "SELECT * FROM food_donation_records WHERE id = ? AND user_id = ? AND status = 'pending'",
    [id, req.user.id]
  );
  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Pickup not found or cannot be edited.' });
  }

  const { start, end } = parseTimeSlot(time_slot || '07:00');

  await db.execute(
    `UPDATE food_donation_records SET mode = ?, preferred_date = ?, time_slot_start = ?, time_slot_end = ?, pickup_address = ?, updated_at = NOW() WHERE id = ?`,
    [schedule_type || rows[0].mode, preferred_date || rows[0].preferred_date, start, end, pickup_address || rows[0].pickup_address, id]
  );

  const [updated] = await db.execute('SELECT * FROM food_donation_records WHERE id = ?', [id]);
  return res.json({ success: true, message: 'Pickup updated.', pickup: updated[0] });
};

exports.deletePickup = async (req, res) => {
  const { id } = req.params;

  const [rows] = await db.execute(
    "SELECT * FROM food_donation_records WHERE id = ? AND user_id = ? AND status = 'pending'",
    [id, req.user.id]
  );
  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Pickup not found or cannot be deleted.' });
  }

  // Also delete related food items
  await db.execute('DELETE FROM food_donation_record_items WHERE food_donation_record_id = ?', [id]);
  await db.execute('DELETE FROM food_donation_records WHERE id = ?', [id]);

  return res.json({ success: true, message: 'Pickup deleted successfully.' });
};

// ─── Badges ───────────────────────────────────────────────────────────────────

exports.getBadges = async (req, res) => {
  const uid = req.user.id;

  const [badges] = await db.execute('SELECT * FROM badges');
  const [userBadges] = await db.execute('SELECT * FROM user_badges WHERE user_id = ?', [uid]);
  const userBadgeMap = Object.fromEntries(userBadges.map(ub => [ub.badge_id, ub]));

  const result = badges.map(badge => {
    const ub = userBadgeMap[badge.id];
    let tags = [];
    try { tags = typeof badge.tags === 'string' ? JSON.parse(badge.tags) : (badge.tags || []); } catch {}
    return {
      id: badge.id,
      key: badge.key,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      goal_value: badge.goal_value,
      goal_type: badge.goal_type,
      status: ub ? ub.status : 'not_started',
      progress: ub ? ub.progress : 0,
      earned_at: ub ? ub.earned_at : null,
    };
  });

  const earned = result.filter(b => b.status === 'earned');
  const inProgress = result.filter(b => b.status === 'in_progress');
  const top3 = earned.slice(0, 3);

  return res.json({ success: true, top3, earned, in_progress: inProgress, all: result });
};

const ACTIVITY_STATUS = {
  financial: 'Completed',
  food:      'Scheduled',
  service:   'Submitted',
  inventory: 'Processed',
};

exports.getActivities = async (req, res) => {
  const [activities] = await db.execute(
    'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );

  return res.json({
    success: true,
    activities: activities.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      icon: a.icon,
      status: ACTIVITY_STATUS[a.type] || 'Updated',
      date: dayjs(a.created_at).format('MM/DD/YYYY'),
      time_ago: dayjs(a.created_at).fromNow(),
    })),
  });
};

// ─── Beneficiary Requests ─────────────────────────────────────────────────────

exports.submitBeneficiaryRequest = async (req, res) => {
  const {
    title, type, food_type, quantity, unit, financial_amount,
    population, age_start, age_end, street, barangay,
    city_municipality, postal_zip_code, needed_date, urgency_level,
    food_items,
    bank_name, account_name, account_number,
  } = req.body;

  if (!title || !type) {
    return res.status(422).json({ success: false, message: 'Title and type are required.' });
  }

  // Parse food_items if sent as a JSON string
  let parsedFoodItems = null;
  if (food_items) {
    try {
      parsedFoodItems = typeof food_items === 'string' ? JSON.parse(food_items) : food_items;
    } catch { parsedFoodItems = null; }
  }

  // Derive legacy single-item columns from the first food item when not sent individually
  const firstItem = Array.isArray(parsedFoodItems) ? parsedFoodItems[0] : null;
  const resolvedFoodType = food_type || firstItem?.food_name || firstItem?.name || null;
  const resolvedQuantity = quantity ? parseFloat(quantity) : (firstItem?.qty ? parseFloat(firstItem.qty) : null);
  const resolvedUnit     = unit || firstItem?.unit || null;

  const [result] = await db.execute(
    `INSERT INTO beneficiary_requests
     (user_id, request_name, type, food_type, quantity, unit, amount, population, age_min, age_max, street, barangay, city, zip_code, request_date, urgency, food_items, bank_name, account_name, account_number, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW(), NOW())`,
    [
      req.user.id,
      title,
      type,
      resolvedFoodType,
      resolvedQuantity,
      resolvedUnit,
      financial_amount ? parseFloat(financial_amount) : null,
      population ? parseInt(population) : 0,
      age_start ? parseInt(age_start) : 0,
      age_end ? parseInt(age_end) : 0,
      street || '',
      barangay || '',
      city_municipality || '',
      postal_zip_code || '',
      needed_date || null,
      urgency_level || null,
      parsedFoodItems ? JSON.stringify(parsedFoodItems) : null,
      bank_name || null,
      account_name || null,
      account_number || null,
    ]
  );

  await createNotification(req.user.id, 'service', 'Request Submitted', `Your assistance request "${title}" has been received and is being reviewed. We will notify you once it is processed.`);

  return res.status(201).json({ success: true, message: 'Request submitted successfully.', request_id: result.insertId });
};

exports.getBeneficiaryRequests = async (req, res) => {
  const [requests] = await db.execute(
    'SELECT * FROM beneficiary_requests WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );

  const mapped = requests
    .map(r => {
      let foodItems = [];
      try {
        foodItems = typeof r.food_items === 'string' ? JSON.parse(r.food_items) : (r.food_items || []);
      } catch { foodItems = []; }
      let receivedItems = [];
      try {
        receivedItems = typeof r.received_items === 'string' ? JSON.parse(r.received_items) : (r.received_items || []);
      } catch { receivedItems = []; }
      let dispatchedItems = [];
      try {
        dispatchedItems = typeof r.dispatched_items === 'string' ? JSON.parse(r.dispatched_items) : (r.dispatched_items || []);
      } catch { dispatchedItems = []; }

      return {
        ...r,
        food_items: foodItems,
        received_items: receivedItems,
        dispatched_items: dispatchedItems,
        dispatched_quantity: r.dispatched_quantity != null ? parseFloat(r.dispatched_quantity) : null,
        bank_name: r.bank_name || null,
        account_name: r.account_name || null,
        account_number: r.account_number || null,
        food_type: r.food_type || (foodItems[0]?.food_name ?? foodItems[0]?.name ?? null),
        quantity: r.quantity ?? (foodItems[0]?.qty ?? null),
        unit: r.unit || (foodItems[0]?.unit ?? null),
        delivery_date_time: r.delivery_date_time ? new Date(r.delivery_date_time).toISOString() : null,
        remarks: r.remarks || null,
      };
    });
  return res.json({ success: true, requests: mapped });
};

exports.cancelBeneficiaryRequest = async (req, res) => {
  const { id } = req.params;

  const [rows] = await db.execute(
    'SELECT * FROM beneficiary_requests WHERE id = ? AND user_id = ?',
    [id, req.user.id]
  );
  const request = rows[0];

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found.' });
  }
  if (request.status.toLowerCase() !== 'pending') {
    return res.status(400).json({ success: false, message: 'Only Pending requests can be cancelled.' });
  }

  await db.execute(
    "UPDATE beneficiary_requests SET status = 'Cancelled', updated_at = NOW() WHERE id = ?",
    [id]
  );
  return res.json({ success: true, message: 'Request cancelled successfully.' });
};

exports.updateRequestStatus = async (req, res) => {
  const user = req.user;
  if (user.role === 'beneficiary') {
    return res.status(403).json({ success: false, message: 'Unauthorized.' });
  }

  const allowed = ['Pending', 'Allocated', 'Urgent', 'Approved', 'Rejected', 'Accepted', 'Denied', 'Completed'];
  const { delivery_date_time, dispatched_quantity, dispatched_items } = req.body;
  // Normalize to Title Case so 'approved', 'APPROVED', 'Approved' all work
  const rawStatus = req.body.status || '';
  const status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

  if (!allowed.includes(status)) {
    return res.status(422).json({ success: false, message: `Invalid status. Allowed: ${allowed.join(', ')}` });
  }

  const [rows] = await db.execute('SELECT * FROM beneficiary_requests WHERE id = ?', [req.params.id]);
  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Request not found.' });
  }

  // If approving / accepting / allocating, optionally save delivery_date_time and dispatched info
  const approvalStatuses = ['Approved', 'Accepted', 'Allocated'];
  if (approvalStatuses.includes(status)) {
    const dispQty = dispatched_quantity !== undefined ? (dispatched_quantity !== null ? parseFloat(dispatched_quantity) : null) : undefined;
    const dispItems = dispatched_items !== undefined ? (dispatched_items !== null ? (typeof dispatched_items === 'string' ? dispatched_items : JSON.stringify(dispatched_items)) : null) : undefined;

    let query = 'UPDATE beneficiary_requests SET status = ?, updated_at = NOW()';
    const params = [status];

    if (delivery_date_time !== undefined) {
      query += ', delivery_date_time = ?';
      params.push(delivery_date_time ? new Date(delivery_date_time) : null);
    }
    if (dispQty !== undefined) {
      query += ', dispatched_quantity = ?';
      params.push(dispQty);
    }
    if (dispItems !== undefined) {
      query += ', dispatched_items = ?';
      params.push(dispItems);
    }

    query += ' WHERE id = ?';
    params.push(req.params.id);

    await db.execute(query, params);
  } else {
    await db.execute('UPDATE beneficiary_requests SET status = ?, updated_at = NOW() WHERE id = ?', [status, req.params.id]);
  }

  const [updated] = await db.execute('SELECT * FROM beneficiary_requests WHERE id = ?', [req.params.id]);

  // Notify the beneficiary (not the admin) about their request status change
  const beneficiaryUserId = rows[0].user_id;
  const statusMessages = {
    Pending:   'Your request is being reviewed by our team.',
    Allocated: 'Great news! Your request has been allocated and will be processed soon.',
    Urgent:    'Your request has been marked as urgent and will be prioritized immediately.',
    Approved:  'Your request has been approved! We will be in touch with the next steps.',
    Accepted:  'Your request has been accepted and is now being prepared for fulfillment.',
    Rejected:  'We regret to inform you that your request has been rejected. Please contact us for more details.',
    Denied:    'Your request has been denied. Please contact our team if you have any questions.',
    Completed: 'Your request has been completed and fulfilled. Thank you for reaching out to us!',
  };
  const criticalStatuses = ['Allocated', 'Urgent', 'Approved', 'Accepted', 'Rejected', 'Denied', 'Completed'];
  try {
    await createNotification(beneficiaryUserId, 'service', `Request ${status}`, statusMessages[status] || `Your request status has been updated to "${status}".`, criticalStatuses.includes(status));
    // Stamp notified_status so the auto-notify check won't create a duplicate
    await db.execute(
      'UPDATE beneficiary_requests SET notified_status = ? WHERE id = ?',
      [status, req.params.id]
    );
  } catch (notifyErr) {
    console.error('[updateRequestStatus notify]', notifyErr.message);
  }

  return res.json({ success: true, message: `Request status updated to "${status}".`, request: updated[0] });
};

exports.completeBeneficiaryRequest = async (req, res) => {
  const { id } = req.params;
  const { received_items, received_qty, remarks } = req.body;

  // Auto-migrate: add remarks, dispatched, and bank details columns if they don't exist
  try {
    await db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS remarks TEXT`);
    await db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS dispatched_quantity NUMERIC DEFAULT NULL`);
    await db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS dispatched_items JSONB DEFAULT NULL`);
    await db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255) DEFAULT NULL`);
    await db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS account_name VARCHAR(255) DEFAULT NULL`);
    await db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS account_number VARCHAR(255) DEFAULT NULL`);
  } catch (_) {}

  const [rows] = await db.execute(
    'SELECT * FROM beneficiary_requests WHERE id = ? AND user_id = ?',
    [id, req.user.id]
  );
  const request = rows[0];

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found.' });
  }

  const s = (request.status || '').toLowerCase();
  if (!['approved', 'accepted', 'allocated', 'urgent'].includes(s)) {
    return res.status(400).json({ success: false, message: 'Only in-transit requests can be marked as received.' });
  }

  // Per-item path: food_items exists
  let foodItems = [];
  try {
    foodItems = typeof request.food_items === 'string' ? JSON.parse(request.food_items) : (request.food_items || []);
  } catch { foodItems = []; }

  // Load current received_items
  let existingReceived = [];
  try {
    existingReceived = typeof request.received_items === 'string' ? JSON.parse(request.received_items) : (request.received_items || []);
  } catch { existingReceived = []; }

  const receivedMap = {};
  for (const item of existingReceived) {
    receivedMap[item.food_name] = parseFloat(item.received_qty || '0');
  }

  if (foodItems.length > 0) {
    // Determine what is being received in this delivery.
    // Read from DB dispatched_items first.
    let currentDeliveryItems = [];
    let dbDispItems = [];
    try {
      dbDispItems = typeof request.dispatched_items === 'string' ? JSON.parse(request.dispatched_items) : (request.dispatched_items || []);
    } catch {}

    if (Array.isArray(dbDispItems) && dbDispItems.length > 0) {
      currentDeliveryItems = dbDispItems;
    } else if (Array.isArray(received_items) && received_items.length > 0) {
      // Fallback to body-supplied received_items
      currentDeliveryItems = received_items;
    } else {
      // Default to complete delivery of remaining requested quantities
      currentDeliveryItems = foodItems.map(item => {
        const name = item.food_name || item.name || 'Unknown';
        const requested = parseFloat(item.qty || item.quantity || '0');
        const alreadyReceived = receivedMap[name] || 0;
        return {
          food_name: name,
          received_qty: Math.max(0, requested - alreadyReceived),
          unit: item.unit || ''
        };
      });
    }

    // Merge currentDeliveryItems into existing map
    for (const item of currentDeliveryItems) {
      const prev = receivedMap[item.food_name] || 0;
      // Note: check either received_qty or qty
      const addedQty = parseFloat(item.received_qty ?? item.qty ?? item.quantity ?? 0);
      receivedMap[item.food_name] = prev + addedQty;
    }

    const updatedReceived = Object.entries(receivedMap).map(([food_name, received_qty]) => ({ food_name, received_qty }));

    // Complete when every food_item's received qty meets the requested qty
    let isCompleted = true;
    for (const foodItem of foodItems) {
      const name = foodItem.food_name || foodItem.name || 'Unknown';
      const requested = parseFloat(foodItem.qty || foodItem.quantity || '0');
      const received = receivedMap[name] || 0;
      if (received < requested) { isCompleted = false; break; }
    }

    if (isCompleted) {
      await db.execute(
        "UPDATE beneficiary_requests SET status = 'Completed', received_items = ?, remarks = ?, updated_at = NOW() WHERE id = ?",
        [JSON.stringify(updatedReceived), remarks || null, id]
      );
      await createNotification(req.user.id, 'service', 'Request Completed', `Your request "${request.request_name || 'Unnamed'}" has been fully fulfilled. Thank you!`, true);
    } else {
      await db.execute(
        'UPDATE beneficiary_requests SET received_items = ?, remarks = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(updatedReceived), remarks || null, id]
      );
    }

    const remainingItems = foodItems
      .map(item => {
        const name = item.food_name || item.name || 'Unknown';
        const requested = parseFloat(item.qty || item.quantity || '0');
        const received = receivedMap[name] || 0;
        return { food_name: name, remaining: Math.max(0, requested - received), unit: item.unit || '' };
      })
      .filter(i => i.remaining > 0);

    return res.json({
      success: true,
      is_completed: isCompleted,
      received_items: updatedReceived,
      remaining_items: remainingItems,
      remarks: remarks || null,
      message: isCompleted ? 'Request fully fulfilled!' : `Receipt recorded. ${remainingItems.length} item(s) still remaining.`,
    });
  }

  // Legacy single-qty fallback
  const totalQty   = request.quantity ? parseFloat(request.quantity) : null;
  const alreadyGot = parseFloat(request.received_quantity) || 0;
  
  let addingQty = 0;
  if (request.dispatched_quantity !== null) {
    addingQty = parseFloat(request.dispatched_quantity);
  } else if (received_qty != null) {
    addingQty = parseFloat(received_qty);
  } else if (totalQty) {
    addingQty = totalQty - alreadyGot;
  }

  let newReceived = alreadyGot;
  let isCompleted = false;

  if (totalQty) {
    newReceived  = Math.min(alreadyGot + addingQty, totalQty);
    isCompleted  = newReceived >= totalQty;
  } else {
    isCompleted = true;
  }

  if (isCompleted) {
    await db.execute(
      "UPDATE beneficiary_requests SET status = 'Completed', received_quantity = ?, remarks = ?, updated_at = NOW() WHERE id = ?",
      [newReceived || null, remarks || null, id]
    );
    await createNotification(req.user.id, 'service', 'Request Completed', `Your request "${request.request_name || 'Unnamed'}" has been fully fulfilled. Thank you!`, true);
  } else {
    await db.execute(
      'UPDATE beneficiary_requests SET received_quantity = ?, remarks = ?, updated_at = NOW() WHERE id = ?',
      [newReceived, remarks || null, id]
    );
  }

  const remaining = totalQty ? Math.max(0, totalQty - newReceived) : 0;
  return res.json({
    success: true,
    is_completed: isCompleted,
    received_quantity: newReceived,
    remaining_quantity: remaining,
    unit: request.unit || '',
    remarks: remarks || null,
    message: isCompleted
      ? 'Request fully fulfilled!'
      : `Receipt recorded. ${remaining} ${request.unit || ''} remaining.`,
  });
};

// ─── Profile Update ───────────────────────────────────────────────────────────

exports.updateProfile = async (req, res) => {
  const user = req.user;

  if (user.role === 'donor') {
    const { first_name, last_name, middle_initial, suffix, date_of_birth, gender, house_no, street, barangay, city_municipality, province_region, postal_zip_code, contact_number } = req.body;
    if (!first_name || !last_name) {
      return res.status(422).json({ success: false, errors: { first_name: ['Required.'] } });
    }
    await db.execute(
      `UPDATE donors SET first_name=?, last_name=?, middle_name=?, suffix=?, dob=?, gender=?, house=?, street=?, barangay=?, city=?, province=?, zip=?, contact=?, updated_at=NOW() WHERE user_id=?`,
      [first_name, last_name, middle_initial || null, suffix || null, date_of_birth || null, gender || null, house_no || null, street || null, barangay || null, city_municipality || null, province_region || null, postal_zip_code || null, contact_number || null, user.id]
    );
  } else if (user.role === 'organization') {
    const { organization_name, website_url, industry_sector, organization_type, contact_person, position_role, contact_number } = req.body;
    if (!organization_name) {
      return res.status(422).json({ success: false, errors: { organization_name: ['Required.'] } });
    }
    await db.execute(
      `UPDATE donor_organizations SET org_name=?, website=?, industry=?, type=?, first_name=?, last_name=?, contact=?, updated_at=NOW() WHERE user_id=?`,
      [organization_name, website_url || null, industry_sector || null, organization_type || null, contact_person || null, position_role || null, contact_number || null, user.id]
    );
  }

  return res.json({ success: true, message: 'Profile updated successfully.' });
};

exports.deactivateAccount = async (req, res) => {
  await db.execute('UPDATE users SET is_active = false WHERE id = ?', [req.user.id]);
  return res.json({ success: true, message: 'Account deactivated.' });
};
