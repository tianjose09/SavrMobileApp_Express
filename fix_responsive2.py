"""
Pass 2: Fix remaining gaps
- Screens still missing adequate bottom scroll clearance (no named scrollContent style)
- Add paddingBottom spacer Views where missing
- Fix double SafeAreaView pattern to properly use react-native-safe-area-context edges
"""
import os, re

BASE = r'c:/Users/All User/Documents/SAVRMobileApp/SAVR_frontend'
SCREENS = os.path.join(BASE, 'screens')
MIN = 130

# Screens where content can be cut off by the tab bar and
# didn't get a scrollContent style fix in pass 1
REMAINING = [
    'Activities/AchievementBadges.tsx',
    'Dashboards/BeneficiaryDashboard.tsx',
    'Dashboards/PkDashboard.tsx',
    'Donations/ChooseDonation.tsx',
    'Donations/FoodDonationDetails.tsx',
    'FoodInventory/AddFoodItem_Inventory.tsx',
    'FoodInventory/FoodInventory.tsx',
    'MealOptimization/IngrMealPlanning.tsx',
    'MealOptimization/MealOptimizationResults.tsx',
    'MealOptimization/MealPreparationSummary.tsx',
    'MealOptimization/PrepareMeal.tsx',
    'Recipes/RecipesList.tsx',
    'Requests/CreateRequest.tsx',
    'Requests/TrackMyRequest.tsx',
    'Accounts/EditProfile.tsx',
    'Accounts/Profile.tsx',
]

fixed = []

for rel in REMAINING:
    path = os.path.join(SCREENS, rel.replace('/', os.sep))
    if not os.path.exists(path):
        continue
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    orig = c

    # ── A: Any named style with paddingBottom < MIN ──────────────────────────
    # Matches style objects in StyleSheet.create() blocks
    def bump(m):
        val = int(m.group(1))
        if val < MIN:
            return 'paddingBottom: %d' % MIN
        return m.group(0)

    # General style block that contains paddingBottom
    def fix_style_block(m):
        block = m.group(0)
        new_block = re.sub(r'paddingBottom:\s*(\d+)', bump, block)
        return new_block

    # Only fix style blocks that are named *content* / *scroll* / *wrapper* / *container*
    c = re.sub(
        r'(content|scroll|wrapper|container|main|body)\w*\s*:\s*\{[^}]{0,400}paddingBottom:\s*\d+[^}]{0,400}\}',
        fix_style_block,
        c,
        flags=re.IGNORECASE | re.DOTALL
    )

    # ── B: Inline spacer <View style={{ height: X }} /> or <View style={{height:X}}/> ──
    def bump_spacer(m):
        val = int(m.group(1))
        if val < MIN:
            return '{ height: %d }' % MIN
        return m.group(0)
    c = re.sub(r'\{\s*height:\s*(\d+)\s*\}(?=\s*/?>)', bump_spacer, c)

    # ── C: contentContainerStyle inline that has paddingBottom ───────────────
    def fix_ccs(m):
        inner = m.group(1)
        new_inner = re.sub(r'paddingBottom:\s*(\d+)', bump, inner)
        return 'contentContainerStyle={' + new_inner + '}'
    c = re.sub(r'contentContainerStyle=\{(\{[^}]+\})\}', fix_ccs, c)

    if c != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(c)
        fixed.append(rel)
        print("Fixed: " + rel)

# ── Fix double SafeAreaView pattern → use edges prop ─────────────────────────
# Old: <SafeAreaView style={{ flex: 0, backgroundColor: 'X' }} />
# Old: <SafeAreaView style={styles.container}>
# New: keep as-is but the react-native-safe-area-context handles it correctly;
#      just add edges={['top']} to the header one and edges={['bottom']} to footer
# This is too complex to do via regex without risking breaks, so skip.

# ── Remove stale fix_responsive.py script ────────────────────────────────────
script = os.path.join(os.path.dirname(BASE), 'fix_responsive.py')
if os.path.exists(script):
    os.remove(script)

script2 = r'c:/Users/All User/Documents/SAVRMobileApp/fix_responsive2.py'
# Don't remove self

print("Pass 2 fixed %d files." % len(fixed))
