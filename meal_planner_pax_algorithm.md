# Meal Planner — PAX-Focused Algorithm (Staff Purchase Mode)
## Pseudocode Based on Real SAVR Database Schema

---

## OVERVIEW

Unlike Algorithm 1 (inventory-constrained), this algorithm assumes the **staff
will purchase all required ingredients**. There is no inventory to check and no
cost to optimize.

The sole focus is:
1. **Can this meal serve the target population (pax)?** — always yes, since staff buys.
2. **How well does this meal fit the beneficiary's demographic?** — age range and food type.
3. **How simple is this meal to scale and procure?** — fewer ingredients = easier to buy.

The output is a **ranked meal list** plus a **ready-to-use purchase list** of
exact ingredient quantities scaled to `target_pax`.

```
Input  : target_pax, age_min, age_max, food_type, MealCatalog
Output : list of MealRecommendation sorted by final_score DESCENDING,
         each with a scaled PurchaseList
```

---

## REAL DATABASE COLUMNS USED

```
beneficiary_requests
  population   integer   ← target_pax (number of people to serve)
  age_min      integer   ← youngest person in the group
  age_max      integer   ← oldest person in the group
  food_type    varchar   ← e.g. 'Rice Meal', 'Soup', 'Snack', 'Packed Meal'
  request_name varchar   ← title of the request

beneficiary_organizations
  count_infants    integer   ← 0–1 year old
  count_children   integer   ← 2–12 years old
  count_teenagers  integer   ← 13–17 years old
  count_adults     integer   ← 18–59 years old
  count_seniors    integer   ← 60+ years old
  count_pwd        integer   ← persons with disability
  count_pregnant   integer   ← pregnant individuals

donation_requests
  pax     integer   ← alternative target_pax source
  urgency varchar   ← 'low' | 'medium' | 'high' | 'critical'
```

---

## DATA STRUCTURES USED

```
DemographicProfile {
  target_pax   : int      // beneficiary_requests.population OR donation_requests.pax
  age_min      : int      // beneficiary_requests.age_min
  age_max      : int      // beneficiary_requests.age_max
  food_type    : string   // beneficiary_requests.food_type  (nullable)

  // Optional breakdown (from beneficiary_organizations)
  count_infants    : int = 0
  count_children   : int = 0
  count_teenagers  : int = 0
  count_adults     : int = 0
  count_seniors    : int = 0
  count_pwd        : int = 0
  count_pregnant   : int = 0
}

MealTemplate {
  meal_id         : string
  meal_name       : string
  suitable_age_min : int      // minimum age this meal is appropriate for
  suitable_age_max : int      // maximum age this meal is appropriate for
  food_type_tags  : list of string  // e.g. ['Rice Meal', 'Packed Meal']
  required_ingredients : list of RequiredIngredient
}

RequiredIngredient {
  ingredient_name      : string   // what staff will buy
  quantity_per_serving : decimal  // amount needed per 1 person
  unit                 : string   // kg | pcs | liters | pack | etc.
}

PurchaseItem {
  ingredient_name : string
  total_quantity  : decimal   // quantity_per_serving × target_pax
  unit            : string
}

MealRecommendation {            // algorithm output per meal
  meal_id              : string
  meal_name            : string
  target_pax           : int
  servings_to_prepare  : int    // always equals target_pax (staff buys all needed)
  demographic_score    : float  // 0–1: how well the meal fits age range + food type
  scalability_score    : float  // 0–1: fewer ingredients = higher score
  final_score          : float  // weighted combination
  purchase_list        : list of PurchaseItem
}
```

---

## CONSTANTS

```
WEIGHT_DEMOGRAPHIC  : float = 0.7   // priority: fit the people being served
WEIGHT_SCALABILITY  : float = 0.3   // priority: ease of procurement
                                     // must sum to 1.0

AGE_GROUPS = {
  'infant'    : (0,  1),
  'child'     : (2,  12),
  'teenager'  : (13, 17),
  'adult'     : (18, 59),
  'senior'    : (60, 120)
}
```

---

## STEP 0 — ENTRY POINT

