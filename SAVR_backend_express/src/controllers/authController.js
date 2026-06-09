const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { sendVerificationCodeMail } = require('../mail/verificationCodeMail');
const { sendForgotPasswordMail } = require('../mail/forgotPasswordMail');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);

// Drop the old blocking trigger that was preventing staff portal inserts
db.execute(`DROP TRIGGER IF EXISTS trg_prevent_inventory_without_approval ON service_donations_inventory`).catch(() => {});
db.execute(`DROP FUNCTION IF EXISTS prevent_inventory_without_approval()`).catch(() => {});

// Trigger: when service_donation_records.status changes, keep inventory in sync:
// - accepted  → insert into inventory (if not already there)
// - declined/rejected → delete from inventory
db.execute(`
  CREATE OR REPLACE FUNCTION sync_service_donation_inventory()
  RETURNS TRIGGER AS $$
  BEGIN
    IF LOWER(NEW.status) = 'accepted' AND LOWER(COALESCE(OLD.status,'')) != 'accepted' THEN
      IF NOT EXISTS (
        SELECT 1 FROM service_donations_inventory WHERE service_donation_record_id = NEW.id
      ) THEN
        INSERT INTO service_donations_inventory (
          service_donation_record_id, user_id, service_tab, frequency,
          date, starts_at, address, quantity,
          first_name, last_name, email, notes,
          status, created_at, updated_at
        ) VALUES (
          NEW.id, NEW.user_id, NEW.service_tab, NEW.frequency,
          NEW.date, NEW.starts_at, NEW.address, NEW.quantity,
          NEW.first_name, NEW.last_name, NEW.email, NEW.notes,
          'Active', NOW(), NOW()
        );
      END IF;
    ELSIF LOWER(NEW.status) IN ('declined','rejected','cancelled') THEN
      DELETE FROM service_donations_inventory WHERE service_donation_record_id = NEW.id;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`).then(() =>
  db.execute(`DROP TRIGGER IF EXISTS trg_sync_service_donation_inventory ON service_donation_records`)
).then(() =>
  db.execute(`
    CREATE TRIGGER trg_sync_service_donation_inventory
      AFTER UPDATE ON service_donation_records
      FOR EACH ROW
      EXECUTE FUNCTION sync_service_donation_inventory()
  `)
).catch(err => console.error('[service donation inventory sync]', err.message));

// Trigger: when staff portal inserts directly into service_donations_inventory,
// mark the linked record as accepted so both tables stay in sync.
db.execute(`
  CREATE OR REPLACE FUNCTION sync_inventory_to_record_accepted()
  RETURNS TRIGGER AS $$
  BEGIN
    UPDATE service_donation_records
      SET status = 'accepted', updated_at = NOW()
      WHERE id = NEW.service_donation_record_id
        AND LOWER(status) NOT IN ('accepted','completed','cancelled');
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`).then(() =>
  db.execute(`DROP TRIGGER IF EXISTS trg_sync_inventory_to_record_accepted ON service_donations_inventory`)
).then(() =>
  db.execute(`
    CREATE TRIGGER trg_sync_inventory_to_record_accepted
      AFTER INSERT ON service_donations_inventory
      FOR EACH ROW
      EXECUTE FUNCTION sync_inventory_to_record_accepted()
  `)
).catch(err => console.error('[inventory to record accepted sync]', err.message));

// Trigger: when a record is deleted from inventory (staff declines),
// revert the linked service_donation_record status to 'declined'.
db.execute(`
  CREATE OR REPLACE FUNCTION sync_inventory_delete_to_record()
  RETURNS TRIGGER AS $$
  BEGIN
    UPDATE service_donation_records
      SET status = 'declined', updated_at = NOW()
      WHERE id = OLD.service_donation_record_id
        AND LOWER(status) NOT IN ('declined','rejected','cancelled','completed');
    RETURN OLD;
  END;
  $$ LANGUAGE plpgsql;
`).then(() =>
  db.execute(`DROP TRIGGER IF EXISTS trg_sync_inventory_delete_to_record ON service_donations_inventory`)
).then(() =>
  db.execute(`
    CREATE TRIGGER trg_sync_inventory_delete_to_record
      AFTER DELETE ON service_donations_inventory
      FOR EACH ROW
      EXECUTE FUNCTION sync_inventory_delete_to_record()
  `)
).catch(err => console.error('[inventory delete to record sync]', err.message));

// Add is_active column to users table if it doesn't exist yet
db.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE")
  .catch(() => {});

// Trigger: notify donor when admin changes food donation status
db.execute(`
  CREATE OR REPLACE FUNCTION notify_donor_food_donation_status()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'approved' THEN
        INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
        VALUES (NEW.user_id, 'food', 'Food Donation Approved',
          'Great news! Your food donation has been approved. We will be in touch regarding the pickup or delivery schedule. Thank you!',
          TRUE, NOW());
      ELSIF NEW.status = 'rejected' THEN
        INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
        VALUES (NEW.user_id, 'food', 'Food Donation Denied',
          'We regret to inform you that your food donation has been denied. Please contact us for more details.',
          TRUE, NOW());
      ELSIF NEW.status = 'received' THEN
        INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
        VALUES (NEW.user_id, 'food', 'Food Donation Received',
          'Your food donation has been successfully received and is now being processed into our inventory. Thank you for your generous contribution!',
          TRUE, NOW());
      ELSIF NEW.status = 'cancelled' THEN
        INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
        VALUES (NEW.user_id, 'food', 'Food Donation Cancelled',
          'Your food donation has been cancelled. Please contact us if you have any questions.',
          TRUE, NOW());
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`).then(() =>
  db.execute(`
    DROP TRIGGER IF EXISTS trg_food_donation_status_notify ON food_donation_records
  `)
).then(() =>
  db.execute(`
    CREATE TRIGGER trg_food_donation_status_notify
      AFTER UPDATE ON food_donation_records
      FOR EACH ROW
      EXECUTE FUNCTION notify_donor_food_donation_status()
  `)
).catch(err => console.error('[food donation trigger]', err.message));

