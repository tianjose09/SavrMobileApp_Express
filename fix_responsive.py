import os, re

BASE = r'c:/Users/All User/Documents/SAVRMobileApp/SAVR_frontend'
SCREENS = os.path.join(BASE, 'screens')

# ─── Step 1: Create utils/responsive.ts ─────────────────────────────────────
responsive_ts = (
    "import { Dimensions, PixelRatio } from 'react-native';\n\n"
    "const { width: W, height: H } = Dimensions.get('window');\n\n"
    "const BASE_W = 390;\n"
    "const scale = Math.min(W / BASE_W, 1.3);\n\n"
    "export const wp = (pct: number) => W * pct / 100;\n"
    "export const hp = (pct: number) => H * pct / 100;\n"
    "export const rs = (size: number) =>\n"
    "  Math.round(PixelRatio.roundToNearestPixel(size * scale));\n\n"
    "export const SW = W;\n"
    "export const SH = H;\n\n"
    "/**\n"
    " * Minimum bottom clearance for screens that sit above the tab bar.\n"
    " * Tab bar (70) + Android gesture/button nav area (up to 50) + buffer (10).\n"
    " */\n"
    "export const TAB_BOTTOM_CLEAR = 130;\n"
)

utils_dir = os.path.join(BASE, 'utils')
os.makedirs(utils_dir, exist_ok=True)
with open(os.path.join(utils_dir, 'responsive.ts'), 'w', encoding='utf-8') as f:
    f.write(responsive_ts)
print("Created utils/responsive.ts")

# ─── Step 2: Switch SafeAreaView from react-native to react-native-safe-area-context ──
RN_SAV_RE = re.compile(
    r"(import\s*\{)([^}]*\bSafeAreaView\b[^}]*)(\}\s*from\s*'react-native')"
)
SAFI_IMPORT = "import { SafeAreaView } from 'react-native-safe-area-context';"

def switch_safearea(content):
    m = RN_SAV_RE.search(content)
    if not m:
        return content, False
    if 'react-native-safe-area-context' in content:
        return content, False
    names = [x.strip() for x in m.group(2).split(',') if x.strip() and x.strip() != 'SafeAreaView']
    if names:
        new_rn = m.group(1) + '\n  ' + ', '.join(names) + '\n' + m.group(3)
    else:
        new_rn = ''
    content = content[:m.start()] + new_rn + content[m.end():]
    content = content.replace("from 'react-native';", "from 'react-native';\n" + SAFI_IMPORT, 1)
    return content, True

switched = []
for root, dirs, files in os.walk(SCREENS):
    for fname in files:
        if not fname.endswith('.tsx'):
            continue
        path = os.path.join(root, fname)
        with open(path, 'r', encoding='utf-8') as f:
            c = f.read()
        new_c, changed = switch_safearea(c)
        if changed:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_c)
            rel = os.path.relpath(path, SCREENS).replace(os.sep, '/')
            switched.append(rel)

print("Switched SafeAreaView in %d files:" % len(switched))
for s in switched:
    print("  " + s)

# ─── Step 3: Boost scrollContent paddingBottom in tab-bar screens ────────────
TAB_SCREENS = [
    'Accounts/EditProfile.tsx', 'Accounts/Profile.tsx',
    'Activities/AchievementBadges.tsx', 'Activities/Activities.tsx',
    'Activities/Notifications.tsx', 'Activities/PartnerKitchenRecentActivities.tsx',
    'Dashboards/BeneficiaryDashboard.tsx', 'Dashboards/DonorDashboard.tsx',
    'Dashboards/OrgDashboard.tsx', 'Dashboards/PkDashboard.tsx',
    'Donations/AllUpcomingPickups.tsx', 'Donations/ChooseDonation.tsx',
    'Donations/FinancialDonation.tsx', 'Donations/FoodDonationDelivery.tsx',
    'Donations/FoodDonationDetails.tsx', 'Donations/FoodDonationPickup.tsx',
    'Donations/ServiceDonation.tsx',
    'FoodInventory/AddFoodItem_Inventory.tsx', 'FoodInventory/FoodInventory.tsx',
    'MealOptimization/IngrMealPlanning.tsx', 'MealOptimization/MealOptimizationResults.tsx',
    'MealOptimization/MealPreparationSummary.tsx', 'MealOptimization/PrepareMeal.tsx',
    'Recipes/AddRecipe.tsx', 'Recipes/RecipesList.tsx',
    'Requests/CreateRequest.tsx', 'Requests/TrackMyRequest.tsx',
]

MIN_BOTTOM = 130

def boost_scroll_padding(content):
    changed = False

    def replace_style_block(m):
        nonlocal changed
        block = m.group(0)
        def sub_pb(mb):
            nonlocal changed
            val = int(mb.group(1))
            if val < MIN_BOTTOM:
                changed = True
                return 'paddingBottom: %d' % MIN_BOTTOM
            return mb.group(0)
        return re.sub(r'paddingBottom:\s*(\d+)', sub_pb, block)

    content = re.sub(
        r'(scroll\w+|contentContainer\w*)\s*:\s*\{[^}]+\}',
        replace_style_block,
        content,
        flags=re.IGNORECASE | re.DOTALL
    )

    def fix_content_container_attr(m):
        nonlocal changed
        inner = m.group(1)
        def replace_inline(mb):
            nonlocal changed
            val = int(mb.group(1))
            if val < MIN_BOTTOM:
                changed = True
                return 'paddingBottom: %d' % MIN_BOTTOM
            return mb.group(0)
        new_inner = re.sub(r'paddingBottom:\s*(\d+)', replace_inline, inner)
        return 'contentContainerStyle={' + new_inner + '}'

    content = re.sub(
        r'contentContainerStyle=\{(\{[^}]+\})\}',
        fix_content_container_attr,
        content
    )
    return content, changed

pb_updated = []
for rel in TAB_SCREENS:
    path = os.path.join(SCREENS, rel.replace('/', os.sep))
    if not os.path.exists(path):
        continue
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    new_c, changed = boost_scroll_padding(c)
    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_c)
        pb_updated.append(rel)

print("Boosted scrollContent paddingBottom in %d files:" % len(pb_updated))
for p in pb_updated:
    print("  " + p)

# ─── Step 4: Fix inline height-only spacer Views ─────────────────────────────
def fix_spacers(content):
    changed = False
    def sub(m):
        nonlocal changed
        val = int(m.group(1))
        if val < MIN_BOTTOM:
            changed = True
            return '{ height: %d }' % MIN_BOTTOM
        return m.group(0)
    new_c = re.sub(r'\{\s*height:\s*(\d+)\s*\}(?=\s*/?>)', sub, content)
    return new_c, changed

spacer_updated = []
for rel in TAB_SCREENS:
    path = os.path.join(SCREENS, rel.replace('/', os.sep))
    if not os.path.exists(path):
        continue
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    new_c, changed = fix_spacers(c)
    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_c)
        spacer_updated.append(rel)

print("Fixed inline spacers in %d files:" % len(spacer_updated))
for p in spacer_updated:
    print("  " + p)

print("Done!")
