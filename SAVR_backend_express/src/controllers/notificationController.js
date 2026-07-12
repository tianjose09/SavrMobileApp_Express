const db = require('../db');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);

const https = require('https');

async function logFoodActivity(userId, title, description) {
  try {
    await db.execute(
      "INSERT INTO activity_logs (user_id, type, title, description, icon, created_at, updated_at) VALUES (?, 'food', ?, ?, 'truckicon', NOW(), NOW())",
      [userId, title, description]
    );
  } catch (e) {
    console.error('[logFoodActivity]', e.message);
  }
}

// Ensure push token table exists
db.execute(`
  CREATE TABLE IF NOT EXISTS user_push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    token TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.error('[push_tokens] table init failed:', err.message));

// Send a push notification via Expo's push API
async function sendExpoPush(token, title, body) {
  if (!token || !token.startsWith('ExponentPushToken')) return;
  const payload = JSON.stringify({
    to: token,
    sound: 'default',
    title,
    body,
    priority: 'high',
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'exp.host',
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      res.resume();
      resolve();
    });
    req.on('error', (e) => {
      console.error('[sendExpoPush]', e.message);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

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

db.execute(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP DEFAULT NULL`)
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

db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS receiving_method VARCHAR(255) DEFAULT NULL`)
  .catch(() => {});

// Migrate existing bank_name data into receiving_method then drop the old column
db.execute(`UPDATE beneficiary_requests SET receiving_method = bank_name WHERE receiving_method IS NULL AND bank_name IS NOT NULL`)
  .catch(() => {});
db.execute(`ALTER TABLE beneficiary_requests DROP COLUMN IF EXISTS bank_name`)
  .catch(() => {});

db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS account_name VARCHAR(255) DEFAULT NULL`)
  .catch(() => {});

