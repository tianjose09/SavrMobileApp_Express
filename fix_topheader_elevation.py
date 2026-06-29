import os, re

BASE = r'c:\Users\All User\Documents\SAVRMobileApp\SAVR_frontend\screens'

files = [
    'FoodInventory/FoodInventory.tsx',
    'Requests/TrackMyRequest.tsx',
    'Donations/ServiceDonation.tsx',
    'Requests/CreateRequest.tsx',
    'Dashboards/BeneficiaryDashboard.tsx',
    'Donations/FinancialDonation.tsx',
    'Donations/FoodDonationDetails.tsx',
    'Dashboards/DonorDashboard.tsx',
    'Donations/ChooseDonation.tsx',
    'MealOptimization/IngrMealPlanning.tsx',
    'Recipes/RecipesList.tsx',
    'Donations/FoodDonationDelivery.tsx',
    'Dashboards/PkDashboard.tsx',
    'Dashboards/OrgDashboard.tsx',
]

fixed = []
for rel in files:
    path = os.path.join(BASE, rel.replace('/', os.sep))
    if not os.path.exists(path):
        print(f'MISSING: {rel}')
        continue
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove zIndex + elevation lines inside topHeader
    new_content = re.sub(r'\n\s+zIndex:\s*\d+,(?=\n\s+elevation:)', '', new_content := content)
    new_content = re.sub(r'\n\s+elevation:\s*\d+,', '', new_content)

    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        fixed.append(rel)
        print(f'Fixed: {rel}')
    else:
        print(f'No change: {rel}')

print(f'\nDone: {len(fixed)} files updated')
