const db = require('../db');
const dayjs = require('dayjs');

// Remove unwanted tags from specific system meals.
// WHERE checks prevent re-running once tags are already cleared.
// Use LOWER() for case-insensitive matching regardless of how tags were originally stored
db.execute(`UPDATE meals SET tags = '[]', updated_at = NOW() WHERE id = 1  AND (LOWER(tags::text) LIKE '%recommended%' OR LOWER(tags::text) LIKE '%high pax%'    OR LOWER(tags::text) LIKE '%budget-friendly%')`).catch(err => console.error('[migration] lugaw tags failed:', err.message));
db.execute(`UPDATE meals SET tags = '[]', updated_at = NOW() WHERE id = 4  AND (LOWER(tags::text) LIKE '%protein rich%' OR LOWER(tags::text) LIKE '%feasible%')`).catch(err => console.error('[migration] adobo tags failed:', err.message));
db.execute(`UPDATE meals SET tags = '[]', updated_at = NOW() WHERE id = 12 AND (LOWER(tags::text) LIKE '%budget-friendly%' OR LOWER(tags::text) LIKE '%quick prep%')`).catch(err => console.error('[migration] sardines tags failed:', err.message));

// Remove unused system meals (not in the 5 selected ones) and their ingredients.
db.execute(`DELETE FROM meal_ingredients WHERE meal_id IN (SELECT id FROM meals WHERE user_id IS NULL AND id NOT IN (1, 4, 12, 35, 37))`).catch(err => console.error('[migration] unused meal_ingredients cleanup failed:', err.message));
db.execute(`DELETE FROM meals WHERE user_id IS NULL AND id NOT IN (1, 4, 12, 35, 37)`).catch(err => console.error('[migration] unused meals cleanup failed:', err.message));

// Convert system meal ingredients from kg→g and L→ml for cleaner display.
// WHERE clause matches only kg/L rows so this is safe to run on every startup.
db.execute(
  `UPDATE meal_ingredients
   SET qty_per_serving = qty_per_serving * 1000, unit = 'g'
   WHERE meal_id IN (1, 4, 12, 35, 37) AND unit = 'kg'`
).catch(err => console.error('[migration] system meal kg→g failed:', err.message));

db.execute(
  `UPDATE meal_ingredients
   SET qty_per_serving = qty_per_serving * 1000, unit = 'ml'
   WHERE meal_id IN (1, 4, 12, 35, 37) AND LOWER(unit) = 'l'`
).catch(err => console.error('[migration] system meal L→ml failed:', err.message));

// Seed missing meal descriptions — only updates rows where comment_desc is NULL.
// Meals that already have a description are never overwritten.
const MEAL_DESCRIPTIONS = [
  { id: 31, desc: 'A comforting rice porridge with chicken and spices that provides a warm and filling meal for beneficiaries.' },
  { id: 39, desc: 'A sweet chocolate rice porridge that is easy to prepare in large batches and enjoyed by all ages.' },
  { id:  4, desc: 'A Filipino staple that keeps well and pairs with steamed rice for a complete meal.' },
  { id: 33, desc: 'A hearty tomato-based chicken stew with vegetables that offers balanced nutrition and satisfying portions.' },
  { id: 35, desc: 'A protein-rich sandwich filling that can be prepared quickly and served as a convenient meal option.' },
  { id: 37, desc: 'A familiar and crowd-pleasing dish that pairs well with rice and is suitable for large feeding activities.' },
  { id: 30, desc: 'A versatile ground meat dish mixed with vegetables that stretches ingredients while remaining nutritious.' },
  { id:  1, desc: 'Lugaw is highly scalable and uses minimal ingredients, making it ideal for serving the largest number of people with available donations.' },
  { id: 32, desc: 'A nutritious mung bean stew rich in protein and vegetables, making it ideal for community feeding programs.' },
  { id: 21, desc: 'A ready-to-serve option requiring no cooking, ideal for quick distribution scenarios.' },
  { id: 12, desc: 'A quick and affordable dish using canned sardines extended with available donated vegetables.' },
  { id: 13, desc: 'A creamy macaroni soup that is especially suitable for children and families during feeding programs.' },
  { id: 34, desc: 'A light noodle soup with vegetables and protein that is easy to prepare and distribute in large quantities.' },
  { id: 38, desc: 'A nutritious combination of tuna and vegetables that provides a simple and balanced ready-to-serve meal.' },
  { id: 36, desc: 'A healthy vegetable-based dish that maximizes donated produce while providing essential nutrients and variety.' },
];

