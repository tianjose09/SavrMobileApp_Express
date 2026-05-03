const db = require('../db');
const dayjs = require('dayjs');

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

          const ingWords = ingKey.split(' ').filter(w => w.length > 2);
          const selWords = selName.split(' ').filter(w => w.length > 2);

          let found = false;
          for (const sw of selWords) {
            if (ingKey.includes(sw)) { matchKey = selName; found = true; break; }
          }
          if (found) break;

          for (const iw of ingWords) {
            if (selName.includes(iw)) { matchKey = selName; found = true; break; }
          }
          if (found) break;
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
      if (!m.ingredient.is_optional && m.ingredient.qty_per_serving > 0) {
        servingCaps.push(Math.floor(m.selData.inputQty / m.ingredient.qty_per_serving));
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

  plans.sort((a, b) => b.finalScore - a.finalScore);

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
