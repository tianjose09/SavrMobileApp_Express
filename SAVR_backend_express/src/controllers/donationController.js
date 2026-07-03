const axios = require('axios');
const crypto = require('crypto');
const db = require('../db');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);
const { createNotification } = require('./notificationController');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount) {
  return parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

db.execute(`ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS reference_id INTEGER DEFAULT NULL`).catch(() => {});
db.execute(`ALTER TABLE donation_deliveries ADD COLUMN IF NOT EXISTS proof_of_transfer TEXT DEFAULT NULL`).catch(() => {});
db.execute(`ALTER TABLE donation_deliveries ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255) DEFAULT NULL`).catch(() => {});
db.execute(`ALTER TABLE donation_deliveries ADD COLUMN IF NOT EXISTS transfer_datetime TIMESTAMP DEFAULT NULL`).catch(() => {});
db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS financial_received_at TIMESTAMP DEFAULT NULL`).catch(() => {});
db.execute(`ALTER TABLE food_donation_records ADD COLUMN IF NOT EXISTS delivery_note TEXT DEFAULT NULL`).catch(() => {});
db.execute(`ALTER TABLE food_donation_records ADD COLUMN IF NOT EXISTS tracking_link TEXT DEFAULT NULL`).catch(() => {});
db.execute(`ALTER TABLE donation_deliveries ADD COLUMN IF NOT EXISTS beneficiary_confirmed TINYINT(1) DEFAULT 0`).catch(() => {});
db.execute(`ALTER TABLE donation_deliveries ADD COLUMN IF NOT EXISTS beneficiary_confirmed_at DATETIME DEFAULT NULL`).catch(() => {});

async function logActivity(userId, type, title, description, icon = 'financialiconyellow', referenceId = null) {
  await db.execute(
    'INSERT INTO activity_logs (user_id, type, title, description, icon, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [userId, type, title, description, icon, referenceId]
  );
}

async function recalculateBadges(userId) {
  const [[foodRow]] = await db.execute(
    "SELECT COUNT(*) AS cnt FROM food_donation_records WHERE user_id = ? AND status IN ('pending', 'scheduled', 'approved', 'received', 'completed')",
    [userId]
  );
  const [[financialRow]] = await db.execute(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM financial_donation_records WHERE user_id = ? AND status = 'approved'",
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
      const wasEarned = existing[0].status === 'earned';
      const earnedAt = status === 'earned' && !existing[0].earned_at ? new Date() : existing[0].earned_at;
      await db.execute(
        'UPDATE user_badges SET status = ?, progress = ?, earned_at = ?, updated_at = NOW() WHERE user_id = ? AND badge_id = ?',
        [status, progress, earnedAt, userId, badge.id]
      );
      if (status === 'earned' && !wasEarned) {
        await createNotification(userId, 'badge', `Badge Unlocked: ${badge.name}`, `Congratulations! You've earned the "${badge.name}" badge. Keep up the great work!`, true);
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
  const { amount } = req.body;
  const message = req.body.message || req.body.remarks;
  const isExpoGo = req.body.is_expo_go === true || req.body.is_expo_go === 'true';

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
            payment_method_types: ['qrph'],
            success_url: `${baseUrl}/api/payment/success?donation_id=${donationId}&is_expo_go=${isExpoGo}`,
            cancel_url: `${baseUrl}/api/payment/cancel?donation_id=${donationId}&is_expo_go=${isExpoGo}`,
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
        "SELECT * FROM financial_donation_records WHERE paymongo_payment_id = ? AND status != 'approved'",
        [checkoutId]
      );
      const donation = rows[0];
      if (donation) {
        await db.execute("UPDATE financial_donation_records SET status = 'approved' WHERE id = ?", [donation.id]);
        await logActivity(donation.user_id, 'financial', 'Financial Donation Paid', `₱${formatAmount(donation.amount)} payment confirmed`, 'financialiconyellow');
        await createNotification(donation.user_id, 'financial', 'Payment Confirmed', `Your financial donation of ₱${formatAmount(donation.amount)} has been successfully received. Thank you for your generosity!`);
        await recalculateBadges(donation.user_id);
      }
    }
  }

  if (event === 'payment.failed' || event === 'checkout_session.payment.failed') {
    const checkoutId = data?.id || data?.attributes?.checkout_session_id;
    if (checkoutId) {
      const [claim] = await db.execute(
        "UPDATE financial_donation_records SET status = 'failed', updated_at = NOW() WHERE paymongo_payment_id = ? AND status NOT IN ('approved','failed','cancelled')",
        [checkoutId]
      );
      if (claim.affectedRows > 0) {
        const [rows] = await db.execute('SELECT * FROM financial_donation_records WHERE paymongo_payment_id = ?', [checkoutId]);
        const donation = rows[0];
        if (donation) {
          await createNotification(donation.user_id, 'financial', 'Payment Failed', `Your financial donation of ₱${formatAmount(donation.amount)} could not be processed. Please try again.`, true);
        }
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
        await db.execute("UPDATE financial_donation_records SET status = 'approved', updated_at = NOW() WHERE id = ?", [donation.id]);
        await logActivity(donation.user_id, 'financial', 'Financial Donation Paid', `₱${formatAmount(donation.amount)} payment confirmed`, 'financialiconyellow');
        await createNotification(donation.user_id, 'financial', 'Payment Confirmed', `Your financial donation of ₱${formatAmount(donation.amount)} has been successfully received. Thank you for your generosity!`, true);
        await recalculateBadges(donation.user_id);
        return res.json({ success: true, status: 'paid', amount: donation.amount });
      }

      const sessionFailed = attrs?.status === 'expired' || attrs?.status === 'failed';
      const paymentFailed = Array.isArray(attrs?.payments)
        && attrs.payments.some(p => p?.attributes?.status === 'failed');
      if (sessionFailed || paymentFailed) {
        // Atomic claim — only the first update fires the notification, prevents race condition duplicates
        const [claim] = await db.execute(
          "UPDATE financial_donation_records SET status = 'failed', updated_at = NOW() WHERE id = ? AND status NOT IN ('approved','failed','cancelled')",
          [donation.id]
        );
        if (claim.affectedRows > 0) {
          await createNotification(donation.user_id, 'financial', 'Payment Failed', `Your financial donation of ₱${formatAmount(donation.amount)} could not be processed. Please try again from the app.`, true);
        }
        return res.json({ success: true, status: 'failed', amount: donation.amount });
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
      "SELECT * FROM financial_donation_records WHERE id = ? AND status != 'approved'",
      [req.query.donation_id]
    );
    const donation = rows[0];
    if (donation) {
      await db.execute("UPDATE financial_donation_records SET status = 'approved' WHERE id = ?", [donation.id]);
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
    function returnToApp() {
      const isExpoGo = ${req.query.is_expo_go === 'true'};
      const scheme = isExpoGo ? 'exp+savrmobile://' : 'savrmobile://';
      window.location.href = scheme;
      setTimeout(function () { window.close(); }, 2000);
    }
    window.onload = returnToApp;
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

    <a class="btn" onclick="returnToApp(); return false;" href="#">Return to App</a>
    <a class="btn-outline" onclick="returnToApp(); return false;" href="#">Go to Dashboard</a>

    <p class="footer-note">Powered by PayMongo &nbsp;·&nbsp; SAVR Philippine FoodBank</p>
  </div>
</body>
</html>`);
};

exports.paymentCancel = async (req, res) => {
  if (req.query.donation_id) {
    await db.execute(
      "UPDATE financial_donation_records SET status = 'cancelled', updated_at = NOW() WHERE id = ? AND status NOT IN ('approved','failed','cancelled')",
      [req.query.donation_id]
    );
  }
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Cancelled – SAVR</title>
  <script>
    function returnToApp() {
      const isExpoGo = ${req.query.is_expo_go === 'true'};
      const scheme = isExpoGo ? 'exp+savrmobile://' : 'savrmobile://';
      window.location.href = scheme;
      setTimeout(function () { window.close(); }, 2000);
    }
    window.onload = returnToApp;
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

    <a class="btn" onclick="returnToApp(); return false;" href="#">Return to App</a>
    <a class="btn-outline" onclick="returnToApp(); return false;" href="#">Try Again</a>

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

    let photoPath = null;
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = process.env.APP_URL || `${proto}://${req.get('host')}`;
    const toUrlPath = (file) => `${baseUrl}/storage/donations/food/${file.filename}`;
    const photoFilename = item.photo_filename || item.photoFilename;
    if (photoFilename) {
      const matchedFile = files.find(f => f.originalname === photoFilename || f.originalname.endsWith(photoFilename));
      if (matchedFile) photoPath = toUrlPath(matchedFile);
    }
    if (!photoPath && files[i]) {
      photoPath = toUrlPath(files[i]);
    }

    await db.execute(
      `INSERT INTO food_donation_record_items (food_donation_record_id, food_name, quantity, unit, category, expiration_date, special_notes, photo_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [donationId, item.foodName || item.name || item.type || 'Unknown Item', numQty, unit, item.category || 'General', expiryDate, item.notes || item.special_notes || null, photoPath]
    );
  }

  const modeLabel = schedule_type === 'delivery' ? 'drop-off' : 'pickup';
  await logActivity(req.user.id, 'food', 'Food Donation Submitted', `${foodItems.length} item(s) submitted and pending admin confirmation`, 'truckicon', donationId);
  await createNotification(req.user.id, 'food', 'Food Donation Submitted', `Your food donation of ${foodItems.length} item(s) has been submitted and scheduled for ${modeLabel}. Thank you!`);
  if (schedule_type === 'delivery') {
    const formattedDate = preferred_date ? dayjs(preferred_date).format('MMMM DD, YYYY') : 'the specified date';
    await createNotification(
      req.user.id,
      'food',
      'Delivery Due Date Reminder',
      `Reminder: Please deliver your food donation to the food bank/kitchen on your scheduled date: ${formattedDate}.`,
      true
    );
  }
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
  if (schedule_type === 'delivery') {
    const formattedDate = preferred_date ? dayjs(preferred_date).format('MMMM DD, YYYY') : 'the specified date';
    await createNotification(
      req.user.id,
      'food',
      'Delivery Due Date Reminder',
      `Reminder: Please deliver your food donation to the food bank/kitchen on your scheduled date: ${formattedDate}.`,
      true
    );
  }
  await recalculateBadges(req.user.id);

  return res.json({ success: true, message: `${schedule_type.charAt(0).toUpperCase() + schedule_type.slice(1)} scheduled.`, donation: updated[0] });
};

// ─── Service Donation ─────────────────────────────────────────────────────────

exports.submitService = async (req, res) => {
  const {
    service_type, quantity, frequency, service_date, return_date, service_time, address,
    contact_first_name, contact_last_name, contact_email, description,
    vehicle_type, capacity, max_distance, transport_categories,
    headcount, preferred_work, skill_categories,
    all_day, starts_at, ends_at, day_of_week,
  } = req.body;

  if (!service_type || !contact_first_name || !contact_last_name || !contact_email) {
    return res.status(422).json({ success: false, message: 'Required fields missing.' });
  }

  const isTransportation = (service_type || '').toLowerCase() === 'transportation';
  const isAllDay = all_day === true || all_day === 'true';

  // Transportation uses date fields (deliver/return), not time fields
  if (isTransportation) {
    if (!service_date || !return_date) {
      return res.status(422).json({ success: false, message: 'Delivery date and return date are required for Transportation.' });
    }
  } else if (!isAllDay && (!starts_at || !ends_at)) {
    return res.status(422).json({ success: false, message: 'Start and end times are required for non-all day services.' });
  }

  const cleanTime = (str) => (str || '').replace(/[^\x20-\x7E]/g, ' ').trim();
  let startsAt = null;
  let endsAt = null;

  // Only parse time strings for Volunteer work — Transportation uses dates, not times
  if (!isTransportation && !isAllDay) {
    try { startsAt = dayjs(`1970-01-01 ${cleanTime(starts_at)}`).format('HH:mm:ss'); } catch {}
    try { endsAt = dayjs(`1970-01-01 ${cleanTime(ends_at)}`).format('HH:mm:ss'); } catch {}
  }

  // deliver_at / return_at are the actual DB column names (varchar)
  const deliverAt = isTransportation ? (service_date || null) : null;
  const returnAt  = isTransportation ? (return_date  || null) : null;
  // For Volunteer Work the existing `date` column stores the preferred date
  const finalDate = !isTransportation ? (service_date || null) : null;

  const transportCatsJson = transport_categories
    ? (typeof transport_categories === 'string' ? transport_categories : JSON.stringify(transport_categories))
    : null;
  const skillCatsJson = skill_categories
    ? (typeof skill_categories === 'string' ? skill_categories : JSON.stringify(skill_categories))
    : null;

  // Ensure extra columns exist (safe to run repeatedly)
  await db.execute(`ALTER TABLE service_donation_records ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(255) DEFAULT NULL`).catch(() => {});
  await db.execute(`ALTER TABLE service_donation_records ADD COLUMN IF NOT EXISTS capacity VARCHAR(100) DEFAULT NULL`).catch(() => {});
  await db.execute(`ALTER TABLE service_donation_records ADD COLUMN IF NOT EXISTS max_distance VARCHAR(100) DEFAULT NULL`).catch(() => {});
  await db.execute(`ALTER TABLE service_donation_records ADD COLUMN IF NOT EXISTS transport_categories JSON DEFAULT NULL`).catch(() => {});
  await db.execute(`ALTER TABLE service_donation_records ADD COLUMN IF NOT EXISTS headcount INTEGER DEFAULT NULL`).catch(() => {});
  await db.execute(`ALTER TABLE service_donation_records ADD COLUMN IF NOT EXISTS preferred_work VARCHAR(255) DEFAULT NULL`).catch(() => {});
  await db.execute(`ALTER TABLE service_donation_records ADD COLUMN IF NOT EXISTS skill_categories JSON DEFAULT NULL`).catch(() => {});
  await db.execute(`ALTER TABLE service_donation_records ADD COLUMN IF NOT EXISTS deliver_at VARCHAR(50) DEFAULT NULL`).catch(() => {});
  await db.execute(`ALTER TABLE service_donation_records ADD COLUMN IF NOT EXISTS return_at VARCHAR(50) DEFAULT NULL`).catch(() => {});

  const [result] = await db.execute(
    `INSERT INTO service_donation_records
       (user_id, service_tab, quantity, frequency, date, deliver_at, return_at, day_of_week, starts_at, ends_at, all_day, address,
        first_name, last_name, email, notes,
        vehicle_type, capacity, max_distance, transport_categories,
        headcount, preferred_work, skill_categories,
        status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
    [
      req.user.id, service_type, parseInt(quantity) || null, frequency,
      finalDate, deliverAt, returnAt, day_of_week || null, startsAt, endsAt, isAllDay ? 1 : 0,
      isTransportation ? 'Transportation' : (address || 'Volunteer'),
      contact_first_name, contact_last_name, contact_email, description || null,
      vehicle_type || null, parseInt(capacity) || null, parseInt(max_distance) || null, transportCatsJson,
      parseInt(headcount) || null, preferred_work || null, skillCatsJson,
    ]
  );

  const [donation] = await db.execute('SELECT * FROM service_donation_records WHERE id = ?', [result.insertId]);

  const qtyLabel = service_type === 'Volunteer Work' ? `${headcount} volunteer(s)` : `${quantity} vehicle(s)`;
  await logActivity(req.user.id, 'service', 'Service Donation Submitted', `${service_type} - ${qtyLabel}`, 'truckicon', result.insertId);
  await createNotification(req.user.id, 'service', 'Service Donation Submitted', `Your ${service_type} service donation has been submitted and is now awaiting approval from our team. We will notify you once it has been reviewed. Thank you for volunteering!`);
  await recalculateBadges(req.user.id);

  return res.status(201).json({ success: true, message: 'Service donation submitted.', donation: donation[0] });
};

// ─── Stats ────────────────────────────────────────────────────────────────────

exports.getDonationStats = async (req, res) => {
  const uid = req.user.id;

  const [[totalFinancialRow]] = await db.execute(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM financial_donation_records WHERE user_id = ? AND status = 'approved'",
    [uid]
  );
  const [[totalFoodRow]] = await db.execute(
    "SELECT COUNT(*) AS cnt FROM food_donation_records WHERE user_id = ? AND status IN ('pending', 'scheduled', 'approved', 'received', 'completed')",
    [uid]
  );
  const [[totalServiceRow]] = await db.execute(
    "SELECT COUNT(*) AS cnt FROM service_donation_records WHERE user_id = ? AND status IN ('confirmed','completed')",
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
      `SELECT fdr.*,
        EXISTS (
          SELECT 1 FROM truck_stops ts2
          WHERE ts2.reference_id::text = fdr.id::text
            AND ts2.source = 'food_donation'
            AND ts2.stop_type = 'PICKUP'
            AND ts2.status = 'in_transit'
        ) AS pickup_now
       FROM food_donation_records fdr
       WHERE fdr.user_id = ?
         AND fdr.status IN ('pending','scheduled','approved','accepted','confirmed','in_transit')
         AND (
           fdr.mode = 'delivery'
           OR NOT EXISTS (
             SELECT 1 FROM truck_stops ts
             WHERE ts.reference_id::text = fdr.id::text
               AND ts.source = 'food_donation'
               AND ts.stop_type = 'PICKUP'
               AND ts.status = 'completed'
           )
         )
       ORDER BY fdr.created_at DESC`,
      [uid]
    );

    return res.json({
      success: true,
      pickups: pickups.map(p => ({
        id: p.id,
        status: p.status,
        mode: p.mode,
        pickup_now: !!p.pickup_now,
        preferred_date: p.preferred_date ? dayjs(p.preferred_date).format('YYYY-MM-DD') : null,
        time_slot: (() => {
          const formatTime12Hour = (timeStr) => {
            if (!timeStr) return '';
            const parsed = dayjs(`1970-01-01 ${timeStr}`);
            return parsed.isValid() ? parsed.format('h:mm A') : timeStr;
          };
          const start12 = formatTime12Hour(p.time_slot_start);
          const end12 = p.time_slot_end ? formatTime12Hour(p.time_slot_end) : '';
          return start12 + (end12 ? ` - ${end12}` : '');
        })(),
        pickup_address: p.pickup_address,
        delivery_note: p.delivery_note || null,
        tracking_link: p.tracking_link || null,
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

exports.confirmDelivery = async (req, res) => {
  const { id } = req.params;
  const uid = req.user.id;
  const { note, tracking_link } = req.body;

  try {
    const [rows] = await db.execute(
      "SELECT * FROM food_donation_records WHERE id = ? AND user_id = ?",
      [id, uid]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Donation not found.' });
    }

    await db.execute(
      "UPDATE food_donation_records SET status = 'in_transit', delivery_note = ?, tracking_link = ?, updated_at = NOW() WHERE id = ?",
      [note || null, tracking_link || null, id]
    );

    const [userRows] = await db.execute('SELECT name FROM users WHERE id = ?', [uid]);
    const donorName = userRows[0]?.name || 'A donor';

    const phTime = new Date().toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    const trackingText = tracking_link ? ` Tracking link: ${tracking_link}` : '';
    const [staffRows] = await db.execute("SELECT id FROM users WHERE role = 'staff'");
    const title = 'Donor On The Way';
    const description = `${donorName} is on the way to the warehouse. (${phTime})${trackingText}`;
    for (const staff of staffRows) {
      await createNotification(staff.id, 'food', title, description, false);
    }

    return res.json({ success: true, message: 'Staff notified that you are on the way.' });
  } catch (err) {
    console.error('[confirmDelivery]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to notify staff.', error: err.message });
  }
};

exports.markArrived = async (req, res) => {
  const { id } = req.params;
  const uid = req.user.id;

  try {
    const [rows] = await db.execute(
      "SELECT * FROM food_donation_records WHERE id = ? AND user_id = ?",
      [id, uid]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Donation not found.' });
    }

    const [userRows] = await db.execute('SELECT name FROM users WHERE id = ?', [uid]);
    const donorName = userRows[0]?.name || 'A donor';

    const phTime = new Date().toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    const [staffRows] = await db.execute("SELECT id FROM users WHERE role = 'staff'");
    const title = 'Donor Has Arrived';
    const description = `${donorName} is already at the delivery address. (${phTime})`;
    for (const staff of staffRows) {
      await createNotification(staff.id, 'food', title, description, true);
    }

    return res.json({ success: true, message: 'Staff notified that you have arrived.' });
  } catch (err) {
    console.error('[markArrived]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to report arrival.', error: err.message });
  }
};

exports.declinePickup = async (req, res) => {
  const { id } = req.params;
  const uid = req.user.id;

  try {
    const [rows] = await db.execute(
      "SELECT * FROM food_donation_records WHERE id = ? AND user_id = ?",
      [id, uid]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pickup not found.' });
    }

    await db.execute(
      "UPDATE food_donation_records SET status = 'cancelled', notified_status = 'cancelled', updated_at = NOW() WHERE id = ?",
      [id]
    );

    await db.execute(
      "DELETE FROM truck_stops WHERE reference_id::text = ? AND source = 'food_donation'",
      [id]
    );

    const [userRows] = await db.execute('SELECT name FROM users WHERE id = ?', [uid]);
    const donorName = userRows[0]?.name || 'A donor';

    await logActivity(
      uid,
      'food',
      'Food Donation Cancelled',
      `Pickup declined by donor ${donorName}`,
      'truckicon',
      id
    );

    const [staffRows] = await db.execute("SELECT id FROM users WHERE role = 'staff'");
    const title = 'Scheduled Pickup Declined';
    const description = `${donorName} has declined the scheduled pickup for donation #${id}.`;
    for (const staff of staffRows) {
      await createNotification(staff.id, 'food', title, description, true);
    }

    return res.json({ success: true, message: 'Pickup declined successfully.' });
  } catch (err) {
    console.error('[declinePickup]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to decline pickup.', error: err.message });
  }
};

exports.declineEarly = async (req, res) => {
  const { id } = req.params;
  const uid = req.user.id;

  try {
    const [rows] = await db.execute(
      "SELECT * FROM food_donation_records WHERE id = ? AND user_id = ?",
      [id, uid]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pickup not found.' });
    }

    // Revert the in_transit truck stop back to pending (staff can re-attempt)
    await db.execute(
      "UPDATE truck_stops SET status = 'pending', updated_at = NOW() WHERE reference_id::text = ? AND source = 'food_donation' AND stop_type = 'PICKUP' AND status = 'in_transit'",
      [id]
    );

    // Reset the donation record back to accepted so it still appears as approved
    await db.execute(
      "UPDATE food_donation_records SET status = 'accepted', updated_at = NOW() WHERE id = ?",
      [id]
    );

    const [userRows] = await db.execute('SELECT name FROM users WHERE id = ?', [uid]);
    const donorName = userRows[0]?.name || 'A donor';

    const [staffRows] = await db.execute("SELECT id FROM users WHERE role = 'staff'");
    for (const staff of staffRows) {
      await createNotification(staff.id, 'food', 'Donor Declined Pickup', `${donorName} is unable to proceed with the pickup for donation #${id} at this time.`, true);
    }

    return res.json({ success: true, message: 'Pickup declined. Staff has been notified.' });
  } catch (err) {
    console.error('[declineEarly]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to decline pickup.', error: err.message });
  }
};

// ─── Badges ───────────────────────────────────────────────────────────────────

exports.getBadges = async (req, res) => {
  const uid = req.user.id;

  // Always recalculate before returning so staff approvals on the web are reflected immediately
  await recalculateBadges(uid);

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
  service:   'Submitted',
  inventory: 'Done',
};

function liveServiceStatus(dbStatus) {
  const s = (dbStatus || '').toLowerCase();
  if (s === 'accepted' || s === 'confirmed') return 'Accepted';
  if (s === 'completed') return 'Completed';
  if (s === 'declined' || s === 'rejected') return 'Rejected';
  if (s === 'cancelled') return 'Cancelled';
  return 'Submitted';
}

function liveFoodStatus(dbStatus) {
  const s = (dbStatus || '').toLowerCase();
  if (s === 'approved' || s === 'accepted' || s === 'confirmed') return 'Approved';
  if (s === 'in_transit') return 'In Transit';
  if (s === 'scheduled') return 'Scheduled';
  if (s === 'received' || s === 'completed') return 'Completed';
  if (s === 'rejected') return 'Denied';
  if (s === 'cancelled') return 'Cancelled';
  return 'Pending';
}

exports.getActivities = async (req, res) => {
  const uid = req.user.id;
  const [activities] = await db.execute(
    'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC',
    [uid]
  );

  // Collect reference IDs so we can fetch live statuses in bulk
  const foodRefIds = activities
    .filter(a => a.type === 'food' && a.reference_id && (a.title || '').toLowerCase().includes('submitted'))
    .map(a => a.reference_id);
  const serviceRefIds = activities
    .filter(a => a.type === 'service' && a.reference_id && (a.title || '').toLowerCase().includes('submitted'))
    .map(a => a.reference_id);

  // Live statuses
  const foodStatusMap = {};
  if (foodRefIds.length > 0) {
    const placeholders = foodRefIds.map(() => '?').join(',');
    const [foodRows] = await db.execute(
      `SELECT id, status FROM food_donation_records WHERE id IN (${placeholders})`,
      foodRefIds
    );
    foodRows.forEach(r => { foodStatusMap[r.id] = r.status; });
  }

  const serviceStatusMap = {};
  const serviceDescMap = {};
  if (serviceRefIds.length > 0) {
    const placeholders = serviceRefIds.map(() => '?').join(',');
    const [svcRows] = await db.execute(
      `SELECT id, status, service_tab, vehicle_type, quantity, headcount FROM service_donation_records WHERE id IN (${placeholders})`,
      serviceRefIds
    );
    svcRows.forEach(r => {
      serviceStatusMap[r.id] = r.status;
      const tab = (r.service_tab || '').toLowerCase();
      if (tab === 'transportation' && r.vehicle_type) {
        const qty = parseInt(r.quantity) || 1;
        serviceDescMap[r.id] = `Transportation - ${r.vehicle_type} (${qty} unit${qty !== 1 ? 's' : ''})`;
      } else {
        const hc = parseInt(r.headcount) || 1;
        serviceDescMap[r.id] = `Volunteer Work - ${hc} volunteer${hc !== 1 ? 's' : ''}`;
      }
    });
  }

  // Food item descriptions — pull actual donated items
  const foodItemsDescMap = {};
  if (foodRefIds.length > 0) {
    const placeholders = foodRefIds.map(() => '?').join(',');
    const [itemRows] = await db.execute(
      `SELECT food_donation_record_id, food_name, quantity, unit
       FROM food_donation_record_items WHERE food_donation_record_id IN (${placeholders})`,
      foodRefIds
    );
    const grouped = {};
    itemRows.forEach(row => {
      if (!grouped[row.food_donation_record_id]) grouped[row.food_donation_record_id] = [];
      grouped[row.food_donation_record_id].push(`${row.food_name} (${row.quantity} ${row.unit})`);
    });
    Object.entries(grouped).forEach(([id, items]) => {
      const shown = items.slice(0, 3);
      const extra = items.length - shown.length;
      foodItemsDescMap[id] = shown.join(', ') + (extra > 0 ? `, and ${extra} more` : '');
    });
  }

  return res.json({
    success: true,
    activities: activities.map(a => {
      const titleLower = (a.title || '').toLowerCase();
      let status = ACTIVITY_STATUS[a.type] || 'Updated';
      let description = a.description;

      if (a.type === 'food') {
        if (titleLower.includes('submitted') && a.reference_id) {
          if (foodStatusMap[a.reference_id] !== undefined)
            status = liveFoodStatus(foodStatusMap[a.reference_id]);
          if (foodItemsDescMap[a.reference_id])
            description = foodItemsDescMap[a.reference_id];
        } else if (titleLower.includes('approved')) status = 'Approved';
        else if (titleLower.includes('received') || titleLower.includes('completed')) status = 'Completed';
        else if (titleLower.includes('rejected') || titleLower.includes('denied')) status = 'Denied';
        else status = 'Pending';
      }

      if (a.type === 'service' && titleLower.includes('submitted') && a.reference_id) {
        if (serviceStatusMap[a.reference_id] !== undefined)
          status = liveServiceStatus(serviceStatusMap[a.reference_id]);
        if (serviceDescMap[a.reference_id])
          description = serviceDescMap[a.reference_id];
      }

      if (titleLower.includes('missed')) status = 'Missed';

      return {
        id: a.id,
        type: a.type,
        title: a.title,
        description,
        icon: a.icon,
        status,
        date: dayjs(a.created_at).format('MM/DD/YYYY'),
        time_ago: dayjs(a.created_at).fromNow(),
      };
    }),
  });
};

// ─── Beneficiary Requests ─────────────────────────────────────────────────────

exports.submitBeneficiaryRequest = async (req, res) => {
  try {
    const {
      title, type, food_type, quantity, unit, financial_amount,
      population, age_start, age_end, street, barangay,
      city_municipality, postal_zip_code, needed_date, urgency_level,
      food_items, latitude, longitude,
      account_name, account_number,
    } = req.body;
    const receiving_method = req.body.receiving_method || req.body.bank_name || null;

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
       (user_id, request_name, type, food_type, quantity, unit, amount, population, age_min, age_max, street, barangay, city, zip_code, latitude, longitude, start_date, end_date, urgency, food_items, receiving_method, account_name, account_number, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW(), NOW())`,
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
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        needed_date || null,
        req.body.end_date || null,
        urgency_level || null,
        parsedFoodItems ? JSON.stringify(parsedFoodItems) : null,
        receiving_method || null,
        account_name || null,
        account_number || null,
      ]
    );

    await createNotification(req.user.id, 'service', 'Request Submitted', `Your assistance request "${title}" has been received and is being reviewed. We will notify you once it is processed.`);

    return res.status(201).json({ success: true, message: 'Request submitted successfully.', request_id: result.insertId });
  } catch (e) {
    console.error('[submitBeneficiaryRequest]', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.getBeneficiaryRequests = async (req, res) => {
  try {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = process.env.APP_URL || `${proto}://${req.get('host')}`;

  const [requests] = await db.execute(
    "SELECT * FROM beneficiary_requests WHERE user_id = ? AND status != 'Deleted' ORDER BY created_at DESC",
    [req.user.id]
  );

  const requestIds = requests.map(r => r.id);

  // Bulk-fetch financial disbursements from donation_deliveries
  const disbursementsByRequest = {};
  if (requestIds.length > 0) {
    try {
      let deliveryRows = [];
      try {
        [deliveryRows] = await db.execute(`
          SELECT dd.beneficiary_request_id, del.id AS delivery_id, del.delivery_items, del.status,
                 del.created_at, del.proof_of_transfer, del.reference_number, del.transfer_datetime,
                 del.grant_amount, del.receipt_path, del.notes, del.received_at
          FROM donation_deliveries del
          JOIN donation_drives dd ON dd.id = del.donation_drive_id
          WHERE dd.beneficiary_request_id = ANY(?)
          ORDER BY del.created_at ASC
        `, [requestIds]);
      } catch (innerErr) {
        console.error('[getMyRequests] delivery query error:', innerErr.message);
      }
      console.log('[getMyRequests] deliveryRows count:', deliveryRows.length, '| requestIds:', requestIds);

      for (const row of deliveryRows) {
        const rid = row.beneficiary_request_id;
        let items = [];
        try {
          const parsed = typeof row.delivery_items === 'string' ? JSON.parse(row.delivery_items) : row.delivery_items;
          items = Array.isArray(parsed) ? parsed : [];
        } catch {}
        const financialItems = items.filter((item) => item.type === 'financial');

        // Include row if it has financial delivery_items OR if staff set grant_amount directly
        const hasDirectGrant = row.grant_amount !== null && row.grant_amount !== undefined;
        if (financialItems.length === 0 && !hasDirectGrant) continue;

        if (!disbursementsByRequest[rid]) disbursementsByRequest[rid] = [];

        const webAppUrl = process.env.WEB_APP_URL || baseUrl;
        const toAbsoluteUrl = (p) => {
          if (!p) return null;
          if (p.startsWith('http://') || p.startsWith('https://')) return p;
          // Paths starting with 'financial-records/' were uploaded by the web app
          if (p.startsWith('financial-records/')) return `${webAppUrl}/storage/${p}`;
          return `${baseUrl}/storage/${p}`;
        };

        if (financialItems.length > 0) {
          for (const fi of financialItems) {
            // Prefer proof_of_transfer (may already be an absolute URL set by web app)
            const receiptUrl = toAbsoluteUrl(row.proof_of_transfer || row.receipt_path || fi.receipt || null);
            disbursementsByRequest[rid].push({
              id: row.delivery_id,
              delivery_id: row.delivery_id,
              amount: parseFloat(row.grant_amount || fi.qty || fi.amount || '0'),
              date: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : null,
              status: row.status,
              proof_of_transfer: receiptUrl,
              notes: row.notes || fi.note || fi.notes || null,
              reference_number: row.reference_number || null,
              transfer_datetime: row.transfer_datetime ? new Date(row.transfer_datetime).toISOString() : null,
              confirmed: !!row.received_at,
              confirmed_at: row.received_at ? new Date(row.received_at).toISOString() : null,
            });
          }
        } else {
          // grant_amount set directly by staff with no delivery_items
          const receiptUrl = toAbsoluteUrl(row.proof_of_transfer || row.receipt_path || null);
          disbursementsByRequest[rid].push({
            id: row.delivery_id,
            delivery_id: row.delivery_id,
            amount: parseFloat(row.grant_amount || '0'),
            date: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : null,
            status: row.status,
            proof_of_transfer: receiptUrl,
            notes: row.notes || null,
            reference_number: row.reference_number || null,
            transfer_datetime: row.transfer_datetime ? new Date(row.transfer_datetime).toISOString() : null,
            confirmed: !!row.received_at,
            confirmed_at: row.received_at ? new Date(row.received_at).toISOString() : null,
          });
        }
      }
    } catch (disbErr) {
      console.error('[getMyRequests] disbursement fetch error:', disbErr.message);
    }
  }

  // Bulk-fetch all DELIVER truck stops — each row is one food item in a delivery
  let allStops = [];
  if (requestIds.length > 0) {
    const placeholders = requestIds.map(() => '?').join(',');
    [allStops] = await db.execute(`
      SELECT ts.id AS stop_id, ts.status, ts.date, ts.time_slot_start, ts.time_slot_end,
             ts.food_name, ts.qty, ts.unit, ts.food_type,
             dd.id AS drive_id, dd.beneficiary_request_id, dd.status AS drive_status,
             dd.start_date AS drive_start_date, dd.end_date AS drive_end_date
      FROM truck_stops ts
      JOIN donation_drives dd ON dd.id = ts.reference_id AND ts.source = 'donation_drive'
      WHERE dd.beneficiary_request_id IN (${placeholders}) AND ts.stop_type = 'DELIVER'
      ORDER BY dd.id ASC, ts.id ASC
    `, requestIds);
  }

  // One batch card per truck_stop (matches web: each stop = one delivery event)
  const batchesByRequest = {};
  for (const stop of allStops) {
    const rid = stop.beneficiary_request_id;
    const stopStatus = (stop.status || '').toLowerCase();
    const mappedStatus = ['notified'].includes(stopStatus) ? 'missed' : stopStatus;
    const item = {
      food_name: stop.food_name || '',
      qty: parseFloat(stop.qty || '0'),
      unit: stop.unit || '',
      category: stop.food_type || '',
    };
    if (!batchesByRequest[rid]) batchesByRequest[rid] = [];
    batchesByRequest[rid].push({
      stop_id: stop.stop_id,
      drive_id: stop.drive_id,
      request_id: rid,
      drive_status: (stop.drive_status || '').toLowerCase(),
      status: mappedStatus,
      date: stop.date ? new Date(stop.date).toISOString().split('T')[0] : null,
      time: stop.time_slot_start ? stop.time_slot_start.substring(0, 5) : null,
      time_end: stop.time_slot_end ? stop.time_slot_end.substring(0, 5) : null,
      start_date: stop.drive_start_date ? new Date(stop.drive_start_date).toISOString().split('T')[0] : null,
      end_date: stop.drive_end_date ? new Date(stop.drive_end_date).toISOString().split('T')[0] : null,
      delivery_food_items: mappedStatus === 'pending' ? [item] : [],   // DELIVERING badge
      delivered_food_items: mappedStatus === 'completed' ? [item] : [], // Delivered Batches
    });
  }

  const mapped = requests.map(r => {
    let foodItems = [];
    try { foodItems = typeof r.food_items === 'string' ? JSON.parse(r.food_items) : (r.food_items || []); } catch {}
    let receivedItems = [];
    try { receivedItems = typeof r.received_items === 'string' ? JSON.parse(r.received_items) : (r.received_items || []); } catch {}
    // Merge donation_deliveries disbursements with dispatched_items column (recorded by staff)
    const deliveryDisbursements = disbursementsByRequest[r.id] || [];
    let recordedDisbursements = [];
    try {
      const raw = typeof r.dispatched_items === 'string' ? JSON.parse(r.dispatched_items) : (r.dispatched_items || []);
      recordedDisbursements = Array.isArray(raw) ? raw : [];
    } catch {}
    // Use delivery-based if available; otherwise fall back to recorded disbursements from dispatched_items
    const disbursements = deliveryDisbursements.length > 0 ? deliveryDisbursements : recordedDisbursements;

    const deliveryBatches = (batchesByRequest[r.id] || []).map((b, idx) => ({
      batch_number: idx + 1,
      stop_id: b.stop_id,
      drive_id: b.drive_id,
      drive_status: b.drive_status,
      status: b.status,
      delivery_date: b.date,
      delivery_time_start: b.time,
      delivery_time_end: b.time_end,
      drive_start_date: b.start_date,
      drive_end_date: b.end_date,
      delivery_food_items: b.delivery_food_items,   // pending — for DELIVERING badge
      delivered_food_items: b.delivered_food_items, // completed — for Delivered Batches
    }));

    // Top-level delivery_food_items from the first pending batch
    const pendingBatch = deliveryBatches.find(b => b.status === 'pending') || deliveryBatches[0] || null;

    return {
      ...r,
      food_items: foodItems,
      received_items: receivedItems,
      dispatched_items: disbursements,
      dispatched_quantity: disbursements.reduce((sum, d) => sum + (d.amount || 0), 0),
      delivery_batches: deliveryBatches,
      delivery_food_items: pendingBatch?.delivery_food_items || [],
      // Aliased field names per spec
      receiving_method: r.receiving_method || null,
      account_name: r.account_name || null,
      account_number: r.account_number || null,
      age_range_min: r.age_min ?? null,
      age_range_max: r.age_max ?? null,
      drive_id: pendingBatch?.drive_id || null,
      drive_start_date: r.start_date
        ? new Date(r.start_date).toISOString().split('T')[0]
        : (r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : null),
      drive_status: deliveryBatches[0]?.drive_status || null,
      drive_end_date: (deliveryBatches[0]?.drive_end_date) || null,
      food_type: r.food_type || (foodItems[0]?.food_name ?? foodItems[0]?.name ?? null),
      quantity: r.quantity ?? (foodItems[0]?.qty ?? null),
      unit: r.unit || (foodItems[0]?.unit ?? null),
      financial_received_at: r.financial_received_at ? new Date(r.financial_received_at).toISOString() : null,
    };
  });

  return res.json({ success: true, requests: mapped });
  } catch (err) {
    console.error('[getBeneficiaryRequests]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch requests.' });
  }
};

exports.receiveBeneficiaryStop = async (req, res) => {
  const { id, stopId } = req.params;

  // Verify the stop is a DELIVER stop linked to this beneficiary's request
  const [stopRows] = await db.execute(`
    SELECT ts.id, ts.status, ts.reference_id AS drive_id, dd.beneficiary_request_id
    FROM truck_stops ts
    JOIN donation_drives dd ON dd.id = ts.reference_id AND ts.source = 'donation_drive'
    WHERE ts.id = ? AND dd.beneficiary_request_id = ? AND ts.stop_type = 'DELIVER'
  `, [stopId, id]);
  if (!stopRows.length) {
    return res.status(404).json({ success: false, message: 'Delivery stop not found.' });
  }
  const stop = stopRows[0];

  const [reqRows] = await db.execute(
    'SELECT * FROM beneficiary_requests WHERE id = ? AND user_id = ?',
    [id, req.user.id]
  );
  if (!reqRows.length) {
    return res.status(404).json({ success: false, message: 'Request not found.' });
  }
  const request = reqRows[0];

  // Mark only THIS specific stop as completed (each stop = one independent batch)
  await db.execute(
    "UPDATE truck_stops SET status = 'completed', notified_at = NOW(), updated_at = NOW() WHERE id = ?",
    [stopId]
  );

  // Flip the oldest in_transit donation_deliveries row to received so the web goal bar advances
  try {
    await db.execute(
      `UPDATE donation_deliveries SET status = 'received', updated_at = NOW()
       WHERE id = (
         SELECT id FROM donation_deliveries
         WHERE donation_drive_id = ? AND status = 'in_transit'
         ORDER BY created_at ASC LIMIT 1
       )`,
      [stop.drive_id]
    );
  } catch (e) {
    console.error('[receiveBeneficiaryStop] donation_deliveries flip failed:', e.message);
  }

  // Get only this stop's food item (not all items in the drive)
  const [driveItems] = await db.execute(
    "SELECT food_name, qty, unit FROM truck_stops WHERE id = ?",
    [stopId]
  );

  // Merge into accumulated received_items
  let existingReceived = [];
  try { existingReceived = typeof request.received_items === 'string' ? JSON.parse(request.received_items) : (request.received_items || []); } catch {}
  const receivedMap = {};
  for (const item of existingReceived) receivedMap[item.food_name] = parseFloat(item.received_qty || '0');
  for (const item of driveItems) {
    receivedMap[item.food_name] = (receivedMap[item.food_name] || 0) + parseFloat(item.qty || '0');
  }
  const updatedReceived = Object.entries(receivedMap).map(([food_name, received_qty]) => ({ food_name, received_qty }));

  // Check goal: all food_items requested qty met
  let foodItems = [];
  try { foodItems = typeof request.food_items === 'string' ? JSON.parse(request.food_items) : (request.food_items || []); } catch {}

  let goalMet = false;
  if (foodItems.length > 0) {
    goalMet = foodItems.every(item => {
      const name = item.food_name || item.name || 'Unknown';
      return (receivedMap[name] || 0) >= parseFloat(item.qty || item.quantity || '0');
    });
  } else if (request.quantity) {
    const totalReceived = Object.values(receivedMap).reduce((s, q) => s + q, 0);
    goalMet = totalReceived >= parseFloat(request.quantity);
  } else {
    goalMet = true;
  }

  if (goalMet) {
    await db.execute(
      "UPDATE beneficiary_requests SET status = 'Completed', received_items = ?, updated_at = NOW() WHERE id = ?",
      [JSON.stringify(updatedReceived), id]
    );
    await createNotification(req.user.id, 'service', 'Request Completed',
      `Your request "${request.request_name || 'Unnamed'}" has been fully fulfilled. Thank you!`, true);
  } else {
    await db.execute(
      'UPDATE beneficiary_requests SET received_items = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(updatedReceived), id]
    );
  }

  return res.json({
    success: true,
    message: goalMet ? 'All items received. Request completed!' : 'Delivery confirmed. More deliveries may follow.',
    status: goalMet ? 'Completed' : request.status,
    goal_met: goalMet,
  });
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

// POST /api/donation/auto-cancel-expired
// Finds the logged-in beneficiary's active requests where all delivery stops
// are past-dated and none were received, then marks them Cancelled.
exports.autoCancelExpiredRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const [expired] = await db.execute(`
      SELECT DISTINCT br.id, br.request_name
      FROM beneficiary_requests br
      WHERE br.user_id = ?
        AND UPPER(br.status) IN ('APPROVED', 'ACCEPTED', 'ALLOCATED', 'URGENT')
        AND EXISTS (
          SELECT 1 FROM donation_drives dd
          JOIN truck_stops ts
            ON ts.reference_id::text = dd.id::text
            AND ts.source = 'donation_drive'
            AND ts.stop_type = 'DELIVER'
            AND ts.status = 'pending'
            AND ts.date < CURRENT_DATE
          WHERE dd.beneficiary_request_id = br.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM donation_drives dd
          JOIN truck_stops ts
            ON ts.reference_id::text = dd.id::text
            AND ts.source = 'donation_drive'
            AND ts.stop_type = 'DELIVER'
            AND ts.status = 'completed'
          WHERE dd.beneficiary_request_id = br.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM donation_drives dd
          JOIN truck_stops ts
            ON ts.reference_id::text = dd.id::text
            AND ts.source = 'donation_drive'
            AND ts.stop_type = 'DELIVER'
            AND ts.status = 'pending'
            AND ts.date >= CURRENT_DATE
          WHERE dd.beneficiary_request_id = br.id
        )
    `, [userId]);

    for (const r of expired) {
      await db.execute(
        "UPDATE beneficiary_requests SET status = 'Cancelled', updated_at = NOW() WHERE id = ?",
        [r.id]
      );
      // No notification created here — if staff sent a missed delivery message,
      // it is already in the beneficiary's notification bell from that action.
    }

    return res.json({ success: true, cancelled: expired.length });
  } catch (e) {
    console.error('[autoCancelExpiredRequests]', e);
    return res.status(500).json({ success: false, message: 'Failed to auto-cancel expired requests.' });
  }
};

exports.updateRequestStatus = async (req, res) => {
  const user = req.user;
  if (user.role === 'beneficiary') {
    return res.status(403).json({ success: false, message: 'Unauthorized.' });
  }

  const allowed = ['Pending', 'Allocated', 'Urgent', 'Approved', 'Rejected', 'Accepted', 'Denied', 'Completed', 'Cancelled'];
  const { delivery_date_time, dispatched_quantity, dispatched_items, start_date, submitted_date } = req.body;
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

  // Build update query — always update status; optionally update dates and dispatched info
  let query = 'UPDATE beneficiary_requests SET status = ?, updated_at = NOW()';
  const params = [status];

  // Start date
  if (start_date !== undefined) {
    query += ', start_date = ?';
    params.push(start_date ? new Date(start_date) : null);
  }

  // Date Submitted (created_at) — staff can correct the submission timestamp
  if (submitted_date !== undefined) {
    query += ', created_at = ?';
    params.push(submitted_date ? new Date(submitted_date) : null);
  }

  // Approval-specific fields
  const approvalStatuses = ['Approved', 'Accepted', 'Allocated'];
  if (approvalStatuses.includes(status)) {
    const dispQty = dispatched_quantity !== undefined ? (dispatched_quantity !== null ? parseFloat(dispatched_quantity) : null) : undefined;
    const dispItems = dispatched_items !== undefined ? (dispatched_items !== null ? (typeof dispatched_items === 'string' ? dispatched_items : JSON.stringify(dispatched_items)) : null) : undefined;

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
  }

  query += ' WHERE id = ?';
  params.push(req.params.id);

  await db.execute(query, params);

  const [updated] = await db.execute('SELECT * FROM beneficiary_requests WHERE id = ?', [req.params.id]);

  return res.json({ success: true, message: `Request status updated to "${status}".`, request: updated[0] });
};

// Staff: record a financial disbursement (partial or full) for a financial request
exports.recordDisbursement = async (req, res) => {
  if (req.user.role === 'beneficiary' || req.user.role === 'donor') {
    return res.status(403).json({ success: false, message: 'Unauthorized.' });
  }

  const { id } = req.params;
  const { amount, date, notes, reference_no } = req.body;

  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(422).json({ success: false, message: 'A valid amount is required.' });
  }

  const [rows] = await db.execute('SELECT * FROM beneficiary_requests WHERE id = ?', [id]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Request not found.' });

  const request = rows[0];
  if ((request.type || '').toLowerCase() !== 'financial') {
    return res.status(422).json({ success: false, message: 'Disbursements only apply to financial requests.' });
  }

  let proofPhotoUrl = null;
  if (req.file) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = process.env.APP_URL || `${proto}://${req.get('host')}`;
    proofPhotoUrl = `${baseUrl}/storage/donations/receipts/${req.file.filename}`;
  }

  const disbursedAmount = parseFloat(amount);
  const newEntry = {
    id: Date.now(),
    amount: disbursedAmount,
    date: date || new Date().toISOString().split('T')[0],
    notes: notes || null,
    reference_no: reference_no || null,
    proof_photo: proofPhotoUrl,
    confirmed: false,
  };

  let existing = [];
  try { existing = typeof request.dispatched_items === 'string' ? JSON.parse(request.dispatched_items) : (request.dispatched_items || []); } catch {}
  // Keep only financial disbursement entries (arrays of {amount, date})
  if (!Array.isArray(existing)) existing = [];
  existing.push(newEntry);

  const totalSent = (parseFloat(request.dispatched_quantity || '0')) + disbursedAmount;

  await db.execute(
    'UPDATE beneficiary_requests SET dispatched_items = ?, dispatched_quantity = ?, updated_at = NOW() WHERE id = ?',
    [JSON.stringify(existing), totalSent, id]
  );

  const { createNotification } = require('./notificationController');
  const requestedAmount = parseFloat(request.amount || '0');
  const goalMet = totalSent >= requestedAmount;
  const msg = goalMet
    ? `Great news! The full amount of ₱${requestedAmount.toLocaleString()} for your request "${request.request_name}" has been sent.`
    : `₱${disbursedAmount.toLocaleString()} has been sent for your request "${request.request_name}". Total sent so far: ₱${totalSent.toLocaleString()} of ₱${requestedAmount.toLocaleString()}.`;
  await createNotification(request.user_id, 'service', goalMet ? 'Financial Request Fulfilled' : 'Partial Payment Sent', msg, true);

  return res.json({ success: true, message: 'Disbursement recorded.', total_sent: totalSent, disbursements: existing });
};

exports.confirmDisbursement = async (req, res) => {
  const { id, disbursementId } = req.params;
  const uid = req.user.id;

  try {
    const [rows] = await db.execute(
      "SELECT * FROM beneficiary_requests WHERE id = ? AND user_id = ?",
      [id, uid]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const request = rows[0];

    // Mark the donation_delivery as received by the beneficiary
    const [deliveryRows] = await db.execute(`
      SELECT del.id FROM donation_deliveries del
      JOIN donation_drives dd ON dd.id = del.donation_drive_id
      WHERE del.id = ? AND dd.beneficiary_request_id = ?
    `, [disbursementId, id]);

    if (!deliveryRows.length) {
      return res.status(404).json({ success: false, message: 'Disbursement not found.' });
    }

    await db.execute(
      "UPDATE donation_deliveries SET received_at = NOW(), status = 'received', updated_at = NOW() WHERE id = ?",
      [disbursementId]
    );

    // Mark the beneficiary request as financially received
    await db.execute(
      "UPDATE beneficiary_requests SET financial_received_at = NOW(), updated_at = NOW() WHERE id = ?",
      [id]
    );

    const [staffRows] = await db.execute("SELECT id FROM users WHERE role = 'staff'");
    const title = 'Financial Disbursement Received';
    const description = `Beneficiary has confirmed receipt of disbursement for request "${request.request_name}".`;
    for (const staff of staffRows) {
      await createNotification(staff.id, 'service', title, description, false);
    }

    return res.json({ success: true, message: 'Disbursement receipt confirmed.' });
  } catch (err) {
    console.error('[confirmDisbursement]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to confirm receipt.', error: err.message });
  }
};

// Donors: get active food/financial drives (Approved beneficiary requests)
exports.getActiveDrives = async (req, res) => {
  try {
    const [drives] = await db.execute(
      `SELECT dd.id, dd.drive_title AS request_name, dd.type, dd.start_date, dd.end_date, dd.goal,
              br.urgency, br.amount AS request_amount, br.food_items AS br_food_items
       FROM donation_drives dd
       LEFT JOIN beneficiary_requests br ON br.id = dd.beneficiary_request_id
       WHERE dd.status = 'OnGoing'
       ORDER BY dd.created_at DESC`
    );

    if (!drives.length) return res.json({ success: true, active_drives: [] });

    const driveIds = drives.map(d => d.id);
    const placeholders = driveIds.map(() => '?').join(',');
    const [driveItemRows] = await db.execute(
      `SELECT donation_drive_id, food_name, category, goal_qty AS qty, unit
       FROM donation_drive_items
       WHERE donation_drive_id IN (${placeholders})`,
      driveIds
    );

    const itemsByDrive = {};
    for (const item of driveItemRows) {
      if (!itemsByDrive[item.donation_drive_id]) itemsByDrive[item.donation_drive_id] = [];
      itemsByDrive[item.donation_drive_id].push({
        food_name: item.food_name,
        category: item.category || '',
        qty: item.qty,
        unit: item.unit,
      });
    }

    const mapped = drives.map(d => {
      const driveType = d.type
        ? d.type.charAt(0).toUpperCase() + d.type.slice(1).toLowerCase()
        : 'Food';
      const urgency = d.urgency
        ? d.urgency.charAt(0).toUpperCase() + d.urgency.slice(1).toLowerCase()
        : 'Medium';
      const isFinancial = driveType === 'Financial';

      let foodItems = itemsByDrive[d.id] || [];
      // Fall back to beneficiary_request food_items when donation_drive_items is empty
      if (!isFinancial && foodItems.length === 0 && d.br_food_items) {
        try {
          const raw = typeof d.br_food_items === 'string' ? JSON.parse(d.br_food_items) : d.br_food_items;
          if (Array.isArray(raw)) {
            foodItems = raw.map(i => ({
              food_name: i.food_name || i.name || '',
              category: i.food_type || i.category || '',
              qty: i.qty || i.quantity || 0,
              unit: i.unit || '',
            })).filter(i => i.food_name);
          }
        } catch {}
      }

      return {
        id: d.id,
        request_name: d.request_name || 'Unnamed Drive',
        type: driveType,
        urgency,
        start_date: d.start_date,
        end_date: d.end_date,
        food_items: isFinancial ? [] : foodItems,
        amount: isFinancial ? (parseFloat(d.goal) || parseFloat(d.request_amount) || 0) : null,
      };
    });

    return res.json({ success: true, active_drives: mapped });
  } catch (error) {
    console.error('[getActiveDrives] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// Staff: list all beneficiary requests with full details including banking fields
exports.getAllBeneficiaryRequests = async (req, res) => {
  if (req.user.role === 'beneficiary' || req.user.role === 'donor') {
    return res.status(403).json({ success: false, message: 'Unauthorized.' });
  }

  const [requests] = await db.execute(
    `SELECT id, user_id, request_name, type, food_type, quantity, unit, amount,
            population, age_min, age_max, street, barangay, city, zip_code,
            start_date, end_date, urgency, food_items, status, created_at, updated_at,
            account_name, account_number,
            received_items, dispatched_quantity, dispatched_items, notified_status
     FROM beneficiary_requests
     ORDER BY created_at DESC`
  );

  const mapped = requests.map(r => {
    let foodItems = [];
    try { foodItems = typeof r.food_items === 'string' ? JSON.parse(r.food_items) : (r.food_items || []); } catch {}

    return {
      ...r,
      food_items: foodItems,
      receiving_method: r.receiving_method || null,
      account_name:     r.account_name || null,
      account_number:   r.account_number || null,
    };
  });

  return res.json({ success: true, requests: mapped });
};

// Staff: get a single beneficiary request by ID with full details
exports.getBeneficiaryRequestById = async (req, res) => {
  if (req.user.role === 'beneficiary' || req.user.role === 'donor') {
    return res.status(403).json({ success: false, message: 'Unauthorized.' });
  }

  const [rows] = await db.execute(
    `SELECT id, user_id, request_name, type, food_type, quantity, unit, amount,
            population, age_min, age_max, street, barangay, city, zip_code,
            start_date, end_date, urgency, food_items, status, created_at, updated_at,
            account_name, account_number,
            received_items, dispatched_quantity, dispatched_items, notified_status
     FROM beneficiary_requests WHERE id = ?`,
    [req.params.id]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Request not found.' });
  }

  const r = rows[0];
  let foodItems = [];
  try { foodItems = typeof r.food_items === 'string' ? JSON.parse(r.food_items) : (r.food_items || []); } catch {}

  return res.json({
    success: true,
    request: {
      ...r,
      food_items: foodItems,
      receiving_method: r.receiving_method || null,
      account_name:     r.account_name || null,
      account_number:   r.account_number || null,
    },
  });
};

// Staff: mark a truck stop as missed and attach a message for the beneficiary/donor
exports.markStopMissed = async (req, res) => {
  const user = req.user;
  if (user.role === 'beneficiary' || user.role === 'donor') {
    return res.status(403).json({ success: false, message: 'Unauthorized.' });
  }

  const { stopId } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(422).json({ success: false, message: 'A message is required when marking a stop as missed.' });
  }

  const [rows] = await db.execute('SELECT * FROM truck_stops WHERE id = ?', [stopId]);
  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Stop not found.' });
  }

  await db.execute(
    "UPDATE truck_stops SET status = 'missed', staff_message = ?, missed_notified_at = NULL, updated_at = NOW() WHERE id = ?",
    [message.trim(), stopId]
  );

  return res.json({ success: true, message: 'Stop marked as missed.' });
};

exports.completeBeneficiaryRequest = async (req, res) => {
  const { id } = req.params;
  const { received_items, received_qty, remarks } = req.body;

  // Auto-migrate: add remarks, dispatched, and bank details columns if they don't exist
  try {
    await db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS remarks TEXT`);
    await db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS dispatched_quantity NUMERIC DEFAULT NULL`);
    await db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS dispatched_items JSONB DEFAULT NULL`);
    await db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS receiving_method VARCHAR(255) DEFAULT NULL`);
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
    await db.execute(`UPDATE users SET name=?, updated_at=NOW() WHERE id=?`, [`${first_name} ${last_name}`.trim(), user.id]);
  } else if (user.role === 'partner_kitchen') {
    const { kitchen_name, contact_person, position_role, website_url, contact_number } = req.body;
    if (!kitchen_name) {
      return res.status(422).json({ success: false, errors: { kitchen_name: ['Required.'] } });
    }
    await db.execute(
      `UPDATE partner_kitchen SET kitchen_name=?, contact_person=?, position_role=?, website_url=?, contact_number=?, updated_at=NOW() WHERE user_id=?`,
      [kitchen_name, contact_person || null, position_role || null, website_url || null, contact_number || null, user.id]
    );
    await db.execute(`UPDATE users SET name=?, updated_at=NOW() WHERE id=?`, [kitchen_name, user.id]);
  } else if (user.role === 'organization') {
    const { organization_name, website_url, industry_sector, organization_type, first_name, last_name, contact_number } = req.body;
    if (!organization_name) {
      return res.status(422).json({ success: false, errors: { organization_name: ['Required.'] } });
    }
    await db.execute(
      `UPDATE donor_organizations SET org_name=?, website=?, industry=?, type=?, first_name=?, last_name=?, contact=?, updated_at=NOW() WHERE user_id=?`,
      [organization_name, website_url || null, industry_sector || null, organization_type || null, first_name || null, last_name || null, contact_number || null, user.id]
    );
    await db.execute(`UPDATE users SET name=?, updated_at=NOW() WHERE id=?`, [organization_name, user.id]);
  } else if (user.role === 'beneficiary') {
    const { first_name, last_name, middle_initial, suffix, date_of_birth, gender, house_no, street, barangay, city_municipality, province_region, postal_zip_code, contact_number } = req.body;
    if (!first_name || !last_name) {
      return res.status(422).json({ success: false, errors: { first_name: ['Required.'] } });
    }
    // Try updating the individual beneficiaries table first
    const [result] = await db.execute(
      `UPDATE beneficiaries SET first_name=?, last_name=?, middle_name=?, suffix=?, dob=?, gender=?, house=?, street=?, barangay=?, city=?, province=?, zip=?, contact=?, updated_at=NOW() WHERE user_id=?`,
      [first_name, last_name, middle_initial || null, suffix || null, date_of_birth || null, gender || null, house_no || null, street || null, barangay || null, city_municipality || null, province_region || null, postal_zip_code || null, contact_number || null, user.id]
    );
    // If no row was updated, the beneficiary might be an organization-type beneficiary
    if (result.rowCount === 0 || result.affectedRows === 0) {
      await db.execute(
        `UPDATE beneficiary_organizations SET house=?, street=?, barangay=?, city=?, province=?, zip=?, contact=?, updated_at=NOW() WHERE user_id=?`,
        [house_no || null, street || null, barangay || null, city_municipality || null, province_region || null, postal_zip_code || null, contact_number || null, user.id]
      );
    }
    // Also update the display name in the users table
    await db.execute(
      `UPDATE users SET name=?, updated_at=NOW() WHERE id=?`,
      [`${first_name} ${last_name}`.trim(), user.id]
    );
  }

  return res.json({ success: true, message: 'Profile updated successfully.' });
};

exports.deleteAccount = async (req, res) => {
  const uid = req.user.id;
  const ts  = Date.now();
  try {
    // Soft-delete: anonymize the user row so donations/requests stay linked
    // as "Deleted User" in reports. Email is tombstoned so it can be re-used.
    await db.execute(
      `UPDATE users
       SET name           = 'Deleted User',
           email          = ?,
           username       = ?,
           password       = ?,
           updated_at     = NOW()
       WHERE id = ?`,
      [`deleted_${uid}_${ts}@deleted.local`, `deleted_${uid}_${ts}`, `DEACTIVATED_${crypto.randomBytes(32).toString('hex')}`, uid]
    );

    // Scrub personal info from the profile table
    await db.execute(
      `UPDATE donors
       SET first_name = 'Deleted', last_name = 'User',
           middle_name = NULL, contact_number = NULL,
           house_no = NULL, street = NULL, barangay = NULL,
           city_municipality = NULL, province_region = NULL,
           postal_zip_code = NULL, date_of_birth = NULL,
           updated_at = NOW()
       WHERE user_id = ?`,
      [uid]
    ).catch(() => {});
    await db.execute(
      `UPDATE beneficiaries
       SET first_name = 'Deleted', last_name = 'User',
           contact_number = NULL, updated_at = NOW()
       WHERE user_id = ?`,
      [uid]
    ).catch(() => {});
    await db.execute(
      `UPDATE organizations
       SET name = 'Deleted Organization', contact_number = NULL, updated_at = NOW()
       WHERE user_id = ?`,
      [uid]
    ).catch(() => {});
    await db.execute(
      `UPDATE partner_kitchens
       SET kitchen_name = 'Deleted Kitchen', contact_person = NULL,
           contact_number = NULL, updated_at = NOW()
       WHERE user_id = ?`,
      [uid]
    ).catch(() => {});

    // Remove push token so no further notifications are sent
    await db.execute('DELETE FROM user_push_tokens WHERE user_id = ?', [uid]).catch(() => {});

    return res.json({ success: true, message: 'Account deactivated.' });
  } catch (error) {
    console.error('Error deactivating account:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong, please try again.' });
  }
};

