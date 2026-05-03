const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { sendVerificationCodeMail } = require('../mail/verificationCodeMail');
const { sendForgotPasswordMail } = require('../mail/forgotPasswordMail');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);

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
      const [rows] = await db.execute('SELECT first_name, last_name FROM donor_profiles WHERE user_id = ?', [user.id]);
      if (rows[0]) return `${rows[0].first_name} ${rows[0].last_name}`;
      break;
    }
    case 'organization': {
      const [rows] = await db.execute('SELECT org_name FROM organization_profiles WHERE user_id = ?', [user.id]);
      if (rows[0]) return rows[0].org_name;
      break;
    }
    case 'partner_kitchen': {
      const [rows] = await db.execute('SELECT kitchen_name FROM partner_kitchen_profiles WHERE user_id = ?', [user.id]);
      if (rows[0] && rows[0].kitchen_name) return rows[0].kitchen_name;
      if (user.name) return user.name;
      break;
    }
    case 'beneficiary': {
      const [orgRows] = await db.execute('SELECT org_name FROM beneficiary_organizations WHERE user_id = ?', [user.id]);
      if (orgRows[0]) return orgRows[0].org_name;
      const [profRows] = await db.execute('SELECT first_name, last_name FROM beneficiary_profiles WHERE user_id = ?', [user.id]);
      if (profRows[0]) return `${profRows[0].first_name} ${profRows[0].last_name}`;
      break;
    }
  }
  return user.email;
}

async function storeVerificationCode(email, code) {
  await db.execute('DELETE FROM password_reset_tokens WHERE email = ?', [email]);
  await db.execute(
    'INSERT INTO password_reset_tokens (email, token, created_at) VALUES (?, ?, NOW())',
    [email, code]
  );
}

