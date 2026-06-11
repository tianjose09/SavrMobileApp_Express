require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'beneficiary_requests'
      ORDER BY ordinal_position;
    `);
    console.log('=== beneficiary_requests table columns ===');
    for (const row of res.rows) {
      console.log(`  ${row.column_name} | ${row.data_type} | nullable: ${row.is_nullable} | default: ${row.column_default || 'none'}`);
    }
    console.log(`\nTotal columns: ${res.rows.length}`);

    // Check which fields the frontend sends
    const frontendFields = [
      'title → request_name', 'type', 'food_type', 'quantity', 'unit',
      'financial_amount → amount', 'population', 'age_start → age_min', 'age_end → age_max',
      'street', 'barangay', 'city_municipality → city', 'postal_zip_code → zip_code',
      'needed_date → request_date', 'urgency_level → urgency',
      'food_items', 'receiving_method', 'account_name', 'account_number'
    ];
    console.log('\n=== Frontend → DB column mapping ===');
    frontendFields.forEach(f => console.log(`  ${f}`));

    const dbCols = res.rows.map(r => r.column_name);
    const requiredCols = [
      'id', 'user_id', 'request_name', 'type', 'food_type', 'quantity', 'unit',
      'amount', 'population', 'age_min', 'age_max', 'street', 'barangay', 'city', 'zip_code',
      'request_date', 'urgency', 'food_items', 'receiving_method', 'account_name', 'account_number',
      'status', 'created_at', 'updated_at'
    ];
    console.log('\n=== Column existence check ===');
    let allGood = true;
    for (const col of requiredCols) {
      const exists = dbCols.includes(col);
      console.log(`  ${col}: ${exists ? '✅' : '❌ MISSING'}`);
      if (!exists) allGood = false;
    }
    console.log(`\n${allGood ? '✅ All required columns exist!' : '❌ Some columns are missing!'}`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