db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS account_number VARCHAR(255) DEFAULT NULL`)
  .catch(() => {});

db.execute(`ALTER TABLE beneficiary_requests ADD COLUMN IF NOT EXISTS notified_statuses_json JSONB DEFAULT '[]'`)
  .catch(() => {});

db.execute(`ALTER TABLE donation_deliveries ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP DEFAULT NULL`)
  .catch(() => {});

db.execute(`ALTER TABLE service_donation_records ADD COLUMN IF NOT EXISTS notified_status VARCHAR(50)`)
  .catch(() => {});

db.execute(`ALTER TABLE truck_stops ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP DEFAULT NULL`)
  .catch(() => {});

db.execute(`ALTER TABLE truck_stops ADD COLUMN IF NOT EXISTS missed_notified_at TIMESTAMP DEFAULT NULL`)
  .catch(() => {});

db.execute(`ALTER TABLE truck_stops ADD COLUMN IF NOT EXISTS staff_message TEXT DEFAULT NULL`)
  .catch(() => {});

async function createNotification(userId, type, title, description, isCritical = false) {
  try {
    await db.execute(
      'INSERT INTO notifications (user_id, type, title, description, is_critical, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [userId, type, title, description, isCritical]
    );
    // Fire push notification if the user has a registered device token
    const [tokenRows] = await db.execute('SELECT token FROM user_push_tokens WHERE user_id = ?', [userId]);
    if (tokenRows.length > 0) {
      sendExpoPush(tokenRows[0].token, title, description).catch(() => {});
    }
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
      'SELECT id, user_id, status, notified_status, notified_statuses_json, request_name FROM beneficiary_requests WHERE user_id = ?',
      [userId]
    );

    // Only handle statuses NOT covered by the DB trigger (notify_beneficiary_request_status).
    // The trigger fires for approved/accepted/allocated/urgent/rejected/denied with the correct
    // request name. Handling them here too causes duplicates (one with name, one without).
    const notableStatuses = ['cancelled', 'completed'];
    const statusMessages = {
      cancelled: 'Your request "[name]" has been cancelled by our team. Please contact us if you have any questions.',
      completed: 'Your request "[name]" has been completed and fulfilled. Thank you for reaching out to us!',
    };
    const statusTitles = {
      cancelled: 'Request Cancelled',
      completed: 'Request Completed',
    };

    for (const r of requests) {
      try {
        const s = (r.status || '').toLowerCase().trim();

        // Rejected/denied: the DB trigger already created the notification row.
        // We only need to fire the push — no new notification needed.
        const isRejected = ['rejected', 'denied', 'declined', 'refused', 'disapproved'].includes(s) ||
                           s.includes('reject') || s.includes('den') || s.includes('declin');
        if (isRejected) {
          let prevNotified = [];
          try { prevNotified = typeof r.notified_statuses_json === 'string' ? JSON.parse(r.notified_statuses_json) : (r.notified_statuses_json || []); } catch {}
          if (prevNotified.includes(r.status)) continue;

          // Atomically claim so we only push once
          const [claimRes] = await db.execute(
            `UPDATE beneficiary_requests
             SET notified_statuses_json = COALESCE(notified_statuses_json, '[]'::jsonb) || ?::jsonb
             WHERE id = ? AND NOT (COALESCE(notified_statuses_json, '[]'::jsonb) @> ?::jsonb)`,
            [JSON.stringify([r.status]), r.id, JSON.stringify([r.status])]
          );
          if (claimRes.affectedRows === 0) continue;

          // Use the trigger-created notification text for the push content
          const [notifRows] = await db.execute(
            `SELECT title, description FROM notifications WHERE user_id = ? AND type = 'service' ORDER BY created_at DESC LIMIT 1`,
            [r.user_id]
          );
          const [tokenRows] = await db.execute('SELECT token FROM user_push_tokens WHERE user_id = ?', [r.user_id]);
          if (tokenRows.length > 0) {
            const name = r.request_name || 'Unnamed';
            const title = notifRows[0]?.title || 'Request Rejected';
            const body = notifRows[0]?.description || `Your request "${name}" has been rejected.`;
            sendExpoPush(tokenRows[0].token, title, body).catch(() => {});
          }
          continue;
        }

        if (!notableStatuses.includes(s)) continue;

        // Skip if this exact status was already notified before (even if status bounced away and back)
        let prevNotified = [];
        try { prevNotified = typeof r.notified_statuses_json === 'string' ? JSON.parse(r.notified_statuses_json) : (r.notified_statuses_json || []); } catch {}
        if (prevNotified.includes(r.status)) continue;

        // Atomically claim — append to history array and update last-notified stamp
        const [result] = await db.execute(
          `UPDATE beneficiary_requests
           SET notified_status = ?,
               notified_statuses_json = COALESCE(notified_statuses_json, '[]'::jsonb) || ?::jsonb
           WHERE id = ? AND NOT (COALESCE(notified_statuses_json, '[]'::jsonb) @> ?::jsonb)`,
          [r.status, JSON.stringify([r.status]), r.id, JSON.stringify([r.status])]
        );
        if (result.affectedRows === 0) continue;

        const name = r.request_name || 'Unnamed';
        const msg = (statusMessages[s] || `Your request "${name}" status has been updated to "${r.status}".`)
          .replace('[name]', name);
        await createNotification(r.user_id, 'service', statusTitles[s] || `Request ${r.status}`, msg, true);
      } catch (e) {
        console.error('[autoNotifyBeneficiary] item', r.id, e.message);
      }
    }
    // Check truck_stops DELIVER entries linked to this beneficiary's requests.
    // Notify beneficiary when financial disbursements are made via donation_deliveries
    try {
      const [financialDeliveries] = await db.execute(`
        SELECT del.id, del.delivery_items, del.created_at,
               dd.beneficiary_request_id, br.request_name, br.amount AS total_amount, br.user_id
        FROM donation_deliveries del
        JOIN donation_drives dd ON dd.id = del.donation_drive_id
        JOIN beneficiary_requests br ON br.id = dd.beneficiary_request_id
        WHERE br.user_id = ? AND br.type = 'financial'
          AND del.notified_at IS NULL
        ORDER BY del.created_at ASC
      `, [userId]);

      for (const del of financialDeliveries) {
        try {
          let items = [];
          try { items = typeof del.delivery_items === 'string' ? JSON.parse(del.delivery_items) : (del.delivery_items || []); } catch {}
          const financialItems = items.filter((i) => i.type === 'financial');
          if (financialItems.length === 0) continue;

          const [claimRes] = await db.execute(
            'UPDATE donation_deliveries SET notified_at = NOW() WHERE id = ? AND notified_at IS NULL',
            [del.id]
          );
          if (claimRes.affectedRows === 0) continue;

          const amountSent = financialItems.reduce((s, i) => s + parseFloat(i.qty || i.amount || '0'), 0);
          const name = del.request_name || 'Unnamed';
          const totalAmount = parseFloat(del.total_amount || '0');

          // Compute total sent across all deliveries for this request to check if fulfilled
          const [totals] = await db.execute(`
            SELECT COALESCE(SUM(
              (SELECT SUM((fi->>'qty')::numeric)
               FROM json_array_elements(del2.delivery_items) AS fi
               WHERE (fi->>'type') = 'financial')
            ), 0) AS total_sent
            FROM donation_deliveries del2
            JOIN donation_drives dd2 ON dd2.id = del2.donation_drive_id
            WHERE dd2.beneficiary_request_id = ?
          `, [del.beneficiary_request_id]);
          const totalSent = parseFloat(totals[0]?.total_sent || '0');
          const goalMet = totalAmount > 0 && totalSent >= totalAmount;

          const title = goalMet ? 'Financial Request Fulfilled' : 'Partial Payment Sent';
          const msg = goalMet
            ? `The full amount of ₱${totalAmount.toLocaleString()} for your request "${name}" has been sent to your account.`
            : `₱${amountSent.toLocaleString()} has been sent for your request "${name}". Total received so far: ₱${totalSent.toLocaleString()}${totalAmount > 0 ? ' of ₱' + totalAmount.toLocaleString() : ''}.`;

          await createNotification(del.user_id, 'service', title, msg, true);
        } catch (e) {
          console.error('[autoNotifyBeneficiary financial] delivery', del.id, e.message);
        }
      }
    } catch (e) {
      console.error('[autoNotifyBeneficiary financial]', e.message);
    }

    // Two cases:
    //   1. Never notified (notified_at IS NULL) — covers pending/completed/missed on first touch
    //   2. Already notified but then marked missed (updated_at > notified_at) — staff changed
    //      status to 'missed' after the initial 'pending' notification was already sent
    try {
      const [deliveryStops] = await db.execute(`
        SELECT ts.id, ts.status, ts.notified_at, ts.missed_notified_at, ts.staff_message,
               ts.date, ts.time_slot_start,
               br.request_name, br.user_id, dd.beneficiary_request_id
        FROM truck_stops ts
        JOIN donation_drives dd ON dd.id = ts.reference_id AND ts.source = 'donation_drive'
        JOIN beneficiary_requests br ON br.id = dd.beneficiary_request_id
        WHERE br.user_id = ? AND ts.stop_type = 'DELIVER'
          AND (
            ts.notified_at IS NULL
            OR (LOWER(ts.status) IN ('missed', 'notified') AND ts.missed_notified_at IS NULL)
          )
      `, [userId]);

      for (const stop of deliveryStops) {
        try {
          const isMissed = ['missed', 'notified'].includes((stop.status || '').toLowerCase());
          // Missed/notified stops use a dedicated missed_notified_at guard; all others use notified_at
          const claimQuery = isMissed
            ? 'UPDATE truck_stops SET missed_notified_at = NOW() WHERE id = ? AND LOWER(status) = ANY(ARRAY[\'missed\',\'notified\']) AND missed_notified_at IS NULL'
            : 'UPDATE truck_stops SET notified_at = NOW() WHERE id = ? AND notified_at IS NULL';
          const claimParams = isMissed ? [stop.id] : [stop.id];
          const [res] = await db.execute(claimQuery, claimParams);
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
          } else if (['missed', 'notified'].includes((stop.status || '').toLowerCase())) {
            // Web backend already created the notification row with the staff's message.
            // We only need to fire the push — creating another row would duplicate the bell entry.
            const [existingNotif] = await db.execute(
              `SELECT title, description FROM notifications
               WHERE user_id = ? AND type = 'service' AND is_critical = TRUE
               ORDER BY created_at DESC LIMIT 1`,
              [stop.user_id]
            );
            const pushTitle = existingNotif[0]?.title || 'Delivery Missed';
            const pushBody  = existingNotif[0]?.description
              || stop.staff_message
              || `Your scheduled delivery for "${name}" was missed. Please create a new request to reschedule.`;
            const [tokenRows] = await db.execute(
              'SELECT token FROM user_push_tokens WHERE user_id = ?', [stop.user_id]
            );
            if (tokenRows.length > 0) {
              sendExpoPush(tokenRows[0].token, pushTitle, pushBody).catch(() => {});
            }
            continue; // skip createNotification — web already wrote the row
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

    // Notify beneficiary when a donation delivery transitions to in_transit.
    // The web app sets donation_deliveries.status = 'in_transit' without touching beneficiary_requests,
    // so this polls for that state and fires once per request using notified_statuses_json as a guard.
    try {
      const [inTransitRows] = await db.execute(`
        SELECT DISTINCT br.id AS request_id, br.request_name, br.notified_statuses_json
        FROM donation_deliveries del
        JOIN donation_drives dd ON dd.id = del.donation_drive_id
        JOIN beneficiary_requests br ON br.id = dd.beneficiary_request_id
        WHERE br.user_id = ? AND del.status = 'in_transit'
          AND NOT (COALESCE(br.notified_statuses_json, '[]'::jsonb) @> '"in_transit_delivery"'::jsonb)
      `, [userId]);

      for (const row of inTransitRows) {
        try {
          const [claimRes] = await db.execute(
            `UPDATE beneficiary_requests
             SET notified_statuses_json = COALESCE(notified_statuses_json, '[]'::jsonb) || '"in_transit_delivery"'::jsonb
             WHERE id = ? AND NOT (COALESCE(notified_statuses_json, '[]'::jsonb) @> '"in_transit_delivery"'::jsonb)`,
            [row.request_id]
          );
          if (claimRes.affectedRows === 0) continue;
          await createNotification(
            userId, 'service', 'Your Delivery is On Its Way',
            `A delivery for your request "${row.request_name || 'Unnamed'}" is now in transit. Please be ready to receive it.`,
            true
          );
        } catch (e) {
          console.error('[autoNotifyBeneficiary in_transit] request', row.request_id, e.message);
        }
      }
    } catch (e) {
      console.error('[autoNotifyBeneficiary in_transit]', e.message);
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
      'SELECT id, user_id, status, mode, preferred_date, notified_status FROM food_donation_records WHERE user_id = ?',
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

        // Guard against an external source that may have already sent a notification
        // for this status change in the last 10 minutes.
        const [recentFoodRows] = await db.execute(
          `SELECT id FROM notifications
           WHERE user_id = ? AND type = 'food'
             AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)
             AND created_at > NOW() - INTERVAL '10 minutes'
           LIMIT 1`,
          [r.user_id, `%${s}%`, `%${s}%`]
        );
        if (recentFoodRows.length > 0) continue;

        let msg = foodMessages[s] || `Your food donation status has been updated to "${r.status}".`;
        if (s === 'approved' && r.mode === 'delivery' && r.preferred_date) {
          const dateStr = dayjs(r.preferred_date).format('MMMM DD, YYYY');
          msg = `Your food donation has been approved! Reminder: Please deliver this to the food bank/kitchen on your scheduled date: ${dateStr}.`;
        }

        await createNotification(r.user_id, 'food', foodTitles[s] || `Food Donation ${r.status}`, msg, true);
        // No separate activity log entries for status changes — the original
        // 'Food Donation Submitted' entry already shows the live status via reference_id.
      } catch (e) {
        console.error('[autoNotifyDonor food] item', r.id, e.message);
      }
    }

    const serviceNotable = ['accepted', 'confirmed', 'declined', 'rejected', 'completed', 'cancelled'];
    const serviceMessages = {
      accepted:  'Great news! Your service donation "[name]" has been accepted. Thank you for volunteering!',
      confirmed: 'Great news! Your service donation "[name]" has been confirmed. Thank you for volunteering!',
      declined:  'We regret to inform you that your service donation "[name]" has been declined. Please contact our team for more details.',
      rejected:  'We regret to inform you that your service donation "[name]" has been rejected. Please contact our team for more details.',
      completed: 'Your service donation "[name]" has been completed. Thank you for your contribution!',
      cancelled: 'Your service donation "[name]" has been cancelled. Please contact our team if you have any questions.',
    };
    const serviceTitles = {
      accepted:  'Service Donation Accepted',
      confirmed: 'Service Donation Confirmed',
      declined:  'Service Donation Declined',
      rejected:  'Service Donation Rejected',
      completed: 'Service Donation Completed',
      cancelled: 'Service Donation Cancelled',
    };

    const [serviceRows] = await db.execute(
      'SELECT id, user_id, status, notified_status, service_tab FROM service_donation_records WHERE user_id = ?',
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

        // Guard against an external source (admin portal / legacy DB trigger) that may
        // have already inserted a notification for this status change in the last 10 minutes.
        const [recentRows] = await db.execute(
          `SELECT id FROM notifications
           WHERE user_id = ? AND type = 'service'
             AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)
             AND created_at > NOW() - INTERVAL '10 minutes'
           LIMIT 1`,
          [r.user_id, `%${s}%`, `%${s}%`]
        );
        if (recentRows.length > 0) continue;

        const svcName = r.service_tab || 'service';
        const svcMsg = (serviceMessages[s] || `Your service donation "[name]" status has been updated to "${r.status}".`).replace('[name]', svcName);
        await createNotification(r.user_id, 'service', serviceTitles[s] || `Service Donation ${r.status}`, svcMsg, true);
      } catch (e) {
        console.error('[autoNotifyDonor service] item', r.id, e.message);
      }
    }
    // Sync food_donation_records status from pending/completed/missed PICKUP truck stops
    try {
      const [pickupStops] = await db.execute(`
        SELECT ts.id, ts.status, ts.staff_message, ts.reference_id AS donation_id,
               ts.missed_notified_at, ts.date, ts.time_slot_start,
               fdr.user_id AS donor_id
        FROM truck_stops ts
        JOIN food_donation_records fdr ON fdr.id::text = ts.reference_id::text
        WHERE fdr.user_id = ? AND ts.source = 'food_donation'
          AND (
            (LOWER(ts.status) = 'pending'   AND ts.notified_at IS NULL)
            OR (LOWER(ts.status) = 'completed' AND ts.notified_at IS NULL)
            OR (LOWER(ts.status) = 'missed'    AND ts.missed_notified_at IS NULL)
          )
      `, [userId]);

      for (const stop of pickupStops) {
        try {
          const statusLower = (stop.status || '').toLowerCase();
          const isDonorMissed = statusLower === 'missed';
          const donorClaimQuery = isDonorMissed
            ? 'UPDATE truck_stops SET missed_notified_at = NOW() WHERE id = ? AND LOWER(status) = ? AND missed_notified_at IS NULL'
            : 'UPDATE truck_stops SET notified_at = NOW() WHERE id = ? AND notified_at IS NULL';
          const donorClaimParams = isDonorMissed ? [stop.id, 'missed'] : [stop.id];
          const [res] = await db.execute(donorClaimQuery, donorClaimParams);
          if (res.affectedRows === 0) continue;

          if (statusLower === 'pending') {
            const dateStr = stop.date
              ? new Date(stop.date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
              : 'soon';
            const timeStr = stop.time_slot_start ? stop.time_slot_start.substring(0, 5) : '';
            const timeLabel = timeStr ? ` at ${timeStr}` : '';
            await createNotification(
              stop.donor_id, 'food', 'Pickup Incoming!',
              `Great news! Our team is scheduled to pick up your food donation on ${dateStr}${timeLabel}. Please make sure it is ready for collection. Thank you for your generosity!`,
              true
            );
          } else if (statusLower === 'completed') {
            await db.execute(
              "UPDATE food_donation_records SET status = 'received', updated_at = NOW() WHERE id = ? AND status NOT IN ('received','completed','rejected','cancelled')",
              [stop.donation_id]
            );
          } else if (['missed', 'notified'].includes(statusLower)) {
            const missedMsg = stop.staff_message ||
`Dear Donor,

