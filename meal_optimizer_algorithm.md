# Meal Optimizer — Full Algorithm
## Pseudocode Based on Real SAVR Database Schema

---

## OVERVIEW

The meal optimizer reads the partner kitchen's inventory — approved food donations
(₱0 cost) and staff-purchased ingredients (actual cost) — evaluates every meal in
the catalog, scores each feasible plan against two factors (pax served and cost per
pax), and returns a ranked list — best option at the top.

```
Input  : KitchenInventory (DB: donated + purchased), MealCatalog, target_pax,
         WEIGHT_PAX, WEIGHT_COST, max_budget
Output : list of MealPlan, sorted by final_score DESCENDING
```

### Inventory Cost Rules

| Source | Table | unit_cost |
|---|---|---|
| Food donation (approved) | `food_donation_record_items` | **₱0.00** always |
| Staff-purchased ingredient | `purchased_ingredients` | **actual price** entered by staff |

### Donated-First Priority Rule

> When both donated and purchased stock exist for the same ingredient, **donated
> stock is always consumed first**. Only the quantity that exceeds available
> donated stock is drawn from purchased stock.
>
> This minimizes cost automatically — donated portions cost ₱0, so the algorithm
> never pays for an ingredient it can get for free.

**Example:** 15 kg donated + 5 kg purchased rice, recipe needs 18 kg →
use all 15 kg donated (₱0) + only 3 kg purchased (₱75/kg = ₱225 total).
Previously, a naïve weighted-average approach would have charged a blended rate
across all 18 kg even though donated stock covers most of it.

### Budget Constraint

> A configurable `MAX_BUDGET` (default ₱5,000) is checked against each plan's
> `total_cost` (computed after donated-first allocation). Plans that exceed the
> budget are flagged as `within_budget = false` but are **not excluded** — they
> still appear in the ranked list so staff can make an informed decision.

---

## REAL DATABASE TABLES USED

### Source 1 — Donated Inventory
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

food_donation_record_items  (unit_cost = ₱0 always)
  id                          bigint         PK
  food_donation_record_id     bigint         FK → food_donation_records.id  CASCADE DELETE
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

### Source 2 — Staff-Purchased Inventory
```
purchased_ingredients  (unit_cost = actual price entered by staff)
  id              bigint          PK
  staff_id        bigint          FK → users.id  (who bought it)
  food_name       varchar         ← must match recipe ingredient names
  quantity        numeric(10,2)   ← amount purchased
  unit            varchar         ← must match the same unit used in recipes
  unit_cost       numeric(10,2)   ← price per unit (₱), entered by staff
  expiration_date date            nullable
  purchased_at    date            ← date of purchase
  created_at      timestamp
  updated_at      timestamp
```

### Request Context (determines target_pax)
```
beneficiary_requests
  id             bigint
  user_id        bigint          FK → users.id
  type           varchar         'food' | 'financial'
  request_name   varchar
  food_type      varchar         nullable
  quantity       numeric(10,2)   nullable
  unit           varchar         nullable
  amount         numeric(15,2)   nullable
  population     integer         ← NUMBER OF PEOPLE TO SERVE (target pax)
  age_min        integer
  age_max        integer
  street         varchar
  barangay       varchar
  city           varchar
  zip_code       varchar
  request_date   date
  urgency        varchar
  status         varchar         'Pending' | 'Allocated' | 'Urgent'
  created_at     timestamp
  updated_at     timestamp

donation_requests  (alternative pax source)
  id          bigint
  pax         integer             ← NUMBER OF PEOPLE TO SERVE (target pax)
  urgency     varchar             CHECK: 'low' | 'medium' | 'high' | 'critical'
  status      varchar             CHECK: 'Pending' | 'Allocated' | 'Declined' | 'Done'
  ...
```

---

## DATA STRUCTURES USED

