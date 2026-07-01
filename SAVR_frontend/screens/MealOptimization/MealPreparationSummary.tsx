import React, { useState, useCallback, useEffect } from 'react';
import {
  Alert, FlatList, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { MealPrepService, PrepMealItem, PrepStatus } from '../../services/mealPrepService';
import { ApiService } from '../../services/api';

const DEFAULT_INGREDIENTS: Record<string, string> = {
  'lugaw': 'Rice, Water or broth, Garlic, Onion, Ginger, Chicken (optional), Fish sauce or salt, Pepper, Oil',
  'champorado': 'Rice, Cocoa powder, Sugar, Milk',
  'arroz caldo': 'Rice, Chicken, Ginger, Garlic, Onion, Fish sauce, Water or broth, Boiled eggs (optional), Spring onions (optional)',
  'chicken adobo': 'Chicken, Soy sauce, Vinegar, Water, Garlic, Bay leaves, Peppercorn, Oil',
  'tinolang manok': 'Chicken, Green papaya or sayote, Malunggay or chili leaves, Ginger, Garlic, Onion, Fish sauce, Water',
  'sinampalukang manok': 'Chicken, Potatoes, Cabbage, Corn (optional), Onion, Peppercorn, Fish sauce or salt, Water',
  'guisadong gulay': 'Mixed vegetables (cabbage, carrots, beans, etc.), Garlic, Onion, Oil, Soy sauce or fish sauce',
  'chop suey': 'Mixed vegetables (cabbage, carrots, cauliflower, beans), Chicken or pork (optional), Garlic, Onion, Soy sauce, Oyster sauce (optional), Cornstarch (optional), Oil',
  'ginisang munggo': 'Mung beans, Garlic, Onion, Tomatoes, Malunggay leaves or spinach, Pork (optional), Fish sauce or salt, Water, Oil',
  'pork menudo': 'Pork, Potatoes, Carrots, Tomato sauce, Garlic, Onion, Soy sauce, Oil, Raisins (optional)',
  'chicken afritada': 'Chicken, Potatoes, Carrots, Bell peppers, Tomato sauce, Garlic, Onion, Oil, Salt, Pepper',
  'ginisang repolyo with sardines': 'Canned sardines (in tomato sauce), Cabbage, Carrots, Garlic, Onion, Oil',
  'chicken sopas': 'Macaroni, Chicken, Milk, Carrots, Cabbage, Onion, Garlic, Water or broth, Salt, Pepper',
  'filipino spaghetti': 'Spaghetti pasta, Ground meat, Spaghetti sauce (sweet-style), Hotdogs, Garlic, Onion, Oil, Grated cheese',
  'fried chicken': 'Chicken, Flour or breading mix, Salt, Pepper, Garlic powder (optional), Oil (for frying)',
  'fried fish': 'Fish (tilapia, galunggong, etc.), Salt, Pepper, Oil',
  'potato omelette': 'Potatoes, Eggs, Garlic, Onion, Salt, Pepper, Oil',
  'tortang talong': 'Eggplant, Eggs, Garlic, Salt, Pepper, Oil',
  'scrambled eggs': 'Eggs, Oil or butter, Salt, Pepper',
  'french toast': 'Bread (pandesal or loaf), Eggs, Butter or oil, Salt, Peanut butter (optional)',
  'tuna sandwich': 'Bread, Canned tuna or spread, Mayonnaise, Cheese (optional)',
  'banana cue': 'Saba bananas, Brown sugar, Oil',
  'kamote cue': 'Sweet potatoes, Brown sugar, Oil',
  'beef caldereta': 'Beef, Tomato puree, Soy sauce, Onion, Garlic, Water',
  'beef mechado': 'Beef, Potatoes, Carrots, Tomato puree, Onion, Garlic, Water',
  'beef asado': 'Beef, Potatoes, Tomato puree, Soy sauce, Onion, Garlic, Water',
  'beef bifstek': 'Beef, Soy sauce, Lemon, Garlic, Onion',
  'crispy talong': 'Eggplant, Breadcrumbs, Eggs, Oil',
  'adobong talong': 'Eggplant, Garlic, Soy sauce, Vinegar, Ground pork (optional)',
  'ginataang talong': 'Eggplant, Coconut milk, Onion'
};

export default function MealPreparationSummary({ navigation }: any) {
  const [meals, setMeals] = useState<PrepMealItem[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadMeals();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMeals();
    });
    return unsubscribe;
  }, [navigation]);

  const loadMeals = async () => {
    try {
      let localMeals = await MealPrepService.getMeals();
      
      // 1. Fetch prepared meals (Done) from database inventory
      const prepResponse = await ApiService.getPreparedMeals();
      const dbPreparedMeals = (prepResponse?.data?.success && Array.isArray(prepResponse.data.items))
        ? prepResponse.data.items
        : [];

      // 2. Fetch recent activity logs to find in-progress/preparing meals
      const actResponse = await ApiService.getActivities();
      const dbActivities = (actResponse?.data?.success && Array.isArray(actResponse.data.activities))
        ? actResponse.data.activities
        : [];

      let hasNew = false;

      // Sync activities representing prepared meals
      for (const act of dbActivities) {
        if (act.type === 'inventory') {
          // Extract meal name from description, e.g. "Prepared meal: Chicken Adobo"
          const matchTitle = act.description || '';
          const prefix = 'Prepared meal: ';
          if (matchTitle.startsWith(prefix)) {
            const afterPrefix = matchTitle.slice(prefix.length);
            // Meal name is everything before first newline
            const mealName = afterPrefix.split('\n')[0].split(',')[0].trim();

            if (mealName) {
              // Check if it already exists in local storage
              const exists = localMeals.some(m => 
                m.mealName && m.mealName.toLowerCase() === mealName.toLowerCase()
              );

              if (!exists) {
                // Parse actual ingredients from the activity log description
                let ingredients = '';
                const divider = 'Ingredients used:\n';
                if (afterPrefix.includes(divider)) {
                  const lines = afterPrefix.split(divider)[1].split('\n');
                  ingredients = lines
                    .map((l: string) => l.replace(/^[•\-\s\*\+]+/, '').split(':')[0].trim())
                    .filter(Boolean)
                    .join(', ');
                }

                // Fallback to default dictionary if parsing returned nothing
                if (!ingredients) {
                  ingredients = DEFAULT_INGREDIENTS[mealName.toLowerCase()] || 'Ingredients synced from database';
                }

                // Determine if it is Done vs Preparing by checking if it exists in dbPreparedMeals
                const isDone = dbPreparedMeals.some((item: any) => 
                  item.name && item.name.toLowerCase() === mealName.toLowerCase()
                );

                await MealPrepService.addMeal({
                  mealId: act.reference_id || `db_${Date.now()}_${Math.random()}`,
                  mealName: mealName,
                  ingredients: ingredients,
                  pax: 1, // default
                  status: isDone ? 'Done' : 'Preparing',
                });
                hasNew = true;
              }
            }
          }
        }
      }

      if (hasNew) {
        localMeals = await MealPrepService.getMeals();
      }
      setMeals(localMeals);
    } catch (e) {
      console.error('Failed to sync prepared meals', e);
      const localMeals = await MealPrepService.getMeals();
      setMeals(localMeals);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeals();
    setRefreshing(false);
  };



  const handleStatusToggle = (meal: PrepMealItem) => {
    Alert.alert(
      'Update Status',
      `Change status for ${meal.mealName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Preparing',
          onPress: async () => {
            await MealPrepService.updateStatus(meal.id, 'Preparing');
            loadMeals();
          }
        },
        {
          text: 'Set Done',
          onPress: async () => {
            if (meal.status !== 'Done') {
              try {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const expiryDate = tomorrow.toISOString().split('T')[0];

                const nameLower = (meal.mealName || '').toLowerCase();
                const GRAINS = ['lugaw', 'arroz caldo', 'champorado', 'sopas'];
                const VEGGIES = ['munggo guisado', 'veggie stir-fry', 'sotanghon soup'];
                let mealCategory = 'Meat';
                if (GRAINS.some(m => nameLower.includes(m))) mealCategory = 'Grains & Cereals';
                else if (VEGGIES.some(m => nameLower.includes(m))) mealCategory = 'Vegetables';

                await ApiService.addInventory({
                  food_name: meal.mealName,
                  category: mealCategory,
                  quantity: meal.pax || 1,
                  unit: 'meal',
                  meal_type: 'Prep Meal',
                  expiration_date: expiryDate,
                });
                await MealPrepService.updateStatus(meal.id, 'Done');
                Alert.alert('Success', 'Meal marked as done and added to prepared meals inventory!');
                loadMeals();
              } catch (e: any) {
                console.error(e);
                Alert.alert('Error', 'Failed to complete meal. Please try again.');
              }
            }
          }
        }
      ]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete Meals',
      `Are you sure you want to delete ${selectedIds.size} meal(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await MealPrepService.deleteMeals(Array.from(selectedIds));
            setIsSelectMode(false);
            setSelectedIds(new Set());
            loadMeals();
          }
        }
      ]
    );
  };

  const getStatusStyle = (status: PrepStatus) => {
    switch (status) {
      case 'Preparing': return styles.statusPreparing;
      case 'Done': return styles.statusDone;
      case 'Cancelled': return styles.statusCancelled;
      default: return styles.statusPreparing;
    }
  };

  const renderItem = ({ item }: { item: PrepMealItem }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <View style={styles.mealRow}>
        {isSelectMode && (
          <TouchableOpacity 
            style={styles.checkboxContainer}
            onPress={() => {
              const newSelected = new Set(selectedIds);
              if (isSelected) newSelected.delete(item.id);
              else newSelected.add(item.id);
              setSelectedIds(newSelected);
            }}
          >
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
            </View>
          </TouchableOpacity>
        )}
        <View style={styles.mealInfo}>
          <Text style={styles.mealName} numberOfLines={2}>{item.mealName}</Text>
          <Text style={styles.ingredients} numberOfLines={1}>{item.ingredients}</Text>
        </View>
        <View style={styles.paxInfo}>
          <Text style={styles.paxQty}>{item.pax}</Text>
          <Text 
            style={styles.paxLabel} 
            numberOfLines={1} 
            adjustsFontSizeToFit
          >
            {item.pax === 1 ? 'Serving' : 'Servings'}
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.statusPill, getStatusStyle(item.status)]}
          onPress={() => !isSelectMode && handleStatusToggle(item)}
          disabled={isSelectMode}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAF9" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#156133" />
        </TouchableOpacity>
      </View>

      <View style={styles.titleSection}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.pageTitle}>List of Meals</Text>
            <Text style={styles.pageSubtitle}>Track your meal preparation status</Text>
          </View>
          <TouchableOpacity
            style={styles.selectBtn}
            onPress={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedIds(new Set());
            }}
          >
            <Text style={styles.selectBtnText}>{isSelectMode ? 'Cancel' : 'Select'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isSelectMode && (
        <View style={styles.selectionToolbar}>
          <TouchableOpacity onPress={() => {
            if (selectedIds.size === meals.length) {
              setSelectedIds(new Set());
            } else {
              setSelectedIds(new Set(meals.map(m => m.id)));
            }
          }}>
            <Text style={styles.toolbarText}>{selectedIds.size === meals.length ? 'Deselect All' : 'Select All'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteSelected}>
            <Text style={[styles.toolbarText, { color: '#E43E3E' }]}>Delete ({selectedIds.size})</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.listContainer}>
        <FlatList
          data={meals}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, meals.length === 0 && { flex: 1, justifyContent: 'center' }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No meals being prepared right now.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#156133"]} />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    marginBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginLeft: -8,
  },
  titleSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectBtn: {
    backgroundColor: '#eef6f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectBtnText: {
    color: '#156133',
    fontWeight: '700',
    fontSize: 14,
  },
  selectionToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  toolbarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#156133',
  },
  checkboxContainer: {
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#156133',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkboxSelected: {
    backgroundColor: '#156133',
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#156133',
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#6c7c73',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 30,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e8eedf',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  listContent: {
    paddingVertical: 10,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  deleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  mealInfo: {
    flex: 1,
    paddingRight: 10,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#156133',
    marginBottom: 4,
  },
  ingredients: {
    fontSize: 13,
    color: '#84938a',
  },
  paxInfo: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
  },
  paxQty: {
    fontSize: 18,
    fontWeight: '900',
    color: '#156133',
  },
  paxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6c7c73',
  },
  statusPill: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 999,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  statusPreparing: {
    backgroundColor: '#eab308', // yellow
  },
  statusDone: {
    backgroundColor: '#156133', // green
  },
  statusCancelled: {
    backgroundColor: '#b91c1c', // red
    borderWidth: 2,
    borderColor: '#1d4ed8', // blue border to match their sample
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 20,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#84938a',
    fontSize: 15,
    fontWeight: '600',
  }
});
