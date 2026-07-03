# Meal Optimization Algorithm — Complete Explainer
**SAVR Mobile App · mealController.js**

---

## Table of Contents
1. [What the System Does](#1-what-the-system-does)
2. [The Two Modes](#2-the-two-modes)
3. [Shared Foundation — How Ingredients Are Matched](#3-shared-foundation--how-ingredients-are-matched)
4. [Shared Foundation — Unit Normalization](#4-shared-foundation--unit-normalization)
5. [Recipe Mode — Full Walkthrough](#5-recipe-mode--full-walkthrough)
6. [Any Available Meal Mode — Full Walkthrough](#6-any-available-meal-mode--full-walkthrough)
7. [Side-by-Side Comparison](#7-side-by-side-comparison)
8. [Score Breakdown with a Worked Example](#8-score-breakdown-with-a-worked-example)
9. [Tie-Breaking Logic](#9-tie-breaking-logic)
10. [Output and What the App Shows](#10-output-and-what-the-app-shows)
11. [Design Decisions You Can Defend](#11-design-decisions-you-can-defend)
12. [Likely Panel Questions and Answers](#12-likely-panel-questions-and-answers)

---

## 1. What the System Does

The Meal Optimization feature answers one question: **"Given what we have in our food inventory right now, which meal should we prepare — and for how many servings?"**

It is not a recommendation based on popularity or nutrition. It is a **resource-allocation optimizer** that:
- Matches donated ingredients to known meal recipes
- Computes how many servings each meal can produce
- Scores and ranks meals based on urgency (expiry) and capacity
- Tells staff what to cook first so food waste is minimized and the most people are served

The system runs entirely on the **backend (Node.js + PostgreSQL)**. The frontend sends the request and displays results.

---

## 2. The Two Modes

| | Recipe Mode | Any Available Meal Mode |
|---|---|---|
| **Who selects ingredients?** | Staff manually picks from inventory list | Backend pulls from the database automatically |
| **What meal is being planned?** | A specific meal request (staff knows what to cook) | Unknown — system finds the best option |
| **Partial matches allowed?** | Yes — a meal can appear even with missing ingredients | No — 100% of required ingredients must be present |
| **Scoring goal** | Maximize servings for the target pax; penalize expiry waste | Maximize waste reduction (expiry urgency); verify serving coverage |
| **Output** | Ranked list of ALL meals, full and partial matches | Top 3 fully-feasible meals only |
| **Used when** | Staff has a specific meal in mind | Staff has no plan and wants the system to decide |

---

## 3. Shared Foundation — How Ingredients Are Matched

Both modes use the same ingredient-matching logic. Each recipe in the database has a list of ingredients with names. The system needs to match those recipe ingredient names to what is actually in the inventory.

### Step 1 — Exact match
```
recipe ingredient: "chicken"
inventory item:    "chicken"
→ direct match ✓
```

### Step 2 — Substring match
```
recipe ingredient: "canned tuna"
inventory item:    "tuna"
→ "canned tuna".includes("tuna") → match ✓
```

### Step 3 — Descriptor stripping + main noun match
Descriptors like `canned`, `fresh`, `dried`, `frozen`, `ground`, `sliced`, etc. are stripped. Only the **main noun** (rightmost meaningful word) is compared. This prevents false positives.

```
recipe ingredient: "canned sardines"   → main noun: "sardines"
inventory item:    "fresh sardines"    → main noun: "sardines"
→ match ✓

recipe ingredient: "canned tuna"       → main noun: "tuna"
inventory item:    "canned sardines"   → main noun: "sardines"
→ "tuna" ≠ "sardines" → no match ✓ (correctly rejected)
```

### Plural/Singular Handling (frontend)
The frontend display also applies **plural-to-singular normalization** so that inventory items like "Eggs" correctly highlight the recipe ingredient "egg":
```
"eggs" → strip trailing 's' → "egg"
check each comma-separated recipe token: "egg" === "egg" → match ✓

"bags" → strip trailing 's' → "bag"
check tokens: "bagel" ≠ "bag" and "bagel" does not start with "bag " → no match ✓
```
The token-level check (not substring) prevents false positives.

### Optional vs. Required Ingredients
Each recipe ingredient has an `is_optional` flag. In Any Available Meal mode, only missing **required** ingredients disqualify a meal. Missing optional ingredients are ignored.

---

## 4. Shared Foundation — Unit Normalization

Recipes store quantities in grams or millilitres (`g`, `ml`). Inventory stores in kilograms, litres, or pieces (`kg`, `L`, `pcs`). Before any math, **everything is converted to a base unit** (kg or L):

| Input unit | Conversion | Result |
|---|---|---|
| `g` | ÷ 1000 | `kg` |
| `ml` | ÷ 1000 | `L` |
| `tsp` | × 0.005 | `L` |
| `tbsp` | × 0.015 | `L` |
| `pcs` | × 400 ÷ 1000 | `kg` (1 piece ≈ 400g) |
| `kg` / `L` | no change | already base |

**Why this matters:** Without normalization, comparing "150g of rice" against "48 kg in inventory" is impossible. After normalization: 0.15 kg needed vs. 48 kg available → 320 servings possible.

---

## 5. Recipe Mode — Full Walkthrough

### Input
- `target_pax` — how many servings are needed (e.g., 100)
- `selected_ingredients` — the ingredients staff picked from the inventory UI, with quantities and expiry dates

### Step 1 — Match ingredients
For each meal in the database, the system finds which selected ingredients match the recipe (using the logic in Section 3).

### Step 2 — Identify major ingredients
Not all ingredients are equal. **Major ingredients** are bulk items that actually determine how many servings you can make — proteins, carbs, legumes, dairy, main vegetables:

```
Major: rice, chicken, pork, beef, fish, egg, tuna, sardine, macaroni,
       noodle, bread, mung, milk, cabbage, carrot, potato, kamote...

Minor (never limits servings): water, salt, oil, garlic, onion,
                                cornstarch, fish sauce, soy sauce...
```

Minor ingredients are skipped when computing serving capacity — you would never say "we can only make 5 servings because we only have 10g of salt."

### Step 3 — Compute max servings
For each **major** matched ingredient:
```
servingCap = floor(available_qty_in_base / qty_per_serving_in_base)
```
The meal's `maxServings = min(all serving caps, targetPax)`.
It is capped at `targetPax` because making more than requested is irrelevant.

**Example:**
- Rice: 48 kg available, 0.15 kg/serving → floor(48 / 0.15) = 320
- Chicken: 5 kg available, 0.10 kg/serving → floor(5 / 0.10) = 50
- maxServings = min(320, 50, 100) = **50** (chicken is the bottleneck; target is 100)

### Step 4 — Compute scores

#### Pax Score (70% weight)
Measures how close the meal gets to the requested serving count:
```
paxScore = maxServings / targetPax        (range: 0.0 – 1.0)
```
Example: 50 servings out of 100 requested → paxScore = 0.50

#### Expiry Score (30% weight)
Uses the **soonest expiring** major ingredient's days-to-expiry:
```
expiryScore = max(0, 1 - minDays / 90)   (range: 0.0 – 1.0)
```
| Days remaining | expiryScore |
|---|---|
| 0 days | 1.00 (maximum urgency) |
| 7 days | 0.92 |
| 14 days | 0.84 |
| 30 days | 0.67 |
| 90+ days | 0.00 (no urgency) |

#### Final Score
```
finalScore = 0.70 × paxScore + 0.30 × expiryScore
```
The 70/30 split deliberately prioritizes **feeding more people** over expiry urgency. A meal that feeds 100 out of 100 requested will almost always beat a meal that feeds 20 but uses expiring ingredients.

### Step 5 — Sort and output
- Full-match meals (no missing required ingredients) always rank above partial matches
- Within each group, sorted by `finalScore` descending
- Output shows all meals — both full and partial — so staff can see the whole picture

---

## 6. Any Available Meal Mode — Full Walkthrough

### Input
- `target_pax` — how many servings are needed
- No ingredient list from the frontend — the backend pulls directly from the database

### Step 1 — Pull live inventory from the database
```sql
SELECT food_name, quantity, unit, expiration_date
FROM food_inventory
WHERE quantity > 0
  AND meal_type IS DISTINCT FROM 'Prep Meal'
  AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
ORDER BY food_name
```

**Three exclusion rules:**
1. `quantity > 0` — zero-stock items cannot contribute
2. `meal_type IS DISTINCT FROM 'Prep Meal'` — items that are themselves prepared meals (not raw ingredients) are excluded
3. `expiration_date >= CURRENT_DATE` — already-expired items are excluded

**Multiple batches of the same item** (e.g., two separate entries of "chicken") are combined: quantities are summed and the **earliest expiry date** is kept (conservative/safe approach).

### Step 2 — Hard filter: 100% required ingredient coverage
Every **required** ingredient in the recipe must be present in the inventory. If even one required ingredient is missing, the meal is **completely disqualified**.

This is the most important design decision in this mode. Unlike Recipe Mode which shows partial matches, Any Available Meal Mode only presents meals that can actually be made right now. Showing a meal with a missing ingredient would mislead staff.

```
Recipe: chicken, rice, soy sauce (optional), garlic (optional)
Inventory has: chicken ✓, rice ✓ — soy sauce and garlic are optional
→ PASSES the hard filter ✓

Recipe: beef, potato, carrot, tomato
Inventory has: beef ✓, potato ✓, carrot ✓ — but NO tomato
→ FAILS the hard filter — meal is rejected
```

### Step 3 — Compute possible servings
Same formula as Recipe Mode, but applied to **all required ingredients** (not just major ones):
```
for each required ingredient:
    servingCap = floor(available_qty_in_base / qty_per_serving_in_base)

possibleServings = min(all serving caps)
```
If `possibleServings = 0`, the meal is rejected (can't make even one serving).

### Step 4 — Compute the three component scores

#### Expiry Score (50% of final score)
Computed per ingredient using a **tiered table** (not a continuous formula):

| Days remaining | Tier Score |
|---|---|
| 0–1 days | **100** — critical, prepare today |
| 2–3 days | **90** — very high urgency |
| 4–5 days | **75** — high urgency |
| 6–7 days | **60** — moderate-high urgency |
| 8–14 days | **40** — moderate urgency |
| > 14 days or no expiry | **20** — low urgency |

The ingredient's tier score is looked up and **averaged across all required ingredients**:
```
expiryScore = average(tierScore for each required ingredient)
```
**Why average, not minimum?**  
Using the minimum would cause a single non-perishable ingredient (score 20) to drag down the whole meal even if everything else expires tomorrow. The average gives a fair picture of the meal's overall expiry urgency.

#### Availability Score (30% of final score)
Fixed at **100** for all qualifying meals. Because of the hard filter in Step 2, every meal that reaches scoring has 100% of its required ingredients present. This constant is kept in the formula to make the weight structure explicit and consistent.

#### Serving Capacity Score (20% of final score)
Measures how well the available inventory covers the requested number of servings:
```
servingCapScore = min((possibleServings / targetPax) × 100, 100)
```
**Why capped at 100?**  
If you need 50 servings and can make 80, the extra 30 servings worth of inventory is a bonus — but it doesn't make the meal any "better" for the current request. Without the cap, a meal with 200% coverage would score inflated points and unfairly outrank a meal with 100% coverage and more urgent expiry.

**Example:**
- targetPax = 100
- possibleServings = 80
- servingCapScore = min((80/100) × 100, 100) = min(80, 100) = **80**

- targetPax = 100  
- possibleServings = 150
- servingCapScore = min((150/100) × 100, 100) = min(150, 100) = **100** (capped)

#### Final Score
```
finalScore = 0.50 × expiryScore + 0.30 × availabilityScore + 0.20 × servingCapScore
```

**Why different weights from Recipe Mode?**  
In Any Available Meal Mode, the goal shifts from "feed as many people as possible" to "**use what expires soonest before it's wasted**." The availability score is always 100 (by definition), so the real competition between meals is expiry urgency (50%) versus serving coverage (20%). Staff uses this mode precisely when they don't have a fixed meal in mind — expiry reduction becomes the primary optimization objective.

### Step 5 — Tie-breaking (four levels)
If two meals have identical final scores, they are ranked by:

1. **Earliest expiring ingredient first** (ascending `minDays`)  
   → Prioritize the meal whose ingredients expire soonest
2. **More possible servings first** (descending `possibleServings`)  
   → Between tied expiry urgencies, feed more people
3. **More near-expiry ingredients first** (descending count of ingredients with ≤ 14 days)  
   → Prefer meals that use the most at-risk items in one preparation
4. **Fewer required ingredients first** (ascending `requiredIngredientCount`)  
   → Simpler meals are easier and faster to prepare

### Step 6 — Output top 3
`plans.slice(0, 3)` — exactly the top 3 distinct meals after sorting. Each meal appears only once. The backend also generates:

- **Recommendation Reason** — two sentences explaining why expiry makes this urgent and how well inventory covers the request
- **Score Breakdown** — `expiry_score`, `availability_score`, `serving_capacity_score`, `final_score` displayed on the result cards
- **recipe_ingredients** — per-ingredient `qty_per_serving` so the app can compute exact deduction amounts when preparation is marked done

---

## 7. Side-by-Side Comparison

| Aspect | Recipe Mode | Any Available Meal Mode |
|---|---|---|
| **Ingredient source** | Frontend (staff selection) | PostgreSQL `food_inventory` table |
| **Partial matches** | Shown (with missing items listed) | Never shown — hard 100% filter |
| **Serving limit** | Capped at `targetPax` | Uncapped (shown for ranking) |
| **Expiry formula** | Continuous: `1 - minDays/90` | Tiered: 0–1d=100, 2–3d=90... |
| **Expiry applied to** | Soonest expiring major ingredient | Average across ALL required ingredients |
| **Weight: serving coverage** | 70% | 20% |
| **Weight: expiry urgency** | 30% | 50% |
| **Weight: availability** | N/A | 30% (always 100) |
| **Output count** | All meals | Top 3 only |
| **Ranking sort** | Full matches first, then by finalScore | By finalScore, then 4-level tie-break |
| **Deductions on prep** | Uses manually entered `inputQty` | Uses `targetPax × qty_per_serving` |

---

## 8. Score Breakdown with a Worked Example

**Scenario:** Any Available Meal Mode, targetPax = 100

**Inventory (after merging batches):**
- Chicken: 8 kg, expires in 2 days
- Rice: 20 kg, expires in 30 days

**Meal: Chicken Adobo** (required ingredients: chicken 0.10 kg/serving, rice 0.15 kg/serving)

**Step 1 — Hard filter:**
- Chicken: ✓ present
- Rice: ✓ present
→ Passes

**Step 2 — Possible servings:**
- Chicken: floor(8 / 0.10) = 80 servings
- Rice: floor(20 / 0.15) = 133 servings
- possibleServings = min(80, 133) = **80**

**Step 3 — Expiry score:**
- Chicken: 2 days → tier score = 90
- Rice: 30 days → tier score = 20
- expiryScore = (90 + 20) / 2 = **55.0**

**Step 4 — Serving capacity score:**
- servingCapScore = min((80/100) × 100, 100) = **80.0**

**Step 5 — Availability score: 100** (hard filter passed)

**Step 6 — Final score:**
```
finalScore = 0.50 × 55.0 + 0.30 × 100 + 0.20 × 80.0
           = 27.5 + 30.0 + 16.0
           = 73.5
```

**Recommendation reason generated:**  
*"Ingredients are expiring within 3 days, making this a high-priority meal to avoid spoilage. Current inventory supports 80 out of 100 requested servings (80% capacity)."*

---

## 9. Tie-Breaking Logic

Tie-breaking is only invoked when `finalScore` values are exactly equal (after rounding to 1 decimal). The four levels resolve ties deterministically:

```
Level 1: Earliest expiring ingredient (ascending minDays)
         → "Which meal uses the most urgent ingredient?"

Level 2: More possible servings (descending possibleServings)
         → "Between tied urgency, which feeds more people?"

Level 3: More near-expiry ingredients (descending count ≤ 14 days)
         → "Which meal uses the most at-risk items in one batch?"

Level 4: Fewer required ingredients (ascending count)
         → "Which meal is simpler to prepare right now?"
```

In practice, exact ties are rare after the 50/30/20 scoring because different expiry tiers and serving caps produce distinct decimals. The tie-break exists as a safety net for deterministic output.

---

## 10. Output and What the App Shows

### Recipe Mode output per meal:
- Meal name, rank number, tags
- `servings` — max servings possible (capped at targetPax)
- `status` — "Optimal Output" for rank 1
- `ingredients_used` — matched ingredient names
- `missing_items` — names of unmatched required ingredients (if any)
- `comment_desc` — meal description from the database

### Any Available Meal output per meal:
- Meal name, rank number (#1 / #2 / #3), tags
- `servings` — possible servings (shown for ranking context only)
- `status` — "Top Priority" / "Priority #2" / "Priority #3"
- `expiry_score`, `availability_score`, `serving_capacity_score`, `final_score`
- `comment_title` — "Recommendation Reason:"
- `comment_desc` — generated two-sentence reason
- `recipe_ingredients` — array of `{ name, qty_per_serving, unit }` for deduction math

### What happens after "Prepare This Meal":
- **Recipe Mode:** each ingredient is deducted by the quantity the staff manually entered in the selection UI
- **Any Available Meal Mode:** each ingredient is deducted by `targetPax × qty_per_serving` (from `recipe_ingredients`), capped at the actual available quantity if `targetPax > possibleServings`
- Deductions execute when staff marks the meal as **Done** in the PrepareMeal screen, not at button press
- The associated meal request is marked **Done** and removed from the dashboard

---

## 11. Design Decisions You Can Defend

### "Why 70/30 in Recipe Mode?"
Recipe Mode is used when staff has a specific meal request to fulfill — a beneficiary asked for 100 servings of Chicken Adobo. The primary objective is to serve that number of people. Expiry is secondary. The 70/30 split reflects that priority.

### "Why 50/30/20 in Any Available Meal Mode?"
When staff has no predetermined meal, the system's job is to prevent food waste first. The most time-critical decision is which ingredients are about to expire. The 50% weight on expiry reflects this. Availability is always 100% (by the hard filter), so it acts as a constant baseline. Serving coverage (20%) still matters but is subordinate to waste reduction.

### "Why a hard filter in Any Available Meal Mode?"
Showing a meal with a missing required ingredient would be misleading — staff would start preparation and then discover they can't finish it. The hard filter guarantees that every meal on the list is actually producible with current stock. This is a reliability guarantee, not a limitation.

### "Why an average for expiry score instead of the worst ingredient?"
Using the minimum (worst ingredient) would allow one non-perishable item (score 20) to suppress a meal where everything else expires tomorrow. The average reflects the **overall urgency profile** of the meal. A meal with 5 critical ingredients and 1 stable one should score higher than a meal with 1 critical ingredient.

### "Why cap serving capacity at 100?"
The serving capacity score measures how well inventory serves the current request, not total inventory volume. Having 200 servings when you need 100 gives zero additional benefit for this particular task. The cap prevents over-supplied meals from unfairly outscoring meals that meet the request exactly but have more urgent expiry.

### "Why use a tiered table for expiry in Any Available Meal Mode?"
A continuous formula (`1 - days/90`) produces very small score differences between ingredients expiring in, say, 3 vs. 5 days — both are urgent. The tiered approach groups similar urgency levels together and creates meaningful, defensible bands. Staff can understand "this ingredient is in the 2–3 day tier" more intuitively than "expiry score 0.967."

### "Why only the top 3 in Any Available Meal Mode?"
Decision fatigue. Presenting more options in a mode that's specifically designed to reduce decision-making for staff defeats the purpose. The top 3 provides a primary recommendation plus two alternatives, which is the standard best practice in recommendation UX.

---

## 12. Likely Panel Questions and Answers

**Q: What algorithm category is this?**  
A: It is a **greedy, rule-based scoring algorithm** — not machine learning. For each candidate meal, it computes a score using a fixed weighted formula and ranks by that score. This makes it transparent, auditable, and predictable — critical for a food aid system where staff need to trust and understand the recommendation.

**Q: Why not use machine learning?**  
A: The system operates on small, structured data (< 50 meals, < 200 inventory items per run). ML would require historical training data that doesn't exist, would be a black box to staff, and would add unnecessary complexity. The rule-based approach is explainable: you can point to each component score and say exactly why a meal ranked where it did.

**Q: How does it handle expiry when there's no expiry date?**  
A: Items with no expiry date (non-perishables like canned goods, dried beans) receive the lowest urgency tier score of 20. They are still included in the optimization and can still match meals, but they don't create urgency pressure in the ranking.

**Q: What if two meals use the same ingredient?**  
A: Each meal is scored independently. The algorithm does not account for cross-meal resource competition — if both Chicken Adobo and Chicken Sopas use the same 5 kg of chicken, whichever ranks #1 gets first access. In practice, staff prepares one meal per session.

**Q: What happens if no meal qualifies in Any Available Meal Mode?**  
A: The system returns an empty list and the app shows a "no meals available" message. This can happen if the inventory has no complete set of required ingredients for any meal in the database.

**Q: What is FEFO?**  
A: First Expired, First Out — the principle that the item expiring soonest should be used first. Both modes implement FEFO at different levels: Recipe Mode uses the soonest expiry date for the expiry score; Any Available Meal Mode uses tiered expiry scores averaged across all required ingredients and tie-breaks on the soonest expiry date.

**Q: Why does the serving count in Any Available Meal Mode appear on the card but the actual deduction uses targetPax?**  
A: The possible servings figure is a **ranking signal** — it tells staff how much of the request this meal can cover. But when they actually start preparing, they deduct based on the number of people they are cooking for (targetPax), not the theoretical maximum the inventory could support. If targetPax exceeds possible servings, the system caps the deduction at what's available and notifies staff of the shortage.

**Q: Can the same meal appear more than once in the top 3?**  
A: No. The `plans` array in the backend contains at most one entry per meal (each meal is processed once through the loop). `plans.slice(0, 3)` therefore always returns 3 distinct meals.

**Q: What are the 5 system meals?**  
A: Lugaw (ID 1), Chicken Adobo (ID 4), Sardines with Vegetables (ID 12), Egg Sandwich Filling (ID 35), and Fried Chicken (ID 37). User-created recipes are also included alongside these.

---

*Document generated from the live codebase — mealController.js, last updated July 2026.*