```
InventoryItem {
  food_name             : string        // ingredient identifier — key for recipe matching
  quantity              : decimal(10,2) // total available = donated_qty + purchased_qty
  donated_qty           : decimal(10,2) // free tier — consumed first
  purchased_qty         : decimal(10,2) // paid tier — consumed only after donated is exhausted
  purchased_unit_cost   : decimal(10,2) // weighted avg cost of the purchased portion only
                                        //   ₱0.0 if no purchased stock
  unit                  : string
  category              : string
  expiration_date       : date          // earliest expiry across all batches
  source                : enum          // 'donated' | 'purchased' | 'mixed'
}

MealTemplate {
  meal_id    : string             // external config (no DB table yet)
  meal_name  : string
  required_ingredients : list of RequiredIngredient
}

RequiredIngredient {
  food_name            : string   // must match InventoryItem.food_name
  quantity_per_serving : decimal
  unit                 : string   // must match InventoryItem.unit
}

MealPlan {
  meal_id           : string
  meal_name         : string
  servings_possible : int
  total_cost        : decimal     // cost after donated-first allocation
                                  //   ₱0 if all ingredients are donated
                                  //   >₱0 only for the purchased portion actually used
  cost_per_pax      : decimal     // total_cost / servings_possible
  within_budget     : boolean     // total_cost <= MAX_BUDGET
  pax_score         : float       // normalized 0–1 (higher servings = higher score)
  cost_score        : float       // normalized 0–1 (lower cost_per_pax = higher score)
  final_score       : float       // weighted combination of pax_score + cost_score
  covers_target_pax : boolean     // servings_possible >= target_pax
  ingredients_used  : list of {
    food_name           : string
    donated_used        : decimal  // qty drawn from donated stock (₱0)
    purchased_used      : decimal  // qty drawn from purchased stock (actual cost)
    purchased_unit_cost : decimal  // cost per unit for the purchased portion
    cost_used           : decimal  // purchased_unit_cost × purchased_used
  }
}
```

---

## CONSTANTS

```
WEIGHT_PAX       : float   = 0.6     // weight for maximizing pax served
WEIGHT_COST      : float   = 0.4     // weight for minimizing cost per pax
                                      // WEIGHT_PAX + WEIGHT_COST must equal 1.0

MIN_SERVINGS     : int     = 1       // minimum servings for a plan to be valid
EXPIRY_WARN_DAYS : int     = 3       // days before expiration_date to flag an item

MAX_BUDGET       : decimal = 5000.00 // configurable total cost ceiling (₱)
                                      // Plans exceeding this are flagged within_budget=false
                                      // but still returned — staff can still choose them
```

---

## STEP 0 — ENTRY POINT

```
FUNCTION run_meal_optimizer(
    target_pax   : int,             // from beneficiary_requests.population
                                    //   OR donation_requests.pax
    meal_catalog : list of MealTemplate,
    weight_pax   : float   = WEIGHT_PAX,
    weight_cost  : float   = WEIGHT_COST,
    max_budget   : decimal = MAX_BUDGET   // configurable per run
) -> list of MealPlan:

  // Guard: weights must sum to 1
  IF ABS((weight_pax + weight_cost) - 1.0) > 0.0001:
    RAISE InvalidWeightsError("WEIGHT_PAX + WEIGHT_COST must equal 1.0")

  // Guard: catalog must not be empty
  IF meal_catalog is EMPTY:
    RAISE EmptyCatalogError("No meals in catalog to evaluate")

  // Guard: budget must be positive
  IF max_budget <= 0:
    RAISE InvalidBudgetError("max_budget must be greater than ₱0")

  // Step 1: Load donated and purchased inventory separately; keep both qtys tracked
  usable_inventory = CALL load_and_filter_inventory()

  // Step 2: Evaluate each meal — donated-first cost, budget flag
  raw_plans = CALL evaluate_all_meals(usable_inventory, meal_catalog, target_pax, max_budget)

  // Step 3: If no meal is feasible, return empty with a warning
  IF raw_plans is EMPTY:
    LOG WARNING "No feasible meal plans. Inventory may be insufficient or all expired."
    RETURN []

  // Warn if all plans exceed the budget (but still return them)
  over_budget_count = COUNT(plan for plan in raw_plans WHERE plan.within_budget == false)
  IF over_budget_count == raw_plans.length:
    LOG WARNING "All {raw_plans.length} feasible plan(s) exceed the budget of ₱{max_budget}."

  // Step 4: Normalize scores across all feasible plans
  scored_plans = CALL normalize_and_score(raw_plans, weight_pax, weight_cost)

  // Step 5: Sort — within-budget plans first, then by final score descending
  //   Primary   : within_budget DESC  (true before false)
  //   Secondary : final_score   DESC
  scored_plans.sort(by = [within_budget DESC, final_score DESC])

  // Step 6: Assign ranks and return
  FOR i FROM 0 TO scored_plans.length - 1:
    scored_plans[i].rank = i + 1

  LOG "Optimizer complete. {scored_plans.length} feasible plan(s) ranked."
  LOG "Budget: ₱{max_budget} — {scored_plans.length - over_budget_count} within budget, {over_budget_count} over."

  RETURN scored_plans
```

