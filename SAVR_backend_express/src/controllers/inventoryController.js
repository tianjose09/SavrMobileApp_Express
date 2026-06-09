const db = require('../db');
const dayjs = require('dayjs');
const { createNotification } = require('./notificationController');

exports.index = async (req, res) => {
  const [items] = await db.execute(
    "SELECT * FROM food_inventory WHERE meal_type = 'Raw Ingredients' ORDER BY food_name"
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

  if (req.user?.id) {
    await createNotification(req.user.id, 'food', 'Inventory Updated', `${food_name} (${quantity} ${unit}) has been added to your kitchen inventory.`);
  }

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
    "SELECT * FROM food_inventory WHERE meal_type = 'Prepared Meals' ORDER BY created_at DESC"
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
  const { deductions, meal_name } = req.body;

  if (!Array.isArray(deductions) || !deductions.length) {
    return res.status(422).json({ success: false, message: 'Deductions array is required.' });
  }

  for (const deduction of deductions) {
    const [rows] = await db.execute('SELECT * FROM food_inventory WHERE id = ?', [deduction.id]);
    const item = rows[0];
    if (item) {
      const newQty = Math.max(0, parseFloat(item.quantity) - parseFloat(deduction.qty_used));
      await db.execute('UPDATE food_inventory SET quantity = ?, updated_at = NOW() WHERE id = ?', [newQty, item.id]);
    }
  }

  if (meal_name && req.user) {
    // Build ingredient summary from deductions
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