Promise.all(
  MEAL_DESCRIPTIONS.map(({ id, desc }) =>
    db.execute(
      'UPDATE meals SET comment_desc = ? WHERE id = ? AND (comment_desc IS NULL OR comment_desc = \'\')',
      [desc, id]
    )
  )
).catch(err => console.error('[meal descriptions seed]', err.message));

// Major ingredients limit serving count — bulk proteins, carbs, legumes, dairy, main veg
const MAJOR_KEYWORDS = [
  // Carbohydrates
  'rice', 'malagkit', 'champorado',
  'macaroni', 'noodle', 'bihon', 'canton', 'sotanghon', 'pasta', 'bread',
  // Noodle dish names (don't contain 'noodle' in their name)
  'lomi', 'mami', 'pancit',
  // Proteins
  'chicken', 'drumstick',
  'pork', 'beef',
  'fish', 'bangus', 'tilapia', 'galunggong',
  'tuna', 'sardine',
  'egg', 'tofu',
  // Seafood
  'hipon', 'shrimp',
  // Cured/processed meats (pork-based Filipino meats)
  'longganisa', 'tocino', 'tapa', 'sisig', 'embutido', 'giniling', 'lumpia',
  // Legumes
  'mung', 'monggo', 'lentil', 'chickpea',
  // Dairy
  'milk', 'cheese',
  // Vegetables (main bulk)
  'cabbage', 'kangkong', 'sitaw', 'sayote', 'potato', 'kamote', 'corn', 'carrot',
  'gabi', 'laing', 'pinakbet', 'chopsuey',
  // Egg-based dishes (explicit phrases to avoid talong override cancelling them)
  'tortang talong',
];

// Specific names that would match a major keyword but are actually minor/condiments
const MINOR_OVERRIDES = [
  // Fish false positives
  'fish sauce', 'fish paste', 'fish ball',
  // Corn false positives
  'cornstarch', 'corn starch', 'corn oil',
  // Egg/eggplant false positives (talong alone = eggplant = minor; tortang talong handled in MAJOR_KEYWORDS)
  'eggplant', 'talong',
  // Pork false positives
  'pork rind', 'chicharon',
  // Powdered/broth seasonings (chicken/beef/pork powder or broth = condiment, not bulk protein)
  'chicken powder', 'chicken broth', 'chicken stock', 'chicken bouillon', 'chicken cube',
  'beef powder', 'beef broth', 'beef stock', 'beef bouillon', 'beef cube',
  'pork broth', 'pork stock', 'pork bouillon', 'pork cube',
];

function isMajorIngredient(name) {
  const n = name.toLowerCase().trim();
  // Check major keywords first — longer/specific phrases (e.g. 'tortang talong') take
  // priority over the override list so they aren't accidentally suppressed.
  if (MAJOR_KEYWORDS.some(kw => kw.includes(' ') && n.includes(kw))) return true;
  // Then check minor overrides (e.g. 'talong' alone = eggplant = minor)
  if (MINOR_OVERRIDES.some(exc => n.includes(exc))) return false;
  // Finally check single-word major keywords
  return MAJOR_KEYWORDS.some(kw => n.includes(kw));
}

// Convert all units to base (kg or L) for consistent comparison
function toBaseUnit(qty, unit) {
  const u = (unit || '').toLowerCase().trim();
  if (u === 'g')             return qty / 1000;
  if (u === 'ml')            return qty / 1000;
  if (u === 'tsp')           return qty * 0.005;  // 1 tsp = 5 ml = 0.005 L
  if (u === 'tbsp')          return qty * 0.015;  // 1 tbsp = 15 ml = 0.015 L
  if (u === 'pcs' || u === 'pc') return (qty * 400) / 1000; // 1 pc ≈ 400g
  return qty; // kg, L — already in base unit
}

const WEIGHT_PAX = 0.7;
const WEIGHT_EXPIRY = 0.3;

