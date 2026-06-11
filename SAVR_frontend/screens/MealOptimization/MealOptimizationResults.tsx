import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import { MealPrepService } from '../../services/mealPrepService';


const isMatch = (selectedName: string, ingText: string): boolean => {
  if (ingText.includes(selectedName)) return true;
  const words = selectedName.split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return false;
  // Anchor on the rightmost word (main noun) so "brown rice" never matches "brown sugar"
  const mainNoun = words[words.length - 1];
  return ingText.includes(mainNoun);
};

// Serving size per person in the ingredient's own unit
const SERVING_MAP: Record<string, number> = {
  rice: 0.15,       // 150g per pax
  chicken: 0.1,     // 100g per pax
  beef: 0.1,
  pork: 0.1,
  fish: 0.1,
  meat: 0.1,
  milk: 0.2,        // 200ml per pax
  mango: 0.1,
  banana: 0.15,
  carrot: 0.08,
  carrots: 0.08,
  cabbage: 0.08,
  potato: 0.1,
  potatoes: 0.1,
  eggplant: 0.1,
  vegetables: 0.08,
  bread: 1,         // 1 pc per pax
  egg: 1,
  eggs: 1,
};

// Calculate pax from a list of ingredients (varies based on meal complexity)
const calculatePaxCapacity = (ingredients: any[], meal: any): number => {
  if (!ingredients || ingredients.length === 0) return 0;

  const capacities: number[] = [];

  ingredients.forEach(ing => {
    const qty = parseFloat(ing.inputQty) || 0;
    if (qty <= 0) return;
    const name = (ing.name || '').toLowerCase();
    const unit = (ing.unit || '').toLowerCase();

    let servingSize = 0;
    for (const [key, val] of Object.entries(SERVING_MAP)) {
      if (name.includes(key)) { servingSize = val; break; }
    }

    if (servingSize === 0) {
      if (unit === 'pcs') servingSize = 1;
      else if (unit === 'l' || unit === 'liter' || unit === 'liters') servingSize = 0.2;
      else servingSize = 0.15;
    }

    let effectiveQty = qty;
    if (unit === 'g' || unit === 'ml') {
      effectiveQty = qty / 1000;
    }

    capacities.push(effectiveQty / servingSize);
  });

  if (capacities.length === 0) return 0;

  const bottleneckCapacity = Math.min(...capacities);

  // Scale down the capacity slightly based on how complex the meal is 
  // (if it requires many other ingredients we don't have, the real capacity is effectively lower).
  const complexity = (meal.ingredients_used || '').split(',').length || 1;
  const matchedCount = ingredients.length;
  const scalingFactor = 1 + (Math.max(0, complexity - matchedCount) * 0.15);

  const finalPax = Math.floor(bottleneckCapacity / scalingFactor);
  return finalPax > 0 ? finalPax : 5;
};