// Ensure beneficiary_requests.status has no restrictive check constraint
db.execute(`ALTER TABLE beneficiary_requests DROP CONSTRAINT IF EXISTS beneficiary_requests_status_check`).catch(() => {});

// Track last notified status per request so we can auto-notify on fetch
db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS notified_status VARCHAR(100) DEFAULT NULL`).catch(() => {});

// Delivery date/time set by staff when approving a request
db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS delivery_date_time TIMESTAMP DEFAULT NULL`).catch(() => {});

// Trigger: intercept admin DELETE on beneficiary_requests → convert to Rejected so the
// card stays visible in the beneficiary's Cancelled tab instead of vanishing.
// Notification is handled by notify_beneficiary_request_status firing on the UPDATE.
db.execute(`
  CREATE OR REPLACE FUNCTION prevent_beneficiary_request_delete()
  RETURNS TRIGGER AS $$
  BEGIN
    UPDATE beneficiary_requests
      SET status = 'Rejected', updated_at = NOW()
      WHERE id = OLD.id;
    RETURN NULL;
  END;
  $$ LANGUAGE plpgsql;
`).then(() =>
  db.execute(`DROP TRIGGER IF EXISTS trg_prevent_request_delete ON beneficiary_requests`)
).then(() =>
  db.execute(`
    CREATE TRIGGER trg_prevent_request_delete
      BEFORE DELETE ON beneficiary_requests
      FOR EACH ROW
      WHEN (OLD.status IS DISTINCT FROM 'Cancelled')
      EXECUTE FUNCTION prevent_beneficiary_request_delete()
  `)
).catch(err => console.error('[request delete trigger]', err.message));

// Trigger: when a donation_drive is deleted, mark the linked beneficiary_request as
// 'Deleted' (via UPDATE, not DELETE — so trg_prevent_request_delete doesn't interfere)
// and notify the beneficiary. The card then disappears from the mobile list.
db.execute(`
  CREATE OR REPLACE FUNCTION on_donation_drive_delete()
  RETURNS TRIGGER AS $$
  DECLARE
    v_request_id INTEGER;
  BEGIN
    IF OLD.beneficiary_request_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM donation_drives
        WHERE beneficiary_request_id = OLD.beneficiary_request_id AND id != OLD.id
      ) THEN
        UPDATE beneficiary_requests
          SET status = 'Deleted', updated_at = NOW()
          WHERE id = OLD.beneficiary_request_id
            AND LOWER(status) NOT IN ('completed','cancelled','deleted','rejected','denied');
        IF FOUND THEN
          INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
          SELECT user_id, 'service', 'Request Removed',
            'Your request "' || COALESCE(request_name, 'Unnamed') || '" has been removed by our team. Please contact us if you have any questions.',
            TRUE, NOW()
          FROM beneficiary_requests WHERE id = OLD.beneficiary_request_id;
        END IF;
      END IF;
    ELSIF OLD.drive_name IS NOT NULL THEN
      SELECT id INTO v_request_id
        FROM beneficiary_requests
        WHERE request_name = OLD.drive_name
          AND LOWER(status) NOT IN ('completed','cancelled','deleted','rejected','denied')
        LIMIT 1;
      IF v_request_id IS NOT NULL AND (
        SELECT COUNT(*) FROM beneficiary_requests
          WHERE request_name = OLD.drive_name
            AND LOWER(status) NOT IN ('completed','cancelled','deleted','rejected','denied')
      ) = 1 THEN
        UPDATE beneficiary_requests
          SET status = 'Deleted', updated_at = NOW()
          WHERE id = v_request_id;
        IF FOUND THEN
          INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
          SELECT user_id, 'service', 'Request Removed',
            'Your request "' || COALESCE(request_name, 'Unnamed') || '" has been removed by our team. Please contact us if you have any questions.',
            TRUE, NOW()
          FROM beneficiary_requests WHERE id = v_request_id;
        END IF;
      END IF;
    END IF;
    RETURN OLD;
  END;
  $$ LANGUAGE plpgsql;
`).then(() =>
  db.execute(`DROP TRIGGER IF EXISTS trg_donation_drive_delete ON donation_drives`)
).then(() =>
  db.execute(`
    CREATE TRIGGER trg_donation_drive_delete
      AFTER DELETE ON donation_drives
      FOR EACH ROW
      EXECUTE FUNCTION on_donation_drive_delete()
  `)
).catch(err => console.error('[donation drive delete trigger]', err.message));

