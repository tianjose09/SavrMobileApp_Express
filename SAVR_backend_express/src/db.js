const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }, // required for Supabase
});

// Convert MySQL-style ? placeholders → PostgreSQL $1 $2 $3...
function pgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Run a query and return results in mysql2-compatible format:
//   SELECT  → [rowsArray, []]
//   INSERT  → [{ insertId, affectedRows }, []]
//   UPDATE/DELETE → [{ affectedRows }, []]
async function execute(sql, params = []) {
  const isInsert = /^\s*INSERT\s+/i.test(sql);
  let finalSql = pgSql(sql);

  // Auto-add RETURNING id so insertId works without changing controllers
  if (isInsert && !/RETURNING/i.test(finalSql)) {
    finalSql += ' RETURNING id';
  }

  const result = await pool.query(finalSql, params);

  if (isInsert) {
    return [{ insertId: result.rows[0]?.id ?? null, affectedRows: result.rowCount }, []];
  }
  return [result.rows, []];
}

// Wrap a pg client to look like a mysql2 connection (for transactions)
function wrapClient(client) {
  return {
    execute: async (sql, params = []) => {
      const isInsert = /^\s*INSERT\s+/i.test(sql);
      let finalSql = pgSql(sql);
      if (isInsert && !/RETURNING/i.test(finalSql)) {
        finalSql += ' RETURNING id';
      }
      const result = await client.query(finalSql, params);
      if (isInsert) {
        return [{ insertId: result.rows[0]?.id ?? null, affectedRows: result.rowCount }, []];
      }
      return [result.rows, []];
    },
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release(),
  };
}

async function getConnection() {
  const client = await pool.connect();
  return wrapClient(client);
}

module.exports = { execute, getConnection };