exports.confirmFinancialReceived = async (req, res) => {
  const { id } = req.params;
  const uid = req.user.id;
  try {
    const [rows] = await db.execute(
      "SELECT * FROM beneficiary_requests WHERE id = ? AND user_id = ? AND type = 'financial'",
      [id, uid]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Request not found.' });
    const request = rows[0];

    if (request.financial_received_at) {
      return res.status(400).json({ success: false, message: 'You have already confirmed receipt of this disbursement.' });
    }

    const effectiveStatus = (request.status || '').toLowerCase();
    if (!['approved', 'allocated', 'accepted'].includes(effectiveStatus)) {
      return res.status(400).json({ success: false, message: 'This request is not yet in an approved state.' });
    }

    await db.execute(
      "UPDATE beneficiary_requests SET financial_received_at = NOW(), status = 'Completed', updated_at = NOW() WHERE id = ?",
      [id]
    );

    await createNotification(
      uid, 'financial',
      'Financial Assistance Received',
      `You have confirmed receipt of the financial assistance for your request "${request.request_name || 'Financial Assistance'}". Thank you!`
    );
    await logActivity(
      uid, 'financial',
      'Financial Assistance Received',
      `You confirmed receipt of the financial disbursement for request #${id}.`,
      'financialiconyellow', parseInt(id)
    );

    return res.json({ success: true, message: 'Receipt confirmed. Your request has been marked as completed.' });
  } catch (err) {
    console.error('[confirmFinancialReceived]', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.deleteActivity = async (req, res) => {
  const { id } = req.params;
  const uid = req.user.id;
  try {
    const [result] = await db.execute(
      'DELETE FROM activity_logs WHERE id = ? AND user_id = ?',
      [id, uid]
    );
    return res.json({ success: true, message: 'Activity deleted successfully.' });
  } catch (err) {
    console.error('[deleteActivity error]', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
