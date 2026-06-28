import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, TouchableOpacity, StatusBar, Alert, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ApiService } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';
import { StorageUtils } from '../../utils/storage';
import NotificationBell from '../../components/NotificationBell';

// Parse a qty string like "48 kg" or "680 pcs" into { value, unit }
const parseQty = (qtyStr: string): { value: number; unit: string } => {
  const match = String(qtyStr).match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (match) return { value: parseFloat(match[1]), unit: match[2].trim() };
  return { value: 0, unit: '' };
};

const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  'Canned Goods': 'Canned Goods: Non-Perishable',
  'Dairy': 'Dairy: Perishable',
  'Dry Goods': 'Dry Goods: Non-Perishable',
  'Fats & Oils': 'Fats & Oils: Non-Perishable',
  'Fruits': 'Fruits: Perishable',
  'Grains & Cereals': 'Grains & Cereals: Non-Perishable',
  'Beverages': 'Beverages: Non-Perishable',
  'Liquid Goods': 'Beverages: Non-Perishable',
  'Meat': 'Meat: Perishable',
  'Sugars & Sweets': 'Sugars & Sweets: Non-Perishable',
  'Protein Alternatives': 'Protein Alternatives: Both',
  'Vegetables': 'Vegetables: Perishable',
  'Prepared Meals': 'Prepared Meals: Perishable',
};

const getCategoryLabel = (cat: string | null) => {
  if (!cat) return '';
  return CATEGORY_DISPLAY_MAP[cat] || cat;
};

const isMatch = (itemName: string, ingName: string): boolean => {
  const itemLower = itemName.toLowerCase().trim();
  const ingLower = ingName.toLowerCase().trim();
  if (itemLower.includes(ingLower) || ingLower.includes(itemLower)) return true;
  
  const itemWords = itemLower.split(/\s+/).filter(w => w.length > 2);
  if (itemWords.length === 0) return false;
  const mainNoun = itemWords[itemWords.length - 1];
  return ingLower.includes(mainNoun);
};

