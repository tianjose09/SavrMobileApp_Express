const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthenticated.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? AND is_active IS NOT FALSE', [decoded.id]);

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Unauthenticated.' });
    }

    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};