// Trigger: notify beneficiary when admin changes request status
db.execute(`
  CREATE OR REPLACE FUNCTION notify_beneficiary_request_status()
  RETURNS TRIGGER AS $$
  DECLARE
    v_status TEXT;
  BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_status := LOWER(TRIM(NEW.status));
      IF v_status IN ('approved', 'accepted') THEN
        INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
        VALUES (NEW.user_id, 'service', 'Request Approved',
          'Great news! Your request "' || COALESCE(NEW.request_name, 'Unnamed') || '" has been approved and is now being prepared for fulfillment. We will be in touch with the next steps.',
          TRUE, NOW());
      ELSIF v_status IN ('rejected', 'denied', 'deny', 'reject', 'declined', 'disapproved', 'refused') OR v_status LIKE '%reject%' OR v_status LIKE '%den%' OR v_status LIKE '%declin%' THEN
        INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
        VALUES (NEW.user_id, 'service', 'Request Rejected',
          'We regret to inform you that your request "' || COALESCE(NEW.request_name, 'Unnamed') || '" has been rejected. Please contact our team if you have any questions.',
          TRUE, NOW());
      ELSIF v_status = 'allocated' THEN
        INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
        VALUES (NEW.user_id, 'service', 'Request Allocated',
          'Your request "' || COALESCE(NEW.request_name, 'Unnamed') || '" has been allocated and will be processed soon. Thank you for your patience.',
          TRUE, NOW());
      ELSIF v_status = 'urgent' THEN
        INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
        VALUES (NEW.user_id, 'service', 'Request Marked Urgent',
          'Your request "' || COALESCE(NEW.request_name, 'Unnamed') || '" has been marked as urgent and will be prioritized immediately.',
          TRUE, NOW());
      ELSIF v_status NOT IN ('pending', 'cancelled', 'canceled', 'deleted') THEN
        INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
        VALUES (NEW.user_id, 'service', 'Request Status Updated',
          'Your request "' || COALESCE(NEW.request_name, 'Unnamed') || '" status has been updated to "' || NEW.status || '". Please contact us if you have any questions.',
          TRUE, NOW());
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`).then(() =>
  db.execute(`DROP TRIGGER IF EXISTS trg_beneficiary_request_status_notify ON beneficiary_requests`)
).then(() =>
  db.execute(`
    CREATE TRIGGER trg_beneficiary_request_status_notify
      AFTER UPDATE ON beneficiary_requests
      FOR EACH ROW
      EXECUTE FUNCTION notify_beneficiary_request_status()
  `)
).catch(err => console.error('[beneficiary request trigger]', err.message));

// Ensure financial_donation_records.status allows all used values
db.execute(`
  ALTER TABLE financial_donation_records
    DROP CONSTRAINT IF EXISTS financial_donation_records_status_check
`).then(() =>
  db.execute(`
    ALTER TABLE financial_donation_records
      ADD CONSTRAINT financial_donation_records_status_check
      CHECK (status IN ('pending', 'paid', 'completed', 'failed', 'cancelled', 'approved', 'rejected', 'denied'))
  `)
).catch(() => {});

// Trigger: notify donor when admin changes financial donation status
db.execute(`
  CREATE OR REPLACE FUNCTION notify_donor_financial_donation_status()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF LOWER(NEW.status) IN ('approved', 'paid', 'completed') THEN
        INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
        VALUES (NEW.user_id, 'financial', 'Financial Donation Confirmed',
          'Your financial donation of PHP ' || TO_CHAR(NEW.amount, 'FM999,999,999.00') || ' has been confirmed and received. Thank you for your generous contribution!',
          TRUE, NOW());
      ELSIF LOWER(NEW.status) IN ('rejected', 'denied') THEN
        INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
        VALUES (NEW.user_id, 'financial', 'Financial Donation Denied',
          'We regret to inform you that your financial donation of PHP ' || TO_CHAR(NEW.amount, 'FM999,999,999.00') || ' has been denied. Please contact us for more details.',
          TRUE, NOW());
      ELSIF LOWER(NEW.status) IN ('cancelled', 'failed') THEN
        INSERT INTO notifications (user_id, type, title, description, is_critical, created_at)
        VALUES (NEW.user_id, 'financial', 'Financial Donation Cancelled',
          'Your financial donation of PHP ' || TO_CHAR(NEW.amount, 'FM999,999,999.00') || ' has been cancelled. Please contact us if you have any questions.',
          TRUE, NOW());
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`).then(() =>
  db.execute(`DROP TRIGGER IF EXISTS trg_financial_donation_status_notify ON financial_donation_records`)
).then(() =>
  db.execute(`
    CREATE TRIGGER trg_financial_donation_status_notify
      AFTER UPDATE ON financial_donation_records
      FOR EACH ROW
      EXECUTE FUNCTION notify_donor_financial_donation_status()
  `)
).catch(err => console.error('[financial donation trigger]', err.message));

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeEmail(value) {
  return (value || '').toLowerCase().trim();
}

function normalizeContactNumber(value) {
  if (!value) return value;
  return String(value).trim().replace(/^\+?63/, '');
}

function generateCode() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

function issueToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
}

async function getDisplayName(user) {
  switch (user.role) {
    case 'donor': {
      const [rows] = await db.execute('SELECT first_name, last_name FROM donors WHERE user_id = ?', [user.id]);
      if (rows[0]) return `${rows[0].first_name} ${rows[0].last_name}`;
      break;
    }
    case 'organization': {
      const [rows] = await db.execute('SELECT org_name FROM donor_organizations WHERE user_id = ?', [user.id]);
      if (rows[0]) return rows[0].org_name;
      break;
    }
    case 'partner_kitchen': {
      const [rows] = await db.execute('SELECT kitchen_name, contact_person FROM partner_kitchen WHERE user_id = ?', [user.id]);
      if (rows[0]?.kitchen_name) return rows[0].kitchen_name;
      if (rows[0]?.contact_person) return rows[0].contact_person;
      if (user.name && user.name !== 'user') return user.name;
      break;
    }
    case 'beneficiary': {
      const [orgRows] = await db.execute('SELECT org_name FROM beneficiary_organizations WHERE user_id = ?', [user.id]);
      if (orgRows[0]) return orgRows[0].org_name;
      const [profRows] = await db.execute('SELECT first_name, last_name FROM beneficiaries WHERE user_id = ?', [user.id]);
      if (profRows[0]) return `${profRows[0].first_name} ${profRows[0].last_name}`;
      break;
    }
  }
  return user.email;
}