---

## STEP 1 — LOAD AND FILTER INVENTORY

```
FUNCTION load_and_filter_inventory() -> list of InventoryItem:

  // ── 1a. Load donated items (unit_cost = ₱0) ─────────────────────────────────
  donated_rows = DB.query(
    "SELECT fdri.food_name, fdri.quantity, fdri.unit,
            fdri.category, fdri.expiration_date
     FROM food_donation_record_items fdri
     JOIN food_donation_records fdr ON fdr.id = fdri.food_donation_record_id
     WHERE fdr.status = 'approved'
       AND fdri.quantity > 0"
  )

  // ── 1b. Load purchased items (unit_cost = actual price entered by staff) ─────
  purchased_rows = DB.query(
    "SELECT food_name, quantity, unit,
            unit_cost, expiration_date
     FROM purchased_ingredients
     WHERE quantity > 0"
  )

  // ── 1c. Build per-key accumulators ───────────────────────────────────────────
  //
  // key: "food_name|unit" (lowercased)
  // Donated and purchased quantities are kept SEPARATE.
  // purchased_cost_value = SUM(unit_cost × quantity) across purchased batches only.
  // Donated contributes ₱0 — it is NEVER mixed into a weighted average.

  merged = {}   // key → {
                //   food_name, unit, category,
                //   donated_qty,
                //   purchased_qty,
                //   purchased_cost_value,   ← SUM(unit_cost × qty) for purchased only
                //   earliest_expiry
                // }

  FOR each row IN donated_rows:
    key = row.food_name.toLowerCase() + "|" + row.unit.toLowerCase()
    IF key NOT IN merged:
      merged[key] = { food_name: row.food_name, unit: row.unit,
                      category: row.category,
                      donated_qty: 0, purchased_qty: 0,
                      purchased_cost_value: 0.0,
                      earliest_expiry: row.expiration_date }

    merged[key].donated_qty += row.quantity
    IF row.expiration_date < merged[key].earliest_expiry:
      merged[key].earliest_expiry = row.expiration_date
    // donated cost = ₱0 — purchased_cost_value unchanged

  FOR each row IN purchased_rows:
    key = row.food_name.toLowerCase() + "|" + row.unit.toLowerCase()
    IF key NOT IN merged:
      merged[key] = { food_name: row.food_name, unit: row.unit,
                      category: '',
                      donated_qty: 0, purchased_qty: 0,
                      purchased_cost_value: 0.0,
                      earliest_expiry: row.expiration_date OR FAR_FUTURE_DATE }

    merged[key].purchased_qty          += row.quantity
    merged[key].purchased_cost_value   += row.unit_cost * row.quantity
    IF row.expiration_date is NOT NULL AND row.expiration_date < merged[key].earliest_expiry:
      merged[key].earliest_expiry = row.expiration_date

  // ── 1d. Build InventoryItem list and apply filters ───────────────────────────
  usable = []

  FOR each entry IN merged.values():

    total_qty = entry.donated_qty + entry.purchased_qty

    // Skip if nothing usable
    IF total_qty <= 0:
      CONTINUE

    // Skip expired items entirely
    IF entry.earliest_expiry < TODAY():
      LOG WARNING "Skipping expired item: {entry.food_name} (expired {entry.earliest_expiry})"
      CONTINUE

    // Warn on items expiring soon but still include them
    days_left = entry.earliest_expiry - TODAY()
    IF days_left <= EXPIRY_WARN_DAYS:
      LOG WARNING "Item expiring soon: {entry.food_name} — {days_left} day(s) left"

    // Weighted average of the purchased portion only
    // (donated portion is always ₱0 and is never factored into this price)
    IF entry.purchased_qty > 0:
      purchased_unit_cost = entry.purchased_cost_value / entry.purchased_qty
    ELSE:
      purchased_unit_cost = 0.0

    // Determine source label
    IF entry.donated_qty > 0 AND entry.purchased_qty > 0:
      source = 'mixed'
    ELSE IF entry.purchased_qty > 0:
      source = 'purchased'
    ELSE:
      source = 'donated'

    usable.append(InventoryItem {
      food_name           : entry.food_name,
      quantity            : total_qty,
      donated_qty         : entry.donated_qty,
      purchased_qty       : entry.purchased_qty,
      purchased_unit_cost : ROUND(purchased_unit_cost, 4),
      unit                : entry.unit,
      category            : entry.category,
      expiration_date     : entry.earliest_expiry,
      source              : source
    })

  RETURN usable
```

