# Meal Optimizer — Donations Only
## Focused on Food Donations | No Cost Computation

---

## OVERVIEW

The meal optimizer reads the partner kitchen's donated food inventory — approved
food donations only — evaluates every meal in the catalog, scores each feasible
plan against two factors (how many people can be served and how urgently the
ingredients are expiring), and returns a ranked list — best option at the top.

```
Input  : DonatedInventory (DB: food_donation_record_items), MealCatalog, target_pax,
         WEIGHT_PAX, WEIGHT_EXPIRY
Output : ranked list of meal plans
```

**Explanation:**

This means the system helps decide **what meal should be prepared** by analyzing:

- how many people can be served
- which ingredients are expiring soonest and should be used first

It automatically ranks meal options to guide staff in choosing the most efficient
use of donated food before it goes to waste.

---

## INVENTORY RULES

| Source | Table | Cost |
|---|---|---|
| Food donation (approved) | `food_donation_record_items` | Free — always ₱0 |

**Explanation:**

Only donated ingredients are considered. Since all items are donated, there is
**no cost computation** in this version. The optimizer focuses entirely on:

- how many people a meal can serve
- which ingredients need to be used urgently before they expire

---

## REAL DATABASE TABLES USED

### Donated Inventory

```
food_donation_records (parent)
  id                bigint         PK
  user_id           bigint         FK → users.id
  mode              varchar        CHECK: 'pickup' | 'delivery'
  pickup_address    varchar        nullable
  pickup_lat        numeric(10,7)  nullable
  pickup_lng        numeric(10,7)  nullable
  delivery_address  varchar        nullable
  preferred_date    date
  time_slot_start   time
  time_slot_end     time
  status            varchar        CHECK: 'pending' | 'approved' | 'rejected'
  staff_notes       text           nullable
  created_at        timestamp
  updated_at        timestamp

food_donation_record_items
  id                          bigint         PK
  food_donation_record_id     bigint         FK → food_donation_records.id
  food_name                   varchar        ← ingredient identifier
  quantity                    numeric(10,2)
  unit                        varchar
  category                    varchar
  expiration_date             date
  special_notes               text           nullable
  photo_path                  varchar        nullable
  created_at                  timestamp
  updated_at                  timestamp
```

**Explanation:**

These two tables store all donated food items. Only records where the parent
donation has `status = 'approved'` are used. Items that are expired or have
zero quantity are automatically removed from consideration.

### Request Context (determines target_pax)

```
beneficiary_requests
  id             bigint
  user_id        bigint          FK → users.id
  type           varchar         'food' | 'financial'
  request_name   varchar
  food_type      varchar         nullable
  population     integer         ← NUMBER OF PEOPLE TO SERVE (target pax)
  age_min        integer
  age_max        integer
  ...
  status         varchar         'Pending' | 'Allocated' | 'Urgent'
```

**Explanation:**

The `population` field tells the optimizer how many people need to be fed.
This is the **target pax** — the number the system tries to meet or exceed
when evaluating meal options.

---

## DATA STRUCTURES USED

```
InventoryItem {
  food_name       : string        // ingredient name — used to match recipes
  quantity        : decimal       // total available from all approved donations
  unit            : string
  category        : string
  expiration_date : date          // earliest expiry across all batches
  days_remaining  : int           // days until expiration_date from today
}

MealTemplate {
  meal_id                : string
  meal_name              : string
  required_ingredients   : list of RequiredIngredient
}

RequiredIngredient {
  food_name            : string   // must match InventoryItem.food_name
  quantity_per_serving : decimal
  unit                 : string   // must match InventoryItem.unit
}

MealPlan {
  meal_id            : string
  meal_name          : string
  servings_possible  : int        // how many people this meal can serve
  min_days_to_expiry : int        // urgency: lowest days_remaining among ingredients used
  pax_score          : float      // normalized 0–1 (higher servings = higher score)
  expiry_score       : float      // normalized 0–1 (fewer days left = higher score)
  final_score        : float      // weighted combination of pax_score + expiry_score
  covers_target_pax  : boolean    // servings_possible >= target_pax
  ingredients_used   : list of {
    food_name      : string
    qty_used       : decimal
    days_remaining : int          // how many days this ingredient has left
  }
}
```

