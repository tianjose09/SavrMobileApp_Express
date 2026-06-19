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

exports.index = async (req, res) => {
  const [items] = await db.execute(
    "SELECT * FROM food_inventory WHERE meal_type = 'Raw Ingredients' AND (category IS NULL OR (category != 'Prepared Meals' AND category != 'Prep Meal')) AND LOWER(unit) IN ('kg', 'pcs', 'l') ORDER BY food_name"
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

  const [result] = await db.execute(
    `INSERT INTO food_inventory (food_name, category, quantity, unit, expiration_date, meal_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [food_name, category, quantity, unit, expiration_date || null, meal_type || 'Raw Ingredients']
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
  const { deductions, meal_name, servings } = req.body;

  if (!Array.isArray(deductions) || !deductions.length) {
    return res.status(422).json({ success: false, message: 'Deductions array is required.' });
  }

  // Deduct raw ingredients
  for (const deduction of deductions) {
    const [rows] = await db.execute('SELECT * FROM food_inventory WHERE id = ?', [deduction.id]);
    const item = rows[0];
    if (item) {
      const newQty = Math.max(0, parseFloat(item.quantity) - parseFloat(deduction.qty_used));
      await db.execute('UPDATE food_inventory SET quantity = ?, updated_at = NOW() WHERE id = ?', [newQty, item.id]);
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

    // Determine category based on meal name
    const mealLower = (meal_name || '').toLowerCase();
    const GRAINS_MEALS = ['lugaw', 'arroz caldo', 'champorado', 'sopas'];
    const VEGGIE_MEALS = ['munggo guisado', 'veggie stir-fry', 'sotanghon soup'];
    let prepCategory = 'Meat';
    if (GRAINS_MEALS.some(m => mealLower.includes(m))) prepCategory = 'Grains & Cereals';
    else if (VEGGIE_MEALS.some(m => mealLower.includes(m))) prepCategory = 'Vegetables';

    // Add the prepared meal to food_inventory as a Prep Meal row.
    // Search by food_name only (no meal_type filter) so we adopt any existing
    // row regardless of how it was created (e.g. donated via admin portal with
    // unit='meal'). This prevents duplicate rows for the same dish.
    const prepQty = parseFloat(servings) || 1;
    const [existing] = await db.execute(
      "SELECT id, quantity FROM food_inventory WHERE LOWER(food_name) = LOWER(?)",
      [meal_name]
    );
    if (existing.length > 0) {
      const newQty = parseFloat(existing[0].quantity) + prepQty;
      await db.execute(
        "UPDATE food_inventory SET category = ?, meal_type = 'Prep Meal', quantity = ?, updated_at = NOW() WHERE id = ?",
        [prepCategory, newQty, existing[0].id]
      );
    } else {
      await db.execute(
        "INSERT INTO food_inventory (food_name, category, quantity, unit, expiration_date, meal_type, created_at, updated_at) VALUES (?, ?, ?, 'servings', NULL, 'Prep Meal', NOW(), NOW())",
        [meal_name, prepCategory, prepQty]
      );
    }

    const description = `Prepared meal: ${meal_name}${ingredientSummary}`;

    await db.execute(
      "INSERT INTO activity_logs (user_id, type, title, description, icon, created_at, updated_at) VALUES (?, 'inventory', 'Meal Prepared', ?, 'foodicon', NOW(), NOW())",
      [req.user.id, description]
    );

    await createNotification(
      req.user.id,
      'food',
      `Meal Done: ${meal_name}`,
      `You have successfully prepared ${meal_name}.${ingredientSummary}`,
      true
    );
  }

  return res.json({ success: true, message: 'Inventory deducted successfully.' });
};