---

## STEP 2 — EVALUATE ALL MEALS

```
FUNCTION evaluate_all_meals(
    usable_inventory : list of InventoryItem,
    meal_catalog     : list of MealTemplate,
    target_pax       : int,
    max_budget       : decimal
) -> list of MealPlan:

  // Build lookup map: "food_name|unit" → InventoryItem
  inventory_map = {}
  FOR each item IN usable_inventory:
    key = item.food_name.toLowerCase() + "|" + item.unit.toLowerCase()
    inventory_map[key] = item

  raw_plans = []

  FOR each meal IN meal_catalog:

    // --- 2a. Feasibility check (uses total qty = donated + purchased) ---
    servings = CALL compute_max_servings(meal, inventory_map)

    IF servings < MIN_SERVINGS:
      LOG "Skipping '{meal.meal_name}': not enough inventory for {MIN_SERVINGS} serving(s)"
      CONTINUE

    // --- 2b. Cost computation using donated-first rule ---
    cost_breakdown = CALL compute_meal_cost(meal, servings, inventory_map)

    total_cost   = cost_breakdown.total_cost
    cost_per_pax = total_cost / servings

    // --- 2c. Budget check ---
    within_budget = (total_cost <= max_budget)
    IF NOT within_budget:
      LOG "Plan '{meal.meal_name}' exceeds budget: ₱{total_cost} > ₱{max_budget}"

    // --- 2d. Build raw MealPlan ---
    plan = MealPlan {
      meal_id           : meal.meal_id,
      meal_name         : meal.meal_name,
      servings_possible : servings,
      total_cost        : total_cost,
      cost_per_pax      : cost_per_pax,
      within_budget     : within_budget,
      covers_target_pax : (servings >= target_pax),
      pax_score         : 0.0,   // filled in Step 4
      cost_score        : 0.0,   // filled in Step 4
      final_score       : 0.0,   // filled in Step 4
      ingredients_used  : cost_breakdown.ingredients_used
    }

    raw_plans.append(plan)

  RETURN raw_plans
```

---

## STEP 2a — COMPUTE MAX SERVINGS

```
FUNCTION compute_max_servings(
    meal          : MealTemplate,
    inventory_map : map of "food_name|unit" → InventoryItem
) -> int:

  // Uses total quantity (donated + purchased) for feasibility.
  // The donated-first rule applies only during cost computation, not here.

  max_servings = INFINITY

  FOR each req IN meal.required_ingredients:

    key  = req.food_name.toLowerCase() + "|" + req.unit.toLowerCase()
    item = inventory_map.get(key)

    // Missing ingredient → meal is not feasible
    IF item is None:
      LOG "Missing ingredient '{req.food_name}' ({req.unit}) for '{meal.meal_name}'"
      RETURN 0

    // How many full servings can this ingredient support?
    servings_from_this = FLOOR(item.quantity / req.quantity_per_serving)

    // Bottleneck: most constrained ingredient wins
    max_servings = MIN(max_servings, servings_from_this)

  IF max_servings == INFINITY:
    RETURN 0

  RETURN INTEGER(max_servings)
```