exports.optimizeMeals = async (req, res) => {
  const targetPax = Math.max(1, parseInt(req.body.target_pax) || 1);
  const selectedIngredients = req.body.selected_ingredients || [];

  if (!selectedIngredients.length) {
    return res.status(422).json({ success: false, message: 'No ingredients provided.' });
  }

  // Build lookup: lowercase name → { inputQty, unit, daysRemaining }
  const selected = {};
  const today = dayjs().startOf('day');

  for (const item of selectedIngredients) {
    const name = (item.name || '').toLowerCase().trim();
    if (!name) continue;

    let daysRemaining = 999;
    if (item.expiry) {
      try {
        const expiry = dayjs(item.expiry);
        const diff = expiry.diff(today, 'day');
        daysRemaining = Math.max(0, diff);
      } catch {}
    }

    selected[name] = {
      inputQty: parseFloat(item.inputQty) || 0,
      unit: item.unit || '',
      daysRemaining,
    };
  }

  // Load only the 5 selected system meals + all user-created recipes
  const SYSTEM_MEAL_IDS = [1, 4, 12, 35, 37]; // Lugaw, Chicken Adobo, Sardines w/ Veg, Sandwich Filling, Fried Chicken
  const placeholders = SYSTEM_MEAL_IDS.map(() => '?').join(',');
  const [meals] = await db.execute(
    `SELECT * FROM meals WHERE user_id IS NOT NULL OR id IN (${placeholders})`,
    SYSTEM_MEAL_IDS
  );
  const [allIngredients] = await db.execute('SELECT * FROM meal_ingredients');

  // Group ingredients by meal_id
  const ingredientsByMeal = {};
  for (const ing of allIngredients) {
    if (!ingredientsByMeal[ing.meal_id]) ingredientsByMeal[ing.meal_id] = [];
    ingredientsByMeal[ing.meal_id].push(ing);
  }

  const plans = [];

  for (const meal of meals) {
    const mealIngredients = ingredientsByMeal[meal.id] || [];
    const matchedIngredients = [];
    const missingIngredients = [];

    for (const ing of mealIngredients) {
      const ingKey = ing.ingredient_name.toLowerCase().trim();

      let matchKey = null;

      if (selected[ingKey]) {
        matchKey = ingKey;
      } else {
        for (const selName of Object.keys(selected)) {
          if (ingKey.includes(selName) || selName.includes(ingKey)) {
            matchKey = selName;
            break;
          }

          // Strip descriptors so only the actual ingredient noun is compared.
          // Matching on descriptor words alone links unrelated items
          // (e.g. "canned tuna" ↔ "canned sardines" via "canned").
          const DESCRIPTORS = new Set([
            'canned', 'fresh', 'dried', 'frozen', 'raw', 'cooked', 'whole', 'sliced',
            'chopped', 'diced', 'minced', 'ground', 'peeled', 'smoked', 'salted',
            'unsalted', 'boiled', 'fried', 'roasted', 'baked', 'powdered', 'shredded',
            'grated', 'crushed', 'steamed', 'organic', 'plain', 'large', 'small',
            'medium', 'hot', 'cold', 'sweet', 'sour', 'spicy', 'thick', 'thin',
            'mixed', 'assorted', 'regular', 'extra', 'lean', 'skinless', 'boneless',
          ]);

          const ingNouns = ingKey.split(' ').filter(w => w.length > 2 && !DESCRIPTORS.has(w));
          const selNouns = selName.split(' ').filter(w => w.length > 2 && !DESCRIPTORS.has(w));

          if (!ingNouns.length || !selNouns.length) continue;

          // Anchor on the rightmost noun (the main ingredient word) to avoid
          // false positives from shared modifiers.
          const ingMainNoun = ingNouns[ingNouns.length - 1];
          const selMainNoun = selNouns[selNouns.length - 1];

          if (ingKey.includes(selMainNoun) || selName.includes(ingMainNoun)) {
            matchKey = selName;
          }
          if (matchKey) break;
        }
      }

      if (matchKey !== null) {
        matchedIngredients.push({ ingredient: ing, selData: selected[matchKey] });
      } else if (!ing.is_optional) {
        missingIngredients.push(ing.ingredient_name);
      }
    }

    if (!matchedIngredients.length) continue;

    const servingCaps = [];
    let minDays = 999;

    for (const m of matchedIngredients) {
      const ingName = (m.ingredient.ingredient_name || '').toLowerCase().trim();

      // Minor ingredients and water never limit serving count
      if (ingName === 'water' || !isMajorIngredient(ingName)) {
        if (m.selData.daysRemaining < minDays) minDays = m.selData.daysRemaining;
        continue;
      }

      if (m.ingredient.qty_per_serving > 0) {
        const availableQty  = toBaseUnit(m.selData.inputQty, m.selData.unit);
        const reqPerServing = toBaseUnit(m.ingredient.qty_per_serving, m.ingredient.unit);
        if (reqPerServing > 0) {
          servingCaps.push(Math.floor(availableQty / reqPerServing));
        }
      }
      if (m.selData.daysRemaining < minDays) minDays = m.selData.daysRemaining;
    }

    const rawMax = servingCaps.length ? Math.min(...servingCaps) : 0;
    const maxServings = Math.min(rawMax, targetPax);
    const paxScore = targetPax > 0 ? maxServings / targetPax : 0;
    const expiryScore = Math.max(0, 1 - minDays / 90);
    const finalScore = WEIGHT_PAX * paxScore + WEIGHT_EXPIRY * expiryScore;

    plans.push({
      meal,
      maxServings,
      paxScore,
      expiryScore,
      finalScore,
      missing: missingIngredients,
      matched: matchedIngredients.map(m => m.ingredient.ingredient_name),
    });
  }

  // Full matches (no missing ingredients) always rank above partial/suggested meals.
  // Within each group, rank by finalScore descending.
  plans.sort((a, b) => {
    const aFull = a.missing.length === 0 ? 1 : 0;
    const bFull = b.missing.length === 0 ? 1 : 0;
    if (bFull !== aFull) return bFull - aFull;
    return b.finalScore - a.finalScore;
  });

  const results = plans.map((plan, rank) => {
    const rankNum = rank + 1;
    const isTop = rankNum === 1;
    const rankDisplay = isTop ? '#1 Best' : `#${rankNum}`;

    let tags = [];
    try { tags = typeof plan.meal.tags === 'string' ? JSON.parse(plan.meal.tags) : (plan.meal.tags || []); } catch {}
    if (isTop) tags = ['Recommended', ...tags];

    return {
      id: `rank_${rankNum}`,
      name: plan.meal.name,
      rankDisplay,
      isTop,
      isFullMatch: plan.missing.length === 0,
      tags: [...new Set(tags)],
      servings: String(plan.maxServings),
      status: isTop ? 'Optimal Output' : '',
      ingredients_used: plan.matched.join(', '),
      comment_title: isTop ? 'Why this meal ranks first:' : '',
      comment_desc: plan.meal.comment_desc || '',
      missing_items: plan.missing.length ? plan.missing.join(', ') : null,
    };
  });

  return res.json({ success: true, meals: results });
};

