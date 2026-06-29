"""
Add <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
right after the opening <> fragment tag in all green-header double-SAV screens.
"""
import os, re

BASE = r'c:\Users\All User\Documents\SAVRMobileApp\SAVR_frontend\screens'

GREEN_SCREENS = [
    'Dashboards/DonorDashboard.tsx',
    'Dashboards/OrgDashboard.tsx',
    'Dashboards/PkDashboard.tsx',
    'Dashboards/BeneficiaryDashboard.tsx',
    'Activities/Activities.tsx',
    'Activities/Notifications.tsx',
    'Activities/PartnerKitchenRecentActivities.tsx',
    'Activities/AchievementBadges.tsx',
]

STATUS_BAR_LINE = "      <StatusBar translucent backgroundColor=\"transparent\" barStyle=\"light-content\" />\n"

fixed = []

for rel in GREEN_SCREENS:
    path = os.path.join(BASE, rel.replace('/', os.sep))
    if not os.path.exists(path):
        print(f'MISSING: {rel}')
        continue
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if StatusBar JSX already added
    if 'barStyle="light-content"' in content or "barStyle='light-content'" in content:
        print(f'Already has StatusBar: {rel}')
        continue

    # Find the opening <> and insert StatusBar right after the first SafeAreaView (flex:0) line
    # Pattern: insert after the flex:0 SafeAreaView self-closing tag
    pattern = r"(<SafeAreaView\s[^/]*flex:\s*0[^\n]*/>\s*\n)"
    replacement = r"\1" + STATUS_BAR_LINE

    new_content = re.sub(pattern, replacement, content, count=1)

    if new_content == content:
        print(f'No match: {rel}')
        continue

    # Also ensure StatusBar is imported
    if 'StatusBar' not in content.split('from')[0] or 'StatusBar' not in content[:500]:
        # Add StatusBar to react-native import if missing
        new_content = re.sub(
            r"from 'react-native';",
            lambda m: m.group(0) if 'StatusBar' in content[:content.index("from 'react-native';")] else m.group(0).replace("from 'react-native';", "from 'react-native'; // StatusBar already imported"),
            new_content,
            count=1
        )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    fixed.append(rel)
    print(f'Fixed: {rel}')

print(f'\nTotal: {len(fixed)} files fixed')