**Explanation:**

These structures organize system data:

- `InventoryItem` → what donated ingredients are available
- `MealTemplate` → what recipes exist (what ingredients each meal needs)
- `MealPlan` → the computed result for one meal option, including how many people it serves and how urgently it should be prepared

---

## CONSTANTS

```
WEIGHT_PAX       : float = 0.7   // 70% priority → serve as many people as possible
WEIGHT_EXPIRY    : float = 0.3   // 30% priority → use ingredients expiring sooner
                                  // WEIGHT_PAX + WEIGHT_EXPIRY must equal 1.0

MIN_SERVINGS     : int   = 1     // a meal must serve at least 1 person to be valid
EXPIRY_WARN_DAYS : int   = 3     // items within 3 days of expiry trigger a warning
```

**Explanation:**

- 70% priority → serving more people is the main goal
- 30% priority → using ingredients that are close to expiring reduces waste
- These weights can be adjusted depending on the situation (e.g., if many
  items are about to expire, staff can raise WEIGHT_EXPIRY)

---

## STEP 0 — ENTRY POINT

```
FUNCTION run_meal_optimizer(
    target_pax   : int,
    meal_catalog : list of MealTemplate,
    weight_pax   : float = WEIGHT_PAX,
    weight_expiry: float = WEIGHT_EXPIRY
) -> list of MealPlan:

  validate: weight_pax + weight_expiry must equal 1.0
  validate: meal_catalog must not be empty

  usable_inventory = load_and_filter_inventory()

  raw_plans = evaluate_all_meals(usable_inventory, meal_catalog, target_pax)

  IF raw_plans is empty → return []

  scored_plans = normalize_and_score(raw_plans, weight_pax, weight_expiry)

  sort scored_plans by final_score DESCENDING

  assign ranks (1 = best)

  RETURN scored_plans
```

**Explanation:**

This is the **main controller** of the system. It runs all steps in order:

1. Load donated inventory from the database
2. Check which meals can be made with available donations
3. Score and rank those meals
4. Return the ranked list to staff

---

## STEP 1 — LOAD AND FILTER INVENTORY

```
FUNCTION load_and_filter_inventory() -> list of InventoryItem:

  donated_rows = DB.query(
    "SELECT fdri.food_name,
            SUM(fdri.quantity)        AS quantity,
            fdri.unit,
            fdri.category,
            MIN(fdri.expiration_date) AS expiration_date
     FROM food_donation_record_items fdri
     JOIN food_donation_records fdr ON fdr.id = fdri.food_donation_record_id
     WHERE fdr.status            = 'approved'
       AND fdri.quantity         > 0
     GROUP BY fdri.food_name, fdri.unit, fdri.category"
  )

  usable = []

  FOR each row IN donated_rows:

    // Skip expired items
    IF row.expiration_date < TODAY():
      LOG WARNING "Skipping expired: {row.food_name} (expired {row.expiration_date})"
      CONTINUE

    days_remaining = row.expiration_date - TODAY()

    // Warn about items expiring soon but still include them
    IF days_remaining <= EXPIRY_WARN_DAYS:
      LOG WARNING "Expiring soon: {row.food_name} — {days_remaining} day(s) left"

    usable.append(InventoryItem {
      food_name       : row.food_name,
      quantity        : row.quantity,
      unit            : row.unit,
      category        : row.category,
      expiration_date : row.expiration_date,
      days_remaining  : days_remaining
    })

  RETURN usable
```

**Explanation:**

This step ensures:

- only valid donated ingredients are used
- expired items are removed before any computation
- items close to expiring are flagged so staff is aware
- inventory is clean and ready for meal evaluation

---

## STEP 2 — EVALUATE ALL MEALS

