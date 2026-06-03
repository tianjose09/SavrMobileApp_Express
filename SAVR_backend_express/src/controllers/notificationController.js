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

db.execute(`ALTER TABLE food_donation_records ADD COLUMN IF NOT EXISTS notified_status VARCHAR(50)`)
  .catch(() => {});

db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS received_quantity NUMERIC DEFAULT 0`)
  .catch(() => {});

db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS received_items JSONB`)
  .catch(() => {});

db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS dispatched_quantity NUMERIC DEFAULT NULL`)
  .catch(() => {});

db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS dispatched_items JSONB DEFAULT NULL`)
  .catch(() => {});

db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255) DEFAULT NULL`)
  .catch(() => {});

db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS account_name VARCHAR(255) DEFAULT NULL`)
  .catch(() => {});

db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS account_number VARCHAR(255) DEFAULT NULL`)
  .catch(() => {});

db.execute(`ALTER TABLE service_donation_records ADD COLUMN IF NOT EXISTS notified_status VARCHAR(50)`)
  .catch(() => {});

db.execute(`ALTER TABLE truck_stops ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP DEFAULT NULL`)
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

// Checks beneficiary_requests for any unnotified status changes and creates notifications.
// Called before returning notifications so the bell/screen always reflects the latest status.
async function autoNotifyBeneficiary(userId) {
  try {
    const [requests] = await db.execute(
      'SELECT id, user_id, status, notified_status, request_name FROM beneficiary_requests WHERE user_id = ?',
      [userId]
    );

    const notableStatuses = ['rejected', 'denied', 'approved', 'accepted', 'allocated', 'urgent', 'completed'];
    const statusMessages = {
      rejected:  'We regret to inform you that your request has been rejected. Please contact our team if you have any questions.',
      denied:    'We regret to inform you that your request has been denied. Please contact our team if you have any questions.',
      approved:  'Great news! Your request has been approved and is now being prepared for fulfillment.',
      accepted:  'Great news! Your request has been accepted and is now being prepared for fulfillment.',
      allocated: 'Your request has been allocated and will be processed soon. Thank you for your patience.',
      urgent:    'Your request has been marked as urgent and will be prioritized immediately.',
      completed: 'Your request has been completed and fulfilled. Thank you for reaching out to us!',
    };
    const statusTitles = {
      rejected:  'Request Rejected',
      denied:    'Request Denied',
      approved:  'Request Approved',
      accepted:  'Request Accepted',
      allocated: 'Request Allocated',
      urgent:    'Request Marked Urgent',
      completed: 'Request Completed',
    };

    for (const r of requests) {
      try {
        const s = (r.status || '').toLowerCase().trim();
        if (!notableStatuses.includes(s)) continue;

        // Atomically claim the notification slot — only the first concurrent caller wins
        const [result] = await db.execute(
          'UPDATE beneficiary_requests SET notified_status = ? WHERE id = ? AND (notified_status IS NULL OR notified_status != ?)',
          [r.status, r.id, r.status]
        );
        if (result.affectedRows === 0) continue;

        const name = r.request_name || 'Unnamed';
        const msg = (statusMessages[s] || `Your request status has been updated to "${r.status}".`)
          .replace('your request', `your request "${name}"`);
        await createNotification(r.user_id, 'service', statusTitles[s] || `Request ${r.status}`, msg, true);
      } catch (e) {
        console.error('[autoNotifyBeneficiary] item', r.id, e.message);
      }
    }
    // Check truck_stops DELIVER entries linked to this beneficiary's requests
    try {
      const [deliveryStops] = await db.execute(`
        SELECT ts.id, ts.status, ts.date, ts.time_slot_start,
               br.request_name, br.user_id, dd.beneficiary_request_id
        FROM truck_stops ts
        JOIN donation_drives dd ON dd.id = ts.reference_id AND ts.source = 'donation_drive'
        JOIN beneficiary_requests br ON br.id = dd.beneficiary_request_id
        WHERE br.user_id = ? AND ts.stop_type = 'DELIVER' AND ts.notified_at IS NULL
      `, [userId]);

      for (const stop of deliveryStops) {
        try {
          const [res] = await db.execute(
            'UPDATE truck_stops SET notified_at = NOW() WHERE id = ? AND notified_at IS NULL',
            [stop.id]
          );
          if (res.affectedRows === 0) continue;

          const name = stop.request_name || 'Unnamed';
          const dateStr = stop.date
            ? new Date(stop.date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
            : 'soon';
          const timeStr = stop.time_slot_start ? stop.time_slot_start.substring(0, 5) : '';
          const timeLabel = timeStr ? ` at ${timeStr}` : '';

          // Check if the full request is already completed
          let requestCompleted = false;
          try {
            const [reqRows] = await db.execute(
              "SELECT status FROM beneficiary_requests WHERE id = ?",
              [stop.beneficiary_request_id]
            );
            requestCompleted = (reqRows[0]?.status || '').toLowerCase() === 'completed';
          } catch {}

          let title, msg;
          if (stop.status === 'pending') {
            title = 'Delivery Incoming!';
            msg = `Great news! A delivery for your request "${name}" is on its way. Expected on ${dateStr}${timeLabel}. Please be available to receive it.`;
          } else if (stop.status === 'completed') {
            if (requestCompleted) {
              title = 'Request Fully Fulfilled!';
              msg = `All items for your request "${name}" have been delivered. Thank you for reaching out to us!`;
            } else {
              title = 'Partial Delivery Made';
              msg = `Some items for your request "${name}" have been delivered. Please confirm what you received in the app. More deliveries may follow until your request is fully fulfilled.`;
            }
          } else if (stop.status === 'missed') {
            title = 'Delivery Missed';
            msg = `Unfortunately, the delivery for your request "${name}" was missed. Our team will be in touch to reschedule.`;
          } else {
            continue;
          }

          await createNotification(stop.user_id, 'service', title, msg, true);
        } catch (e) {
          console.error('[autoNotifyBeneficiary delivery] stop', stop.id, e.message);
        }
      }
    } catch (e) {
      console.error('[autoNotifyBeneficiary delivery]', e.message);
    }
  } catch (e) {
    console.error('[autoNotifyBeneficiary]', e.message);
  }
}

// Checks food/service donation records for unnotified status changes and creates notifications for donors.
async function autoNotifyDonor(userId) {
  try {
    const foodNotable = ['approved', 'rejected', 'received', 'completed', 'cancelled'];
    const foodMessages = {
      approved:  'Great news! Your food donation has been approved and will be processed soon.',
      rejected:  'We regret to inform you that your food donation has been rejected. Please contact our team for more details.',
      received:  'Your food donation has been received. Thank you for your generosity!',
      completed: 'Your food donation has been completed and fulfilled. Thank you!',
      cancelled: 'Your food donation has been cancelled. Please contact our team if you have any questions.',
    };
    const foodTitles = {
      approved:  'Food Donation Approved',
      rejected:  'Food Donation Rejected',
      received:  'Food Donation Received',
      completed: 'Food Donation Completed',
      cancelled: 'Food Donation Cancelled',
    };

    const [foodRows] = await db.execute(
      'SELECT id, user_id, status, notified_status FROM food_donation_records WHERE user_id = ?',
      [userId]
    );
    for (const r of foodRows) {
      try {
        const s = (r.status || '').toLowerCase().trim();
        if (!foodNotable.includes(s)) continue;

        const [result] = await db.execute(
          'UPDATE food_donation_records SET notified_status = ? WHERE id = ? AND (notified_status IS NULL OR notified_status != ?)',
          [r.status, r.id, r.status]
        );
        if (result.affectedRows === 0) continue;

        await createNotification(r.user_id, 'food', foodTitles[s] || `Food Donation ${r.status}`, foodMessages[s] || `Your food donation status has been updated to "${r.status}".`, true);
      } catch (e) {
        console.error('[autoNotifyDonor food] item', r.id, e.message);
      }
    }

    const serviceNotable = ['confirmed', 'rejected', 'completed', 'cancelled'];
    const serviceMessages = {
      confirmed: 'Your service donation has been confirmed. Thank you for volunteering!',
      rejected:  'We regret to inform you that your service donation has been rejected. Please contact our team for more details.',
      completed: 'Your service donation has been completed. Thank you for your contribution!',
      cancelled: 'Your service donation has been cancelled. Please contact our team if you have any questions.',
    };
    const serviceTitles = {
      confirmed: 'Service Donation Confirmed',
      rejected:  'Service Donation Rejected',
      completed: 'Service Donation Completed',
      cancelled: 'Service Donation Cancelled',
    };

    const [serviceRows] = await db.execute(
      'SELECT id, user_id, status, notified_status FROM service_donation_records WHERE user_id = ?',
      [userId]
    );
    for (const r of serviceRows) {
      try {
        const s = (r.status || '').toLowerCase().trim();
        if (!serviceNotable.includes(s)) continue;

        const [result] = await db.execute(
          'UPDATE service_donation_records SET notified_status = ? WHERE id = ? AND (notified_status IS NULL OR notified_status != ?)',
          [r.status, r.id, r.status]
        );
        if (result.affectedRows === 0) continue;

        await createNotification(r.user_id, 'service', serviceTitles[s] || `Service Donation ${r.status}`, serviceMessages[s] || `Your service donation status has been updated to "${r.status}".`, true);
      } catch (e) {
        console.error('[autoNotifyDonor service] item', r.id, e.message);
      }
    }
    // Sync food_donation_records status from completed/missed PICKUP truck stops
    try {
      const [pickupStops] = await db.execute(`
        SELECT ts.id, ts.status, ts.reference_id AS donation_id
        FROM truck_stops ts
        JOIN food_donation_records fdr ON fdr.id = ts.reference_id
        WHERE fdr.user_id = ? AND ts.source = 'food_donation' AND ts.stop_type = 'PICKUP'
          AND ts.status IN ('completed', 'missed') AND ts.notified_at IS NULL
      `, [userId]);

      for (const stop of pickupStops) {
        try {
          const [res] = await db.execute(
            'UPDATE truck_stops SET notified_at = NOW() WHERE id = ? AND notified_at IS NULL',
            [stop.id]
          );
          if (res.affectedRows === 0) continue;

          if (stop.status === 'completed') {
            await db.execute(
              "UPDATE food_donation_records SET status = 'received', updated_at = NOW() WHERE id = ? AND status NOT IN ('received','completed','rejected','cancelled')",
              [stop.donation_id]
            );
          } else if (stop.status === 'missed') {
            await db.execute(
              "UPDATE food_donation_records SET status = 'cancelled', updated_at = NOW() WHERE id = ? AND status NOT IN ('received','completed','rejected','cancelled')",
              [stop.donation_id]
            );
          }
        } catch (e) {
          console.error('[autoNotifyDonor pickup sync] stop', stop.id, e.message);
        }
      }
    } catch (e) {
      console.error('[autoNotifyDonor pickup sync]', e.message);
    }
  } catch (e) {
    console.error('[autoNotifyDonor]', e.message);
  }
}

// GET /api/notifications
// ?critical=true  → only critical notifications (for the bell badge)
// no param        → all notifications (for the full notification screen)
exports.getNotifications = async (req, res) => {
  try {
    const uid = req.user.id;
    const criticalOnly = req.query.critical === 'true';

    // Auto-generate any pending notifications from web-side status changes
    if (req.user.role === 'beneficiary') {
      await autoNotifyBeneficiary(uid);
    } else if (req.user.role === 'donor' || req.user.role === 'organization') {
      await autoNotifyDonor(uid);
    }

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