---

## STEP 2b — COMPUTE MEAL COST (DONATED-FIRST)

```
FUNCTION compute_meal_cost(
    meal          : MealTemplate,
    servings      : int,
    inventory_map : map of "food_name|unit" → InventoryItem
) -> {
    total_cost       : decimal,
    ingredients_used : list of {
      food_name, donated_used, purchased_used, purchased_unit_cost, cost_used
    }
}:

  total_cost       = 0.0
  ingredients_used = []

  FOR each req IN meal.required_ingredients:

    key      = req.food_name.toLowerCase() + "|" + req.unit.toLowerCase()
    item     = inventory_map[key]
    qty_used = req.quantity_per_serving * servings

    // ── DONATED-FIRST RULE ────────────────────────────────────────────────────
    // 1. Consume donated stock first — these units cost ₱0.
    // 2. Only draw from purchased stock for whatever qty donated cannot cover.
    // This guarantees the minimum possible cost for every ingredient.

    donated_used   = MIN(item.donated_qty, qty_used)      // free portion (₱0)
    purchased_used = MAX(0, qty_used - donated_used)       // paid portion

    // Safety cap: purchased_used cannot exceed available purchased stock.
    // (This should never trigger since compute_max_servings used total qty,
    //  but is guarded here for correctness.)
    purchased_used = MIN(purchased_used, item.purchased_qty)

    cost_used   = item.purchased_unit_cost * purchased_used
    total_cost += cost_used

    ingredients_used.append({
      food_name           : item.food_name,
      donated_used        : donated_used,
      purchased_used      : purchased_used,
      purchased_unit_cost : item.purchased_unit_cost,
      cost_used           : ROUND(cost_used, 2)
    })

  RETURN {
    total_cost       : ROUND(total_cost, 2),
    ingredients_used : ingredients_used
  }
```

---

## STEP 3 — NORMALIZE AND SCORE

```
FUNCTION normalize_and_score(
    raw_plans   : list of MealPlan,
    weight_pax  : float,
    weight_cost : float
) -> list of MealPlan:

  max_servings     = MAX(plan.servings_possible for plan in raw_plans)
  min_servings     = MIN(plan.servings_possible for plan in raw_plans)

  max_cost_per_pax = MAX(plan.cost_per_pax for plan in raw_plans)
  min_cost_per_pax = MIN(plan.cost_per_pax for plan in raw_plans)

  FOR each plan IN raw_plans:

    // PAX SCORE: higher servings = higher score (0 to 1)
    IF max_servings == min_servings:
      pax_score = 1.0
    ELSE:
      pax_score = (plan.servings_possible - min_servings) /
                  (max_servings - min_servings)

    // COST SCORE: lower cost_per_pax = higher score (inverted, 0 to 1)
    // A fully donated meal scores 1.0; a meal that draws more from purchased
    // stock scores relatively lower.
    IF max_cost_per_pax == min_cost_per_pax:
      // All plans cost the same — everyone ties on this factor
      cost_score = 1.0
    ELSE:
      cost_score = 1.0 - (
        (plan.cost_per_pax - min_cost_per_pax) /
        (max_cost_per_pax - min_cost_per_pax)
      )

    final_score = (weight_pax * pax_score) + (weight_cost * cost_score)

    plan.pax_score   = ROUND(pax_score,   4)
    plan.cost_score  = ROUND(cost_score,  4)
    plan.final_score = ROUND(final_score, 4)

  RETURN raw_plans
```

---

## STEP 4 — OUTPUT FORMAT