async function storeVerificationCode(email, code) {
  await db.execute('DELETE FROM password_reset_tokens WHERE LOWER(email) = LOWER(?)', [email]);
  await db.execute(
    'INSERT INTO password_reset_tokens (email, token, created_at) VALUES (?, ?, NOW())',
    [email, code]
  );
}


// ─── Verify Email ─────────────────────────────────────────────────────────────

exports.sendVerificationEmail = async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ success: false, message: 'Invalid email address.' });
  }

  let existing;
  try {
    [existing] = await db.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
  } catch (err) {
    console.error('[sendVerificationEmail db error]', err.message);
    return res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please try again in a moment.' });
  }
  if (existing.length) {
    return res.status(409).json({ success: false, message: 'This email is already registered.' });
  }

  const code = generateCode();
  const name = req.body.name || 'User';

  try {
    await storeVerificationCode(email, code);
  } catch (err) {
    console.error('[storeVerificationCode error]', err);
    return res.status(500).json({ success: false, message: 'Database error while preparing verification. Please try again.', error: err.message });
  }

  try {
    await sendVerificationCodeMail(email, code, name);
    return res.json({ success: true, message: `Verification code sent to ${email}` });
  } catch (err) {
    console.error('[sendVerificationCodeMail error]', err);
    return res.status(500).json({ success: false, message: 'Failed to send verification email. Please check your email address or try again later.', error: err.message });
  }
};

exports.verifyCode = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = req.body.code;

  if (!email || !code || code.length !== 6) {
    return res.status(422).json({ success: false, message: 'Validation failed.' });
  }

  try {
    const [rows] = await db.execute(
      "SELECT *, (created_at < NOW() - INTERVAL '10 minutes') AS is_expired FROM password_reset_tokens WHERE LOWER(email) = LOWER(?)",
      [email]
    );
    const verification = rows[0];

    if (!verification) {
      return res.status(404).json({ success: false, message: 'No verification code found. Please request a new one.' });
    }
    if (verification.token === 'VERIFIED') {
      return res.json({ success: true, message: 'Email verified successfully.' });
    }
    if (verification.is_expired) {
      return res.status(410).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
    }
    if (verification.token !== code) {
      return res.status(422).json({ success: false, message: 'Invalid verification code. Please try again.' });
    }

    await db.execute("UPDATE password_reset_tokens SET token = 'VERIFIED' WHERE LOWER(email) = LOWER(?)", [email]);
    return res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    console.error('[verifyCode db error]', err.message);
    return res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please try again in a moment.' });
  }
};

exports.resendCode = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const name = req.body.name || 'User';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ success: false, message: 'Invalid email address.' });
  }

  try {
    const code = generateCode();
    await storeVerificationCode(email, code);
    await sendVerificationCodeMail(email, code, name);
    return res.json({ success: true, message: 'New verification code sent.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to resend code. Please try again.' });
  }
};

// ─── Forgot Password ──────────────────────────────────────────────────────────

exports.forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ success: false, message: 'Invalid email address.' });
  }

  let rows;
  try {
    [rows] = await db.execute('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
  } catch (err) {
    console.error('[forgotPassword db error]', err.message);
    return res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please try again in a moment.' });
  }
  const user = rows[0];

  if (!user) {
    return res.json({ success: true, message: 'If this email is registered, a reset code has been sent.' });
  }

  try {
    const name = await getDisplayName(user);
    const code = generateCode();
    await storeVerificationCode(email, code);
    await sendForgotPasswordMail(email, code, name);
    return res.json({ success: true, message: `Password reset code sent to ${email}` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to send reset email.', error: err.message });
  }
};

exports.verifyResetCode = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = req.body.code;

  if (!email || !code || code.length !== 6) {
    return res.status(422).json({ success: false, message: 'Validation failed.' });
  }

  try {
    const [rows] = await db.execute(
      "SELECT *, (created_at < NOW() - INTERVAL '10 minutes') AS is_expired FROM password_reset_tokens WHERE LOWER(email) = LOWER(?)",
      [email]
    );
    const verification = rows[0];

    if (!verification) {
      return res.status(404).json({ success: false, message: 'No reset code found. Please request a new one.' });
    }
    if (verification.token === 'VERIFIED') {
      return res.json({ success: true, message: 'Code verified. You may now reset your password.' });
    }
    if (verification.is_expired) {
      return res.status(410).json({ success: false, message: 'Reset code has expired. Please request a new one.' });
    }
    if (verification.token !== code) {
      return res.status(422).json({ success: false, message: 'Invalid reset code. Please try again.' });
    }

    await db.execute("UPDATE password_reset_tokens SET token = 'VERIFIED' WHERE LOWER(email) = LOWER(?)", [email]);
    return res.json({ success: true, message: 'Code verified. You may now reset your password.' });
  } catch (err) {
    console.error('[verifyResetCode db error]', err.message);
    return res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please try again in a moment.' });
  }
};

exports.resetPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password, password_confirmation } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ success: false, message: 'Invalid email address.' });
  }
  if (!password || password.length < 12) {
    return res.status(422).json({ success: false, message: 'Password must be at least 12 characters.' });
  }
  if (password !== password_confirmation) {
    return res.status(422).json({ success: false, message: 'Passwords do not match.' });
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/.test(password)) {
    return res.status(422).json({ success: false, message: 'Password must contain uppercase, lowercase, a number, and a special character.' });
  }

  let userRows, tokenRows;
  try {
    [userRows] = await db.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (!userRows.length) {
      return res.status(422).json({ success: false, message: 'No account found with this email.' });
    }
    [tokenRows] = await db.execute("SELECT * FROM password_reset_tokens WHERE LOWER(email) = LOWER(?) AND token = 'VERIFIED'", [email]);
  } catch (err) {
    console.error('[resetPassword db error]', err.message);
    return res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please try again in a moment.' });
  }
  if (!tokenRows.length) {
    return res.status(403).json({ success: false, message: 'Please verify your reset code first.' });
  }

  try {
    const hashed = await bcrypt.hash(password, 12);
    await db.execute('UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)', [hashed, email]);
    await db.execute('DELETE FROM password_reset_tokens WHERE LOWER(email) = LOWER(?)', [email]);
    return res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to reset password.', error: err.message });
  }
};