exports.getMealIngredients = async (req, res) => {
  const [meals] = await db.execute('SELECT id, name FROM meals ORDER BY name');
  const [ingredients] = await db.execute(
    'SELECT meal_id, ingredient_name, qty_per_serving, unit, is_optional FROM meal_ingredients ORDER BY meal_id, ingredient_name'
  );
  const byMeal = {};
  for (const ing of ingredients) {
    if (!byMeal[ing.meal_id]) byMeal[ing.meal_id] = [];
    byMeal[ing.meal_id].push({
      ingredient: ing.ingredient_name,
      qty_per_serving: ing.qty_per_serving,
      unit: ing.unit,
      optional: ing.is_optional,
    });
  }
  const result = meals.map(m => ({ meal: m.name, ingredients: byMeal[m.id] || [] }));
  return res.json({ success: true, data: result });
};

// GET /api/beneficiary/meals — distinct meal names for the Create Request dropdown
exports.getBeneficiaryMeals = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT DISTINCT name FROM meals ORDER BY name ASC`
    );
    const names = rows.map(r => r.name).filter(Boolean);
    return res.json(names);
  } catch (e) {
    console.error('[getBeneficiaryMeals]', e);
    return res.json([]);
  }
};

exports.getRecipes = async (req, res) => {
  try {
    // Return user-created recipes + the 5 selected system meals
    const SYSTEM_MEAL_IDS = [1, 4, 12, 35, 37];
    const placeholders = SYSTEM_MEAL_IDS.map(() => '?').join(',');
    const [meals] = await db.execute(
      `SELECT * FROM meals WHERE user_id IS NOT NULL OR id IN (${placeholders}) ORDER BY name`,
      SYSTEM_MEAL_IDS
    );
    const [ingredients] = await db.execute(
      'SELECT meal_id, ingredient_name, qty_per_serving, unit, is_optional FROM meal_ingredients ORDER BY meal_id, ingredient_name'
    );
    
    const byMeal = {};
    for (const ing of ingredients) {
      if (!byMeal[ing.meal_id]) byMeal[ing.meal_id] = [];
      byMeal[ing.meal_id].push({
        id: ing.id,
        ingredient_name: ing.ingredient_name,
        qty_per_serving: ing.qty_per_serving,
        unit: ing.unit,
        is_optional: ing.is_optional,
      });
    }

    const result = meals.map(m => {
      let tags = [];
      try {
        tags = typeof m.tags === 'string' ? JSON.parse(m.tags) : (m.tags || []);
      } catch (e) {
        tags = [];
      }
      return {
        id: m.id,
        name: m.name,
        comment_desc: m.comment_desc,
        tags,
        ingredients: byMeal[m.id] || [],
        image_url: m.image_url,
        is_system: m.user_id === null,
      };
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  }
};

exports.storeMeal = async (req, res) => {
  const { name, comment_desc, tags, ingredients, image_url } = req.body;

  if (!name) {
    return res.status(422).json({ success: false, message: 'Meal name is required.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const tagsJson = tags ? JSON.stringify(tags) : '[]';
    const [mealResult] = await conn.execute(
      'INSERT INTO meals (name, comment_desc, tags, user_id, image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [name, comment_desc || '', tagsJson, req.user.id, image_url || null]
    );

    const mealId = mealResult.insertId;

    if (ingredients && Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        const qty = parseFloat(ing.qty_per_serving) || 0;
        await conn.execute(
          'INSERT INTO meal_ingredients (meal_id, ingredient_name, qty_per_serving, unit, is_optional, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
          [mealId, ing.ingredient_name, qty, ing.unit || 'g', ing.is_optional ? true : false]
        );
      }
    }

    // Automatically register recipe in food_inventory as a Prepared Meal (Prep Meal) with quantity 0
    const [existingInv] = await conn.execute(
      "SELECT id FROM food_inventory WHERE LOWER(food_name) = LOWER(?)",
      [name]
    );
    if (!existingInv.length) {
      const mealLower = name.toLowerCase();
      const GRAINS_MEALS = ['lugaw', 'arroz caldo', 'champorado', 'sopas'];
      const VEGGIE_MEALS = ['munggo guisado', 'veggie stir-fry', 'sotanghon soup'];
      let prepCategory = 'Meat';
      if (GRAINS_MEALS.some(m => mealLower.includes(m))) prepCategory = 'Grains & Cereals';
      else if (VEGGIE_MEALS.some(m => mealLower.includes(m))) prepCategory = 'Vegetables';

      await conn.execute(
        "INSERT INTO food_inventory (food_name, category, quantity, unit, expiration_date, meal_type, created_at, updated_at) VALUES (?, ?, 0, 'meal', NULL, 'Prep Meal', NOW(), NOW())",
        [name, prepCategory]
      );
    }

    await conn.commit();
    return res.json({ success: true, message: 'Recipe added successfully!', mealId });
  } catch (error) {
    await conn.rollback();
    console.error('Error storing meal:', error);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  } finally {
    conn.release();
  }
};

exports.getIngredientsList = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT DISTINCT TRIM(name) AS name FROM (
        SELECT ingredient_name AS name FROM meal_ingredients
        UNION
        SELECT food_name AS name FROM food_inventory
      ) AS temp
      WHERE name IS NOT NULL AND TRIM(name) != ''
      ORDER BY name
    `);
    
    // Clean up name: strip out any trailing descriptor brackets like "(Chopped)" or "(Dried)"
    // so we get the base ingredient name for suggestions.
    const uniqueNames = new Set();
    for (const row of rows) {
      let cleaned = row.name.replace(/\s*\([^)]*\)\s*/g, '').trim(); // Remove parenthesized words
      if (cleaned) {
        // Capitalize words for clean presentation
        cleaned = cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        uniqueNames.add(cleaned);
      }
    }
    
    return res.json({ success: true, data: Array.from(uniqueNames).sort() });
  } catch (error) {
    console.error('Error fetching ingredients list:', error);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  }
};