```
FUNCTION evaluate_all_meals(
    usable_inventory : list of InventoryItem,
    meal_catalog     : list of MealTemplate,
    target_pax       : int
) -> list of MealPlan:

  // Build lookup: "food_name|unit" → InventoryItem
  inventory_map = {}
  FOR each item IN usable_inventory:
    key = item.food_name.toLowerCase() + "|" + item.unit.toLowerCase()
    inventory_map[key] = item

  raw_plans = []

  FOR each meal IN meal_catalog:

    // Check if the meal can be made at all
    servings = compute_max_servings(meal, inventory_map)

    IF servings < MIN_SERVINGS:
      LOG "Skipping '{meal.meal_name}': not enough donated inventory"
      CONTINUE

    // Find the most urgent ingredient (fewest days remaining)
    min_days = INFINITY
    ingredients_used = []
    FOR each req IN meal.required_ingredients:
      key  = req.food_name.toLowerCase() + "|" + req.unit.toLowerCase()
      item = inventory_map[key]
      qty_used = req.quantity_per_serving * servings

      min_days = MIN(min_days, item.days_remaining)

      ingredients_used.append({
        food_name      : item.food_name,
        qty_used       : qty_used,
        days_remaining : item.days_remaining
      })

    plan = MealPlan {
      meal_id            : meal.meal_id,
      meal_name          : meal.meal_name,
      servings_possible  : servings,
      min_days_to_expiry : min_days,
      covers_target_pax  : (servings >= target_pax),
      pax_score          : 0.0,   // filled in Step 3
      expiry_score       : 0.0,   // filled in Step 3
      final_score        : 0.0,   // filled in Step 3
      ingredients_used   : ingredients_used
    }

    raw_plans.append(plan)

  RETURN raw_plans
```

**Explanation:**

This checks if a meal can be prepared with available donated ingredients and:

- **how many people it can serve** (based on available quantities)
- **how urgently it should be prepared** (based on the ingredient closest to expiry)

---

## STEP 2a — COMPUTE MAX SERVINGS

```
FUNCTION compute_max_servings(
    meal          : MealTemplate,
    inventory_map : map
) -> int:

  max_servings = INFINITY

  FOR each req IN meal.required_ingredients:

    key  = req.food_name.toLowerCase() + "|" + req.unit.toLowerCase()
    item = inventory_map.get(key)

    // Missing ingredient → meal is not feasible
    IF item is None:
      LOG "Missing: '{req.food_name}' for '{meal.meal_name}'"
      RETURN 0

    servings_from_this = FLOOR(item.quantity / req.quantity_per_serving)
    max_servings = MIN(max_servings, servings_from_this)

  IF max_servings == INFINITY:
    RETURN 0

  RETURN INTEGER(max_servings)
```

**Explanation:**

The ingredient with the **smallest quantity** limits the total number of
servings. This is called the **bottleneck ingredient**.

For example: if rice can serve 100 people but chicken only serves 50,
the meal can only serve 50 people total.

---

## STEP 3 — NORMALIZE AND SCORE

```
FUNCTION normalize_and_score(
    raw_plans    : list of MealPlan,
    weight_pax   : float,
    weight_expiry: float
) -> list of MealPlan:

  max_servings = MAX(plan.servings_possible for plan in raw_plans)
  min_servings = MIN(plan.servings_possible for plan in raw_plans)

  max_days = MAX(plan.min_days_to_expiry for plan in raw_plans)
  min_days = MIN(plan.min_days_to_expiry for plan in raw_plans)

  FOR each plan IN raw_plans:

    // PAX SCORE: higher servings = higher score (0 to 1)
    IF max_servings == min_servings:
      pax_score = 1.0
    ELSE:
      pax_score = (plan.servings_possible - min_servings) /
                  (max_servings - min_servings)

    // EXPIRY SCORE: fewer days remaining = higher score (inverted)
    // A meal using ingredients expiring in 1 day scores higher than
    // one using ingredients still fresh for 30 days.
    IF max_days == min_days:
      expiry_score = 1.0
    ELSE:
      expiry_score = 1.0 - (
        (plan.min_days_to_expiry - min_days) /
        (max_days - min_days)
      )

    final_score = (weight_pax * pax_score) + (weight_expiry * expiry_score)

    plan.pax_score    = ROUND(pax_score,    4)
    plan.expiry_score = ROUND(expiry_score, 4)
    plan.final_score  = ROUND(final_score,  4)

  RETURN raw_plans
```

**Explanation:**

This step converts values into comparable scores (0 to 1) and combines them:

- **pax_score** → the meal that serves the most people scores 1.0; the lowest scores 0.0
- **expiry_score** → the meal that uses ingredients expiring soonest scores 1.0; the most fresh ingredients score 0.0
- **final_score** → the weighted combination that determines overall rank