// ─── Registration ─────────────────────────────────────────────────────────────

exports.registerDonor = async (req, res) => {
  let {
    first_name, last_name, middle_name, suffix,
    date_of_birth, gender,
    house_no, street, barangay, city_municipality, province_region, postal_zip_code,
    email, contact_number, password, password_confirmation,
  } = req.body;

  email = normalizeEmail(email);
  contact_number = normalizeContactNumber(contact_number);
  middle_name = middle_name?.trim() || null;
  suffix = suffix?.trim() || null;

  const errors = {};
  if (!first_name) errors.first_name = ['First name is required.'];
  if (!last_name) errors.last_name = ['Last name is required.'];
  if (!date_of_birth || new Date(date_of_birth) >= new Date()) errors.date_of_birth = ['Date of birth must be strictly before today.'];
  if (!['Male', 'Female', 'Other'].includes(gender)) errors.gender = ['Gender must be Male, Female, or Other.'];
  if (!house_no || !/^[0-9]+$/.test(house_no)) errors.house_no = ['House number must contain numbers only.'];
  if (!street) errors.street = ['Street is required.'];
  if (!barangay) errors.barangay = ['Barangay is required.'];
  if (!city_municipality) errors.city_municipality = ['City/municipality is required.'];
  if (!province_region) errors.province_region = ['Province/region is required.'];
  if (!postal_zip_code) errors.postal_zip_code = ['Postal/zip code is required.'];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = ['Invalid email address.'];
  if (!contact_number || !/^[0-9]{10}$/.test(contact_number)) errors.contact_number = ['Contact number must be exactly 10 digits.'];
  if (!password || password.length < 12) errors.password = ['Password must be at least 12 characters.'];
  else if (password !== password_confirmation) errors.password = ['Passwords do not match.'];
  else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/.test(password)) errors.password = ['Password must contain uppercase, lowercase, a number, and a special character.'];

  if (Object.keys(errors).length) return res.status(422).json({ success: false, message: 'Validation failed.', errors });

  const [emailCheck] = await db.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
  if (emailCheck.length) return res.status(422).json({ success: false, message: 'Validation failed.', errors: { email: ['This email is already registered.'] } });

  const [verifiedCheck] = await db.execute("SELECT * FROM password_reset_tokens WHERE LOWER(email) = LOWER(?) AND token = 'VERIFIED'", [email]);
  if (!verifiedCheck.length) return res.status(403).json({ success: false, message: 'Email not verified. Please verify your email first.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const hashed = await bcrypt.hash(password, 12);
    const [userResult] = await conn.execute(
      'INSERT INTO users (name, role, email, password, email_verified, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, true, NOW(), NOW(), NOW())',
      [`${first_name.trim()} ${last_name.trim()}`, 'donor', email, hashed]
    );
    const userId = userResult.insertId;

    await conn.execute(
      `INSERT INTO donors (user_id, first_name, last_name, middle_name, suffix, dob, gender, house, street, barangay, city, province, zip, contact, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, first_name, last_name, middle_name, suffix, date_of_birth, gender, house_no, street, barangay, city_municipality, province_region, postal_zip_code, contact_number]
    );

    await conn.execute('DELETE FROM password_reset_tokens WHERE LOWER(email) = LOWER(?)', [email]);
    await conn.commit();

    return res.status(201).json({
      success: true, message: 'Donor registered successfully.',
      token: issueToken(userId),
      user: { id: userId, email, role: 'donor', email_verified: true, display_name: `${first_name} ${last_name}` },
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(500).json({ success: false, message: 'Registration failed.', error: err.message });
  } finally {
    conn.release();
  }
};

exports.registerOrganization = async (req, res) => {
  let {
    organization_name, website_url, industry_sector, organization_type,
    first_name, last_name, email, contact_number,
    password, password_confirmation,
  } = req.body;

  email = normalizeEmail(email);
  contact_number = normalizeContactNumber(contact_number);
  website_url = website_url?.trim() || null;

  const errors = {};
  if (!organization_name) errors.organization_name = ['Organization name is required.'];
  if (!industry_sector) errors.industry_sector = ['Industry/sector is required.'];
  if (!organization_type) errors.organization_type = ['Organization type is required.'];
  if (!first_name) errors.first_name = ['First name is required.'];
  if (!last_name) errors.last_name = ['Last name is required.'];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = ['Invalid email address.'];
  if (!contact_number || !/^[0-9]{10}$/.test(contact_number)) errors.contact_number = ['Contact number must be exactly 10 digits.'];
  if (!password || password.length < 12) errors.password = ['Password must be at least 12 characters.'];
  else if (password !== password_confirmation) errors.password = ['Passwords do not match.'];
  else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/.test(password)) errors.password = ['Password must contain uppercase, lowercase, a number, and a special character.'];

  if (Object.keys(errors).length) return res.status(422).json({ success: false, message: 'Validation failed.', errors });

  const [emailCheck] = await db.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
  if (emailCheck.length) return res.status(422).json({ success: false, message: 'Validation failed.', errors: { email: ['This email is already registered.'] } });

  const [verifiedCheck] = await db.execute("SELECT * FROM password_reset_tokens WHERE LOWER(email) = LOWER(?) AND token = 'VERIFIED'", [email]);
  if (!verifiedCheck.length) return res.status(403).json({ success: false, message: 'Email not verified. Please verify your email first.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const hashed = await bcrypt.hash(password, 12);
    const [userResult] = await conn.execute(
      'INSERT INTO users (name, role, email, password, email_verified, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, true, NOW(), NOW(), NOW())',
      [organization_name.trim(), 'organization', email, hashed]
    );
    const userId = userResult.insertId;

    await conn.execute(
      `INSERT INTO donor_organizations (user_id, org_name, website, industry, type, first_name, last_name, contact, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, organization_name, website_url, industry_sector, organization_type, first_name, last_name, contact_number, email]
    );

    await conn.execute('DELETE FROM password_reset_tokens WHERE LOWER(email) = LOWER(?)', [email]);
    await conn.commit();

    return res.status(201).json({
      success: true, message: 'Organization registered successfully.',
      token: issueToken(userId),
      user: { id: userId, email, role: 'organization', email_verified: true, display_name: organization_name },
    });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ success: false, message: 'Registration failed.', error: err.message });
  } finally {
    conn.release();
  }
};