function isCodeExpired(createdAt) {
  return dayjs().diff(dayjs(createdAt), 'minute') >= 10;
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

exports.sendVerificationEmail = async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ success: false, message: 'Invalid email address.' });
  }

  const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) {
    return res.status(409).json({ success: false, message: 'This email is already registered.' });
  }

  try {
    const code = generateCode();
    const name = req.body.name || 'User';
    await storeVerificationCode(email, code);
    await sendVerificationCodeMail(email, code, name);
    return res.json({ success: true, message: `Verification code sent to ${email}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again.', error: err.message });
  }
};

exports.verifyCode = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = req.body.code;

  if (!email || !code || code.length !== 6) {
    return res.status(422).json({ success: false, message: 'Validation failed.' });
  }

  const [rows] = await db.execute('SELECT * FROM password_reset_tokens WHERE email = ?', [email]);
  const verification = rows[0];

  if (!verification) {
    return res.status(404).json({ success: false, message: 'No verification code found. Please request a new one.' });
  }

  if (verification.token === 'VERIFIED') {
    return res.json({ success: true, message: 'Email verified successfully.' });
  }

  if (isCodeExpired(verification.created_at)) {
    return res.status(410).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
  }

  if (verification.token !== code) {
    return res.status(422).json({ success: false, message: 'Invalid verification code. Please try again.' });
  }

  await db.execute("UPDATE password_reset_tokens SET token = 'VERIFIED' WHERE email = ?", [email]);
  return res.json({ success: true, message: 'Email verified successfully.' });
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

  const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
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
    return res.status(500).json({ success: false, message: 'Failed to send reset email. Please try again.', error: err.message });
  }
};

exports.verifyResetCode = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = req.body.code;

  if (!email || !code || code.length !== 6) {
    return res.status(422).json({ success: false, message: 'Validation failed.' });
  }

  const [rows] = await db.execute('SELECT * FROM password_reset_tokens WHERE email = ?', [email]);
  const verification = rows[0];

  if (!verification) {
    return res.status(404).json({ success: false, message: 'No reset code found. Please request a new one.' });
  }

  if (verification.token === 'VERIFIED') {
    return res.json({ success: true, message: 'Code verified. You may now reset your password.' });
  }

  if (isCodeExpired(verification.created_at)) {
    return res.status(410).json({ success: false, message: 'Reset code has expired. Please request a new one.' });
  }

  if (verification.token !== code) {
    return res.status(422).json({ success: false, message: 'Invalid reset code. Please try again.' });
  }

  await db.execute("UPDATE password_reset_tokens SET token = 'VERIFIED' WHERE email = ?", [email]);
  return res.json({ success: true, message: 'Code verified. You may now reset your password.' });
};

exports.resetPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;
  const passwordConfirmation = req.body.password_confirmation;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ success: false, message: 'Invalid email address.' });
  }

  if (!password || password.length < 8) {
    return res.status(422).json({ success: false, message: 'Password must be at least 8 characters.' });
  }
  if (password !== passwordConfirmation) {
    return res.status(422).json({ success: false, message: 'Passwords do not match.' });
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/.test(password)) {
    return res.status(422).json({ success: false, message: 'Password must contain uppercase, lowercase, a number, and a special character.' });
  }

  const [userRows] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (!userRows.length) {
    return res.status(422).json({ success: false, message: 'No account found with this email.' });
  }

  const [tokenRows] = await db.execute("SELECT * FROM password_reset_tokens WHERE email = ? AND token = 'VERIFIED'", [email]);
  if (!tokenRows.length) {
    return res.status(403).json({ success: false, message: 'Please verify your reset code first.' });
  }

  try {
    const hashed = await bcrypt.hash(password, 12);
    await db.execute('UPDATE users SET password = ? WHERE email = ?', [hashed, email]);
    await db.execute('DELETE FROM password_reset_tokens WHERE email = ?', [email]);
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
  if (!contact_number || !/^[0-9]{10}$/.test(contact_number)) errors.contact_number = ['Contact number must be exactly 10 digits (numbers only).'];
  if (!password || password.length < 8) errors.password = ['Password must be at least 8 characters.'];
  else if (password !== password_confirmation) errors.password = ['Passwords do not match.'];
  else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/.test(password)) errors.password = ['Password must contain uppercase, lowercase, a number, and a special character.'];

  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors });
  }

  const [emailCheck] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (emailCheck.length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors: { email: ['This email is already registered.'] } });
  }

  const [verifiedCheck] = await db.execute("SELECT * FROM password_reset_tokens WHERE email = ? AND token = 'VERIFIED'", [email]);
  if (!verifiedCheck.length) {
    return res.status(403).json({ success: false, message: 'Email not verified. Please verify your email first.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const hashed = await bcrypt.hash(password, 12);
    const [userResult] = await conn.execute(
      'INSERT INTO users (name, role, email, password, is_verified, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())',
      [`${first_name.trim()} ${last_name.trim()}`, 'donor', email, hashed]
    );
    const userId = userResult.insertId;

    await conn.execute(
      `INSERT INTO donor_profiles (user_id, first_name, last_name, middle_name, suffix, dob, gender, house, street, barangay, city, province, zip, contact, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, first_name, last_name, middle_name, suffix, date_of_birth, gender, house_no, street, barangay, city_municipality, province_region, postal_zip_code, contact_number]
    );

    await conn.execute('DELETE FROM password_reset_tokens WHERE email = ?', [email]);
    await conn.commit();

    const token = issueToken(userId);
    return res.status(201).json({
      success: true,
      message: 'Donor registered successfully.',
      token,
      user: { id: userId, email, role: 'donor', is_verified: true, display_name: `${first_name} ${last_name}` },
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
  if (!contact_number || !/^[0-9]{10}$/.test(contact_number)) errors.contact_number = ['Contact number must be exactly 10 digits (numbers only).'];
  if (!password || password.length < 8) errors.password = ['Password must be at least 8 characters.'];
  else if (password !== password_confirmation) errors.password = ['Passwords do not match.'];
  else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/.test(password)) errors.password = ['Password must contain uppercase, lowercase, a number, and a special character.'];

  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors });
  }

  const [emailCheck] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (emailCheck.length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors: { email: ['This email is already registered.'] } });
  }

  const [verifiedCheck] = await db.execute("SELECT * FROM password_reset_tokens WHERE email = ? AND token = 'VERIFIED'", [email]);
  if (!verifiedCheck.length) {
    return res.status(403).json({ success: false, message: 'Email not verified. Please verify your email first.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const hashed = await bcrypt.hash(password, 12);
    const [userResult] = await conn.execute(
      'INSERT INTO users (name, role, email, password, is_verified, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())',
      [organization_name.trim(), 'organization', email, hashed]
    );
    const userId = userResult.insertId;

    await conn.execute(
      `INSERT INTO organization_profiles (user_id, org_name, website, industry, type, first_name, last_name, contact, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, organization_name, website_url, industry_sector, organization_type, first_name, last_name, contact_number]
    );

    await conn.execute('DELETE FROM password_reset_tokens WHERE email = ?', [email]);
    await conn.commit();

    const token = issueToken(userId);
    return res.status(201).json({
      success: true,
      message: 'Organization registered successfully.',
      token,
      user: { id: userId, email, role: 'organization', is_verified: true, display_name: organization_name },
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
  if (!contact_number || !/^[0-9]{10}$/.test(contact_number)) errors.contact_number = ['Contact number must be exactly 10 digits (numbers only).'];
  if (!password || password.length < 8) errors.password = ['Password must be at least 8 characters.'];
  else if (password !== password_confirmation) errors.password = ['Passwords do not match.'];
  else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/.test(password)) errors.password = ['Password must contain uppercase, lowercase, a number, and a special character.'];

  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors });
  }

  const [emailCheck] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (emailCheck.length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors: { email: ['This email is already registered.'] } });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const hashed = await bcrypt.hash(password, 12);
    const [userResult] = await conn.execute(
      'INSERT INTO users (name, role, email, password, is_verified, created_at, updated_at) VALUES (?, ?, ?, ?, 0, NOW(), NOW())',
      [kitchen_name.trim(), 'partner_kitchen', email, hashed]
    );
    const userId = userResult.insertId;

    await conn.execute(
      `INSERT INTO partner_kitchen_profiles (user_id, kitchen_name, website_url, contact_person, position_role, contact_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, kitchen_name, website_url, contact_person, position_role, contact_number]
    );

    await conn.commit();

    const token = issueToken(userId);
    return res.status(201).json({
      success: true,
      message: 'Partner Kitchen registered successfully.',
      token,
      user: { id: userId, email, role: 'partner_kitchen', is_verified: false, display_name: kitchen_name },
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
  organization_name = organization_name?.trim() || null;
  website_url = website_url?.trim() || null;
  industry_sector = industry_sector?.trim() || null;
  organization_type = organization_type?.trim() || null;

  const errors = {};
  if (!['individual', 'organization'].includes(beneficiary_type)) errors.beneficiary_type = ['Beneficiary type must be individual or organization.'];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = ['Invalid email address.'];
  if (!contact_number || !/^[0-9]{10}$/.test(contact_number)) errors.contact_number = ['Contact number must be exactly 10 digits.'];
  if (!password || password.length < 8) errors.password = ['Password must be at least 8 characters.'];
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

  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors });
  }

  const [emailCheck] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (emailCheck.length) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors: { email: ['This email is already registered.'] } });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const hashed = await bcrypt.hash(password, 12);
    const displayName = beneficiary_type === 'organization'
      ? organization_name
      : `${first_name.trim()} ${last_name.trim()}`;

    const [userResult] = await conn.execute(
      'INSERT INTO users (name, role, email, password, is_verified, created_at, updated_at) VALUES (?, ?, ?, ?, 0, NOW(), NOW())',
      [displayName, 'beneficiary', email, hashed]
    );
    const userId = userResult.insertId;

    if (beneficiary_type === 'organization') {
      await conn.execute(
        `INSERT INTO beneficiary_organizations (user_id, org_name, website, industry, type, house, street, barangay, city, province, zip, contact, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, organization_name, website_url, industry_sector, organization_type, house_no, street, barangay, city_municipality, province_region, postal_zip_code, contact_number]
      );
    } else {
      await conn.execute(
        `INSERT INTO beneficiary_profiles (user_id, first_name, last_name, middle_name, suffix, dob, gender, house, street, barangay, city, province, zip, contact, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, first_name, last_name, middle_name, suffix, date_of_birth, gender, house_no, street, barangay, city_municipality, province_region, postal_zip_code, contact_number]
      );
    }

    await conn.commit();

    const token = issueToken(userId);
    return res.status(201).json({
      success: true,
      message: 'Beneficiary registered successfully.',
      token,
      user: { id: userId, email, role: 'beneficiary', is_verified: false, display_name: displayName },
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

function checkLoginRateLimit(email) {
  const key = `login:${email.toLowerCase()}`;
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const max = 5;

  const attempts = (loginAttempts.get(key) || []).filter(t => now - t < windowMs);

  if (attempts.length >= max) {
    const oldest = Math.min(...attempts);
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
    return { tooMany: true, retryAfter };
  }
  return { tooMany: false, attempts };
}

function hitLoginRateLimit(email) {
  const key = `login:${email.toLowerCase()}`;
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const current = (loginAttempts.get(key) || []).filter(t => now - t < windowMs);
  current.push(now);
  loginAttempts.set(key, current);
  return current.length;
}

function clearLoginRateLimit(email) {
  loginAttempts.delete(`login:${email.toLowerCase()}`);
}

// ─── Login ────────────────────────────────────────────────────────────────────

exports.login = async (req, res) => {
  let { email: loginInput, password } = req.body;

  if (!loginInput || !password) {
    return res.status(422).json({ success: false, message: 'Validation failed.', errors: { email: ['Email or username is required.'] } });
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginInput)) {
    loginInput = normalizeEmail(loginInput);
  }

  const { tooMany, retryAfter } = checkLoginRateLimit(loginInput);
  if (tooMany) {
    return res.status(429).json({ success: false, locked: true, message: 'Too many failed login attempts.', retry_after: retryAfter });
  }

  const [rows] = await db.execute(
    'SELECT * FROM users WHERE email = ? OR username = ?',
    [loginInput, loginInput]
  );
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    const attempts = hitLoginRateLimit(loginInput);
    const remaining = Math.max(0, 5 - attempts);
    return res.status(401).json({ success: false, message: 'Invalid email or password.', attempts_remaining: remaining });
  }

  clearLoginRateLimit(loginInput);

  const displayName = await getDisplayName(user);
  const token = issueToken(user.id);

  return res.json({
    success: true,
    message: 'Login successful.',
    token,
    user: { id: user.id, email: user.email, role: user.role, is_verified: !!user.is_verified, display_name: displayName },
  });
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

exports.dashboard = async (req, res) => {
  const user = req.user;
  const displayName = await getDisplayName(user);

  const [[{ totalFinancial }]] = await db.execute(
    "SELECT COALESCE(SUM(amount), 0) AS totalFinancial FROM financial_donations WHERE user_id = ? AND status = 'paid'",
    [user.id]
  );

  const [[{ totalFood }]] = await db.execute(
    'SELECT COUNT(*) AS totalFood FROM food_donations WHERE user_id = ?',
    [user.id]
  );

  const [activities] = await db.execute(
    'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
    [user.id]
  );

  const recentActivities = activities.map(a => ({
    id: a.id,
    type: a.type,
    title: a.title,
    description: a.description,
    icon: a.icon,
    time_ago: dayjs(a.created_at).fromNow(),
  }));

  let totalRequests = 0, pendingRequests = 0, fulfilledRequests = 0;
  if (user.role === 'beneficiary') {
    [[{ totalRequests }]] = await db.execute(
      'SELECT COUNT(*) AS totalRequests FROM beneficiary_requests WHERE user_id = ?', [user.id]
    );
    [[{ pendingRequests }]] = await db.execute(
      "SELECT COUNT(*) AS pendingRequests FROM beneficiary_requests WHERE user_id = ? AND status = 'Pending'", [user.id]
    );
    [[{ fulfilledRequests }]] = await db.execute(
      "SELECT COUNT(*) AS fulfilledRequests FROM beneficiary_requests WHERE user_id = ? AND status IN ('Allocated','Urgent')", [user.id]
    );
  }

  const [[{ totalMealsServed }]] = await db.execute(
    "SELECT COUNT(*) AS totalMealsServed FROM activity_logs WHERE user_id = ? AND title = 'Meal Prepared'",
    [user.id]
  );

  return res.json({
    success: true,
    display_name: displayName,
    role: user.role,
    total_donations: parseFloat(totalFinancial),
    total_food: totalFood,
    recent_activities: recentActivities,
    total_requests: totalRequests,
    pending_requests: pendingRequests,
    fulfilled_requests: fulfilledRequests,
    total_meals_served: totalMealsServed,
  });
};

// ─── Profile ──────────────────────────────────────────────────────────────────

exports.profile = async (req, res) => {
  const user = req.user;
  const displayName = await getDisplayName(user);

  let userData = {
    id: user.id,
    email: user.email,
    role: user.role,
    is_verified: !!user.is_verified,
  };

  if (user.role === 'donor') {
    const [rows] = await db.execute('SELECT * FROM donor_profiles WHERE user_id = ?', [user.id]);
    const p = rows[0];
    if (p) {
      userData = { ...userData, first_name: p.first_name, last_name: p.last_name, middle_name: p.middle_name, suffix: p.suffix, date_of_birth: p.dob, gender: p.gender, house_no: p.house, street: p.street, barangay: p.barangay, city_municipality: p.city, province_region: p.province, postal_zip_code: p.zip, contact_number: p.contact };
    }
  } else if (user.role === 'organization') {
    const [rows] = await db.execute('SELECT * FROM organization_profiles WHERE user_id = ?', [user.id]);
    const p = rows[0];
    if (p) {
      userData = { ...userData, organization_name: p.org_name, website_url: p.website, industry_sector: p.industry, organization_type: p.type, first_name: p.first_name, last_name: p.last_name, contact_number: p.contact };
    }
  } else if (user.role === 'partner_kitchen') {
    const [rows] = await db.execute('SELECT * FROM partner_kitchen_profiles WHERE user_id = ?', [user.id]);
    const p = rows[0];
    if (p) {
      userData = { ...userData, kitchen_name: p.kitchen_name, website_url: p.website_url, contact_person: p.contact_person, position_role: p.position_role, contact_number: p.contact_number };
    }
  } else if (user.role === 'beneficiary') {
    const [orgRows] = await db.execute('SELECT * FROM beneficiary_organizations WHERE user_id = ?', [user.id]);
    const org = orgRows[0];
    if (org) {
      userData = { ...userData, organization_name: org.org_name, website_url: org.website, industry_sector: org.industry, organization_type: org.type, house_no: org.house, street: org.street, barangay: org.barangay, city_municipality: org.city, province_region: org.province, postal_zip_code: org.zip, contact_number: org.contact };
    } else {
      const [profRows] = await db.execute('SELECT * FROM beneficiary_profiles WHERE user_id = ?', [user.id]);
      const p = profRows[0];
      if (p) {
        userData = { ...userData, first_name: p.first_name, last_name: p.last_name, middle_name: p.middle_name, suffix: p.suffix, date_of_birth: p.dob, gender: p.gender, house_no: p.house, street: p.street, barangay: p.barangay, city_municipality: p.city, province_region: p.province, postal_zip_code: p.zip, contact_number: p.contact };
      }
    }
  }

  return res.json({ success: true, display_name: displayName, user: userData });
};

// ─── Logout ───────────────────────────────────────────────────────────────────

exports.logout = async (req, res) => {
  return res.json({ success: true, message: 'Logged out successfully.' });
};
