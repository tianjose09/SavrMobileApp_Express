const db = require('../db');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);

// Add is_critical column if it doesn't exist yet
db.execute(`
  CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'system',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_critical BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.error('[notifications] table init failed:', err.message));

db.execute(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT FALSE`)
  .catch(() => {});

async function createNotification(userId, type, title, description, isCritical = false) {
  try {
    await db.execute(
      'INSERT INTO notifications (user_id, type, title, description, is_critical, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [userId, type, title, description, isCritical]
    );
  } catch (e) {
    console.error('[createNotification]', e.message);
  }
}

exports.createNotification = createNotification;

// GET /api/notifications
// ?critical=true  → only critical notifications (for the bell badge)
// no param        → all notifications (for the full notification screen)
exports.getNotifications = async (req, res) => {
  try {
    const uid = req.user.id;
    const criticalOnly = req.query.critical === 'true';

    const sql = criticalOnly
      ? 'SELECT id, type, title, description, is_critical, created_at FROM notifications WHERE user_id = ? AND is_critical = TRUE ORDER BY created_at DESC'
      : 'SELECT id, type, title, description, is_critical, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC';

    const [rows] = await db.execute(sql, [uid]);
    const notifications = rows.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      desc: n.description,
      is_critical: !!n.is_critical,
      time: dayjs(n.created_at).fromNow(),
    }));
    return res.json({ success: true, notifications });
  } catch (e) {
    console.error('[getNotifications]', e);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

// DELETE /api/notifications/:id
exports.deleteNotification = async (req, res) => {
  try {
    const uid = req.user.id;
    const { id } = req.params;
    await db.execute('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, uid]);
    return res.json({ success: true });
  } catch (e) {
    console.error('[deleteNotification]', e);
    return res.status(500).json({ success: false, message: 'Failed to delete notification.' });
  }
};

// DELETE /api/notifications
exports.deleteAllNotifications = async (req, res) => {
  try {
    const uid = req.user.id;
    await db.execute('DELETE FROM notifications WHERE user_id = ?', [uid]);
    return res.json({ success: true });
  } catch (e) {
    console.error('[deleteAllNotifications]', e);
    return res.status(500).json({ success: false, message: 'Failed to delete notifications.' });
  }
};
