"""
Fix excessive top bar spacing:
1. Double-SAV screens: add edges prop to both SAVs, reduce header paddingTop to 10
2. Single-SAV screens: reduce header paddingTop to 10 (SAV handles the status bar)
"""
import re, os

BASE = r'c:\Users\All User\Documents\SAVRMobileApp\SAVR_frontend\screens'

# ─── Double-SAV screens (have flex:0 + flex:1 SafeAreaViews) ─────────────────
DOUBLE_SAV = [
    'Activities/Activities.tsx',
    'Activities/Notifications.tsx',
    'Activities/PartnerKitchenRecentActivities.tsx',
    'Activities/AchievementBadges.tsx',
    'Dashboards/DonorDashboard.tsx',
    'Dashboards/OrgDashboard.tsx',
    'Dashboards/PkDashboard.tsx',
    'Dashboards/BeneficiaryDashboard.tsx',
    'Donations/AllUpcomingPickups.tsx',
    'Donations/ChooseDonation.tsx',
    'MealOptimization/PrepareMeal.tsx',
    'MealOptimization/MealOptimizationResults.tsx',
    'MealOptimization/IngrMealPlanning.tsx',
    'Requests/CreateRequest.tsx',
]

# ─── Single-SAV screens with header paddingTop that needs fixing ──────────────
SINGLE_SAV = [
    'Donations/FinancialDonation.tsx',
    'Donations/FoodDonationDelivery.tsx',
    'Donations/FoodDonationDetails.tsx',
    'Donations/ServiceDonation.tsx',
    'FoodInventory/FoodInventory.tsx',
    'FoodInventory/AddFoodItem_Inventory.tsx',
    'MealOptimization/MealPreparationSummary.tsx',
    'Recipes/RecipesList.tsx',
    'Recipes/AddRecipe.tsx',
    'Requests/TrackMyRequest.tsx',
]

fixed = []

def fix_header_paddingTop(content):
    """Change paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : X  →  paddingTop: X"""
    # Matches both multiline and single-line versions
    pattern = r"paddingTop:\s*Platform\.OS\s*===\s*['\"]android['\"]\s*\?\s*\(StatusBar\.currentHeight\s*\?\?\s*0\)\s*\+\s*\d+\s*:\s*(\d+)"
    return re.sub(pattern, r'paddingTop: \1', content)

def add_edges_to_sav(content):
    """
    Add edges={['top']} to the first (flex:0) SafeAreaView
    Add edges={['bottom']} to the second (flex:1) SafeAreaView
    """
    # Add edges={['top']} to the flex:0 self-closing SAV
    # Pattern: <SafeAreaView style={{ flex: 0, ... }} />
    content = re.sub(
        r'(<SafeAreaView\s+style=\{\{[^}]*flex:\s*0[^}]*\}\})\s*/>',
        r"\1 edges={['top']} />",
        content
    )

    # Add edges={['bottom']} to the main (second) SafeAreaView
    # This is the <SafeAreaView style={styles.XXX}> or <SafeAreaView style={{ flex: 1, ...}}>
    # that does NOT already have edges prop
    # Strategy: replace any SafeAreaView opening tag that:
    #   - does NOT have flex: 0
    #   - does NOT already have edges=
    #   - has a closing > (not self-closing />)
    def add_bottom_edges(m):
        tag = m.group(0)
        if 'edges=' in tag:
            return tag
        if 'flex: 0' in tag or 'flex:0' in tag:
            return tag
        # Insert edges before the closing >
        return tag[:-1] + " edges={['bottom']}>"

    # Match SafeAreaView opening tags (not self-closing)
    content = re.sub(
        r'<SafeAreaView\s[^>]*[^/]>',
        add_bottom_edges,
        content
    )
    return content

for rel in DOUBLE_SAV:
    path = os.path.join(BASE, rel.replace('/', os.sep))
    if not os.path.exists(path):
        print('MISSING: ' + rel)
        continue
    with open(path, 'r', encoding='utf-8') as f:
        orig = f.read()
    c = orig
    c = add_edges_to_sav(c)
    c = fix_header_paddingTop(c)
    if c != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(c)
        fixed.append('[DOUBLE] ' + rel)
        print('Fixed (double): ' + rel)
    else:
        print('No change: ' + rel)

for rel in SINGLE_SAV:
    path = os.path.join(BASE, rel.replace('/', os.sep))
    if not os.path.exists(path):
        print('MISSING: ' + rel)
        continue
    with open(path, 'r', encoding='utf-8') as f:
        orig = f.read()
    c = orig
    c = fix_header_paddingTop(c)
    if c != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(c)
        fixed.append('[SINGLE] ' + rel)
        print('Fixed (single): ' + rel)
    else:
        print('No change: ' + rel)

print('\nTotal fixed: %d' % len(fixed))
for f in fixed:
    print(' -', f)
