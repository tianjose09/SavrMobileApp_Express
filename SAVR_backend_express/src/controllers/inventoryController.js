const db = require('../db');
const dayjs = require('dayjs');
const { createNotification } = require('./notificationController');

// Reset badges that were incorrectly marked 'earned' based on old test/paid data.
// Recalculation happens on the next payment event; this just clears the stale 'earned' flags.
db.execute(`
  UPDATE user_badges ub
  SET status = 'not_started', progress = 0, earned_at = NULL, updated_at = NOW()
  WHERE ub.status = 'earned'
    AND EXISTS (
      SELECT 1 FROM badges b WHERE b.id = ub.badge_id AND b.goal_type = 'financial_total'
    )
    AND (
      SELECT COALESCE(SUM(fdr.amount), 0)
      FROM financial_donation_records fdr
      WHERE fdr.user_id = ub.user_id AND fdr.status = 'approved'
    ) < (SELECT goal_value FROM badges WHERE id = ub.badge_id)
`).catch(err => console.error('[migration] badge reset failed:', err.message));

// Normalize any legacy rows that still carry meal_type='Prepared Meals' → 'Prep Meal'
db.execute("UPDATE food_inventory SET meal_type = 'Prep Meal' WHERE meal_type = 'Prepared Meals'")
  .catch(err => console.error('[migration] meal_type fix failed:', err.message));

// Fix categories for all known prepared-meal rows based on food_name.
// No meal_type filter — catches donated rows and any other origin.
// Also stamps meal_type='Prep Meal' so future deduct lookups find them.
db.execute(`
  UPDATE food_inventory
  SET category = 'Grains & Cereals', meal_type = 'Prep Meal', updated_at = NOW()
  WHERE LOWER(food_name) IN ('lugaw','arroz caldo','champorado','sopas')
`).catch(err => console.error('[migration] grains category fix failed:', err.message));

db.execute(`
  UPDATE food_inventory
  SET category = 'Vegetables', meal_type = 'Prep Meal', updated_at = NOW()
  WHERE LOWER(food_name) IN ('munggo guisado','veggie stir-fry','sotanghon soup')
`).catch(err => console.error('[migration] vegetables category fix failed:', err.message));

db.execute(`
  UPDATE food_inventory
  SET category = 'Meat', meal_type = 'Prep Meal', updated_at = NOW()
  WHERE LOWER(food_name) IN (
    'chicken adobo','chicken afritada','giniling','fried chicken',
    'egg sandwich filling','sardines with vegetables','tuna veggie mix',
    'sandwich'
  )
`).catch(err => console.error('[migration] meat category fix failed:', err.message));

// Catch-all: any row still carrying 'Prepared Meals' as category
// gets defaulted to 'Meat' and meal_type stamped as 'Prep Meal'.
db.execute(`
  UPDATE food_inventory
  SET category = 'Meat', meal_type = 'Prep Meal', updated_at = NOW()
  WHERE category = 'Prepared Meals'
`).catch(err => console.error('[migration] prepared meals catch-all fix failed:', err.message));

// Any row with unit='meal' must be a Prep Meal — fix stale rows that slipped through.
db.execute(`
  UPDATE food_inventory
  SET meal_type = 'Prep Meal', updated_at = NOW()
  WHERE LOWER(unit) = 'meal' AND meal_type != 'Prep Meal'
`).catch(err => console.error('[migration] meal unit fix failed:', err.message));

// Widen quantity column to NUMERIC so decimal values (e.g. 4.83 kg) can be stored.
// The USING clause explicitly casts existing integer values — required by PostgreSQL.
db.execute(`
  ALTER TABLE food_inventory ALTER COLUMN quantity TYPE NUMERIC(10,3) USING quantity::NUMERIC
`).catch(err => console.error('[migration] quantity column type fix failed:', err.message));

exports.index = async (req, res) => {
  const [items] = await db.execute(
    "SELECT * FROM food_inventory ORDER BY food_name"
  );

  return res.json({
    success: true,
    items: items.map(item => ({
      id: item.id,
      name: item.food_name,
      category: item.category,
      meal_type: item.meal_type || null,
      quantity: item.quantity,
      unit: item.unit,
      qty: `${item.quantity} ${item.unit}`,
      expiry: item.expiration_date ? dayjs(item.expiration_date).format('YYYY-MM-DD') : 'N/A',
    })),
  });
};

