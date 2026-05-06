require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

async function test() {
  try {
    // Check public.users columns only
    const cols = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public' ORDER BY ordinal_position"
    );
    console.log('public.users columns:', cols.rows.map(r => r.column_name).join(', '));

    // Check partner_kitchen user with case-insensitive search
    const result = await pool.query(
      "SELECT id, email, role, password, email_verified FROM public.users WHERE role = 'partner_kitchen' LIMIT 3"
    );
    console.log('\nPartner kitchen users:', result.rows.length);
    result.rows.forEach(u => {
      console.log(' - email:', u.email, '| email_verified:', u.email_verified, '| hash prefix:', u.password?.substring(0, 7));
    });

    // Test case-insensitive login query (the fix)
    const loginTest = await pool.query(
      "SELECT id, email, role FROM public.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      ['partnerkitchen1@savr.app']
    );
    console.log('\nCase-insensitive login test:', loginTest.rows.length ? 'USER FOUND ✓' : 'NOT FOUND ✗');

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

test();