```
FUNCTION run_pax_meal_planner(
    profile      : DemographicProfile,
    meal_catalog : list of MealTemplate,
    weight_demographic : float = WEIGHT_DEMOGRAPHIC,
    weight_scalability : float = WEIGHT_SCALABILITY
) -> list of MealRecommendation:

  // Guard: weights must sum to 1
  IF ABS((weight_demographic + weight_scalability) - 1.0) > 0.0001:
    RAISE InvalidWeightsError("Weights must sum to 1.0")

  // Guard: catalog must not be empty
  IF meal_catalog is EMPTY:
    RAISE EmptyCatalogError("No meals in catalog to evaluate")

  // Guard: target pax must be positive
  IF profile.target_pax <= 0:
    RAISE InvalidPaxError("target_pax must be greater than 0")

  // Step 1: Scale every meal to target_pax and build purchase lists
  raw_recommendations = CALL scale_all_meals(meal_catalog, profile.target_pax)

  // Step 2: Score each meal against the demographic profile
  scored = CALL score_all_meals(raw_recommendations, meal_catalog, profile,
                                weight_demographic, weight_scalability)

  // Step 3: Sort by final score, descending
  scored.sort(by = final_score, order = DESCENDING)

  // Step 4: Assign ranks and return
  FOR i FROM 0 TO scored.length - 1:
    scored[i].rank = i + 1

  LOG "Planner complete. {scored.length} meal(s) ranked for {profile.target_pax} pax."

  RETURN scored
```

---

## STEP 1 — SCALE ALL MEALS TO TARGET PAX

```
FUNCTION scale_all_meals(
    meal_catalog : list of MealTemplate,
    target_pax   : int
) -> list of MealRecommendation:

  // Since staff purchases everything, EVERY meal in the catalog is feasible.
  // This step only computes the purchase quantities.

  recommendations = []

  FOR each meal IN meal_catalog:

    purchase_list = CALL build_purchase_list(meal, target_pax)

    rec = MealRecommendation {
      meal_id             : meal.meal_id,
      meal_name           : meal.meal_name,
      target_pax          : target_pax,
      servings_to_prepare : target_pax,   // always matches — staff buys exactly what's needed
      demographic_score   : 0.0,          // filled in Step 2
      scalability_score   : 0.0,          // filled in Step 2
      final_score         : 0.0,          // filled in Step 2
      purchase_list       : purchase_list
    }

    recommendations.append(rec)

  RETURN recommendations
```

---

## STEP 1a — BUILD PURCHASE LIST

```
FUNCTION build_purchase_list(
    meal       : MealTemplate,
    target_pax : int
) -> list of PurchaseItem:

  purchase_list = []

  FOR each req IN meal.required_ingredients:

    total_quantity = ROUND(req.quantity_per_serving * target_pax, 2)

    purchase_list.append(PurchaseItem {
      ingredient_name : req.ingredient_name,
      total_quantity  : total_quantity,
      unit            : req.unit
    })

  RETURN purchase_list
```

---

## STEP 2 — SCORE ALL MEALS

```
FUNCTION score_all_meals(
    recommendations    : list of MealRecommendation,
    meal_catalog       : list of MealTemplate,
    profile            : DemographicProfile,
    weight_demographic : float,
    weight_scalability : float
) -> list of MealRecommendation:

  // --- 2a. Find max ingredient count for scalability normalization ---
  max_ingredient_count = MAX(meal.required_ingredients.length for meal in meal_catalog)
  min_ingredient_count = MIN(meal.required_ingredients.length for meal in meal_catalog)

  // --- 2b. Score each meal ---
  FOR each rec IN recommendations:

    meal = meal_catalog.find(meal_id == rec.meal_id)

    // DEMOGRAPHIC SCORE
    demographic_score = CALL compute_demographic_score(meal, profile)

    // SCALABILITY SCORE: fewer ingredients = easier to buy = higher score
    ingredient_count = meal.required_ingredients.length

    IF max_ingredient_count == min_ingredient_count:
      scalability_score = 1.0
    ELSE:
      scalability_score = 1.0 - (
        (ingredient_count - min_ingredient_count) /
        (max_ingredient_count - min_ingredient_count)
      )

    // FINAL SCORE
    final_score = (weight_demographic * demographic_score) +
                  (weight_scalability * scalability_score)

    rec.demographic_score = ROUND(demographic_score, 4)
    rec.scalability_score = ROUND(scalability_score, 4)
    rec.final_score       = ROUND(final_score,       4)

  RETURN recommendations
```

---

## STEP 2a — COMPUTE DEMOGRAPHIC SCORE