We sincerely apologize for not being able to meet the scheduled pickup date. If possible, we kindly ask you to reschedule your preferred date and time.

How to reschedule:
1. Log in to your account
2. Click Donate on the Navigation Bar
3. Then click Food Donation card and fill up the needed details once again.

Thank you for your understanding and cooperation.`;
            // Update record status and stamp notified_status together so the generic
            // 'cancelled' notification loop does not fire a second time for this event.
            await db.execute(
              "UPDATE food_donation_records SET status = 'cancelled', notified_status = 'cancelled', updated_at = NOW() WHERE id = ? AND status NOT IN ('received','completed','rejected','cancelled')",
              [stop.donation_id]
            );
            await createNotification(stop.donor_id, 'food', 'Pickup Missed', missedMsg, true);
            await db.execute(
              "INSERT INTO activity_logs (user_id, type, title, description, icon, created_at, updated_at) VALUES (?, 'food', 'Pickup Missed', ?, 'truckicon', NOW(), NOW())",
              [stop.donor_id, missedMsg]
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
      ? 'SELECT id, type, title, description, is_critical, created_at FROM notifications WHERE user_id = ? AND is_critical = TRUE ORDER BY created_at DESC LIMIT 50'
      : 'SELECT id, type, title, description, is_critical, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';

    const [rows] = await db.execute(sql, [uid]);
    const notifications = rows.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.description || '',
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

// POST /api/notifications/mark-all-read
exports.markAllRead = async (req, res) => {
  try {
    await db.execute(
      'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
      [req.user.id]
    );
    return res.json({ success: true });
  } catch (e) {
    console.error('[markAllRead]', e);
    return res.status(500).json({ success: false, message: 'Failed to mark notifications read.' });
  }
};

// POST /api/notifications/:id/mark-read
exports.markOneRead = async (req, res) => {
  try {
    const rawId = String(req.params.id).replace(/^db-/, '');
    await db.execute(
      'UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL',
      [rawId, req.user.id]
    );
    return res.json({ success: true });
  } catch (e) {
    console.error('[markOneRead]', e);
    return res.status(500).json({ success: false, message: 'Failed to mark notification read.' });
  }
};

// POST /api/push-token — save or update device push token for the logged-in user
exports.savePushToken = async (req, res) => {
  try {
    const uid = req.user.id;
    const { token } = req.body;
    if (!token) return res.status(422).json({ success: false, message: 'Token is required.' });
    await db.execute(
      `INSERT INTO user_push_tokens (user_id, token, updated_at)
       VALUES (?, ?, NOW())
       ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, updated_at = NOW()`,
      [uid, token]
    );
    return res.json({ success: true });
  } catch (e) {
    console.error('[savePushToken]', e);
    return res.status(500).json({ success: false, message: 'Failed to save push token.' });
  }
};

// POST /api/push-token/clear — remove device push token on logout
exports.clearPushToken = async (req, res) => {
  try {
    const uid = req.user.id;
    await db.execute('DELETE FROM user_push_tokens WHERE user_id = ?', [uid]);
    return res.json({ success: true });
  } catch (e) {
    console.error('[clearPushToken]', e);
    return res.status(500).json({ success: false, message: 'Failed to clear push token.' });
  }
};

// POST /api/notifications/notify-staff
exports.notifyStaffShortage = async (req, res) => {
  try {
    const { mealName, mealPax, targetPax, customMessage } = req.body;
    if (!mealName || mealPax === undefined || targetPax === undefined) {
      return res.status(422).json({ success: false, message: 'Meal name, feasible servings, and target servings are required.' });
    }

    const [userRows] = await db.execute('SELECT name, role FROM users WHERE id = ?', [req.user.id]);
    const senderName = userRows[0]?.name || 'A user';

    // Get all staff members
    const [staffRows] = await db.execute("SELECT id FROM users WHERE role = 'staff'");

    if (staffRows.length === 0) {
      return res.json({ success: true, message: 'No staff available to notify, but the alert was recorded.' });
    }

    const title = 'Feasibility Shortage Alert';
    const description = customMessage
      ? `${senderName}: ${customMessage}`
      : `${senderName} reported a shortage for ${mealName}. Can only serve ${mealPax} out of ${targetPax} requested servings.`;

    for (const staff of staffRows) {
      await createNotification(staff.id, 'service', title, description, true);
    }

    return res.json({ success: true, message: 'Staff notified successfully!' });
  } catch (e) {
    console.error('[notifyStaffShortage]', e);
    return res.status(500).json({ success: false, message: 'Failed to notify staff.' });
  }
};
