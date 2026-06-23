import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { ApiService } from '../../services/api';

// KNOWN_INGREDIENTS list is loaded dynamically from database

const UNIT_OPTIONS = [
  { label: 'kg', value: 'kg' },
  { label: 'L', value: 'L' },
  { label: 'pcs', value: 'pcs' },
  { label: 'tsp', value: 'tsp' },
  { label: 'tbsp', value: 'tbsp' },
];

const getIngredientIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('carrot') || n.includes('onion') || n.includes('garlic') || n.includes('cabbage') || n.includes('spinach') || n.includes('kangkong') || n.includes('sayote') || n.includes('vegetable') || n.includes('leaf') || n.includes('tomato') || n.includes('ginger') || n.includes('pepper')) {
    return { name: 'leaf', color: '#2E7D32' };
  }
  if (n.includes('chicken') || n.includes('drumstick') || n.includes('pork') || n.includes('beef') || n.includes('meat') || n.includes('steak') || n.includes('ham') || n.includes('bacon')) {
    return { name: 'food', color: '#C62828' };
  }
  if (n.includes('fish') || n.includes('tuna') || n.includes('sardine') || n.includes('shrimp') || n.includes('seafood')) {
    return { name: 'fish', color: '#1565C0' };
  }
  if (n.includes('rice') || n.includes('grain') || n.includes('lentil') || n.includes('barley') || n.includes('wheat') || n.includes('bread') || n.includes('toast') || n.includes('flour')) {
    return { name: 'barley', color: '#EF6C00' };
  }
  if (n.includes('water') || n.includes('milk') || n.includes('liquid') || n.includes('oil') || n.includes('vinegar') || n.includes('soy sauce') || n.includes('sauce') || n.includes('broth')) {
    return { name: 'water', color: '#00838F' };
  }
  if (n.includes('egg') || n.includes('cheese') || n.includes('butter')) {
    return { name: 'egg', color: '#F9A825' };
  }
  return { name: 'food-variant', color: '#78909C' };
};

const parseQuantity = (val: string): number => {
  if (!val) return 0;
  val = val.trim();
  if (val.includes('/')) {
    const parts = val.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        return num / den;
      }
    }
  }
  return parseFloat(val) || 0;
};

// ── FILIPINO FOODS (supplements TheMealDB which has limited PH coverage) ────
const FILIPINO_FOODS = [
  "Adobo", "Afritada", "Arroz Caldo", "Atchara",
  "Bachoy", "Bagoong", "Bangus", "Batchoy", "Bibingka", "Biko", "Binagoongan", "Bistek", "Bopis", "Bulalo",
  "Caldereta", "Champorado", "Chicken Inasal", "Chopsuey", "Crispy Pata",
  "Daing na Bangus", "Dinuguan",
  "Embutido", "Escabeche",
  "Ginataang Bilo-Bilo", "Ginataang Mais", "Giniling", "Goto",
  "Halabos na Hipon",
  "Inasal",
  "Kare-Kare", "Kinilaw", "Kutsinta",
  "Laing", "Lechon", "Lechon Kawali", "Leche Flan", "Liempo", "Lomi", "Longganisa", "Lugaw", "Lumpia", "Lumpiang Shanghai",
  "Maja Blanca", "Mami", "Mechado", "Menudo", "Morcon",
  "Nilaga",
  "Pako Salad", "Paksiw", "Paksiw na Lechon", "Palitaw", "Pancit Bihon", "Pancit Canton", "Pancit Malabon", "Pancit Palabok", "Pinapaitan", "Pinakbet", "Pork Belly", "Puto",
  "Rellenong Bangus",
  "Sapin-sapin", "Sisig", "Sinuglaw", "Sinigang", "Sinigang na Baboy", "Sinigang na Hipon", "Sinigang na Isda", "Sinigang sa Miso", "Sopas",
  "Tapa", "Tinola", "Tocino", "Tortang Talong", "Turon",
];