```
FUNCTION compute_demographic_score(
    meal    : MealTemplate,
    profile : DemographicProfile
) -> float:

  // Two sub-scores combined:
  //   1. Age range overlap  (how well does this meal cover the group's ages?)
  //   2. Food type match    (does this meal match the requested food_type?)

  // --- Sub-score 1: Age range overlap ---
  //
  // Overlap = intersection of [meal.suitable_age_min, meal.suitable_age_max]
  //           with [profile.age_min, profile.age_max]
  //
  // Score = overlap_size / request_range_size  (0 to 1)

  overlap_min = MAX(meal.suitable_age_min, profile.age_min)
  overlap_max = MIN(meal.suitable_age_max, profile.age_max)

  IF overlap_max < overlap_min:
    // No overlap — meal is not suitable for any person in this group
    age_score = 0.0
  ELSE:
    overlap_size      = overlap_max - overlap_min + 1
    request_range     = profile.age_max - profile.age_min + 1
    age_score         = CLAMP(overlap_size / request_range, 0.0, 1.0)

  // --- Sub-score 2: Food type match ---
  //
  // If the beneficiary specified a food_type, check if the meal has that tag.
  // If no food_type was specified, all meals score 1.0 on this factor.

  IF profile.food_type is NULL or EMPTY:
    type_score = 1.0
  ELSE IF profile.food_type.toLowerCase() IN meal.food_type_tags (case-insensitive):
    type_score = 1.0
  ELSE:
    type_score = 0.0

  // Combine: age match weighted at 60%, food type match at 40%
  demographic_score = (0.6 * age_score) + (0.4 * type_score)

  RETURN ROUND(demographic_score, 4)
```

---

## STEP 3 — OUTPUT FORMAT

```
FUNCTION display_ranked_recommendations(
    ranked : list of MealRecommendation,
    profile: DemographicProfile
):

  IF ranked is EMPTY:
    PRINT "No meal recommendations available."
    RETURN

  PRINT "===== PAX-FOCUSED MEAL RECOMMENDATIONS ====="
  PRINT "Target pax  : {profile.target_pax} people"
  PRINT "Age range   : {profile.age_min} – {profile.age_max} years old"
  PRINT "Food type   : {profile.food_type OR 'Not specified'}"
  PRINT ""

  FOR each rec IN ranked:
    PRINT "Rank #{rec.rank} — {rec.meal_name}"
    PRINT "  Servings to prepare   : {rec.servings_to_prepare} pax"
    PRINT "  Demographic score     : {rec.demographic_score}"
    PRINT "  Scalability score     : {rec.scalability_score}"
    PRINT "  Final score           : {rec.final_score}"
    PRINT ""
    PRINT "  📋 Purchase List (for {rec.target_pax} pax):"
    FOR each item IN rec.purchase_list:
      PRINT "    - {item.ingredient_name}: {item.total_quantity} {item.unit}"
    PRINT ""
```

---

## FULL CALL SEQUENCE

```
run_pax_meal_planner(profile, meal_catalog)
  │
  ├── scale_all_meals(meal_catalog, target_pax)
  │     └── FOR each meal:
  │           └── build_purchase_list()
  │                 └── total_quantity = quantity_per_serving × target_pax
  │                     (no inventory check — staff buys everything)
  │
  ├── score_all_meals(recommendations, meal_catalog, profile)
  │     ├── find max/min ingredient count across catalog (for scalability range)
  │     └── FOR each meal:
  │           ├── compute_demographic_score()
  │           │     ├── age_score  = overlap of meal age range vs request age range
  │           │     └── type_score = food_type tag match (1.0 or 0.0)
  │           ├── scalability_score = 1 - normalized(ingredient_count)
  │           └── final_score = (0.7 × demographic) + (0.3 × scalability)
  │
  ├── sort DESCENDING by final_score
  ├── assign ranks
  └── return ranked list + purchase lists
```

---

## SCORING WORKED EXAMPLE