```
FUNCTION display_ranked_plans(
    ranked_plans : list of MealPlan,
    target_pax   : int,
    max_budget   : decimal
):

  IF ranked_plans is EMPTY:
    PRINT "No feasible meal plans available with current inventory."
    RETURN

  PRINT "===== RANKED MEAL PLANS ====="
  PRINT "Target pax : {target_pax}"
  PRINT "Budget     : ₱{max_budget}"
  PRINT "Weights    : PAX={WEIGHT_PAX}  COST={WEIGHT_COST}"
  PRINT ""

  FOR each plan IN ranked_plans:
    covers = "✅ covers target" IF plan.covers_target_pax ELSE "⚠️ below target"
    budget = "✅ within budget" IF plan.within_budget ELSE "⚠️ over budget"
    PRINT "Rank #{plan.rank} — {plan.meal_name}  [{covers}]  [{budget}]"
    PRINT "  Servings possible : {plan.servings_possible} pax  (target: {target_pax})"
    PRINT "  Total cost        : ₱{plan.total_cost}  (budget: ₱{max_budget})"
    PRINT "  Cost per pax      : ₱{plan.cost_per_pax}"
    PRINT "  Pax score         : {plan.pax_score}"
    PRINT "  Cost score        : {plan.cost_score}"
    PRINT "  Final score       : {plan.final_score}"
    PRINT "  Ingredients used  :"
    FOR each ing IN plan.ingredients_used:
      IF ing.donated_used > 0 AND ing.purchased_used > 0:
        PRINT "    - {ing.food_name}:"
        PRINT "        donated   {ing.donated_used} {unit}  → ₱0.00"
        PRINT "        purchased {ing.purchased_used} {unit} × ₱{ing.purchased_unit_cost}/unit → ₱{ing.cost_used}"
      ELSE IF ing.donated_used > 0:
        PRINT "    - {ing.food_name}: {ing.donated_used} {unit}  — fully donated → ₱0.00"
      ELSE:
        PRINT "    - {ing.food_name}: {ing.purchased_used} {unit} × ₱{ing.purchased_unit_cost}/unit → ₱{ing.cost_used}"
    PRINT ""
```

---

## FULL CALL SEQUENCE

```
run_meal_optimizer(target_pax, meal_catalog, max_budget)
  │
  ├── load_and_filter_inventory()
  │     ├── SQL: donated   → food_donation_record_items
  │     │         JOIN food_donation_records WHERE status = 'approved'
  │     ├── SQL: purchased → purchased_ingredients
  │     ├── merge by "food_name|unit"
  │     │     ├── donated_qty    tracked separately → unit_cost = ₱0
  │     │     └── purchased_qty  tracked separately → purchased_unit_cost = actual price
  │     │         (weighted avg of purchased batches only — donated never mixed in)
  │     ├── remove expired  (earliest_expiry < TODAY)
  │     ├── flag near-expiry (within 3 days)
  │     └── remove zero-qty
  │
  ├── evaluate_all_meals(inventory, catalog, target_pax, max_budget)
  │     ├── build inventory_map ("food_name|unit" → InventoryItem)
  │     └── FOR each meal:
  │           ├── compute_max_servings()   ← uses total qty (donated + purchased)
  │           ├── compute_meal_cost()      ← DONATED-FIRST RULE
  │           │     ├── donated_used   = MIN(donated_qty, qty_needed)  → ₱0
  │           │     ├── purchased_used = qty_needed - donated_used     → actual cost
  │           │     └── cost_used = purchased_unit_cost × purchased_used
  │           ├── budget check: total_cost <= max_budget → within_budget flag
  │           └── build MealPlan
  │
  ├── warn if all plans exceed budget
  │
  ├── normalize_and_score()
  │     ├── pax_score  = normalized servings (higher = better)
  │     ├── cost_score = normalized cost, inverted (lower cost = higher score)
  │     └── final_score = (WEIGHT_PAX × pax_score) + (WEIGHT_COST × cost_score)
  │
  ├── sort: within_budget DESC, then final_score DESC
  │         (within-budget plans always appear above over-budget plans)
  ├── assign ranks (1 = best)
  └── return ranked list
```

---

## SCORING WORKED EXAMPLE