exports.store = async (req, res) => {
  const { food_name, category, quantity, unit, expiration_date, meal_type } = req.body;

  if (!food_name || !category || quantity === undefined || !unit) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors: {
        food_name: !food_name ? ['Food name is required.'] : [],
        category: !category ? ['Category is required.'] : [],
        quantity: quantity === undefined ? ['Quantity is required.'] : [],
        unit: !unit ? ['Unit is required.'] : [],
      },
    });
  }

  if (parseFloat(quantity) < 0) {
    return res.status(422).json({ success: false, message: 'Quantity must be at least 0.' });
  }

  const resolvedMealType = (unit || '').toLowerCase() === 'meal'
    ? 'Prep Meal'
    : (meal_type || 'Raw Ingredients');

  const [result] = await db.execute(
    `INSERT INTO food_inventory (food_name, category, quantity, unit, expiration_date, meal_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [food_name, category, quantity, unit, expiration_date || null, resolvedMealType]
  );

  const [rows] = await db.execute('SELECT * FROM food_inventory WHERE id = ?', [result.insertId]);
  const item = rows[0];

  return res.status(201).json({
    success: true,
    message: 'Inventory item added successfully.',
    item: {
      ...item,
      expiration_date: item?.expiration_date ? dayjs(item.expiration_date).format('YYYY-MM-DD') : null,
    },
  });
};

exports.preparedMeals = async (req, res) => {
  const [items] = await db.execute(
    "SELECT * FROM food_inventory WHERE meal_type = 'Prep Meal' ORDER BY created_at DESC"
  );

  return res.json({
    success: true,
    items: items.map(item => ({
      id: item.id,
      name: item.food_name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      qty: `${item.quantity} ${item.unit}`,
      expiry: item.expiration_date ? dayjs(item.expiration_date).format('YYYY-MM-DD') : 'N/A',
    })),
  });
};

exports.categories = async (req, res) => {
  const [rows] = await db.execute(
    'SELECT DISTINCT category FROM food_inventory WHERE category IS NOT NULL ORDER BY category'
  );
  return res.json({
    success: true,
    categories: rows.map(r => r.category),
  });
};

exports.deduct = async (req, res) => {
  const { deductions = [], meal_name, servings } = req.body;

  try {
    // Deduct raw ingredients if any are specified
    if (Array.isArray(deductions) && deductions.length > 0) {
      for (const deduction of deductions) {
        const [rows] = await db.execute('SELECT * FROM food_inventory WHERE id = ?', [deduction.id]);
        const item = rows[0];
        if (item) {
          const newQty = parseFloat(item.quantity) - parseFloat(deduction.qty_used);
          if (newQty <= 0) {
            await db.execute('DELETE FROM food_inventory WHERE id = ?', [item.id]);
          } else {
            await db.execute('UPDATE food_inventory SET quantity = ?, updated_at = NOW() WHERE id = ?', [newQty, item.id]);
          }
        }
      }
    }

    if (meal_name && req.user) {
      // Build ingredient summary
      const ingredientLines = [];
      for (const deduction of deductions) {
        const [rows] = await db.execute('SELECT food_name, unit FROM food_inventory WHERE id = ?', [deduction.id]);
        if (rows[0]) {
          ingredientLines.push(`• ${rows[0].food_name}: ${deduction.qty_used} ${rows[0].unit}`);
        }
      }
      const ingredientSummary = ingredientLines.length > 0
        ? `\n\nIngredients used:\n${ingredientLines.join('\n')}`
        : '';

      // The prepared meal will be added to food_inventory only when the user manually sets the status to 'Done' on the Summary screen.

      const description = `Prepared meal: ${meal_name} (${servings} servings)${ingredientSummary}`;

      // Activity log and notification are non-critical — log failures but don't block success response
      db.execute(
        "INSERT INTO activity_logs (user_id, type, title, description, icon, created_at, updated_at) VALUES (?, 'inventory', 'Meal Prepared', ?, 'foodicon', NOW(), NOW())",
        [req.user.id, description]
      ).catch(err => console.error('[deduct] activity_log failed:', err.message));

      createNotification(
        req.user.id,
        'food',
        `Meal Preparing: ${meal_name}`,
        `You have started preparing ${meal_name}.${ingredientSummary}`,
        true
      ).catch(err => console.error('[deduct] notification failed:', err.message));
    }

    return res.json({ success: true, message: 'Inventory deducted successfully.' });
  } catch (err) {
    console.error('[deduct]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to complete meal preparation. Please try again.' });
  }
};

exports.destroy = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute('DELETE FROM food_inventory WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ingredient not found.' });
    }
    return res.json({ success: true, message: 'Ingredient deleted successfully.' });
  } catch (err) {
    console.error('[destroy]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to delete ingredient.' });
  }
};
