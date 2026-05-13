const db = require('../db');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);

// Create the notifications table if it doesn't exist yet
db.execute(`
  CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'system',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.error('[notifications] table init failed:', err.message));

async function createNotification(userId, type, title, description) {
  try {
    await db.execute(
      'INSERT INTO notifications (user_id, type, title, description, created_at) VALUES (?, ?, ?, ?, NOW())',
      [userId, type, title, description]
    );
  } catch (e) {
    console.error('[createNotification]', e.message);
  }
}

exports.createNotification = createNotification;

// GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const uid = req.user.id;
    const [rows] = await db.execute(
      'SELECT id, type, title, description, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [uid]
    );
    const notifications = rows.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      desc: n.description,
      time: dayjs(n.created_at).fromNow(),
    }));
    return res.json({ success: true, notifications });
  } catch (e) {
    console.error('[getNotifications]', e);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

// DELETE /api/notifications/:id  — reading a notification deletes it
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

// DELETE /api/notifications  — mark all read = delete all for user
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