export default function IngrMealPlanning({ route, navigation }: any) {
  const [targetPax, setTargetPax] = useState('0');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [openUnitPickerId, setOpenUnitPickerId] = useState<number | null>(null);

  const UNIT_OPTIONS = ['kg', 'pcs', 'L'];

  const [ingredients, setIngredients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const consumedParamsRef = React.useRef<string | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    setTargetPax('0');
    setSearchQuery('');
    consumedParamsRef.current = null;
    await fetchInventory(); // automatically re-fetches and un-checks all select boxes natively
    setRefreshing(false);
  };

  const fetchInventory = async (recipeIngredients?: any[], targetPaxVal?: number) => {
    setIsLoading(true);
    try {
      const res = await ApiService.getInventory();
      let items = [];
      if (res.data && res.data.success) {
        items = (res.data.items || []).filter((item: any) => item.category !== 'Prepared Meals' && item.category !== 'Prep Meal');
      } else {
        throw new Error('API not available yet');
      }
      // Map data to inject UI selection states
      const formatted = items.map((item: any) => {
        const parsedQty = parseQty(item.qty);
        const outOfStock = parsedQty.value === 0;
        const isUrgent = !outOfStock && item.expiry && item.expiry.includes('2026-01');

        let isSelected = false;
        let inputQty = '1';
        let inputUnit = parsedQty.unit || 'kg';

        if (recipeIngredients && !outOfStock) {
          const matchIng = recipeIngredients.find((ring: any) =>
            isMatch(item.name, ring.ingredient_name)
          );
          if (matchIng) {
            isSelected = true;
            const recipeUnit = (matchIng.unit || '').toLowerCase().trim();
            let qtyPerServing = matchIng.qty_per_serving || 0;
            let resolvedUnit = parsedQty.unit || 'kg';

            // Convert g→kg and ml→L so units stay within the picker options (kg, pcs, L)
            if (recipeUnit === 'g') {
              qtyPerServing = qtyPerServing / 1000;
              resolvedUnit = 'kg';
            } else if (recipeUnit === 'ml') {
              qtyPerServing = qtyPerServing / 1000;
              resolvedUnit = 'L';
            } else if (recipeUnit === 'pcs' || recipeUnit === 'pc') {
              resolvedUnit = 'pcs';
            }

            const needed = parseFloat((qtyPerServing * (targetPaxVal || 0)).toFixed(3));
            const actualQty = Math.min(needed, parsedQty.value);
            inputQty = String(actualQty > 0 ? actualQty : 1);
            inputUnit = resolvedUnit;
          }
        }

        return {
          ...item,
          status: outOfStock ? 'Out of Stock' : (isUrgent ? 'Urgent Expiry' : 'Available'),
          urgent: isUrgent,
          outOfStock,
          selected: isSelected,
          inputQty: isSelected ? inputQty : undefined,
          inputUnit: isSelected ? inputUnit : undefined,
          maxQty: parsedQty.value,
        };
      });
      setIngredients(formatted);
    } catch (e) {
      console.log('Backend not ready yet, using fallback data for visualization.');
      const localData = await StorageUtils.getItem('MOCK_INVENTORY_LIST');
      let items = [];
      if (localData) {
        items = JSON.parse(localData);
      } else {
        items = [
          { id: '1', name: 'Rice', qty: '48 kg', expiry: '2026-06-30', category: 'Grains & Cereals' },
          { id: '2', name: 'Chicken', qty: '17 kg', expiry: '2026-06-30', category: 'Meat' },
          { id: '3', name: 'Mango', qty: '48 kg', expiry: '2026-07-28', category: 'Fruits' },
          { id: '4', name: 'Carrots', qty: '17 kg', expiry: '2026-06-30', category: 'Vegetables' },
          { id: '5', name: 'Bread', qty: '680 pcs', expiry: '2026-06-30', category: 'Grains & Cereals' },
          { id: '6', name: 'Milk', qty: '17 L', expiry: '2026-01-30', category: 'Dairy' },
          { id: '7', name: 'Water', qty: '20 L', expiry: '2026-08-15', category: 'Beverages' },
          { id: '8', name: 'Eggs', qty: '17 pcs', expiry: '2026-06-30', category: 'Protein Alternatives' },
        ];
        await StorageUtils.setItem('MOCK_INVENTORY_LIST', JSON.stringify(items));
      }
      const formatted = items.map((item: any) => {
        const parsedQty = parseQty(item.qty);
        const outOfStock = parsedQty.value === 0;
        const isUrgent = !outOfStock && item.expiry && item.expiry.includes('2026-01');

        let isSelected = false;
        let inputQty = '1';
        let inputUnit = parsedQty.unit || 'kg';

        if (recipeIngredients && !outOfStock) {
          const matchIng = recipeIngredients.find((ring: any) =>
            isMatch(item.name, ring.ingredient_name)
          );
          if (matchIng) {
            isSelected = true;
            const recipeUnit = (matchIng.unit || '').toLowerCase().trim();
            let qtyPerServing = matchIng.qty_per_serving || 0;
            let resolvedUnit = parsedQty.unit || 'kg';

            // Convert g→kg and ml→L so units stay within the picker options (kg, pcs, L)
            if (recipeUnit === 'g') {
              qtyPerServing = qtyPerServing / 1000;
              resolvedUnit = 'kg';
            } else if (recipeUnit === 'ml') {
              qtyPerServing = qtyPerServing / 1000;
              resolvedUnit = 'L';
            } else if (recipeUnit === 'pcs' || recipeUnit === 'pc') {
              resolvedUnit = 'pcs';
            }

            const needed = parseFloat((qtyPerServing * (targetPaxVal || 0)).toFixed(3));
            const actualQty = Math.min(needed, parsedQty.value);
            inputQty = String(actualQty > 0 ? actualQty : 1);
            inputUnit = resolvedUnit;
          }
        }

        return {
          ...item,
          status: outOfStock ? 'Out of Stock' : (isUrgent ? 'Urgent Expiry' : 'Available'),
          urgent: isUrgent,
          outOfStock,
          selected: isSelected,
          inputQty: isSelected ? inputQty : undefined,
          inputUnit: isSelected ? inputUnit : undefined,
          maxQty: parsedQty.value,
        };
      });
      formatted.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      setIngredients(formatted);
    } finally {
      setIsLoading(false);
    }
  };


  useFocusEffect(
    React.useCallback(() => {
      const initPlanning = async () => {
        const routePax = route.params?.targetPax;
        const routeMeal = route.params?.mealName;

        // Build a key to identify this specific param set
        const paramKey = routePax !== undefined && routeMeal !== undefined
          ? `${routeMeal}_${routePax}`
          : null;

        if (paramKey && paramKey !== consumedParamsRef.current) {
          // Mark these params as consumed so we don't re-process on refocus
          consumedParamsRef.current = paramKey;

          const paxNum = parseFloat(routePax) || 0;
          setTargetPax(String(paxNum));
          setSearchQuery('');
          setSelectedCategory(null);

          let matchingIngredients: any[] = [];
          try {
            const recipeRes = await ApiService.getRecipes();
            if (recipeRes.data && recipeRes.data.success) {
              const recipes = recipeRes.data.data || [];
              const matchingRecipe = recipes.find((r: any) => 
                r.name.toLowerCase() === routeMeal.toLowerCase()
              );
              if (matchingRecipe) {
                matchingIngredients = matchingRecipe.ingredients || [];
              }
            }
          } catch (err) {
            console.log('Failed to fetch recipes for auto-selection, using fallback matching', err);
            const fallbacks: Record<string, string[]> = {
              'lugaw': ['rice', 'chicken', 'garlic', 'onion', 'ginger'],
              'arroz caldo': ['rice', 'chicken', 'garlic', 'onion', 'ginger', 'eggs'],
              'champorado': ['rice', 'milk'],
              'chicken adobo': ['chicken', 'garlic', 'onion'],
              'sopas': ['milk', 'chicken', 'carrots', 'cabbage'],
              'sandwich': ['bread', 'eggs'],
            };
            const lowerMeal = routeMeal.toLowerCase();
            const matchingKey = Object.keys(fallbacks).find(k => lowerMeal.includes(k));
            if (matchingKey) {
              matchingIngredients = fallbacks[matchingKey].map(name => ({ ingredient_name: name, qty_per_serving: 0.15, unit: 'kg' }));
            }
          }
          await fetchInventory(matchingIngredients, paxNum);
        } else if (!paramKey) {
          // Normal navigation (no params from dashboard) — only reset if we haven't just consumed params
          if (!consumedParamsRef.current) {
            setTargetPax('0');
            setSearchQuery('');
            setSelectedCategory(null);
            await fetchInventory();
          }
        }
      };

      initPlanning();
    }, [route.params])
  );

  const toggleSelectAll = () => {
    const selectableItems = ingredients.filter(i => !i.outOfStock);
    const allSelected = selectableItems.length > 0 && selectableItems.every(i => i.selected);
    const updated = ingredients.map(i => {
      if (i.outOfStock) return i;
      if (allSelected) return { ...i, selected: false };
      const parsed = parseQty(i.qty);
      const normUnit = parsed.unit.toLowerCase();
      let targetUnit = 'kg';
      if (i.category === 'Canned Goods') {
        targetUnit = 'pcs';
      } else {
        const found = UNIT_OPTIONS.find(o => o.toLowerCase() === normUnit);
        if (found) targetUnit = found;
      }
      return {
        ...i,
        selected: true,
        inputQty: i.inputQty ?? '1',
        inputUnit: targetUnit,
        maxQty: parsed.value,
      };
    });
    setIngredients(updated);
  };

  const toggleRow = (id: number) => {
    setIngredients(ingredients.map(i => {
      if (i.id !== id) return i;
      if (i.outOfStock) return i;
      const parsed = parseQty(i.qty);
      const normUnit = parsed.unit.toLowerCase();
      let targetUnit = 'kg';
      if (i.category === 'Canned Goods') {
        targetUnit = 'pcs';
      } else {
        const found = UNIT_OPTIONS.find(o => o.toLowerCase() === normUnit);
        if (found) targetUnit = found;
      }
      return {
        ...i,
        selected: !i.selected,
        inputQty: !i.selected ? '1' : i.inputQty,
        inputUnit: targetUnit,
        maxQty: parsed.value,
      };
    }));
  };

  const updateInputQty = (id: number, val: string) => {
    setIngredients(ingredients.map(i => {
      if (i.id !== id) return i;
      // Strip non-numeric except decimal point
      const cleaned = val.replace(/[^0-9.]/g, '');
      const num = parseFloat(cleaned);
      // Cap at available max
      if (!isNaN(num) && num > i.maxQty) return { ...i, inputQty: String(i.maxQty) };
      return { ...i, inputQty: cleaned };
    }));
  };

  const stepQty = (id: number, direction: 1 | -1) => {
    setIngredients(ingredients.map(i => {
      if (i.id !== id) return i;
      const current = parseFloat(i.inputQty) || 0;
      // Use 0.5 step for kg/L, 1 step for pcs/others
      const unit = (i.inputUnit || '').toLowerCase();
      const step = (unit === 'kg' || unit === 'l' || unit === 'liter' || unit === 'liters') ? 0.5 : 1;
      const next = Math.min(Math.max(0, parseFloat((current + direction * step).toFixed(2))), i.maxQty);
      return { ...i, inputQty: String(next) };
    }));
  };

  const removeSelected = (id: number) => {
    setIngredients(ingredients.map(i => i.id === id ? { ...i, selected: false } : i));
  };

  const updateInputUnit = (id: number, newUnit: string) => {
    setIngredients(ingredients.map(i => i.id === id ? { ...i, inputUnit: newUnit } : i));
    setOpenUnitPickerId(null);
  };

  const calculateMeals = () => {
    const selectedCount = ingredients.filter(i => i.selected).length;
    const pax = parseInt(targetPax) || 0;

    if (selectedCount === 0) {
      Alert.alert('Notice', 'Please select at least one ingredient before calculating meals.');
      return;
    }
    if (pax <= 0) {
      Alert.alert('Notice', 'Please enter a valid number of servings.');
      return;
    }

    const selectedItems = ingredients.filter(i => i.selected);
    const selectedIds = selectedItems.map(i => i.id);

    // Route the input details securely to the results module!
    navigation.navigate('MealOptimizationResults', {
      selectedCount: selectedItems.length,
      targetPax: pax,
      selectedIds: selectedIds,
      selectedIngredients: selectedItems.map(i => ({
        id: i.id,
        name: i.name,
        inputQty: parseFloat(i.inputQty) || 0,
        unit: i.inputUnit || '',
        maxQty: i.maxQty || 0,
        expiry: i.expiry || null,
      })),
    });
  };

  // Derive variables for UI binding
  const selectedCount = ingredients.filter(i => i.selected).length;
  const selectableIngredients = ingredients.filter(i => !i.outOfStock);
  const allSelectableSelected = selectableIngredients.length > 0 && selectableIngredients.every(i => i.selected);
  const BASE_CATEGORIES_WITH_SUFFIX = [
    'Canned Goods: Non-Perishable',
    'Dairy: Perishable',
    'Dry Goods: Non-Perishable',
    'Fats & Oils: Non-Perishable',
    'Fruits: Perishable',
    'Grains & Cereals: Non-Perishable',
    'Beverages: Non-Perishable',
    'Meat: Perishable',
    'Sugars & Sweets: Non-Perishable',
    'Protein Alternatives: Both',
    'Vegetables: Perishable'
  ];

  const getFullCategoryName = (cat: string) => {
    const clean = cat.replace(/:\s*(Perishable|Non-Perishable|Both)$/i, '').trim().toLowerCase();
    const matched = BASE_CATEGORIES_WITH_SUFFIX.find(b => b.toLowerCase().startsWith(clean + ':'));
    return matched || cat;
  };

  const categories = [...new Set([
    ...BASE_CATEGORIES_WITH_SUFFIX,
    ...ingredients.map((i: any) => i.category ? getFullCategoryName(i.category) : '').filter(Boolean)
  ])].sort() as string[];

  const filteredIngredients = ingredients.filter(i => {
    const matchesSearch =
      (i.name && i.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (i.category && i.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory ||
      (i.category && getFullCategoryName(i.category) === selectedCategory);
    return matchesSearch && matchesCategory;
  });
  const allFilteredOutOfStock = filteredIngredients.length > 0 && filteredIngredients.every(i => i.outOfStock);

  const parsedPax = parseInt(targetPax) || 0;

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#FFFFFF' }} />
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

        {/* TOP BAR HEADER */}
        <View style={styles.topHeader}>
          <Image
            source={require('../../assets/images/logo/logobrown.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NotificationBell navigation={navigation} color="#544434" size={28} style={{ marginRight: 5 }} />
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation?.openDrawer?.()}>
              <Ionicons name="menu-outline" size={32} color="#544434" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#156133" />}
        >

          {/* PAGE TITLE  */}
          <View style={styles.pageTitleRow}>
            <Image source={require('../../assets/images/ingrmealscaling_icon.png')} style={{ width: 44, height: 44, tintColor: '#156133' }} resizeMode="contain" />
            <Text style={styles.pageTitleText}>Meal Planning & Scaling</Text>
          </View>

          {/* BENEFICIARY INFO */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Beneficiary Info</Text>
            <Text style={styles.sectionSubtitle}>Enter the estimated number of servings</Text>
          </View>

          <View style={styles.heroPanel}>
            <TextInput
              style={styles.bigInput}
              keyboardType="numeric"
              value={targetPax}
              onChangeText={setTargetPax}
              maxLength={5}
            />
            <Text style={styles.paxLabel}>Number of Servings</Text>
          </View>

          {/* INGREDIENTS SELECTION */}
          <View style={[styles.sectionHeader, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>Ingredients Selection</Text>
            <Text style={styles.sectionSubtitle}>Select the ingredients you wish to provide</Text>
          </View>

          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search items"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#555555"
              />
              <Ionicons name="search" size={20} color="#000" style={{ marginRight: 10 }} />
            </View>
            <TouchableOpacity activeOpacity={0.8} onPress={toggleSelectAll}>
              <View style={styles.btnSecondary}>
                <Text style={styles.btnSecondaryText}>
                  {allSelectableSelected ? 'Unselect All' : 'Select All'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.helperText}>Select item to calculate for the meal</Text>

          {/* CATEGORY FILTER DROPDOWN */}
          <View style={{ width: '100%', marginBottom: 14 }}>
            <TouchableOpacity
              onPress={() => setShowCategoryDropdown(v => !v)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 1.5,
                borderColor: '#156133',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: selectedCategory ? '#156133' : '#FFF',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: selectedCategory ? '#FFF' : '#156133' }}>
                {selectedCategory ? getCategoryLabel(selectedCategory) : 'Filter by Category'}
              </Text>
              <Ionicons
                name={showCategoryDropdown ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={selectedCategory ? '#FFF' : '#156133'}
              />
            </TouchableOpacity>

            {showCategoryDropdown && (
              <View style={{
                borderWidth: 1.5,
                borderColor: '#d2dfd8',
                borderRadius: 12,
                marginTop: 6,
                backgroundColor: '#FFF',
                overflow: 'hidden',
              }}>
                <TouchableOpacity
                  onPress={() => { setSelectedCategory(null); setShowCategoryDropdown(false); }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#eee',
                    backgroundColor: !selectedCategory ? '#eef6f0' : '#FFF',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#156133' }}>All Categories</Text>
                </TouchableOpacity>
                {categories.map((cat, idx) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => { setSelectedCategory(cat); setShowCategoryDropdown(false); }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: idx < categories.length - 1 ? 1 : 0,
                      borderBottomColor: '#eee',
                      backgroundColor: selectedCategory === cat ? '#eef6f0' : '#FFF',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: selectedCategory === cat ? '#156133' : '#4f6157' }}>{getCategoryLabel(cat)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>


          {/* NO AVAILABLE INGREDIENTS BANNER */}
          {allFilteredOutOfStock && (
            <View style={styles.noAvailableBanner}>
              <Ionicons name="alert-circle-outline" size={18} color="#b91c1c" style={{ marginRight: 8 }} />
              <Text style={styles.noAvailableText}>No available ingredients. All items are out of stock.</Text>
            </View>
          )}

          {/* INGREDIENT CARDS */}
          <View style={styles.tableWrap}>
            <View style={styles.tableBody}>
              {isLoading ? (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#156133" />
                  <Text style={{ marginTop: 10, color: '#325741' }}>Loading Donated Inventory...</Text>
                </View>
              ) : filteredIngredients.length === 0 ? (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <Text style={{ color: '#325741' }}>No inventory items found.</Text>
                </View>
              ) : (
                filteredIngredients.map((item, idx) => {
                  const maxQty = item.maxQty ?? parseQty(item.qty).value;
                  const unit = item.inputUnit || parseQty(item.qty).unit;
                  const usedPct = Math.min(100, ((parseFloat(item.inputQty) || 0) / (maxQty || 1)) * 100);
                  const outOfStock = item.outOfStock || false;
                  return (
                    <View
                      key={`${item.id}-${idx}`}
                      style={[
                        styles.tableRow,
                        item.selected && styles.tableRowSelected,
                        outOfStock && styles.tableRowOutOfStock,
                        idx === filteredIngredients.length - 1 && { borderBottomWidth: 0 }
                      ]}
                    >
                      {/* Row summary — tap to toggle selection */}
                      <TouchableOpacity
                        activeOpacity={outOfStock ? 1 : 0.8}
                        onPress={() => !outOfStock && toggleRow(item.id)}
                        style={styles.tableRowTapArea}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {/* Checkbox indicator */}
                          <View style={[
                            styles.checkbox,
                            item.selected && styles.checkboxSelected,
                            outOfStock && styles.checkboxDisabled,
                          ]}>
                            {outOfStock
                              ? <Ionicons name="close" size={12} color="#aaa" />
                              : item.selected && <Ionicons name="checkmark" size={12} color="#FFF" />
                            }
                          </View>
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={[styles.tdText, item.selected && styles.tdTextSelected, outOfStock && { color: '#aaa' }]} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={[
                              styles.tdSubText,
                              item.selected && { color: 'rgba(255,255,255,0.75)' },
                              item.urgent && !item.selected && { color: '#E43E3E' },
                              outOfStock && { color: '#bbb' },
                            ]}>
                              {item.qty} · Exp: {item.expiry}
                            </Text>
                          </View>
                          {outOfStock ? (
                            <View style={styles.outOfStockTag}>
                              <Text style={styles.outOfStockTagText}>Out of Stock</Text>
                            </View>
                          ) : (
                            <View style={[styles.categoryTag, item.selected && { marginRight: 38 }]}>
                              <Text style={[
                                styles.categoryTagText,
                                item.selected && { color: '#156133', backgroundColor: '#eef6f0' },
                              ]} numberOfLines={1}>
                                {getCategoryLabel(item.category)}
                              </Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Absolute Close Button at Top Right when selected */}
                      {item.selected && (
                        <TouchableOpacity
                          style={styles.cardCloseBtn}
                          onPress={() => removeSelected(item.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close" size={16} color="#FFF" />
                        </TouchableOpacity>
                      )}

                      {/* Inline +/- controls — only show when selected */}
                      {item.selected && (
                        <View style={styles.inlineQtySection}>
                          <View style={styles.inlineQtyRow}>
                            <View style={styles.qtyControlGroup}>
                              <TouchableOpacity
                                style={styles.inlineQtyBtn}
                                onPress={() => stepQty(item.id, -1)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="remove" size={18} color="#E87A1E" />
                              </TouchableOpacity>

                              <View style={styles.inlineQtyInputWrap}>
                                <TextInput
                                  style={styles.inlineQtyInput}
                                  keyboardType="decimal-pad"
                                  value={item.inputQty ?? ''}
                                  onChangeText={(v) => updateInputQty(item.id, v)}
                                  maxLength={8}
                                  selectTextOnFocus
                                />
                                {/* Tappable unit label */}
                                <TouchableOpacity
                                  onPress={() => setOpenUnitPickerId(openUnitPickerId === item.id ? null : item.id)}
                                  activeOpacity={0.7}
                                  style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4 }}
                                >
                                  <Text style={styles.inlineQtyUnit}>{unit}</Text>
                                  <Ionicons name="chevron-down" size={10} color="rgba(255,255,255,0.8)" style={{ marginLeft: 2 }} />
                                </TouchableOpacity>
                              </View>

                              <TouchableOpacity
                                style={styles.inlineQtyBtn}
                                onPress={() => stepQty(item.id, 1)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="add" size={18} color="#E87A1E" />
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Unit picker — shows when tapped */}
                          {openUnitPickerId === item.id && (
                            <View style={styles.inlineUnitPickerRow}>
                              {UNIT_OPTIONS.map((u) => (
                                <TouchableOpacity
                                  key={u}
                                  onPress={() => updateInputUnit(item.id, u)}
                                  style={[
                                    styles.inlineUnitPill,
                                    unit === u ? styles.inlineUnitPillActive : styles.inlineUnitPillInactive
                                  ]}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[
                                    styles.inlineUnitPillText,
                                    unit === u ? styles.inlineUnitPillTextActive : styles.inlineUnitPillTextInactive
                                  ]}>{u}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}

                          {/* Mini progress bar */}
                          <View style={styles.progressSection}>
                            <View style={styles.inlineProgressBg}>
                              <View style={[styles.inlineProgressFill, { width: `${usedPct}%` }]} />
                            </View>
                            <Text style={styles.inlineProgressLabel}>
                              {item.inputQty || '0'} / {maxQty} {unit}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                }))
              }
            </View>
          </View>

          {/* SELECTED INGREDIENTS SUMMARY PILL */}
          {ingredients.some(i => i.selected) && (
            <View style={styles.selectedSummaryBar}>
              <MaterialCommunityIcons name="food-variant" size={16} color="#8A3E08" />
              <Text style={styles.selectedSummaryText}>
                {ingredients.filter(i => i.selected).length} ingredient{ingredients.filter(i => i.selected).length !== 1 ? 's' : ''} selected · Tap a row to adjust quantity
              </Text>
            </View>
          )}

          {/* CALCULATE BUTTON */}
          <View style={styles.calculateBtnWrapper}>
            <TouchableOpacity activeOpacity={0.8} onPress={calculateMeals} style={styles.btnPrimary}>
              <Ionicons name="calculator-outline" size={32} color="#FFF" style={{ marginRight: 12 }} />
              <Text style={styles.btnPrimaryText}>Calculate Meal</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
  },
  logoImage: {
    width: 170,
    height: 58,
    marginBottom: 6,
  },
  iconBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 22,
    alignItems: 'center',
  },

  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 35,
    marginTop: 10,
    width: '100%',
    justifyContent: 'center',
  },
  pageTitleText: {
    fontSize: 27,
    fontWeight: '800',
    color: '#156133',
    marginLeft: 10,
    letterSpacing: -1,
  },

  sectionHeader: {
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#8A3E08',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#325741',
  },

  heroPanel: {
    width: '100%',
    backgroundColor: '#dfab39',
    borderRadius: 20,
    paddingVertical: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  bigInput: {
    fontSize: 48,
    fontWeight: '800',
    color: '#124825',
    textAlign: 'center',
    lineHeight: 56,
  },
  paxLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#124825',
    marginTop: 2,
  },

  // Table Tools
  toolbar: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#7f7f7f',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#333',
    paddingVertical: 0,
    marginVertical: 0,
  },
  btnSecondary: {
    backgroundColor: '#cfab17',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  btnSecondaryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  helperText: {
    fontSize: 12,
    color: '#6c7c73',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 20,
  },

  tableWrap: {
    width: '100%',
    marginBottom: 20,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  thText: {
    color: '#156133',
    fontSize: 11,
    fontWeight: '700',
  },
  tableBody: {
    width: '100%',
  },
  tableRow: {
    flexDirection: 'column',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: '#f7f7f7',
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  tableRowSelected: {
    backgroundColor: '#db7a2f',
    borderColor: '#c4631a',
    shadowColor: '#c4631a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  tableRowTapArea: {
    width: '100%',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#156133',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkboxSelected: {
    backgroundColor: '#156133',
    borderColor: '#156133',
  },
  tdText: {
    color: '#4B3A2C',
    fontSize: 14,
    fontWeight: '700',
  },
  tdSubText: {
    fontSize: 11,
    color: '#7a6040',
    fontWeight: '500',
    marginTop: 2,
  },
  tdTextSelected: {
    color: '#FFF',
  },
  categoryTag: {
    marginLeft: 8,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#156133',
    backgroundColor: '#eef6f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    overflow: 'hidden',
  },

  // Inline quantity controls (inside selected row)
  inlineQtySection: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  inlineUnitPickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: 8,
    marginVertical: 10,
  },
  inlineUnitPill: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  inlineUnitPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  inlineUnitPillInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  inlineUnitPillText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  inlineUnitPillTextActive: {
    color: '#E87A1E',
  },
  inlineUnitPillTextInactive: {
    color: '#FFFFFF',
  },
  inlineQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  qtyControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 99,
    padding: 4,
  },
  inlineQtyBtn: {
    backgroundColor: '#FFF',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inlineQtyInputWrap: {
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    marginHorizontal: 8,
  },
  inlineQtyInput: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    padding: 0,
    minWidth: 30,
  },
  inlineQtyUnit: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 4,
  },
  cardCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  progressSection: {
    flexDirection: 'column',
  },
  inlineProgressBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 8,
  },
  inlineProgressFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 99,
  },
  inlineProgressLabel: {
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
  },
  // Selected summary bar
  selectedSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf6ec',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8c87a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  selectedSummaryText: {
    fontSize: 12,
    color: '#8A3E08',
    fontWeight: '600',
    flex: 1,
  },

  calculateBtnWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  btnPrimary: {
    backgroundColor: '#277e48',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 20,
    width: '100%',
    shadowColor: '#277e48',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
  },

  // Results styling
  resultsContainer: {
    width: '100%',
    backgroundColor: '#f2f8f4',
    padding: 20,
    borderRadius: 24,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#cce6d4'
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#d2dfd8',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#156133',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#6c7c73',
    textAlign: 'center',
  },
  resultsList: {
    gap: 12,
  },
  mealCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#ebefe8',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 4,
    position: 'relative'
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
    fontSize: 12,
    fontWeight: '800',
  },
  mealName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#156133',
    marginBottom: 8,
  },
  mealTagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef6f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: '#156133',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeUrgent: {
    backgroundColor: '#ffe8d9',
  },
  badgeTextUrgent: {
    color: '#b55a18',
  },
  mealDetailGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  detailBox: {
    flex: 1,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e5ece4',
    borderRadius: 12,
    padding: 10,
  },
  detailLabel: {
    fontSize: 10,
    color: '#6c7c73',
    fontWeight: '700',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#264735',
  },
  ingredientListText: {
    fontSize: 12,
    color: '#4f6157',
    lineHeight: 16,
  },
  btnReset: {
    backgroundColor: '#156133',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  btnResetText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // ── Selected Ingredients Panel ──────────────────────────────────────────────
  selectedPanel: {
    width: '100%',
    backgroundColor: '#fdf6ec',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e8c87a',
    padding: 18,
    marginBottom: 28,
  },
  selectedPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  selectedPanelTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#8A3E08',
    marginLeft: 8,
  },
  selectedPanelSubtitle: {
    fontSize: 12,
    color: '#7a6040',
    marginBottom: 16,
  },

  // Individual selected ingredient card
  selectedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6d8b8',
    padding: 14,
    marginBottom: 12,
  },
  selectedCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  selectedCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#156133',
    marginBottom: 2,
  },
  selectedCardAvail: {
    fontSize: 11,
    color: '#7a6040',
    fontWeight: '600',
  },
  removeBtn: {
    padding: 2,
  },

  // Qty controls row
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  qtyBtn: {
    backgroundColor: '#C0392B',
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnAdd: {
    backgroundColor: '#277e48',
  },
  qtyInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  qtyInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
    textAlign: 'center',
  },
  qtyUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7a6040',
    marginLeft: 6,
  },

  // Category filter row
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginBottom: 12,
  },

  // Category filter pills
  categoryPill: {
    borderWidth: 1.5,
    borderColor: '#156133',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFF',
    marginRight: 8,
    marginBottom: 8,
  },
  categoryPillActive: {
    backgroundColor: '#156133',
    borderColor: '#156133',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#156133',
  },
  categoryPillTextActive: {
    color: '#FFF',
  },

  // Out of stock states
  tableRowOutOfStock: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    opacity: 0.75,
  },
  checkboxDisabled: {
    borderColor: '#ccc',
    backgroundColor: '#ebebeb',
  },
  outOfStockTag: {
    marginLeft: 8,
    backgroundColor: '#fde8e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    overflow: 'hidden',
  },
  outOfStockTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b91c1c',
  },
  noAvailableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(185,28,28,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(185,28,28,0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    width: '100%',
  },
  noAvailableText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  // Progress bar
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#ede6d6',
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#db7a2f',
    borderRadius: 99,
  },
  progressLabel: {
    fontSize: 10,
    color: '#9a8060',
    fontWeight: '600',
    textAlign: 'right',
  },
});