```
target_pax = 60   (from beneficiary_requests.population = 60)
max_budget = ₱5,000

Raw inventory (before donated-first allocation):
  Rice     : donated=15 kg,  purchased=5 kg  @ ₱75/kg    total=20 kg
  Chicken  : donated=0  kg,  purchased=8 kg  @ ₱220/kg   total=8  kg
  Lentils  : donated=12 kg,  purchased=0 kg               total=12 kg
  Potatoes : donated=0  kg,  purchased=10 kg @ ₱40/kg    total=10 kg
  Tomatoes : donated=5  kg,  purchased=0 kg               total=5  kg

Given 3 meal templates:

  Plan A — "Chicken Rice"
    Rice    : 0.2 kg/serving   Chicken: 0.1 kg/serving
    → max_servings = MIN(FLOOR(20/0.2), FLOOR(8/0.1)) = MIN(100, 80) = 80

    Donated-first cost for 80 servings:
      Rice    needed: 0.2×80 = 16 kg
        donated_used   = MIN(15, 16) = 15 kg → ₱0
        purchased_used = 16 - 15     =  1 kg × ₱75  = ₱75
      Chicken needed: 0.1×80 = 8 kg
        donated_used   = MIN(0, 8)   =  0 kg → ₱0
        purchased_used = 8 - 0       =  8 kg × ₱220 = ₱1,760
    → total_cost = ₱75 + ₱1,760 = ₱1,835.00   cost_per_pax = ₱22.94
    → within_budget = true (₱1,835 ≤ ₱5,000)

    Previously (weighted-avg, no priority):
      Rice avg = ₱18.75/kg → 16 kg × ₱18.75 = ₱300 (overstated; donated kg charged a price)
      total = ₱300 + ₱1,760 = ₱2,060  ← inflated by ₱225
    Donated-first saves ₱225 by correctly treating donated rice as ₱0.

  Plan B — "Lentil Stew"
    Lentils : 0.15 kg/serving  Tomatoes: 0.05 kg/serving  Potatoes: 0.1 kg/serving
    → max_servings = MIN(FLOOR(12/0.15), FLOOR(5/0.05), FLOOR(10/0.1)) = MIN(80, 100, 100) = 80

    Donated-first cost for 80 servings:
      Lentils  needed: 0.15×80 = 12 kg — all donated → ₱0
      Tomatoes needed: 0.05×80 =  4 kg — all donated → ₱0
      Potatoes needed: 0.1×80  =  8 kg — all purchased × ₱40 = ₱320
    → total_cost = ₱320.00   cost_per_pax = ₱4.00
    → within_budget = true (₱320 ≤ ₱5,000)

  Plan C — "Rice & Lentils"
    Rice    : 0.15 kg/serving  Lentils: 0.1 kg/serving
    → max_servings = MIN(FLOOR(20/0.15), FLOOR(12/0.1)) = MIN(133, 120) = 120

    Donated-first cost for 120 servings:
      Rice    needed: 0.15×120 = 18 kg
        donated_used   = MIN(15, 18) = 15 kg → ₱0
        purchased_used = 18 - 15     =  3 kg × ₱75 = ₱225
      Lentils needed: 0.1×120  = 12 kg — all donated → ₱0
    → total_cost = ₱225.00   cost_per_pax = ₱1.88
    → within_budget = true (₱225 ≤ ₱5,000)

    Previously (weighted-avg, no priority):
      Rice avg = ₱18.75/kg → 18 kg × ₱18.75 = ₱337.50 ← overstated
    Donated-first saves ₱112.50 by correctly treating the 15 kg donated portion as ₱0.

────────────────────────────────────────────────────────────────────────────────
Normalization (WEIGHT_PAX=0.6, WEIGHT_COST=0.4):

  Boundaries:
    max_servings     = 120,   min_servings     = 80
    max_cost_per_pax = ₱22.94, min_cost_per_pax = ₱1.88

  Plan A (80 servings, ₱22.94/pax, within_budget=true):
    pax_score  = (80 - 80) / (120 - 80) = 0.0
    cost_score = 1 - (22.94 - 1.88) / (22.94 - 1.88) = 0.0
    final_score = (0.6×0.0) + (0.4×0.0) = 0.000

  Plan B (80 servings, ₱4.00/pax, within_budget=true):
    pax_score  = (80 - 80) / (120 - 80) = 0.0
    cost_score = 1 - (4.00 - 1.88) / (22.94 - 1.88) = 1 - 2.12/21.06 = 0.899
    final_score = (0.6×0.0) + (0.4×0.899) = 0.360

  Plan C (120 servings, ₱1.88/pax, within_budget=true):
    pax_score  = (120 - 80) / (120 - 80) = 1.0
    cost_score = 1 - (1.88 - 1.88) / (22.94 - 1.88) = 1.0
    final_score = (0.6×1.0) + (0.4×1.0) = 1.000

Final ranking (all within budget):
  Rank 1 — Plan C "Rice & Lentils"  (score: 1.000) ✅ covers target  ✅ within budget
  Rank 2 — Plan B "Lentil Stew"     (score: 0.360) ✅ covers target  ✅ within budget
  Rank 3 — Plan A "Chicken Rice"    (score: 0.000) ✅ covers target  ✅ within budget

Note: Costs are now lower and more accurate than the old weighted-average approach
because donated stock is correctly treated as ₱0 for exactly the qty used from it.
```