export default function MealOptimizationResults({ route, navigation }: any) {
  // Destructure passed params with fallbacks securely
  const selectedCount = route.params?.selectedCount || 0;
  const parsedPax = parseInt(route.params?.targetPax) || 0;
  const selectedIds = route.params?.selectedIds || [];
  const selectedIngredients = route.params?.selectedIngredients || [];

  const [isLoading, setIsLoading] = useState(true);
  const [fullMatchMeals, setFullMatchMeals] = useState<any[]>([]);
  const [suggestedMeals, setSuggestedMeals] = useState<any[]>([]);

  useEffect(() => {
    fetchOptimizedMeals();
  }, []);

  // Helper: does selectedName appear in the recipe ingredient text?
  // (isMatch, SERVING_MAP, calculatePaxCapacity now live at module level)

  const fetchOptimizedMeals = async () => {
    setIsLoading(true);
    try {

      const res = await ApiService.optimizeMeals({
        target_pax: parsedPax,
        ingredient_ids: selectedIds,
        selected_ingredients: selectedIngredients,
      });

      if (res.data && res.data.success) {
        const all = res.data.meals || [];
        setFullMatchMeals(all.filter((m: any) => m.isFullMatch));
        setSuggestedMeals(all.filter((m: any) => !m.isFullMatch));
      } else {
        throw new Error('Fallback logic');
      }
    } catch (e) {
      console.log('Backend optimization script pending. Applying client-side matching...');

      // All known recipes as fallback
      const allMockMeals = [
        {
          id: 'rank_1',
          name: 'Lugaw',
          rankDisplay: '#1 Best',
          isTop: true,
          tags: ['Recommended', 'High Pax'],
          servings: '—',
          status: 'Optimal Output',
          ingredients_used: 'Rice, Water or broth, Garlic, Onion, Ginger, Chicken (optional), Fish sauce or salt, Pepper, Oil',
          comment_title: 'Why this meal ranks first:',
          comment_desc: 'Lugaw is highly scalable and uses minimal ingredients, making it ideal for serving the largest number of people with available donations.'
        },
        {
          id: 'rank_2',
          name: 'Steamed Rice',
          rankDisplay: '#2',
          isTop: false,
          tags: ['Simple', 'High Volume'],
          servings: '—',
          status: '',
          ingredients_used: 'Rice, Water',
          comment_title: '',
          comment_desc: 'Requires only two ingredients. Best used as a base paired with other dishes.'
        },
        {
          id: 'rank_3',
          name: 'Arroz Caldo',
          rankDisplay: '#3',
          isTop: false,
          tags: ['Nutritious', 'Comforting'],
          servings: '—',
          status: '',
          ingredients_used: 'Rice, Chicken, Ginger, Garlic, Onion, Fish sauce, Water or broth, Boiled eggs (optional), Spring onions (optional)',
          comment_title: '',
          comment_desc: 'A hearty rice porridge ideal for large groups, especially during cold weather or relief operations.'
        },
        {
          id: 'rank_4',
          name: 'Chicken Adobo',
          rankDisplay: '#4',
          isTop: false,
          tags: ['Protein Rich', 'Feasible'],
          servings: '—',
          status: '',
          ingredients_used: 'Chicken, Soy sauce, Vinegar, Water, Garlic, Bay leaves, Peppercorn, Oil',
          comment_title: '',
          comment_desc: 'A Filipino staple that keeps well and pairs with steamed rice for a complete meal.'
        },
        {
          id: 'rank_5',
          name: 'Tinola',
          rankDisplay: '#5',
          isTop: false,
          tags: ['Nutritious', 'Protein Rich'],
          servings: '—',
          status: '',
          ingredients_used: 'Chicken, Green papaya or sayote, Malunggay or chili leaves, Ginger, Garlic, Onion, Fish sauce, Water',
          comment_title: '',
          comment_desc: 'A light and nutritious soup well-suited for beneficiaries who need a healthy, balanced meal.'
        },
        {
          id: 'rank_6',
          name: 'Nilagang Manok',
          rankDisplay: '#6',
          isTop: false,
          tags: ['Nutritious', 'Filling'],
          servings: '—',
          status: '',
          ingredients_used: 'Chicken, Potatoes, Cabbage, Corn (optional), Onion, Peppercorn, Fish sauce or salt, Water',
          comment_title: '',
          comment_desc: 'A boiled chicken dish rich in vegetables, providing a complete and filling meal for large groups.'
        },
        {
          id: 'rank_7',
          name: 'Ginisang Gulay',
          rankDisplay: '#7',
          isTop: false,
          tags: ['Vegetable Rich', 'Budget-Friendly'],
          servings: '—',
          status: '',
          ingredients_used: 'Mixed vegetables (cabbage, carrots, beans, etc.), Garlic, Onion, Oil, Soy sauce or fish sauce',
          comment_title: '',
          comment_desc: 'A simple sautéed vegetable dish that maximizes vegetable donations efficiently.'
        },
        {
          id: 'rank_8',
          name: 'Chop Suey',
          rankDisplay: '#8',
          isTop: false,
          tags: ['Vegetable Rich', 'Flexible'],
          servings: '—',
          status: '',
          ingredients_used: 'Mixed vegetables (cabbage, carrots, cauliflower, beans), Chicken or pork (optional), Garlic, Onion, Soy sauce, Oyster sauce (optional), Cornstarch (optional), Oil',
          comment_title: '',
          comment_desc: 'A versatile stir-fry that can use a wide variety of available donated vegetables.'
        },
        {
          id: 'rank_9',
          name: 'Munggo Guisado',
          rankDisplay: '#9',
          isTop: false,
          tags: ['High Protein', 'Nutritious'],
          servings: '—',
          status: '',
          ingredients_used: 'Mung beans, Garlic, Onion, Tomatoes, Malunggay leaves or spinach, Pork (optional), Fish sauce or salt, Water, Oil',
          comment_title: '',
          comment_desc: 'Mung bean stew is rich in plant protein and pairs well with rice to serve large numbers efficiently.'
        },
        {
          id: 'rank_10',
          name: 'Menudo',
          rankDisplay: '#10',
          isTop: false,
          tags: ['Protein Rich', 'Festive'],
          servings: '—',
          status: '',
          ingredients_used: 'Pork, Potatoes, Carrots, Tomato sauce, Garlic, Onion, Soy sauce, Oil, Raisins (optional)',
          comment_title: '',
          comment_desc: 'A tomato-based pork stew with vegetables, suitable for special feeding distributions.'
        },
        {
          id: 'rank_11',
          name: 'Afritada',
          rankDisplay: '#11',
          isTop: false,
          tags: ['Protein Rich', 'Filling'],
          servings: '—',
          status: '',
          ingredients_used: 'Chicken, Potatoes, Carrots, Bell peppers, Tomato sauce, Garlic, Onion, Oil, Salt, Pepper',
          comment_title: '',
          comment_desc: 'A chicken and vegetable stew in tomato sauce, hearty and well-suited for group feeding.'
        },
        {
          id: 'rank_12',
          name: 'Sardines with Vegetables',
          rankDisplay: '#12',
          isTop: false,
          tags: ['Budget-Friendly', 'Quick Prep'],
          servings: '—',
          status: '',
          ingredients_used: 'Canned sardines (in tomato sauce), Cabbage, Carrots, Garlic, Onion, Oil',
          comment_title: '',
          comment_desc: 'A quick and affordable dish using canned sardines extended with available donated vegetables.'
        },
        {
          id: 'rank_13',
          name: 'Sopas',
          rankDisplay: '#13',
          isTop: false,
          tags: ['Comforting', 'Filling'],
          servings: '—',
          status: '',
          ingredients_used: 'Macaroni, Chicken, Milk, Carrots, Cabbage, Onion, Garlic, Water or broth, Salt, Pepper',
          comment_title: '',
          comment_desc: 'A creamy macaroni soup that is especially suitable for children and families during feeding programs.'
        },
        {
          id: 'rank_14',
          name: 'Filipino Spaghetti',
          rankDisplay: '#14',
          isTop: false,
          tags: ['Crowd Favorite', 'Filling'],
          servings: '—',
          status: '',
          ingredients_used: 'Spaghetti pasta, Ground meat, Spaghetti sauce (sweet-style), Hotdogs, Garlic, Onion, Oil, Grated cheese',
          comment_title: '',
          comment_desc: 'A sweet-style spaghetti popular at community events and well-suited for large group servings.'
        },
        {
          id: 'rank_15',
          name: 'Fried Chicken',
          rankDisplay: '#15',
          isTop: false,
          tags: ['Protein Rich', 'Crowd Favorite'],
          servings: '—',
          status: '',
          ingredients_used: 'Chicken, Flour or breading mix, Salt, Pepper, Garlic powder (optional), Oil (for frying)',
          comment_title: '',
          comment_desc: 'A widely loved dish that works well for distribution but requires sufficient cooking oil.'
        },
        {
          id: 'rank_16',
          name: 'Fried Fish',
          rankDisplay: '#16',
          isTop: false,
          tags: ['Protein Rich', 'Simple'],
          servings: '—',
          status: '',
          ingredients_used: 'Fish (tilapia, galunggong, etc.), Salt, Pepper, Oil',
          comment_title: '',
          comment_desc: 'A simple and affordable protein source requiring minimal ingredients.'
        },
        {
          id: 'rank_17',
          name: 'Tortang Patatas',
          rankDisplay: '#17',
          isTop: false,
          tags: ['Budget-Friendly', 'Simple'],
          servings: '—',
          status: '',
          ingredients_used: 'Potatoes, Eggs, Garlic, Onion, Salt, Pepper, Oil',
          comment_title: '',
          comment_desc: 'A potato and egg omelette that is easy to prepare in large batches and uses minimal ingredients.'
        },
        {
          id: 'rank_18',
          name: 'Tortang Talong',
          rankDisplay: '#18',
          isTop: false,
          tags: ['Budget-Friendly', 'Simple'],
          servings: '—',
          status: '',
          ingredients_used: 'Eggplant, Eggs, Garlic, Salt, Pepper, Oil',
          comment_title: '',
          comment_desc: 'A grilled eggplant omelette — a low-cost dish ideal when eggplant is available in donations.'
        },
        {
          id: 'rank_19',
          name: 'Scrambled Eggs',
          rankDisplay: '#19',
          isTop: false,
          tags: ['Quick Prep', 'Simple'],
          servings: '—',
          status: '',
          ingredients_used: 'Eggs, Oil or butter, Salt, Pepper',
          comment_title: '',
          comment_desc: 'A very fast protein dish requiring minimal ingredients, best served alongside rice or bread.'
        },
        {
          id: 'rank_20',
          name: 'Bread + Egg Meal',
          rankDisplay: '#20',
          isTop: false,
          tags: ['Quick Prep', 'Budget-Friendly'],
          servings: '—',
          status: '',
          ingredients_used: 'Bread (pandesal or loaf), Eggs, Butter or oil, Salt, Peanut butter (optional)',
          comment_title: '',
          comment_desc: 'A simple no-cook or minimal-cook meal suitable for breakfast distributions or emergency feeding.'
        },
        {
          id: 'rank_21',
          name: 'Sandwich',
          rankDisplay: '#21',
          isTop: false,
          tags: ['Quick Prep', 'No-Cook Option'],
          servings: '—',
          status: '',
          ingredients_used: 'Bread, Canned tuna or spread, Mayonnaise, Cheese (optional)',
          comment_title: '',
          comment_desc: 'A ready-to-serve option requiring no cooking, ideal for quick distribution scenarios.'
        },
        {
          id: 'rank_22',
          name: 'Banana Cue',
          rankDisplay: '#22',
          isTop: false,
          tags: ['Snack', 'Simple'],
          servings: '—',
          status: '',
          ingredients_used: 'Saba bananas, Brown sugar, Oil',
          comment_title: '',
          comment_desc: 'A sweet banana snack that works well as a supplemental item when saba bananas are donated.'
        },
        {
          id: 'rank_23',
          name: 'Camote Cue',
          rankDisplay: '#23',
          isTop: false,
          tags: ['Snack', 'Budget-Friendly'],
          servings: '—',
          status: '',
          ingredients_used: 'Sweet potatoes, Brown sugar, Oil',
          comment_title: '',
          comment_desc: 'A caramelized sweet potato snack — a practical use of sweet potato donations.'
        },
        {
          id: 'rank_24',
          name: 'Beef Asado',
          rankDisplay: '#24',
          isTop: false,
          tags: ['Protein Rich', 'Savory'],
          servings: '—',
          status: '',
          ingredients_used: 'Beef, Tomato puree, Soy sauce, Onion, Garlic, Water',
          comment_title: '',
          comment_desc: 'A Filipino-style beef stew in tomato and soy sauce, ideal when beef donations are available.'
        },
        {
          id: 'rank_25',
          name: 'Beef Caldereta',
          rankDisplay: '#25',
          isTop: false,
          tags: ['Protein Rich', 'Filling'],
          servings: '—',
          status: '',
          ingredients_used: 'Beef, Potatoes, Carrots, Tomato puree, Onion, Garlic, Water',
          comment_title: '',
          comment_desc: 'A rich tomato-based beef and vegetable stew well-suited for large feeding groups with beef donations.'
        },
        {
          id: 'rank_26',
          name: 'Beef Mechado',
          rankDisplay: '#26',
          isTop: false,
          tags: ['Protein Rich', 'Filling'],
          servings: '—',
          status: '',
          ingredients_used: 'Beef, Potatoes, Tomato puree, Soy sauce, Onion, Garlic, Water',
          comment_title: '',
          comment_desc: 'A hearty braised beef dish with potatoes in tomato and soy sauce, scalable for group feeding.'
        },
        {
          id: 'rank_27',
          name: 'Bistek',
          rankDisplay: '#27',
          isTop: false,
          tags: ['Protein Rich', 'Simple'],
          servings: '—',
          status: '',
          ingredients_used: 'Beef, Soy sauce, Lemon, Garlic, Onion',
          comment_title: '',
          comment_desc: 'Filipino beef steak marinated in soy sauce and lemon, simple to prepare and high in protein.'
        },
        {
          id: 'rank_28',
          name: 'Crispy Eggplant',
          rankDisplay: '#28',
          isTop: false,
          tags: ['Vegetable Rich', 'Budget-Friendly'],
          servings: '—',
          status: '',
          ingredients_used: 'Eggplant, Breadcrumbs, Eggs, Oil',
          comment_title: '',
          comment_desc: 'Breaded and fried eggplant slices, a crispy vegetable dish ideal when eggplant is available in donations.'
        },
        {
          id: 'rank_29',
          name: 'Eggplant Adobo',
          rankDisplay: '#29',
          isTop: false,
          tags: ['Budget-Friendly', 'Filipino Classic'],
          servings: '—',
          status: '',
          ingredients_used: 'Eggplant, Garlic, Soy sauce, Vinegar, Ground pork (optional)',
          comment_title: '',
          comment_desc: 'Eggplant cooked adobo-style in soy sauce and vinegar, a low-cost vegetable alternative to meat adobo.'
        },
        {
          id: 'rank_30',
          name: 'Grilled Eggplant with Coconut Milk',
          rankDisplay: '#30',
          isTop: false,
          tags: ['Vegetable Rich', 'Nutritious'],
          servings: '—',
          status: '',
          ingredients_used: 'Eggplant, Coconut milk, Onion',
          comment_title: '',
          comment_desc: 'Grilled eggplant simmered in coconut milk, a nutritious and flavorful dish when eggplant and coconut milk are donated.'
        },
      ];

      // Apply ingredient matching + ranking client-side
      const selectedNames = (selectedIngredients as any[])
        .map(i => (i.name || '').toLowerCase().trim())
        .filter(Boolean);

      const scored = allMockMeals
        .map(meal => {
          const ingText = (meal.ingredients_used || '').toLowerCase();
          const matchedSel = (selectedIngredients as any[]).filter(ing =>
            isMatch((ing.name || '').toLowerCase(), ingText)
          );
          const matchCount = matchedSel.length;
          const paxCapacity = calculatePaxCapacity(matchedSel, meal);
          // isFullMatch = all meal ingredients are covered by selected ingredients
          const mealTokens = ingText.split(',').map((t: string) => t.trim()).filter(Boolean);
          const isFullMatch = mealTokens.length > 0 &&
            mealTokens.every((token: string) => selectedNames.some((name: string) => isMatch(name, token)));
          return { ...meal, matchCount, isFullMatch, paxCapacity };
        })
        .filter(meal => selectedNames.length === 0 || meal.matchCount > 0)
        .sort((a, b) => b.paxCapacity - a.paxCapacity);

      // Split into full-match and partial-match
      const fullMatches = scored.filter(m => m.isFullMatch);
      const partialMatches = scored.filter(m => !m.isFullMatch);

      const rankMeals = (list: any[], startIdx: number) =>
        list.map((meal, idx) => ({
          ...meal,
          id: `rank_${startIdx + idx + 1}`,
          rankDisplay: startIdx + idx === 0 ? '#1 Best' : `#${startIdx + idx + 1}`,
          isTop: startIdx + idx === 0,
          status: startIdx + idx === 0 ? 'Optimal Output' : '',
          comment_title: startIdx + idx === 0 ? 'Why this meal ranks first:' : '',
          tags: startIdx + idx === 0 ? ['Recommended', ...meal.tags] : meal.tags,
        }));

      setFullMatchMeals(rankMeals(fullMatches, 0));
      setSuggestedMeals(rankMeals(partialMatches, fullMatches.length));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#FFFFFF' }} />
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={26} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Optimization Results</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('MealPreparationSummary')} style={styles.headerListBtn}>
            <Ionicons name="list" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          <View style={[styles.sectionHeader, { alignSelf: 'flex-start' }]}>
            <Text style={styles.sectionTitle}>List of Meals</Text>
            <Text style={styles.sectionSubtitle}>
              Meals that can be made using all of your selected ingredients.
            </Text>
          </View>


          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{selectedCount}</Text>
              <Text style={styles.statLabel}>Ingredients{`\n`}Selected</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{isLoading ? '—' : fullMatchMeals.length}</Text>
              <Text style={styles.statLabel}>Feasible{`\n`}Meals</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{parsedPax}</Text>
              <Text style={styles.statLabel}>Target{`\n`}Servings</Text>
            </View>
          </View>

          <View style={styles.resultsList}>

            {isLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#156133" />
                <Text style={{ marginTop: 15, color: '#325741' }}>Running Optimization Algorithms...</Text>
              </View>
            ) : (
              <>
                {/* ── FULL MATCH MEALS ── */}
                {fullMatchMeals.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <MaterialCommunityIcons name="food-off" size={40} color="#b0c4b8" />
                    <Text style={styles.emptyTitle}>No Exact Meal Match Found</Text>
                    <Text style={styles.emptySubtitle}>
                      There is currently no available meal that uses{' '}
                      <Text style={{ fontWeight: '800', color: '#8A3E08' }}>all</Text>{' '}
                      of your selected ingredients together.{`\n\n`}
                      Check the <Text style={{ fontWeight: '800', color: '#b07a1e' }}>Suggested Meals</Text> below — these are possible options using some of your ingredients along with additional ones.
                    </Text>
                  </View>
                ) : (
                  fullMatchMeals.map((meal) => (
                    <MealCard key={meal.id} meal={meal} selectedIngredients={selectedIngredients} navigation={navigation} />
                  ))
                )}

                {/* ── SUGGESTED MEALS SECTION ── */}
                {suggestedMeals.length > 0 && (
                  <>
                    <View style={styles.suggestedHeader}>
                      <Ionicons name="bulb-outline" size={20} color="#b07a1e" style={{ marginRight: 8 }} />
                      <Text style={styles.suggestedTitle}>Suggested Meals</Text>
                    </View>
                    <View style={styles.suggestedNoteBox}>
                      <MaterialCommunityIcons name="information-outline" size={18} color="#9a6b10" style={{ marginBottom: 6 }} />
                      <Text style={styles.suggestedNoteText}>
                        These meals contain only{' '}
                        <Text style={{ fontWeight: '800' }}>some</Text>{' '}of your selected ingredients —{' '}
                        <Text style={{ fontWeight: '800' }}>not all of them are present</Text>{' '}in each recipe.{`\n\n`}
                        There is no current available meal that uses exactly all your selected ingredients. These are{' '}
                        <Text style={{ fontWeight: '800' }}>possible alternatives</Text>{' '}
                        that may require sourcing additional ingredients.
                      </Text>
                    </View>
                    {suggestedMeals.map((meal) => (
                      <MealCard key={meal.id} meal={meal} isSuggested selectedIngredients={selectedIngredients} navigation={navigation} />
                    ))}
                  </>
                )}

                {/* Recalculate Button */}
                <TouchableOpacity
                  style={styles.btnReset}
                  activeOpacity={0.8}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={styles.btnResetText}>Recalculate New Meal</Text>
                </TouchableOpacity>
              </>
            )}

          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

