const db = require('../db');
const dayjs = require('dayjs');

// Convert g→kg, ml→L, pcs→kg (1 pc = 400g) so inputQty matches the recipe's base unit (kg / L)
function toBaseUnit(qty, unit) {
  const u = (unit || '').toLowerCase().trim();
  if (u === 'g')   return qty / 1000;
  if (u === 'ml')  return qty / 1000;
  if (u === 'pcs' || u === 'pc') return (qty * 400) / 1000; // 1 pc = 400g = 0.4 kg
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

  // Load all meals with their ingredients
  const [meals] = await db.execute('SELECT * FROM meals');
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
      // Water is kept in recipes for completeness but never limits servings
      const ingName = (m.ingredient.ingredient_name || '').toLowerCase().trim();
      if (ingName === 'water') {
        if (m.selData.daysRemaining < minDays) minDays = m.selData.daysRemaining;
        continue;
      }
      if (m.ingredient.qty_per_serving > 0) {
        const availableQty = toBaseUnit(m.selData.inputQty, m.selData.unit);
        servingCaps.push(Math.floor(availableQty / m.ingredient.qty_per_serving));
      }
      if (m.selData.daysRemaining < minDays) minDays = m.selData.daysRemaining;
    }

    const maxServings = servingCaps.length ? Math.min(...servingCaps) : 0;
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