```
Profile:
  target_pax = 80
  age_min    = 5    age_max = 65
  food_type  = 'Rice Meal'

Given 3 meals in catalog:

  Meal A — "Chicken Rice"
    suitable_age_min = 3,  suitable_age_max = 70
    food_type_tags   = ['Rice Meal', 'Packed Meal']
    required_ingredients: 4 items

  Meal B — "Infant Porridge"
    suitable_age_min = 0,  suitable_age_max = 2
    food_type_tags   = ['Porridge', 'Soft Food']
    required_ingredients: 3 items

  Meal C — "Vegetable Stew"
    suitable_age_min = 10, suitable_age_max = 80
    food_type_tags   = ['Soup', 'Stew']
    required_ingredients: 6 items

Ingredient count range: min = 3, max = 6

─────────────────────────────────────────────────────
Meal A — "Chicken Rice":
  age overlap  = [MAX(3,5), MIN(70,65)] = [5,65] → size=61
  request range = 65 - 5 + 1 = 61
  age_score    = 61/61 = 1.0
  type_score   = 'Rice Meal' IN tags → 1.0
  demographic  = (0.6×1.0) + (0.4×1.0) = 1.0

  scalability  = 1 - (4-3)/(6-3) = 1 - 0.333 = 0.667
  final_score  = (0.7×1.0) + (0.3×0.667) = 0.900

  Purchase List (80 pax):
    [scaled quantities × 80 per ingredient]

─────────────────────────────────────────────────────
Meal B — "Infant Porridge":
  age overlap  = [MAX(0,5), MIN(2,65)] = [5,2] → overlap_max < overlap_min
  age_score    = 0.0  (no overlap — infants only, group is 5–65)
  type_score   = 'Rice Meal' NOT IN tags → 0.0
  demographic  = (0.6×0.0) + (0.4×0.0) = 0.0

  scalability  = 1 - (3-3)/(6-3) = 1.0
  final_score  = (0.7×0.0) + (0.3×1.0) = 0.300

─────────────────────────────────────────────────────
Meal C — "Vegetable Stew":
  age overlap  = [MAX(10,5), MIN(80,65)] = [10,65] → size=56
  request range = 61
  age_score    = 56/61 = 0.918
  type_score   = 'Rice Meal' NOT IN tags → 0.0
  demographic  = (0.6×0.918) + (0.4×0.0) = 0.551

  scalability  = 1 - (6-3)/(6-3) = 0.0
  final_score  = (0.7×0.551) + (0.3×0.0) = 0.386

─────────────────────────────────────────────────────
Final Ranking:
  Rank 1 — Meal A "Chicken Rice"     (score: 0.900) ✅ best fit
  Rank 2 — Meal C "Vegetable Stew"   (score: 0.386) ⚠️ age ok, type mismatch
  Rank 3 — Meal B "Infant Porridge"  (score: 0.300) ❌ wrong age group entirely
```

---

## COMPARISON: ALGORITHM 1 vs ALGORITHM 2

| Factor | Algorithm 1 (Inventory-Based) | Algorithm 2 (PAX-Focused) |
|---|---|---|
| Inventory source | `food_donation_record_items` (approved) | None — staff purchases all |
| Cost | Tracked (always ₱0 currently) | Not tracked at all |
| Feasibility check | Limited by available donated stock | Every meal is always feasible |
| Scoring factors | Pax served + cost per pax | Demographic fit + scalability |
| Output | Ranked meals from what's available | Ranked meals + purchase list |
| `target_pax` role | Upper bound (may or may not be reached) | Always met exactly |
| Best use case | When using donated food stock | When staff is buying for a specific request |

---

## EDGE CASES HANDLED

| Situation | Behaviour |
|---|---|
| `target_pax = 0` or negative | `InvalidPaxError` raised at entry point |
| `profile.food_type` is null | `type_score = 1.0` for all meals — no penalty |
| Meal age range has zero overlap with request | `age_score = 0.0` — meal still appears but ranked last |
| All meals have same ingredient count | `scalability_score = 1.0` for all — tiebreaker falls to demographic |
| Only one meal in catalog | Scores as-is — returned as rank 1 regardless |
| Weights don't sum to 1.0 | `InvalidWeightsError` raised before any evaluation |
| `age_min > age_max` in profile | Treat as single age point — range size = 1 |

---

## DATABASE QUERY REFERENCE

```sql
-- Get demographic profile from a beneficiary request
SELECT
  br.population  AS target_pax,
  br.age_min,
  br.age_max,
  br.food_type,
  br.urgency
FROM beneficiary_requests br
WHERE br.id   = :request_id
  AND br.type = 'food';

-- Get detailed demographic breakdown (if beneficiary is an organization)
SELECT
  bo.count_infants,
  bo.count_children,
  bo.count_teenagers,
  bo.count_adults,
  bo.count_seniors,
  bo.count_pwd,
  bo.count_pregnant
FROM beneficiary_organizations bo
JOIN users u ON u.id = bo.user_id
WHERE u.id = :user_id;

-- Get target pax from a donation request (alternative source)
SELECT pax, urgency
FROM donation_requests
WHERE id = :request_id;
```