exports.registerPartnerKitchen = async (req, res) => {
  let {
    kitchen_name, website_url, contact_person, position_role,
    email, contact_number, password, password_confirmation,
  } = req.body;

  email = normalizeEmail(email);
  contact_number = normalizeContactNumber(contact_number);
  website_url = website_url?.trim() || null;

  const errors = {};
  if (!kitchen_name) errors.kitchen_name = ['Kitchen name is required.'];
  if (!contact_person) errors.contact_person = ['Contact person is required.'];
  if (!position_role) errors.position_role = ['Position/role is required.'];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = ['Invalid email address.'];
  if (!contact_number || !/^[0-9]{10}$/.test(contact_number)) errors.contact_number = ['Contact number must be exactly 10 digits.'];
  if (!password || password.length < 12) errors.password = ['Password must be at least 12 characters.'];
  else if (password !== password_confirmation) errors.password = ['Passwords do not match.'];
  else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/.test(password)) errors.password = ['Password must contain uppercase, lowercase, a number, and a special character.'];

  if (Object.keys(errors).length) return res.status(422).json({ success: false, message: 'Validation failed.', errors });

  const [emailCheck] = await db.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
  if (emailCheck.length) return res.status(422).json({ success: false, message: 'Validation failed.', errors: { email: ['This email is already registered.'] } });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const hashed = await bcrypt.hash(password, 12);
    const [userResult] = await conn.execute(
      'INSERT INTO users (name, role, email, password, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, false, NOW(), NOW())',
      [kitchen_name.trim(), 'partner_kitchen', email, hashed]
    );
    const userId = userResult.insertId;

    await conn.execute(
      `INSERT INTO partner_kitchen (user_id, kitchen_name, website_url, contact_person, position_role, contact_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, kitchen_name, website_url, contact_person, position_role, contact_number]
    );

    await conn.commit();

    return res.status(201).json({
      success: true, message: 'Partner Kitchen registered successfully.',
      token: issueToken(userId),
      user: { id: userId, email, role: 'partner_kitchen', email_verified: false, display_name: kitchen_name },
    });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ success: false, message: 'Registration failed.', error: err.message });
  } finally {
    conn.release();
  }
};

exports.registerBeneficiary = async (req, res) => {
  let {
    beneficiary_type, email, contact_number, password, password_confirmation,
    house_no, street, barangay, city_municipality, province_region, postal_zip_code,
    organization_name, website_url, industry_sector, organization_type,
    first_name, last_name, middle_name, suffix, date_of_birth, gender,
  } = req.body;

  email = normalizeEmail(email);
  contact_number = normalizeContactNumber(contact_number);
  middle_name = middle_name?.trim() || null;
  suffix = suffix?.trim() || null;

  const errors = {};
  if (!['individual', 'organization'].includes(beneficiary_type)) errors.beneficiary_type = ['Beneficiary type must be individual or organization.'];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = ['Invalid email address.'];
  if (!contact_number || !/^[0-9]{10}$/.test(contact_number)) errors.contact_number = ['Contact number must be exactly 10 digits.'];
  if (!password || password.length < 12) errors.password = ['Password must be at least 12 characters.'];
  else if (password !== password_confirmation) errors.password = ['Passwords do not match.'];
  else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/.test(password)) errors.password = ['Password must contain uppercase, lowercase, a number, and a special character.'];
  if (!house_no || !/^[0-9]+$/.test(house_no)) errors.house_no = ['House number must contain numbers only.'];
  if (!street) errors.street = ['Street is required.'];
  if (!barangay) errors.barangay = ['Barangay is required.'];
  if (!city_municipality) errors.city_municipality = ['City/municipality is required.'];
  if (!province_region) errors.province_region = ['Province/region is required.'];
  if (!postal_zip_code) errors.postal_zip_code = ['Postal/zip code is required.'];

  if (beneficiary_type === 'organization') {
    if (!organization_name) errors.organization_name = ['Organization name is required.'];
    if (!industry_sector) errors.industry_sector = ['Industry/sector is required.'];
    if (!organization_type) errors.organization_type = ['Organization type is required.'];
  } else {
    if (!first_name) errors.first_name = ['First name is required.'];
    if (!last_name) errors.last_name = ['Last name is required.'];
    if (!date_of_birth || new Date(date_of_birth) >= new Date()) errors.date_of_birth = ['Date of birth must be strictly before today.'];
    if (!['Male', 'Female', 'Other'].includes(gender)) errors.gender = ['Gender must be Male, Female, or Other.'];
  }

  if (Object.keys(errors).length) return res.status(422).json({ success: false, message: 'Validation failed.', errors });

  const [emailCheck] = await db.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
  if (emailCheck.length) return res.status(422).json({ success: false, message: 'Validation failed.', errors: { email: ['This email is already registered.'] } });

  const [verifiedCheck] = await db.execute("SELECT * FROM password_reset_tokens WHERE LOWER(email) = LOWER(?) AND token = 'VERIFIED'", [email]);
  if (!verifiedCheck.length) return res.status(403).json({ success: false, message: 'Email not verified. Please verify your email first.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const hashed = await bcrypt.hash(password, 12);
    const displayName = beneficiary_type === 'organization'
      ? organization_name.trim()
      : `${first_name.trim()} ${last_name.trim()}`;

    const [userResult] = await conn.execute(
      'INSERT INTO users (name, role, email, password, email_verified, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, true, NOW(), NOW(), NOW())',
      [displayName, 'beneficiary', email, hashed]
    );
    const userId = userResult.insertId;

    if (beneficiary_type === 'organization') {
      await conn.execute(
        `INSERT INTO beneficiary_organizations (user_id, org_name, website, industry, type, house, street, barangay, city, province, zip, contact, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, organization_name, website_url || null, industry_sector, organization_type, house_no, street, barangay, city_municipality, province_region, postal_zip_code, contact_number]
      );
    } else {
      await conn.execute(
        `INSERT INTO beneficiaries (user_id, first_name, last_name, middle_name, suffix, dob, gender, house, street, barangay, city, province, zip, contact, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, first_name, last_name, middle_name, suffix, date_of_birth, gender, house_no, street, barangay, city_municipality, province_region, postal_zip_code, contact_number]
      );
    }

    await conn.commit();

    return res.status(201).json({
      success: true, message: 'Beneficiary registered successfully.',
      token: issueToken(userId),
      user: { id: userId, email, role: 'beneficiary', email_verified: true, display_name: displayName },
    });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ success: false, message: 'Registration failed.', error: err.message });
  } finally {
    conn.release();
  }
};

// ─── Login Rate Limiter ───────────────────────────────────────────────────────

const loginAttempts = new Map();

function checkLoginRateLimit(key) {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const attempts = (loginAttempts.get(key) || []).filter(t => now - t < windowMs);
  if (attempts.length >= 5) {
    const retryAfter = Math.ceil((Math.min(...attempts) + windowMs - now) / 1000);
    return { tooMany: true, retryAfter };
  }
  return { tooMany: false };
}

function hitLoginRateLimit(key) {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const current = (loginAttempts.get(key) || []).filter(t => now - t < windowMs);
  current.push(now);
  loginAttempts.set(key, current);
  return current.length;
}

function clearLoginRateLimit(key) {
  loginAttempts.delete(key);
}

// ─── Login ────────────────────────────────────────────────────────────────────

exports.login = async (req, res) => {
  let { email: loginInput, password } = req.body;

  if (!loginInput || !password) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors: { email: ['Email or username is required.'] } });
  }

  const rateLimitKey = `login:${loginInput.toLowerCase()}`;
  const { tooMany, retryAfter } = checkLoginRateLimit(rateLimitKey);
  if (tooMany) {
    return res.status(429).json({ success: false, locked: true, message: 'Too many failed login attempts.', retry_after: retryAfter });
  }

  try {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE (LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?)) AND is_active IS NOT FALSE',
      [loginInput, loginInput]
    );
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      const attempts = hitLoginRateLimit(rateLimitKey);
      return res.status(401).json({ success: false, message: 'Invalid email or password.', attempts_remaining: Math.max(0, 5 - attempts) });
    }

    clearLoginRateLimit(rateLimitKey);

    // Backfill email_verified_at for accounts verified via mobile (email_verified=true but timestamp missing)
    if (user.email_verified && !user.email_verified_at) {
      await db.execute('UPDATE users SET email_verified_at = NOW() WHERE id = ?', [user.id]).catch(() => {});
    }

    const displayName = await getDisplayName(user);
    const token = issueToken(user.id);

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: { id: user.id, email: user.email, role: user.role, email_verified: !!user.email_verified, display_name: displayName },
    });
  } catch (err) {
    console.error('[login error]', err.message);
    return res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please try again in a moment.' });
  }
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

exports.dashboard = async (req, res) => {
  const user = req.user;
  const displayName = await getDisplayName(user);

  const [[{ totalfinancial }]] = await db.execute(
    "SELECT COALESCE(SUM(amount), 0) AS totalfinancial FROM financial_donation_records WHERE user_id = ? AND status = 'paid'",
    [user.id]
  );
  const [[{ totalfood }]] = await db.execute(
    'SELECT COUNT(*) AS totalfood FROM food_donation_records WHERE user_id = ?',
    [user.id]
  );
  const [activities] = await db.execute(
    'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
    [user.id]
  );

  const recentActivities = activities.map(a => ({
    id: a.id, type: a.type, title: a.title, description: a.description,
    icon: a.icon, time_ago: dayjs(a.created_at).fromNow(),
  }));

  let totalrequests = 0, pendingrequests = 0, acceptedrequests = 0;
  if (user.role === 'beneficiary') {
    [[{ totalrequests }]] = await db.execute('SELECT COUNT(*) AS totalrequests FROM beneficiary_requests WHERE user_id = ?', [user.id]);
    [[{ pendingrequests }]] = await db.execute("SELECT COUNT(*) AS pendingrequests FROM beneficiary_requests WHERE user_id = ? AND LOWER(status) = 'pending'", [user.id]);
    [[{ acceptedrequests }]] = await db.execute("SELECT COUNT(*) AS acceptedrequests FROM beneficiary_requests WHERE user_id = ? AND LOWER(status) IN ('accepted','approved','allocated','urgent')", [user.id]);
  }

  const [[{ totalmealsserved }]] = await db.execute(
    "SELECT COUNT(*) AS totalmealsserved FROM activity_logs WHERE user_id = ? AND title = 'Meal Prepared'",
    [user.id]
  );

  const [[{ totalfinancialcount }]] = await db.execute(
    "SELECT COUNT(*) AS totalfinancialcount FROM financial_donation_records WHERE user_id = ? AND status = 'paid'",
    [user.id]
  );
  const [[{ totalservice }]] = await db.execute(
    "SELECT COUNT(*) AS totalservice FROM service_donation_records WHERE user_id = ?",
    [user.id]
  );

  return res.json({
    success: true,
    display_name: displayName,
    role: user.role,
    total_donations: parseFloat(totalfinancial),
    total_financial_count: parseInt(totalfinancialcount),
    total_food: parseInt(totalfood),
    total_service: parseInt(totalservice),
    recent_activities: recentActivities,
    total_requests: parseInt(totalrequests),
    pending_requests: parseInt(pendingrequests),
    accepted_requests: parseInt(acceptedrequests),
    total_meals_served: parseInt(totalmealsserved),
  });
};

// ─── Profile ──────────────────────────────────────────────────────────────────

exports.profile = async (req, res) => {
  const user = req.user;
  const displayName = await getDisplayName(user);

  let userData = { id: user.id, email: user.email, role: user.role, email_verified: !!user.email_verified };

  if (user.role === 'donor') {
    const [rows] = await db.execute('SELECT * FROM donors WHERE user_id = ?', [user.id]);
    const p = rows[0];
    if (p) userData = { ...userData, first_name: p.first_name, last_name: p.last_name, middle_name: p.middle_name, suffix: p.suffix, date_of_birth: p.dob ? dayjs(p.dob).format('YYYY-MM-DD') : null, gender: p.gender, house_no: p.house, street: p.street, barangay: p.barangay, city_municipality: p.city, province_region: p.province, postal_zip_code: p.zip, contact_number: p.contact };

  } else if (user.role === 'organization') {
    const [rows] = await db.execute('SELECT * FROM donor_organizations WHERE user_id = ?', [user.id]);
    const p = rows[0];
    if (p) userData = { ...userData, organization_name: p.org_name, website_url: p.website, industry_sector: p.industry, organization_type: p.type, first_name: p.first_name, last_name: p.last_name, contact_number: p.contact };

  } else if (user.role === 'partner_kitchen') {
    const [rows] = await db.execute('SELECT * FROM partner_kitchen WHERE user_id = ?', [user.id]);
    const p = rows[0];
    if (p) userData = { ...userData, kitchen_name: p.kitchen_name, website_url: p.website_url, contact_person: p.contact_person, position_role: p.position_role, contact_number: p.contact_number };

  } else if (user.role === 'beneficiary') {
    const [orgRows] = await db.execute('SELECT * FROM beneficiary_organizations WHERE user_id = ?', [user.id]);
    const org = orgRows[0];
    if (org) {
      userData = { ...userData, organization_name: org.org_name, website_url: org.website, industry_sector: org.industry, organization_type: org.type, house_no: org.house, street: org.street, barangay: org.barangay, city_municipality: org.city, province_region: org.province, postal_zip_code: org.zip, contact_number: org.contact };
    } else {
      const [profRows] = await db.execute('SELECT * FROM beneficiaries WHERE user_id = ?', [user.id]);
      const p = profRows[0];
      if (p) userData = { ...userData, first_name: p.first_name, last_name: p.last_name, middle_name: p.middle_name, suffix: p.suffix, date_of_birth: p.dob ? dayjs(p.dob).format('YYYY-MM-DD') : null, gender: p.gender, house_no: p.house, street: p.street, barangay: p.barangay, city_municipality: p.city, province_region: p.province, postal_zip_code: p.zip, contact_number: p.contact };
    }
  }

  return res.json({ success: true, display_name: displayName, user: userData });
};

// ─── Logout ───────────────────────────────────────────────────────────────────

exports.logout = async (req, res) => {
  return res.json({ success: true, message: 'Logged out successfully.' });
};