This ensures the optimizer favors meals that both serve many people AND
reduce food waste at the same time.

---

## STEP 4 — OUTPUT

```
FUNCTION display_ranked_plans(
    ranked_plans : list of MealPlan,
    target_pax   : int
):

  IF ranked_plans is EMPTY:
    PRINT "No feasible meal plans with current donated inventory."
    RETURN

  PRINT "===== RANKED MEAL PLANS (DONATIONS ONLY) ====="
  PRINT "Target pax : {target_pax}"
  PRINT "Weights    : PAX={WEIGHT_PAX}  EXPIRY={WEIGHT_EXPIRY}"
  PRINT ""

  FOR each plan IN ranked_plans:
    covers = "✅ covers target" IF plan.covers_target_pax ELSE "⚠️ below target"
    PRINT "Rank #{plan.rank} — {plan.meal_name}  [{covers}]"
    PRINT "  Servings possible  : {plan.servings_possible} pax  (target: {target_pax})"
    PRINT "  Most urgent item   : {plan.min_days_to_expiry} day(s) until expiry"
    PRINT "  Pax score          : {plan.pax_score}"
    PRINT "  Expiry score       : {plan.expiry_score}"
    PRINT "  Final score        : {plan.final_score}"
    PRINT "  Ingredients used   :"
    FOR each ing IN plan.ingredients_used:
      PRINT "    - {ing.food_name}: {ing.qty_used} used — {ing.days_remaining} day(s) left"
    PRINT ""
```

**Explanation:**

The output shows staff:

- which meal is the best recommendation (Rank #1)
- how many people each meal can serve
- which ingredient is closest to expiry (urgency reminder)
- a breakdown of all donated ingredients used

The meal name is included so staff can clearly identify **which specific meal is
being recommended**, making the output understandable and usable for
decision-making.

---

## FULL CALL SEQUENCE

```
run_meal_optimizer(target_pax, meal_catalog)
  │
  ├── load_and_filter_inventory()
  │     ├── SQL: food_donation_record_items
  │     │         JOIN food_donation_records WHERE status = 'approved'
  │     ├── group by food_name + unit → sum quantity, min expiration_date
  │     ├── remove expired items
  │     ├── flag near-expiry (within 3 days)
  │     └── compute days_remaining for each item
  │
  ├── evaluate_all_meals(inventory, catalog, target_pax)
  │     ├── build inventory_map ("food_name|unit" → InventoryItem)
  │     └── FOR each meal:
  │           ├── compute_max_servings()   ← bottleneck ingredient (total donated qty)
  │           ├── compute min_days_to_expiry  ← most urgent ingredient used
  │           └── build MealPlan
  │
  ├── normalize_and_score()
  │     ├── pax_score    = normalized servings (higher = better)
  │     ├── expiry_score = normalized urgency, inverted (fewer days = higher score)
  │     └── final_score  = (WEIGHT_PAX × pax_score) + (WEIGHT_EXPIRY × expiry_score)
  │
  ├── sort DESCENDING by final_score
  ├── assign ranks (1 = best)
  └── return ranked list
```

**Explanation:**

This shows the complete flow of how the system processes data step-by-step —
from reading the database, to evaluating meals, to returning a ranked result.

---

## SCORING WORKED EXAMPLE

```
target_pax = 60  (from beneficiary_requests.population = 60)

Donated Inventory (approved, not expired):
  Rice     : 20 kg   — expires in 10 days
  Chicken  : 8  kg   — expires in 2  days  ← most urgent
  Lentils  : 12 kg   — expires in 15 days
  Potatoes : 10 kg   — expires in 5  days
  Tomatoes : 5  kg   — expires in 7  days

Given 3 meal templates:

  Plan A — "Chicken Rice"
    Rice: 0.2 kg/serving   Chicken: 0.1 kg/serving
    → max_servings = MIN(FLOOR(20/0.2), FLOOR(8/0.1)) = MIN(100, 80) = 80
    → min_days_to_expiry = MIN(10, 2) = 2 days  ← most urgent

  Plan B — "Lentil Stew"
    Lentils: 0.15 kg/serving  Tomatoes: 0.05 kg/serving  Potatoes: 0.1 kg/serving
    → max_servings = MIN(FLOOR(12/0.15), FLOOR(5/0.05), FLOOR(10/0.1))
                   = MIN(80, 100, 100) = 80
    → min_days_to_expiry = MIN(15, 7, 5) = 5 days

  Plan C — "Rice & Lentils"
    Rice: 0.15 kg/serving   Lentils: 0.1 kg/serving
    → max_servings = MIN(FLOOR(20/0.15), FLOOR(12/0.1)) = MIN(133, 120) = 120
    → min_days_to_expiry = MIN(10, 15) = 10 days

────────────────────────────────────────────────────────────────────────────────
Normalization (WEIGHT_PAX=0.7, WEIGHT_EXPIRY=0.3):

  Boundaries:
    max_servings = 120,  min_servings = 80
    max_days     = 10,   min_days     = 2

  Plan A (80 servings, 2 days):
    pax_score    = (80  - 80) / (120 - 80) = 0.000
    expiry_score = 1 - (2 - 2) / (10 - 2) = 1.000  ← most urgent ingredients
    final_score  = (0.7×0.000) + (0.3×1.000) = 0.300

  Plan B (80 servings, 5 days):
    pax_score    = (80  - 80) / (120 - 80) = 0.000
    expiry_score = 1 - (5 - 2) / (10 - 2) = 0.625
    final_score  = (0.7×0.000) + (0.3×0.625) = 0.188

  Plan C (120 servings, 10 days):
    pax_score    = (120 - 80) / (120 - 80) = 1.000  ← serves most people
    expiry_score = 1 - (10 - 2) / (10 - 2) = 0.000  ← freshest ingredients
    final_score  = (0.7×1.000) + (0.3×0.000) = 0.700

Final ranking:
  Rank 1 — Plan C "Rice & Lentils"  (score: 0.700) ✅ covers 120 pax (target met)
  Rank 2 — Plan A "Chicken Rice"    (score: 0.300) ✅ covers 80  pax — urgent! chicken expires in 2 days
  Rank 3 — Plan B "Lentil Stew"     (score: 0.188) ✅ covers 80  pax

Note: If staff notices Plan A's chicken expires in 2 days and Plan C is already
chosen, they should consider using the chicken soon in a separate batch.
Staff can also raise WEIGHT_EXPIRY to give more priority to urgency.
```

---

## EDGE CASES

| Situation | Behaviour |
|---|---|
| Missing ingredient | `compute_max_servings` returns 0 → meal skipped |
| Ingredient expired | Removed in Step 1 → not available for any meal |
| Ingredient expires within 3 days | Still included — warning logged, reflected in expiry_score |
| All plans serve same pax | `pax_score = 1.0` for all → tiebreaker falls to expiry_score |
| All plans have same expiry urgency | `expiry_score = 1.0` for all → tiebreaker falls to pax_score |
| All donated inventory expired | Step 1 returns empty → optimizer returns `[]` |
| Meal needs ingredient with wrong unit | Treated as a different ingredient → missing → meal skipped |
| No approved donations | No inventory loaded → no feasible plans → returns `[]` |

**Explanation:**

These ensure the system remains **stable and accurate** even in unexpected
situations. The most important rule: if an ingredient is missing or expired,
the meal is simply skipped rather than causing an error.

---

## DATABASE QUERY REFERENCE

```sql
-- Load all approved donated inventory (not expired, qty > 0)
SELECT
  fdri.food_name,
  SUM(fdri.quantity)        AS quantity,
  fdri.unit,
  fdri.category,
  MIN(fdri.expiration_date) AS expiration_date,
  MIN(fdri.expiration_date) - CURRENT_DATE AS days_remaining
FROM food_donation_record_items fdri
JOIN food_donation_records fdr ON fdr.id = fdri.food_donation_record_id
WHERE fdr.status            = 'approved'
  AND fdri.expiration_date >= CURRENT_DATE
  AND fdri.quantity         > 0
GROUP BY fdri.food_name, fdri.unit, fdri.category;

-- Get target pax from a beneficiary request
SELECT population
FROM beneficiary_requests
WHERE id   = :request_id
  AND type = 'food';
```