export default function AddRecipe({ navigation }: any) {
  // Focus States for Inputs
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isDescFocused, setIsDescFocused] = useState(false);

  // Info Details State
  const [recipeName, setRecipeName] = useState('');
  const [commentDesc, setCommentDesc] = useState('');

  // Photo state
  const [recipePhoto, setRecipePhoto] = useState<string | null>(null);

  // Ingredients State
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ingredientsList, setIngredientsList] = useState<any[]>([]);
  const [openUnitPickerId, setOpenUnitPickerId] = useState<string | null>(null);

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setRecipeName('');
    setCommentDesc('');
    setRecipePhoto(null);
    setIngredientSearch('');
    setShowSuggestions(false);
    setIngredientsList([]);
    setOpenUnitPickerId(null);
    setIsSaving(false);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  }, []);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setRecipePhoto(result.assets[0].uri);
    }
  };

  const [dbIngredients, setDbIngredients] = useState<string[]>([]);

  React.useEffect(() => {
    const loadIngredients = async () => {
      const uniqueNames = new Set<string>();

      // 1. Load from backend
      try {
        const res = await ApiService.getIngredientsList();
        const dataArr = res.data?.data || res.data?.ingredients || [];
        if (Array.isArray(dataArr)) {
          dataArr.forEach((name: string) => {
            if (name) uniqueNames.add(name);
          });
        }
      } catch (e) {
        console.log('Backend ingredients API not available:', e);
      }

      // 2. Load from TheMealDB
      try {
        const res = await fetch('https://www.themealdb.com/api/json/v1/1/list.php?i=list');
        const data = await res.json();
        const items = data.meals || [];
        items.forEach((m: any) => {
          if (m.strIngredient) uniqueNames.add(m.strIngredient);
        });
      } catch (e) {
        console.log('TheMealDB API not available:', e);
      }

      // 3. Load hardcoded Filipino foods
      FILIPINO_FOODS.forEach(item => uniqueNames.add(item));

      setDbIngredients(Array.from(uniqueNames).sort());
    };
    loadIngredients();
  }, []);

  // Autocomplete suggestions based on known ingredients from DB
  const filteredSuggestions = dbIngredients.filter(item =>
    item.toLowerCase().includes(ingredientSearch.toLowerCase()) &&
    !ingredientsList.some(added => added.baseName.toLowerCase() === item.toLowerCase())
  );

  const isAdding = useRef(false);

  const addIngredientItem = (baseName: string) => {
    if (isAdding.current) return;
    const itemExist = ingredientsList.some(item => item.baseName.toLowerCase() === baseName.toLowerCase());
    if (itemExist) return;
    isAdding.current = true;
    setIngredientsList(prev => [
      ...prev,
      { id: String(Date.now()), baseName, qty: '1', unit: 'pcs' }
    ]);
    setIngredientSearch('');
    setShowSuggestions(false);
    setTimeout(() => { isAdding.current = false; }, 300);
  };

  const removeIngredientItem = (id: string) => {
    setIngredientsList(ingredientsList.filter(item => item.id !== id));
  };

  const updateIngredientItem = (id: string, key: string, value: any) => {
    setIngredientsList(
      ingredientsList.map(item => (item.id === id ? { ...item, [key]: value } : item))
    );
  };

  const incrementIngredientQty = (id: string) => {
    setIngredientsList(ingredientsList.map(item => {
      if (item.id !== id) return item;
      const current = parseFloat(item.qty) || 0;
      const step = (item.unit === 'kg' || item.unit === 'L') ? 0.5 : 1;
      const next = parseFloat((current + step).toFixed(2));
      return { ...item, qty: String(next) };
    }));
  };

  const decrementIngredientQty = (id: string) => {
    setIngredientsList(ingredientsList.map(item => {
      if (item.id !== id) return item;
      const current = parseFloat(item.qty) || 1;
      const isDecimal = item.unit === 'kg' || item.unit === 'L';
      const step = isDecimal ? 0.5 : 1;
      const minVal = isDecimal ? 0.5 : 1;
      const next = Math.max(minVal, parseFloat((current - step).toFixed(2)));
      return { ...item, qty: String(next) };
    }));
  };

  const handleSaveRecipe = () => {
    if (!recipeName.trim()) {
      Alert.alert('Validation Error', 'Recipe Name is required.');
      return;
    }
    if (ingredientsList.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one ingredient.');
      return;
    }
    handleSubmitRecipe();
  };

  const handleSubmitRecipe = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const formattedIngredients = ingredientsList.map(ing => {
      const totalQty = parseQuantity(ing.qty);
      return {
        ingredient_name: ing.baseName,
        qty_per_serving: totalQty,
        unit: ing.unit,
        is_optional: false,
      };
    });

    try {
      let imageUrl = null;
      if (recipePhoto) {
        const formData = new FormData();
        let filename = recipePhoto.split('/').pop() || `recipe_photo.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        if (!match) filename = `${filename}.jpg`;
        // @ts-ignore
        formData.append('recipe_photo', { uri: recipePhoto, name: filename, type });

        const uploadRes = await ApiService.uploadRecipeImage(formData);
        if (uploadRes.data && uploadRes.data.success) {
          imageUrl = uploadRes.data.image_url;
        }
      }

      const response = await ApiService.addRecipe({
        name: recipeName,
        comment_desc: commentDesc,
        tags: [],
        ingredients: formattedIngredients,
        image_url: imageUrl,
      });

      if (response.data && response.data.success) {
        Alert.alert('Success', 'Recipe added successfully!', [
          { text: 'OK', onPress: () => navigation.navigate('RecipesList') }
        ]);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to save recipe.');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to save recipe. Please check connection.';
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#156133" />


      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── PAGE HEADER: simple green bar (outside scroll) ── */}
        <View style={styles.pageHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.pageTitleText}>Add New Recipe</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#156133']}
              tintColor="#156133"
            />
          }
        >
          {/* ── SECTION 1: RECIPE DETAILS ── */}
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="book-open-outline" size={20} color="#156133" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>Recipe Details</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Recipe Name<Text style={{ color: '#E4B63F' }}> *</Text></Text>
            <View style={[styles.inputBox, isNameFocused && styles.inputBoxFocused]}>
              <TextInput
                style={styles.inputText}
                placeholder="Enter recipe name (e.g. Chicken Adobo)"
                placeholderTextColor="#B0B0B0"
                value={recipeName}
                onChangeText={setRecipeName}
                onFocus={() => setIsNameFocused(true)}
                onBlur={() => setIsNameFocused(false)}
              />
            </View>

            <Text style={styles.fieldLabel}>Description</Text>
            <View style={[styles.inputBox, styles.textareaBox, isDescFocused && styles.inputBoxFocused]}>
              <TextInput
                style={[styles.inputText, styles.textareaText]}
                placeholder="Provide a brief description of the recipe..."
                placeholderTextColor="#B0B0B0"
                multiline
                numberOfLines={4}
                value={commentDesc}
                onChangeText={setCommentDesc}
                onFocus={() => setIsDescFocused(true)}
                onBlur={() => setIsDescFocused(false)}
              />
            </View>

            {/* Photo picker - optional */}
            <Text style={styles.fieldLabel}>Recipe Photo <Text style={styles.optionalText}>(optional)</Text></Text>
            <TouchableOpacity style={styles.photoPickerBox} onPress={pickPhoto} activeOpacity={0.85}>
              {recipePhoto ? (
                <>
                  <Image source={{ uri: recipePhoto }} style={styles.photoPreview} />
                  <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setRecipePhoto(null)}>
                    <Ionicons name="close-circle" size={22} color="#FFF" />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera" size={32} color="#C4621A" />
                  <Text style={styles.photoPlaceholderText}>Upload Recipe Photo</Text>
                  <Text style={styles.photoPlaceholderSub}>Tap to browse your photo library</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── SECTION 2: ADD INGREDIENTS ── */}
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="food-apple-outline" size={20} color="#156133" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>Add Ingredients</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.selectIngLabel}>Select the ingredients<Text style={{ color: '#E4B63F' }}> *</Text></Text>

            {/* Search bar */}
            <View style={{ zIndex: 20, marginBottom: 4 }}>
              <View style={styles.searchBar}>
                <TextInput
                  style={styles.searchBarInput}
                  placeholder="Search for an ingredient..."
                  placeholderTextColor="#B0B0B0"
                  value={ingredientSearch}
                  onChangeText={(val) => {
                    setIngredientSearch(val);
                    setShowSuggestions(val.trim().length > 0);
                  }}
                  onFocus={() => setShowSuggestions(ingredientSearch.trim().length > 0)}
                />
                {ingredientSearch.length > 0 ? (
                  <TouchableOpacity onPress={() => { setIngredientSearch(''); setShowSuggestions(false); }}>
                    <Ionicons name="close-circle" size={20} color="#B0B0B0" style={{ marginRight: 4 }} />
                  </TouchableOpacity>
                ) : null}
                <Ionicons name="search" size={22} color="#222" style={{ marginRight: 2 }} />
              </View>

              {/* Suggestions dropdown */}
              {showSuggestions && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                    {filteredSuggestions.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.suggestionRow}
                        onPress={() => addIngredientItem(item)}
                      >
                        <Text style={styles.suggestionText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                    {ingredientSearch.trim().length > 0 && (
                      <TouchableOpacity
                        style={styles.suggestionRow}
                        onPress={() => addIngredientItem(ingredientSearch.trim())}
                      >
                        <Text style={[styles.suggestionText, { color: '#156133', fontWeight: '700' }]}>
                          Add "{ingredientSearch.trim()}"
                        </Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Ingredients List */}
            {ingredientsList.length === 0 ? (
              <View style={styles.emptyIngredientsWrap}>
                <MaterialCommunityIcons name="silverware-clean" size={40} color="#D0D0D0" />
                <Text style={styles.emptyIngredientsText}>No ingredients added yet.</Text>
                <Text style={styles.emptyIngredientsSubtext}>Search above to add ingredients.</Text>
              </View>
            ) : (
              <View style={styles.addedListContainer}>
                {/* Column header labels */}
                <View style={styles.ingColumnHeader}>
                  <Text style={styles.ingColLabel}>Ingredients</Text>
                  <Text style={styles.ingColLabelCenter}>Qty</Text>
                  <Text style={styles.ingColLabelRight}>Unit</Text>
                </View>
                {ingredientsList.map((item) => {
                  const iconDetail = getIngredientIcon(item.baseName);

                  const renderRightActions = () => (
                    <TouchableOpacity
                      style={styles.swipeDeleteAction}
                      onPress={() => removeIngredientItem(item.id)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trash" size={22} color="#FFF" />
                      <Text style={styles.swipeDeleteText}>Delete</Text>
                    </TouchableOpacity>
                  );

                  return (
                    <Swipeable
                      key={item.id}
                      renderRightActions={renderRightActions}
                      overshootRight={false}
                      friction={2}
                    >
                      <View style={styles.ingredientCardSelected}>
                        {/* SINGLE ROW: Icon+Name | Qty | Unit */}
                        <View style={styles.ingRowMain}>

                          {/* LEFT: icon + name */}
                          <View style={styles.ingRowLeft}>
                            <View style={styles.iconCircleBgSelected}>
                              <MaterialCommunityIcons name={iconDetail.name as any} size={18} color="#FFF" />
                            </View>
                            <Text style={styles.ingredientCardNameSelected} numberOfLines={1}>{item.baseName}</Text>
                          </View>

                          {/* MIDDLE: qty stepper */}
                          <View style={styles.ingRowQty}>
                            <TouchableOpacity onPress={() => decrementIngredientQty(item.id)} activeOpacity={0.7} style={styles.inlineQtyBtn}>
                              <Ionicons name="remove" size={14} color="#db7a2f" />
                            </TouchableOpacity>
                            <TextInput
                              style={styles.inlineQtyInput}
                              keyboardType="decimal-pad"
                              value={item.qty}
                              onChangeText={(val) => updateIngredientItem(item.id, 'qty', val.replace(/[^0-9.]/g, ''))}
                              maxLength={5}
                              selectTextOnFocus
                            />
                            <TouchableOpacity onPress={() => incrementIngredientQty(item.id)} activeOpacity={0.7} style={styles.inlineQtyBtn}>
                              <Ionicons name="add" size={14} color="#db7a2f" />
                            </TouchableOpacity>
                          </View>

                          {/* RIGHT: unit pill */}
                          <TouchableOpacity
                            onPress={() => setOpenUnitPickerId(openUnitPickerId === item.id ? null : item.id)}
                            activeOpacity={0.8}
                            style={styles.ingUnitPill}
                          >
                            <Text style={styles.ingUnitPillText}>{item.unit}</Text>
                            <Ionicons name="chevron-down" size={10} color="rgba(255,255,255,0.8)" style={{ marginLeft: 2 }} />
                          </TouchableOpacity>
                        </View>

                        {/* Unit picker pills (expand below when tapped) */}
                        {openUnitPickerId === item.id && (
                          <View style={styles.inlineUnitPickerRow}>
                            {UNIT_OPTIONS.map((u) => (
                              <TouchableOpacity
                                key={u.value}
                                onPress={() => {
                                  updateIngredientItem(item.id, 'unit', u.value);
                                  setOpenUnitPickerId(null);
                                }}
                                style={[
                                  styles.inlineUnitPill,
                                  item.unit === u.value ? styles.inlineUnitPillActive : styles.inlineUnitPillInactive
                                ]}
                                activeOpacity={0.8}
                              >
                                <Text style={[
                                  styles.inlineUnitPillText,
                                  item.unit === u.value ? styles.inlineUnitPillTextActive : styles.inlineUnitPillTextInactive
                                ]}>{u.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    </Swipeable>
                  );
                })}

                <TouchableOpacity
                  style={styles.addAnotherBtn}
                  onPress={() => setIngredientSearch('')}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#156133" style={{ marginRight: 6 }} />
                  <Text style={styles.addAnotherText}>Add Another Ingredient</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* SAVE BUTTON */}
          <View style={styles.premiumSaveBar}>
            <TouchableOpacity
              style={[styles.premiumSaveBtn, isSaving && { opacity: 0.7 }]}
              onPress={handleSaveRecipe}
              activeOpacity={0.85}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />
              ) : (
                <MaterialCommunityIcons name="chef-hat" size={20} color="#FFF" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.premiumSaveBtnText}>{isSaving ? 'Saving...' : 'Save Recipe'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6', // beautiful soft off-white background tint
  },
  // ── PAGE HEADER (clean green bar) ──
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#156133',
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitleText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  // ── SCROLL CONTENT ──
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 20,
  },
  // ── SECTION HEADER & TITLES ──
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#156133',
    letterSpacing: -0.2,
  },
  sectionTitleLarge: {
    fontSize: 18,
  },
  // ── WHITE CONTAINER CARD ──
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2EAE5', // soft light green/grey border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  // ── FIELDS ──
  fieldLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#444444', // clean label color inside white card
    marginBottom: 8,
    marginTop: 16,
  },
  inputBox: {
    borderWidth: 1,
    borderColor: '#E2EAE5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAF9', // soft light input background inside card
  },
  inputBoxFocused: {
    borderColor: '#156133',
    backgroundColor: '#FFFFFF',
  },
  inputText: {
    fontSize: 15,
    color: '#333',
  },
  textareaBox: {
    height: 120,
    paddingTop: 12,
    alignItems: 'flex-start',
  },
  textareaText: {
    textAlignVertical: 'top',
    height: '100%',
  },
  // ── PHOTO PICKER ──
  optionalText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#A0A0A0',
  },
  photoPickerBox: {
    borderWidth: 1.5,
    borderColor: '#C4621A',
    borderRadius: 18,
    height: 160,
    backgroundColor: '#FFF8F4',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C4621A',
    marginTop: 4,
  },
  photoPlaceholderSub: {
    fontSize: 11,
    color: '#B0B0B0',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 11,
  },
  // ── INGREDIENTS SECTION ──
  selectIngLabel: {
    fontSize: 14,
    color: '#444444',
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2EAE5',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: '#F8FAF9',
  },
  searchBarInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    height: '100%',
  },
  // ── SUGGESTIONS ──
  suggestionsContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderWidth: 1.2,
    borderColor: '#E2EAE5',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  suggestionRow: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  suggestionIconDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  // ── EMPTY STATE ──
  emptyIngredientsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: '#E9E4DF',
    borderRadius: 16,
    borderStyle: 'dashed',
    backgroundColor: '#FAFAFA',
  },
  emptyIngredientsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    marginTop: 8,
  },
  emptyIngredientsSubtext: {
    fontSize: 12,
    color: '#AAA',
    marginTop: 4,
  },
  // ── INGREDIENT CARDS (ORANGE) ──
  addedListContainer: {
    marginTop: 10,
  },
  ingColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 6,
    marginBottom: 2,
  },
  ingColLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: '#8A4F1D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ingColLabelCenter: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8A4F1D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 36,
  },
  ingColLabelRight: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8A4F1D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 32,
  },
  ingredientCardSelected: {
    backgroundColor: '#db7a2f',
    borderWidth: 1.5,
    borderColor: '#c4631a',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    shadowColor: '#c4631a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  // Single horizontal row
  ingRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  ingRowQty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  ingUnitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  ingUnitPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  iconCircleBgSelected: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  ingredientCardNameSelected: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  cardDeleteBtnCustom: {
    padding: 2,
    flexShrink: 0,
  },
  deleteCircleBg: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  // Qty stepper inside row
  inlineQtyBtn: {
    backgroundColor: '#FFF',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
  },
  inlineQtyInput: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    padding: 0,
    minWidth: 28,
    marginHorizontal: 4,
  },
  inlineUnitPickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  inlineUnitPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  inlineUnitPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  inlineUnitPillInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  inlineUnitPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  inlineUnitPillTextActive: {
    color: '#db7a2f',
  },
  inlineUnitPillTextInactive: {
    color: '#FFFFFF',
  },
  // ── ADD ANOTHER ──
  // ── SWIPE DELETE ACTION ──
  swipeDeleteAction: {
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginBottom: 10,
    marginLeft: 6,
  },
  swipeDeleteText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  addAnotherBtn: {

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: '#156133',
    borderRadius: 14,
    borderStyle: 'dashed',
    marginTop: 4,
    backgroundColor: '#F6FBF8',
  },
  addAnotherText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#156133',
  },
  // ── SAVE BUTTON ──
  premiumSaveBar: {
    marginTop: 28,
    marginBottom: 10,
  },
  premiumSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#156133',
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#0c3e20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  premiumSaveBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