---

## EDGE CASES HANDLED

| Situation | Behaviour |
|---|---|
| Ingredient fully donated | `donated_used = qty_needed`, `purchased_used = 0` → cost_used = ₱0 |
| Ingredient fully purchased | `donated_used = 0`, `purchased_used = qty_needed` → full cost applied |
| Same ingredient from both sources | Donated qty consumed first; purchased qty only for remainder |
| Donated qty > needed | Entire requirement met by donated stock → purchased_used = 0 → ₱0 cost |
| Donated qty < needed | Donated covers partial qty; purchased covers the rest |
| Staff buys ingredient not in donations | `donated_qty = 0`, all qty from purchased stock |
| Donated + purchased have different units | Treated as separate ingredients (different map keys) |
| Missing ingredient in either source | `compute_max_servings` returns 0 → meal skipped |
| Plan within budget | `within_budget = true` — ranked normally among within-budget plans |
| Plan exceeds budget | `within_budget = false` — still returned, but sorted below all within-budget plans |
| All plans exceed budget | All returned with `within_budget = false`; warning logged |
| Budget = ₱0 or negative | `InvalidBudgetError` raised before any evaluation |
| All plans have same cost_per_pax | `cost_score = 1.0` for all → tiebreaker falls to pax_score |
| All plans serve same pax count | `pax_score = 1.0` for all → tiebreaker falls to cost_score |
| All inventory expired | `load_and_filter_inventory` returns empty → optimizer returns `[]` |
| Expiration within 3 days | Item included but warning logged |
| Purchased ingredient has no expiry | Use a far-future date (no expiry concern) |
| Weights don't sum to 1.0 | `InvalidWeightsError` raised before any evaluation |

---

## DATABASE QUERY REFERENCE

```sql
-- Load donated inventory (approved, not expired, qty > 0)
SELECT
  fdri.food_name,
  SUM(fdri.quantity)        AS donated_qty,
  fdri.unit,
  fdri.category,
  MIN(fdri.expiration_date) AS earliest_expiry,
  0.0                       AS purchased_unit_cost,
  'donated'                 AS source
FROM food_donation_record_items fdri
JOIN food_donation_records fdr ON fdr.id = fdri.food_donation_record_id
WHERE fdr.status            = 'approved'
  AND fdri.expiration_date >= CURRENT_DATE
  AND fdri.quantity         > 0
GROUP BY fdri.food_name, fdri.unit, fdri.category;

-- Load purchased inventory (not expired, qty > 0)
-- purchased_unit_cost = weighted average of this ingredient's purchased batches only
SELECT
  food_name,
  SUM(quantity)                                   AS purchased_qty,
  unit,
  SUM(unit_cost * quantity) / SUM(quantity)       AS purchased_unit_cost,
  MIN(COALESCE(expiration_date, '9999-12-31'))    AS earliest_expiry,
  'purchased'                                     AS source
FROM purchased_ingredients
WHERE quantity > 0
  AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
GROUP BY food_name, unit;

-- Get target pax from a beneficiary request
SELECT population
FROM beneficiary_requests
WHERE id   = :request_id
  AND type = 'food';

-- Get target pax from a donation request
SELECT pax
FROM donation_requests
WHERE id = :request_id;
```