// ── Reusable Meal Card Component ──────────────────────────────
function MealCard({ meal, isSuggested = false, selectedIngredients = [], navigation }: {
  meal: any;
  isSuggested?: boolean;
  selectedIngredients?: any[];
  navigation?: any;
}) {
  // Filter only the selected ingredients that appear in THIS meal's recipe
  const ingText = (meal.ingredients_used || '').toLowerCase();
  const matchedIngredients = selectedIngredients.filter(ing =>
    isMatch((ing.name || '').toLowerCase(), ingText)
  );
  // Use backend-calculated servings when available; fall back to frontend estimate for mock data
  const mealPax = (meal.servings && meal.servings !== '—')
    ? parseInt(meal.servings, 10)
    : calculatePaxCapacity(matchedIngredients, meal);
  return (
    <View style={[
      styles.mealCard,
      meal.isTop && !isSuggested && { borderColor: '#dcb04d', backgroundColor: '#fffdf7' },
      isSuggested && styles.mealCardSuggested,
    ]}>
      {/* Meal name row — name wraps freely, rank pill stays on the right */}
      <View style={styles.mealNameRow}>
        <Text style={[styles.mealName, isSuggested && { color: '#8a7040' }, { flex: 1 }]}>{meal.name}</Text>
        <View style={[meal.isTop && !isSuggested ? styles.rankPill : styles.rankPill2, { position: 'relative', top: 0, right: 0, marginLeft: 8, flexShrink: 0 }]}>
          <Text style={meal.isTop && !isSuggested ? styles.rankPillText : styles.rankPillText2}>
            {meal.rankDisplay}
          </Text>
        </View>
      </View>

      <View style={styles.mealTagsList}>
        {meal.tags && meal.tags.map((tag: string, i: number) => (
          <View key={i} style={[styles.badge, isSuggested && styles.badgeSuggested]}>
            <Text style={[styles.badgeText, isSuggested && styles.badgeTextSuggested]}>{tag}</Text>
          </View>
        ))}
      </View>

      <View style={styles.mealDetailGrid}>
        {mealPax > 0 && (
          <View style={[styles.detailBox, { borderColor: isSuggested ? '#e8d49a' : '#b8dfc9' }]}>
            <Text style={styles.detailLabel}>SERVINGS</Text>
            <Text style={[styles.detailValue, { color: isSuggested ? '#9a6b10' : '#156133', fontSize: 18 }]}>
              {mealPax} serving{mealPax === 1 ? '' : 's'}
            </Text>
          </View>
        )}
        {meal.status ? (
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>STATUS</Text>
            <Text style={styles.detailValue}>{meal.status}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.ingredientListText}>
        <Text style={{ fontWeight: '700' }}>Ingredients:</Text>{' '}
        {(() => {
          // Backend sends matched in ingredients_used and unmatched in missing_items.
          // Fallback (client-side) puts everything in ingredients_used with no missing_items,
          // so we re-run isMatch in that case to determine bold vs. regular.
          const hasServerSplit = meal.missing_items !== undefined && meal.missing_items !== null;
          const matchedTokens = (meal.ingredients_used || '')
            .split(',').map((s: string) => s.trim()).filter(Boolean);
          const missingTokens = hasServerSplit
            ? (meal.missing_items || '').split(',').map((s: string) => s.trim()).filter(Boolean)
            : [];
          const allTokens: { name: string; isMatched: boolean }[] = [
            ...matchedTokens.map((t: string) => ({
              name: t,
              isMatched: hasServerSplit
                ? true
                : selectedIngredients.some((si: any) => isMatch((si.name || '').toLowerCase(), t.toLowerCase())),
            })),
            ...missingTokens.map((t: string) => ({ name: t, isMatched: false })),
          ];
          return allTokens.map((item, idx) => {
            const isLastItem = idx === allTokens.length - 1;
            return (
              <Text
                key={idx}
                style={item.isMatched ? { fontWeight: '800', color: '#156133' } : { color: '#4f6157' }}
              >
                {item.name}{isLastItem ? '' : ', '}
              </Text>
            );
          });
        })()}
      </Text>

      <View style={[styles.commentBox, isSuggested && styles.commentBoxSuggested]}>
        {meal.comment_title ? (
          <Text style={styles.commentTitle}>{meal.comment_title}</Text>
        ) : null}
        <Text style={styles.commentText}>{meal.comment_desc}</Text>
      </View>

      {/* Prepare This Meal Button */}
      {navigation && (
        <TouchableOpacity
          style={[styles.preparBtn, isSuggested && styles.preparBtnSuggested]}
          activeOpacity={0.85}
          onPress={async () => {
            const deductions = matchedIngredients
              .filter((ing: any) => ing.id && parseFloat(ing.inputQty) > 0)
              .map((ing: any) => ({ id: ing.id, qty_used: parseFloat(ing.inputQty) }));

            const mealItem = await MealPrepService.addMeal({
              mealId: meal.id,
              mealName: meal.name,
              ingredients: meal.ingredients_used,
              pax: mealPax,
              status: 'Preparing',
              deductions,
            });
            navigation.navigate('PrepareMeal', {
              meal,
              selectedIngredients: matchedIngredients,
              mealPax,
              prepMealId: mealItem.id
            });
          }}
        >
          <MaterialCommunityIcons name="chef-hat" size={20} color={isSuggested ? "#b07a1e" : "#FFF"} style={{ marginRight: 8 }} />
          <Text style={[styles.preparBtnText, isSuggested && styles.preparBtnTextSuggested]}>
            Prepare This Meal
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#156133',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    marginLeft: 6,
  },
  headerListBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  content: {
    padding: 22,
    alignItems: 'center',
  },

  sectionHeader: {
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#156133',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#325741',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#d2dfd8',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#277e48',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#6c7c73',
    textAlign: 'center',
  },

  // Pax Capacity Banner
  paxBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eaf6ef',
    borderWidth: 2,
    borderColor: '#7ecba5',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 16,
    shadowColor: '#156133',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  paxBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paxBannerLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#156133',
  },
  paxBannerSub: {
    fontSize: 11,
    color: '#4f7060',
    marginTop: 2,
  },
  paxBannerRight: {
    alignItems: 'center',
    backgroundColor: '#156133',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 80,
  },
  paxBannerNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 32,
  },
  paxBannerUnit: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
  resultsList: {
    width: '100%',
    gap: 14,
  },
  mealCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#ebefe8',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
    width: '100%'
  },
  mealNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rankPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: '#fef2df',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  rankPillText: {
    color: '#c9791e',
    fontSize: 11,
    fontWeight: '800',
  },
  rankPill2: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  rankPillText2: {
    color: '#6c7c73',
    fontSize: 13,
    fontWeight: '800',
  },
  mealName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#db7a2f',
  },
  mealTagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef6f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    color: '#156133',
    fontSize: 10,
    fontWeight: '700',
  },
  mealDetailGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  detailBox: {
    flex: 1,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e5ece4',
    borderRadius: 14,
    padding: 12,
  },
  detailLabel: {
    fontSize: 10,
    color: '#6c7c73',
    fontWeight: '700',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#264735',
  },
  ingredientListText: {
    fontSize: 13,
    color: '#4f6157',
    lineHeight: 18,
  },
  commentBox: {
    backgroundColor: '#ebf5ee',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  commentTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#156133',
    marginBottom: 6,
  },
  commentText: {
    fontSize: 13,
    color: '#325741',
    lineHeight: 18,
  },
  btnReset: {
    backgroundColor: '#db7a2f',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 15,
    shadowColor: '#156133',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  btnResetText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },

  // Empty state
  emptyBox: {
    backgroundColor: '#f6faf7',
    borderWidth: 1.5,
    borderColor: '#d2dfd8',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4f6157',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6c7c73',
    textAlign: 'center',
    lineHeight: 19,
  },

  // Suggested section
  suggestedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  suggestedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#b07a1e',
    letterSpacing: -0.3,
  },
  suggestedNoteBox: {
    backgroundColor: '#fef9ec',
    borderWidth: 1.5,
    borderColor: '#f0d88a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  suggestedNoteText: {
    fontSize: 13,
    color: '#7a5c10',
    lineHeight: 19,
  },
  mealCardSuggested: {
    backgroundColor: '#fffdf4',
    borderColor: '#f0dcaa',
  },
  badgeSuggested: {
    backgroundColor: '#fdf0d0',
  },
  badgeTextSuggested: {
    color: '#9a6b10',
  },
  commentBoxSuggested: {
    backgroundColor: '#fef7e0',
  },

  // Prepare This Meal button (on MealCard)
  preparBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#156133',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 14,
    shadowColor: '#156133',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  preparBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
  preparBtnSuggested: {
    backgroundColor: '#b07a1e',
    shadowColor: '#b07a1e',
  },
  preparBtnTextSuggested: {
    color: '#FFF',
  },

  // Servings Scaler
  scalerPanel: {
    width: '100%',
    backgroundColor: '#f0f8f4',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#b8dfc9',
    padding: 18,
    marginBottom: 20,
  },
  scalerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  scalerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#156133',
  },
  scalerSubtitle: {
    fontSize: 12,
    color: '#4f7060',
    marginBottom: 14,
  },
  scalerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scalerBtn: {
    backgroundColor: '#C0392B',
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scalerBtnAdd: {
    backgroundColor: '#277e48',
  },
  scalerBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  scalerDisplay: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#b8dfc9',
    paddingVertical: 10,
    marginHorizontal: 4,
  },
  scalerPaxNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#156133',
    lineHeight: 32,
  },
  scalerPaxLabel: {
    fontSize: 11,
    color: '#4f7060',
    fontWeight: '600',
  },
  scalerNote: {
    fontSize: 11,
    color: '#b07a1e',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '600',
  },
});