exports.deleteRecipe = async (req, res) => {
  const { id } = req.params;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT id FROM meals WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
      [id, req.user.id]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Recipe not found.' });
    }
    await conn.execute('DELETE FROM meal_ingredients WHERE meal_id = ?', [id]);
    await conn.execute('DELETE FROM meals WHERE id = ?', [id]);
    await conn.commit();
    return res.json({ success: true, message: 'Recipe deleted successfully.' });
  } catch (error) {
    await conn.rollback();
    console.error('Error deleting recipe:', error);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  } finally {
    conn.release();
  }
};

// GET /api/partner-kitchen/meal-requests
exports.getMealRequests = async (req, res) => {
  try {
    const { status } = req.query;

    const [pkRows] = await db.execute(
      'SELECT id FROM partner_kitchen WHERE user_id = ?',
      [req.user.id]
    );
    if (!pkRows.length) {
      return res.json([]);
    }
    const kitchenId = pkRows[0].id;

    const params = [kitchenId];
    let statusClause = '';
    if (status) {
      statusClause = ' AND r.status = ?';
      params.push(status);
    } else {
      // By default exclude completed requests so they disappear from the dashboard
      statusClause = " AND r.status != 'Done'";
    }

    const [requests] = await db.execute(
      `SELECT r.id, r.donation_drive_id AS drive_id, r.drive_title, r.urgency,
              r.status, r.note, r.start_date, r.end_date, r.created_at
       FROM partner_kitchen_meal_requests r
       WHERE r.partner_kitchen_id = ?${statusClause}
       ORDER BY r.created_at DESC`,
      params
    );

    if (!requests.length) {
      return res.json([]);
    }

    const ids = requests.map(r => r.id);
    const [items] = await db.execute(
      `SELECT id, meal_request_id, food_name, quantity, unit, status
       FROM partner_kitchen_meal_request_items
       WHERE meal_request_id IN (${ids.map(() => '?').join(',')})`,
      ids
    );

    const itemsByRequest = {};
    for (const item of items) {
      if (!itemsByRequest[item.meal_request_id]) itemsByRequest[item.meal_request_id] = [];
      itemsByRequest[item.meal_request_id].push({
        id: item.id,
        food_name: item.food_name,
        quantity: item.quantity,
        unit: item.unit,
        status: item.status,
      });
    }

    const data = requests.map(r => ({ ...r, items: itemsByRequest[r.id] || [] }));
    return res.json(data);
  } catch (e) {
    console.error('[getMealRequests]', e);
    return res.status(500).json({ success: false, message: 'Failed to fetch meal requests.' });
  }
};

// PATCH /api/partner-kitchen/meal-requests/:id/status
exports.updateMealRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(422).json({ success: false, message: 'Status is required.' });

    const [pkRows] = await db.execute(
      'SELECT id FROM partner_kitchen WHERE user_id = ?',
      [req.user.id]
    );
    if (!pkRows.length) return res.status(403).json({ success: false, message: 'Partner kitchen not found.' });
    const kitchenId = pkRows[0].id;

    await db.execute(
      'UPDATE partner_kitchen_meal_requests SET status = ?, updated_at = NOW() WHERE id = ? AND partner_kitchen_id = ?',
      [status, id, kitchenId]
    );
    return res.json({ message: 'Status updated.', status });
  } catch (e) {
    console.error('[updateMealRequestStatus]', e);
    return res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
};

exports.uploadRecipeImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided.' });
    }
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = process.env.APP_URL || `${proto}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/storage/recipes/${req.file.filename}`;
    return res.json({ success: true, image_url: imageUrl });
  } catch (error) {
    console.error('Error uploading recipe image:', error);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  }
};
