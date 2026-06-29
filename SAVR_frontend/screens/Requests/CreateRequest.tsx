import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform, Image, KeyboardAvoidingView, Alert, ActivityIndicator, Modal, FlatList, StatusBar, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { ApiService } from '../../services/api';
import CustomDropdown from '../../components/CustomDropdown';
import NotificationBell from '../../components/NotificationBell';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type FoodItem = { id: number; name: string; category: string; qty: string; unit: string };
type RequestedFood = { id: number; name: string; category: string; qty: string; unit: string };

const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  'Canned Goods': 'Canned Goods: Non-Perishable',
  'Prepared Meals': 'Prepared Meals: Perishable',
  'Beverages': 'Beverages: Non-Perishable',
  'Dry Goods': 'Dry Goods: Non-Perishable',
};

const PRESET_FOODS_BY_CATEGORY: Record<string, string[]> = {
  'Beverages': ["Bottled Water", "Canned Juice", "Soda", "Milk", "Coffee"],
  'Canned Goods': ["Canned Sardines", "Canned Tuna", "Canned Corned Beef", "Canned Meat Loaf"],
  'Prepared Meals': [
    "Arroz Caldo",
    "Champorado",
    "Chicken Adobo",
    "Chicken Afritada",
    "Egg Sandwich Filling",
    "Fried Chicken",
    "Giniling",
    "Lugaw",
    "Munggo Guisado",
    "Sandwich",
    "Sardines with Vegetables",
    "Sopas",
    "Sotanghon Soup",
    "Tuna Veggie Mix",
    "Veggie Stir-Fry"
  ],
  'Dry Goods': ["Rice", "Sugar", "Salt", "Flour", "Pasta", "Noodles"]
};

const getCategoryLabel = (cat: string | null) => {
  if (!cat) return '';
  return CATEGORY_DISPLAY_MAP[cat] || cat;
};

// â”€â”€â”€ Category icon map (MaterialCommunityIcons names) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type IconEntry = { lib: 'mci' | 'ion'; name: string };
const ICON_COLOR = '#6B7280';
const ICON_COLOR_ACTIVE = '#fff';
const CATEGORY_ICON_MAP: Record<string, IconEntry> = {
  Meat: { lib: 'mci', name: 'food-steak' },
  Vegetables: { lib: 'mci', name: 'leaf' },
  Fruits: { lib: 'mci', name: 'fruit-cherries' },
  'Grains & Cereals': { lib: 'mci', name: 'barley' },
  'Canned Goods': { lib: 'mci', name: 'package-variant-closed' },
  Dairy: { lib: 'mci', name: 'cheese' },
  'Dry Goods': { lib: 'mci', name: 'package-variant' },
  'Liquid Goods': { lib: 'mci', name: 'bottle-soda-outline' },
  Beverages: { lib: 'mci', name: 'bottle-soda-outline' },
  'Fats & Oils': { lib: 'mci', name: 'oil' },
  'Protein Alternatives': { lib: 'mci', name: 'seed-outline' },
  'Sugars & Sweets': { lib: 'mci', name: 'cookie' },
  'Prepared Meals': { lib: 'mci', name: 'food-variant' },
};
const DEFAULT_CAT_ICON: IconEntry = { lib: 'mci', name: 'package-variant' };

function CatIcon({ cat, size = 22, active = false }: { cat: string; size?: number; active?: boolean }) {
  const entry = CATEGORY_ICON_MAP[cat] || DEFAULT_CAT_ICON;
  const c = active ? ICON_COLOR_ACTIVE : ICON_COLOR;
  if (entry.lib === 'ion') return <Ionicons name={entry.name as any} size={size} color={c} />;
  return <MaterialCommunityIcons name={entry.name as any} size={size} color={c} />;
}

// â”€â”€â”€ Common units â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const UNIT_OPTIONS = ['kg', 'pcs', 'meal', 'L'];

const CATEGORY_UNIT_MAP: Record<string, string> = {
  'Canned Goods': 'pcs',
  'Prepared Meals': 'meal',
  'Beverages': 'L',
  'Dry Goods': 'kg',
};

function getAllowedUnits(category: string | null): string[] {
  if (!category) return UNIT_OPTIONS;
  const locked = CATEGORY_UNIT_MAP[category];
  return locked ? [locked] : UNIT_OPTIONS;
}

export default function CreateRequest({ navigation }: any) {
  const [requestType, setRequestType] = useState<'food' | 'financial'>('food');
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false); // Android
  const [showIOSPicker, setShowIOSPicker] = useState(false);   // iOS Modal
  const [dateObj, setDateObj] = useState(new Date());

  const [showEndDatePicker, setShowEndDatePicker] = useState(false); // Android
  const [showEndIOSPicker, setShowEndIOSPicker] = useState(false);   // iOS Modal
  const [endDateObj, setEndDateObj] = useState(new Date());
  const isSubmitting = useRef(false);

  const [location, setLocation] = useState({
    latitude: 14.4445, // roughly Las Pinas
    longitude: 120.9842,
    latitudeDelta: 0.0422,
    longitudeDelta: 0.0221,
  });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const mapRef = useRef<MapView>(null);
  const isProgrammaticMove = useRef(false);

  // Food request details state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFoodName, setSelectedFoodName] = useState<string>('');
  const [itemQty, setItemQty] = useState('');
  const [itemUnit, setItemUnit] = useState('kg');
  const [requestedFoods, setRequestedFoods] = useState<RequestedFood[]>([]);
  const [dynamicFoods, setDynamicFoods] = useState<Record<string, string[]>>({
    'Beverages': PRESET_FOODS_BY_CATEGORY['Beverages'],
    'Canned Goods': PRESET_FOODS_BY_CATEGORY['Canned Goods'],
    'Prepared Meals': PRESET_FOODS_BY_CATEGORY['Prepared Meals'],
    'Dry Goods': PRESET_FOODS_BY_CATEGORY['Dry Goods']
  });

  // Separate state for each tab — changes in one never bleed into the other
  const [foodForm, setFoodForm] = useState({
    title: '', population: '', age_start: '', age_end: '',
    street: '', barangay: '', city_municipality: '', postal_zip_code: '',
    needed_date: '', end_date: '', urgency_level: '',
  });
  const [financialForm, setFinancialForm] = useState({
    title: '', financial_amount: '', population: '', age_start: '', age_end: '',
    street: '', barangay: '', city_municipality: '', postal_zip_code: '',
    needed_date: '', end_date: '', urgency_level: '',
    receiving_method: '', account_name: '', account_number: '',
  });

  // Computed read-only view of the active form — never set this directly
  const form = (requestType === 'food' ? foodForm : financialForm) as {
    title: string; financial_amount: string; population: string;
    age_start: string; age_end: string; street: string; barangay: string;
    city_municipality: string; postal_zip_code: string; needed_date: string;
    end_date: string; urgency_level: string; receiving_method: string;
    account_name: string; account_number: string;
  };

  const [refreshing, setRefreshing] = useState(false);

  // Write to whichever form tab is currently active
  const updateForm = (key: string, val: string) => {
    if (requestType === 'food') {
      setFoodForm(prev => ({ ...prev, [key]: val }));
    } else {
      setFinancialForm(prev => ({ ...prev, [key]: val }));
    }
  };

  // Used by startup geocoder — populate address in both forms at once
  const updateBothForms = (key: string, val: string) => {
    setFoodForm(prev => ({ ...prev, [key]: val }));
    setFinancialForm(prev => ({ ...prev, [key]: val }));
  };

  const geocodeAddress = async (address: string) => {
    if (!address.trim()) return;
    setIsGeocoding(true);
    try {
      const results = await Location.geocodeAsync(address);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        const newRegion = { latitude, longitude, latitudeDelta: 0.0422, longitudeDelta: 0.0221 };
        isProgrammaticMove.current = true;
        setLocation(newRegion);
        mapRef.current?.animateToRegion(newRegion, 800);
        await reverseGeocode(latitude, longitude);
      } else {
        Alert.alert('Address Not Found', 'Could not locate that address. Try adding more detail (city, country).');
      }
    } catch {
      Alert.alert('Error', 'Failed to locate the address. Check your connection and try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    setIsReverseGeocoding(true);
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        const parts = [place.streetNumber, place.street, place.district, place.city, place.region, place.country]
          .filter(Boolean);
        const fullAddr = parts.join(', ');
        updateForm('street', fullAddr);
        updateForm('barangay', place.district || place.street || 'Manual');
        updateForm('city_municipality', place.city || place.subregion || 'Manual');
        updateForm('postal_zip_code', place.postalCode || '');
      }
    } catch { }
    finally {
      setIsReverseGeocoding(false);
    }
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      try {
        let loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;
        setLocation(prev => ({ ...prev, latitude, longitude }));

        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (place) {
          const parts = [place.streetNumber, place.street, place.city, place.region, place.country]
            .filter(Boolean);
          const fullAddr = parts.join(', ');
          updateBothForms('street', fullAddr);
          updateBothForms('barangay', place.district || place.street || 'Manual');
          updateBothForms('city_municipality', place.city || place.subregion || 'Manual');
          updateBothForms('postal_zip_code', place.postalCode || '');
        }
      } catch (e) { }
    })();
  }, []);

  const resetForm = () => {
    setFoodForm({ title: '', population: '', age_start: '', age_end: '', street: '', barangay: '', city_municipality: '', postal_zip_code: '', needed_date: '', end_date: '', urgency_level: '' });
    setFinancialForm({ title: '', financial_amount: '', population: '', age_start: '', age_end: '', street: '', barangay: '', city_municipality: '', postal_zip_code: '', needed_date: '', end_date: '', urgency_level: '', receiving_method: '', account_name: '', account_number: '' });
    setRequestedFoods([]);
    setSelectedCategory(null);
    setSelectedFoodName('');
    setItemQty('');
    setDateObj(new Date());
    setEndDateObj(new Date());
    isSubmitting.current = false;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setFoodForm({ title: '', population: '', age_start: '', age_end: '', street: '', barangay: '', city_municipality: '', postal_zip_code: '', needed_date: '', end_date: '', urgency_level: '' });
    setFinancialForm({ title: '', financial_amount: '', population: '', age_start: '', age_end: '', street: '', barangay: '', city_municipality: '', postal_zip_code: '', needed_date: '', end_date: '', urgency_level: '', receiving_method: '', account_name: '', account_number: '' });
    setDateObj(new Date());
    setEndDateObj(new Date());
    setRequestedFoods([]);
    setSelectedCategory(null);
    setSelectedFoodName('');
    setItemQty('');
    setRefreshing(false);
  };

  useEffect(() => {
    if (requestType !== 'food') return;

    const fetchBackendData = async () => {
      let bevList: string[] = [];
      let cannedList: string[] = [];
      let prepList: string[] = [];
      let dryList: string[] = [];

      try {
        const rawRes = await ApiService.getInventory();
        if (rawRes.data?.success) {
          const items = rawRes.data.items || [];
          items.forEach((item: any) => {
            const name = item.name || item.food_name;
            const cat = (item.category || '').toLowerCase().trim();
            if (!name) return;

            if (cat.startsWith('beverage') || cat.startsWith('liquid')) {
              bevList.push(name);
            } else if (cat.startsWith('canned')) {
              cannedList.push(name);
            } else if (cat === 'prepared meals' || cat === 'prep meal') {
              prepList.push(name);
            } else if (cat.startsWith('dry') || cat.includes('dry goods')) {
              dryList.push(name);
            }
          });
        }
      } catch (err) {
        console.error('Failed to fetch raw inventory:', err);
      }

      try {
        const prepRes = await ApiService.getPreparedMeals();
        if (prepRes.data?.success) {
          const items = prepRes.data.items || [];
          items.forEach((item: any) => {
            const name = item.name || item.food_name;
            if (name) prepList.push(name);
          });
        }
      } catch (err) {
        console.error('Failed to fetch prepared meals:', err);
      }

      try {
        const mealsRes = await ApiService.getBeneficiaryMeals();
        const mealNames: string[] = Array.isArray(mealsRes.data) ? mealsRes.data : [];
        const existingLower = new Set(prepList.map((n: string) => n.toLowerCase()));
        mealNames.forEach((name: string) => {
          if (name && !existingLower.has(name.toLowerCase())) {
            prepList.push(name);
          }
        });
      } catch (err) {
        console.error('Failed to fetch meal names:', err);
      }

      // De-duplicate lists
      bevList = [...new Set(bevList)].sort();
      cannedList = [...new Set(cannedList)].sort();
      prepList = [...new Set(prepList)].sort();
      dryList = [...new Set(dryList)].sort();

      setDynamicFoods({
        'Beverages': bevList.length > 0 ? bevList : PRESET_FOODS_BY_CATEGORY['Beverages'],
        'Canned Goods': cannedList.length > 0 ? cannedList : PRESET_FOODS_BY_CATEGORY['Canned Goods'],
        'Prepared Meals': prepList.length > 0 ? prepList : PRESET_FOODS_BY_CATEGORY['Prepared Meals'],
        'Dry Goods': dryList.length > 0 ? dryList : PRESET_FOODS_BY_CATEGORY['Dry Goods'],
      });
    };

    fetchBackendData();
  }, [requestType, refreshing]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    // Android: dismiss fires with undefined â€” just close picker, don't update
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'dismissed' || !selectedDate) return;
    }
    const currentDate = selectedDate || dateObj;
    setDateObj(currentDate);
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    updateForm('needed_date', `${yyyy}-${mm}-${dd}`);
  };

  const confirmIOSDate = () => {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    updateForm('needed_date', `${yyyy}-${mm}-${dd}`);
    setShowIOSPicker(false);
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
      if (event.type === 'dismissed' || !selectedDate) return;
    }
    const currentDate = selectedDate || endDateObj;
    setEndDateObj(currentDate);
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    updateForm('end_date', `${yyyy}-${mm}-${dd}`);
  };

  const confirmIOSEndDate = () => {
    const yyyy = endDateObj.getFullYear();
    const mm = String(endDateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(endDateObj.getDate()).padStart(2, '0');
    updateForm('end_date', `${yyyy}-${mm}-${dd}`);
    setShowEndIOSPicker(false);
  };

  const addFoodToList = () => {
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a food category.');
      return;
    }
    if (!selectedFoodName) {
      Alert.alert('Error', 'Please select a food name.');
      return;
    }
    if (!itemQty || isNaN(Number(itemQty)) || Number(itemQty) <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
      return;
    }
    if (!itemUnit.trim()) {
      Alert.alert('Invalid Unit', 'Please enter a unit.');
      return;
    }

    const alreadyIdx = requestedFoods.findIndex(
      f => f.category === selectedCategory && f.name === selectedFoodName
    );

    if (alreadyIdx > -1) {
      setRequestedFoods(prev => {
        const copy = [...prev];
        copy[alreadyIdx] = {
          ...copy[alreadyIdx],
          qty: itemQty,
          unit: itemUnit.trim()
        };
        return copy;
      });
    } else {
      setRequestedFoods(prev => [
        ...prev,
        {
          id: Date.now(),
          name: selectedFoodName,
          category: selectedCategory,
          qty: itemQty,
          unit: itemUnit.trim()
        }
      ]);
    }
    setSelectedFoodName('');
    setItemQty('');
  };

  const removeFood = (id: number) => setRequestedFoods(prev => prev.filter(f => f.id !== id));

  const handleSubmit = async () => {
    if (isSubmitting.current) return;
    if (!form.title || !form.urgency_level || !form.population || !form.street || !form.barangay || !form.city_municipality || !form.needed_date || !form.end_date) {
      Alert.alert('Error', 'Please fill out all required fields marked with an asterisk (*).');
      return;
    }
    if (requestType === 'food' && requestedFoods.length === 0) {
      Alert.alert('Error', 'Please add at least one food item to your request.');
      return;
    }
    if (requestType === 'financial') {
      if (!form.financial_amount || isNaN(Number(form.financial_amount)) || Number(form.financial_amount) <= 0) {
        Alert.alert('Error', 'Please enter a valid amount needed.');
        return;
      }
      if (!form.receiving_method || !form.account_name || !form.account_number) {
        Alert.alert('Error', 'Please fill out all receiving account details.');
        return;
      }
    }
    isSubmitting.current = true;
    setIsLoading(true);
    try {
      const payload = {
        ...form,
        type: requestType,
        latitude: location.latitude,
        longitude: location.longitude,
        food_items: requestedFoods.map(f => ({ id: f.id, food_name: f.name, food_type: f.category, qty: f.qty, unit: f.unit })),
      };
      const res = await ApiService.submitBeneficiaryRequest(payload);
      if (res.data.success) {
        resetForm();
        Alert.alert('Success', 'Your request has been submitted successfully.');
      } else {
        Alert.alert('Error', res.data.message || 'Failed to submit request.');
        isSubmitting.current = false;
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Connection error.');
      isSubmitting.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#FFFFFF' }} edges={['top']} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
        {/* TOP BAR HEADER */}
        <View style={styles.topHeader}>
          <Image source={require('../../assets/images/logo/logobrown.png')} style={styles.logoImage} resizeMode="contain" />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NotificationBell navigation={navigation} color="#544434" size={28} style={{ marginRight: 5 }} />
            <TouchableOpacity onPress={() => navigation.openDrawer()}>
              <Ionicons name="menu-outline" size={32} color="#544434" />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#00592d']}
              tintColor="#00592d"
            />
          }
        >

          {/* Title */}
          <View style={styles.titleRow}>
            <Image
              source={require('../../assets/images/icons/createrequesticon.png')}
              style={styles.titleIconImage}
              resizeMode="contain"
            />
            <Text style={styles.pageTitle}>Create Request</Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity style={[styles.tabButton, requestType === 'food' ? styles.tabActive : styles.tabInactive]} onPress={() => setRequestType('food')} activeOpacity={0.9}>
              <Image
                source={require('../../assets/images/icons/foodicon.png')}
                style={{
                  width: 22,
                  height: 22,
                  marginRight: 8,
                  tintColor: requestType === 'food' ? '#FFFFFF' : '#222222',
                }}
                resizeMode="contain"
              />
              <Text style={[styles.tabText, requestType === 'food' ? styles.tabTextActive : styles.tabTextInactive]}>FOOD</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, requestType === 'financial' ? styles.tabActive : styles.tabInactive]} onPress={() => setRequestType('financial')} activeOpacity={0.9}>
              <Image
                source={require('../../assets/images/icons/financialicon.png')}
                style={{
                  width: 20,
                  height: 20,
                  marginRight: 8,
                  tintColor: requestType === 'financial' ? '#FFFFFF' : '#222222',
                }}
                resizeMode="contain"
              />
              <Text style={[styles.tabText, requestType === 'financial' ? styles.tabTextActive : styles.tabTextInactive]}>FINANCIAL</Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>

            <Text style={styles.inputLabel}>Name of Drive <Text style={{ color: '#E8A835' }}>*</Text></Text>
            <TextInput
              style={styles.inputBox}
              placeholder="e.g. Kapatiran Fire Tondo Relief"
              placeholderTextColor="#A5D1B8"
              value={form.title}
              onChangeText={(val) => updateForm('title', val)}
            />

            <Text style={styles.inputLabel}>Urgency Level <Text style={{ color: '#E8A835' }}>*</Text></Text>
            <CustomDropdown
              selectedValue={form.urgency_level}
              onValueChange={(val) => updateForm('urgency_level', val)}
              placeholder="Select Level"
              items={[{ label: 'LOW', value: 'LOW' }, { label: 'MEDIUM', value: 'MEDIUM' }, { label: 'HIGH', value: 'HIGH' }]}
              style={[styles.inputBox, { marginBottom: 18 }]}
            />

            {/* â”€â”€ Conditional form layout: Financial vs Food â”€â”€ */}
            {requestType === 'financial' ? (
              <View>
                <Text style={styles.inputLabel}>Amount of Money Needed (â‚±) <Text style={{ color: '#E8A835' }}>*</Text></Text>
                <TextInput
                  style={[styles.inputBox, { marginBottom: 18 }]}
                  placeholder="â‚±5000"
                  placeholderTextColor="#A5D1B8"
                  keyboardType="numeric"
                  value={form.financial_amount}
                  onChangeText={(val) => updateForm('financial_amount', val)}
                  onBlur={() => {
                    if (form.financial_amount) {
                      const clean = form.financial_amount.replace(/[^0-9.]/g, '');
                      const parsed = parseFloat(clean);
                      if (!isNaN(parsed)) {
                        updateForm('financial_amount', parsed.toFixed(2));
                      }
                    }
                  }}
                />

                {/* Population & Age */}
                <View style={[styles.rowInputs, { marginBottom: 18 }]}>
                  <View style={{ flex: 1, marginRight: 6, justifyContent: 'flex-end' }}>
                    <Text style={styles.inputLabel} numberOfLines={1} adjustsFontSizeToFit>Number of Population <Text style={{ color: '#E8A835' }}>*</Text></Text>
                    <TextInput style={[styles.inputBox, { marginBottom: 0 }]} placeholder="e.g. 200" placeholderTextColor="#A5D1B8" textAlign="left" keyboardType="numeric" value={form.population} onChangeText={(val) => updateForm('population', val)} />
                  </View>
                  <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <Text style={styles.inputLabel}>Age Range</Text>
                    <View style={[styles.rowInputsNoMargin, { marginBottom: 0 }]}>
                      <TextInput style={[styles.inputBox, { flex: 1, marginBottom: 0 }]} placeholder="Min" placeholderTextColor="#A5D1B8" textAlign="center" keyboardType="numeric" value={form.age_start} onChangeText={(val) => updateForm('age_start', val)} />
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', alignSelf: 'center', marginBottom: 0, paddingHorizontal: 6 }}>-</Text>
                      <TextInput style={[styles.inputBox, { flex: 1, marginBottom: 0 }]} placeholder="Max" placeholderTextColor="#A5D1B8" textAlign="center" keyboardType="numeric" value={form.age_end} onChangeText={(val) => updateForm('age_end', val)} />
                    </View>
                  </View>
                </View>

                {/* Receiving Account Details Header */}
                <View style={styles.receivingAccHeader}>
                  <Ionicons name="wallet-outline" size={18} color="#E8A835" />
                  <Text style={styles.receivingAccTitle}>Receiving Account Details</Text>
                </View>

                <Text style={styles.inputLabel}>Receiving Method <Text style={{ color: '#E8A835' }}>*</Text></Text>
                <CustomDropdown
                  selectedValue={form.receiving_method}
                  onValueChange={(val) => updateForm('receiving_method', val)}
                  placeholder="Select Method"
                  items={[
                    { label: 'E-Wallet', value: 'E-Wallet' },
                    { label: 'Bank', value: 'Bank' },
                  ]}
                  style={[styles.inputBox, { marginBottom: 18 }]}
                />

                <Text style={styles.inputLabel}>Account Name <Text style={{ color: '#E8A835' }}>*</Text></Text>
                <TextInput
                  style={[styles.inputBox, { marginBottom: 18 }]}
                  placeholder="eg. Juan dela Cruz"
                  placeholderTextColor="#A5D1B8"
                  value={form.account_name}
                  onChangeText={(val) => updateForm('account_name', val)}
                />

                <Text style={styles.inputLabel}>Account Number / Mobile No. <Text style={{ color: '#E8A835' }}>*</Text></Text>
                <TextInput
                  style={[styles.inputBox, { marginBottom: 18 }]}
                  placeholder="eg. 09171234567 or bank account no."
                  placeholderTextColor="#A5D1B8"
                  keyboardType="numeric"
                  value={form.account_number}
                  onChangeText={(val) => updateForm('account_number', val)}
                />
              </View>
            ) : (
              <View>
                {/* Population & Age */}
                <View style={[styles.rowInputs, { marginBottom: 18 }]}>
                  <View style={{ flex: 1, marginRight: 6, justifyContent: 'flex-end' }}>
                    <Text style={styles.inputLabel} numberOfLines={1} adjustsFontSizeToFit>Number of Population <Text style={{ color: '#E8A835' }}>*</Text></Text>
                    <TextInput style={[styles.inputBox, { marginBottom: 0 }]} placeholder="e.g. 200" placeholderTextColor="#A5D1B8" textAlign="left" keyboardType="numeric" value={form.population} onChangeText={(val) => updateForm('population', val)} />
                  </View>
                  <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <Text style={styles.inputLabel}>Age Range</Text>
                    <View style={[styles.rowInputsNoMargin, { marginBottom: 0 }]}>
                      <TextInput style={[styles.inputBox, { flex: 1, marginBottom: 0 }]} placeholder="Min" placeholderTextColor="#A5D1B8" textAlign="center" keyboardType="numeric" value={form.age_start} onChangeText={(val) => updateForm('age_start', val)} />
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', alignSelf: 'center', marginBottom: 0, paddingHorizontal: 6 }}>-</Text>
                      <TextInput style={[styles.inputBox, { flex: 1, marginBottom: 0 }]} placeholder="Max" placeholderTextColor="#A5D1B8" textAlign="center" keyboardType="numeric" value={form.age_end} onChangeText={(val) => updateForm('age_end', val)} />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Address / Coverage Row */}
            <View style={{ marginBottom: 18 }}>
              <Text style={styles.inputLabel}>Address / Coverage <Text style={{ color: '#E8A835' }}>*</Text></Text>
              <TextInput
                style={[styles.inputBox, { height: undefined, minHeight: 42, paddingVertical: 8 }]}
                multiline={true}
                blurOnSubmit={true}
                placeholder="Street, Barangay, City"
                placeholderTextColor="#A5D1B8"
                value={form.street}
                onChangeText={(val) => {
                  updateForm('street', val);
                  updateForm('barangay', val ? (form.barangay || 'Manual') : '');
                  updateForm('city_municipality', val ? (form.city_municipality || 'Manual') : '');
                }}
                onSubmitEditing={() => geocodeAddress(form.street)}
                returnKeyType="search"
              />
            </View>

            {/* Google Map */}
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                region={location}
                scrollEnabled={true}
                zoomEnabled={true}
                pitchEnabled={true}
                rotateEnabled={true}
                onRegionChangeComplete={(reg) => {
                  setLocation(reg);
                  if (isProgrammaticMove.current) {
                    isProgrammaticMove.current = false;
                  } else {
                    reverseGeocode(reg.latitude, reg.longitude);
                  }
                }}
              />
              <View pointerEvents="none" style={styles.markerFixed}>
                <Ionicons name="location" size={40} color="red" />
              </View>
            </View>

            {/* Dates Row */}
            <View style={[styles.rowInputs, { marginBottom: 18 }]}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.inputLabel}>Start Date <Text style={{ color: '#E8A835' }}>*</Text></Text>
                <TouchableOpacity
                  style={[styles.inputBox, { justifyContent: 'center', marginBottom: 0 }]}
                  onPress={() => {
                    if (Platform.OS === 'ios') setShowIOSPicker(true);
                    else setShowDatePicker(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: form.needed_date ? '#FFF' : '#A5D1B8', fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {form.needed_date || 'mm/dd/yyyy'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#FFF" />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>End Date <Text style={{ color: '#E8A835' }}>*</Text></Text>
                <TouchableOpacity
                  style={[styles.inputBox, { justifyContent: 'center', marginBottom: 0 }]}
                  onPress={() => {
                    if (Platform.OS === 'ios') setShowEndIOSPicker(true);
                    else setShowEndDatePicker(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: form.end_date ? '#FFF' : '#A5D1B8', fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {form.end_date || 'mm/dd/yyyy'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#FFF" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Android native pickers */}
            {Platform.OS === 'android' && showDatePicker && (
              <DateTimePicker
                value={dateObj}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={onDateChange}
              />
            )}
            {Platform.OS === 'android' && showEndDatePicker && (
              <DateTimePicker
                value={endDateObj}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={onEndDateChange}
              />
            )}

            {/* iOS Modal pickers */}
            <Modal visible={showIOSPicker} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <View style={styles.modalSheet}>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowIOSPicker(false)}>
                      <Text style={styles.modalCancel}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Start Date</Text>
                    <TouchableOpacity onPress={confirmIOSDate}>
                      <Text style={styles.modalDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
                    <DateTimePicker
                      value={dateObj}
                      mode="date"
                      display="spinner"
                      minimumDate={new Date()}
                      onChange={(e, d) => { if (d) setDateObj(d); }}
                      style={{ width: '100%', alignSelf: 'center' }}
                      textColor="#1a1a1a"
                    />
                  </View>
                </View>
              </View>
            </Modal>

            <Modal visible={showEndIOSPicker} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <View style={styles.modalSheet}>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowEndIOSPicker(false)}>
                      <Text style={styles.modalCancel}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>End Date</Text>
                    <TouchableOpacity onPress={confirmIOSEndDate}>
                      <Text style={styles.modalDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
                    <DateTimePicker
                      value={endDateObj}
                      mode="date"
                      display="spinner"
                      minimumDate={new Date()}
                      onChange={(e, d) => { if (d) setEndDateObj(d); }}
                      style={{ width: '100%', alignSelf: 'center' }}
                      textColor="#1a1a1a"
                    />
                  </View>
                </View>
              </View>
            </Modal>
          </View>

          {/* â”€â”€ Food Details Card (outside green card) â”€â”€ */}
          {requestType === 'food' && (
            <View style={styles.foodDetailsCard}>
              <View style={styles.foodDetailsHeader}>
                <MaterialCommunityIcons name="food-variant" size={18} color="#00592d" />
                <Text style={styles.foodDetailsTitle}>Food Details <Text style={{ color: '#E8A835' }}>*</Text></Text>
              </View>

              {/* Category selector */}
              <CustomDropdown
                selectedValue={selectedCategory || ''}
                onValueChange={(val) => {
                  setSelectedCategory(val || null);
                  setSelectedFoodName('');
                  setItemQty('');
                  setItemUnit(CATEGORY_UNIT_MAP[val] ?? 'kg');
                }}
                placeholder="Food Category"
                items={[
                  { label: 'Canned Goods: Non-Perishable', value: 'Canned Goods' },
                  { label: 'Prepared Meals: Perishable', value: 'Prepared Meals' },
                  { label: 'Beverages: Non-Perishable', value: 'Beverages' },
                  { label: 'Dry Goods: Non-Perishable', value: 'Dry Goods' }
                ]}
                style={styles.fdCatDropdown}
                disableSort={true}
                placeholderTextColor="#A3A3A3"
              />

              {/* Row for Food Name, Qty, Unit, Add + */}
              <View style={styles.fdInputRow}>
                <View style={{ flex: 2.5 }}>
                  <CustomDropdown
                    selectedValue={selectedFoodName}
                    onValueChange={(val) => setSelectedFoodName(val)}
                    placeholder="Food Name"
                    items={
                      selectedCategory
                        ? (dynamicFoods[selectedCategory] || []).map(f => ({ label: f, value: f }))
                        : []
                    }
                    style={styles.fdFoodNameDropdown}
                    disableSort={true}
                    placeholderTextColor="#A3A3A3"
                  />
                </View>

                <View style={{ flex: 1.0 }}>
                  <TextInput
                    style={styles.fdQtyInputNew}
                    placeholder="Qty"
                    placeholderTextColor="#A3A3A3"
                    keyboardType="numeric"
                    value={itemQty}
                    onChangeText={setItemQty}
                    textAlign="center"
                  />
                </View>

                <View style={{ flex: 1.2 }}>
                  <CustomDropdown
                    selectedValue={itemUnit}
                    onValueChange={(val) => setItemUnit(val)}
                    placeholder="Unit"
                    items={getAllowedUnits(selectedCategory).map(u => ({ label: u, value: u }))}
                    style={styles.fdUnitDropdownNew}
                    disableSort={true}
                    placeholderTextColor="#A3A3A3"
                  />
                </View>

                <View style={{ flex: 1.0 }}>
                  <TouchableOpacity style={styles.fdAddBtnNew} onPress={addFoodToList} activeOpacity={0.8}>
                    <Ionicons name="add" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Table header */}
              <View style={styles.fdTableHeader}>
                <Text style={[styles.fdTableCol, { flex: 1 }]}>TYPE</Text>
                <Text style={[styles.fdTableCol, { flex: 2 }]}>FOOD NAME</Text>
                <Text style={[styles.fdTableCol, { flex: 1, textAlign: 'right' }]}>QTY</Text>
                <Text style={styles.fdTableCol}> </Text>
              </View>

              {/* Table rows */}
              {requestedFoods.length === 0 ? (
                <View style={styles.fdTableEmpty}>
                  <Text style={styles.fdTableEmptyText}>No items added yet</Text>
                </View>
              ) : (
                requestedFoods.map((f, idx) => (
                  <View key={`${f.id}-${idx}`} style={[styles.fdTableRow, idx < requestedFoods.length - 1 && styles.fdTableRowBorder]}>
                    <Text style={[styles.fdTableCell, { flex: 1 }]} numberOfLines={1}>{getCategoryLabel(f.category)}</Text>
                    <Text style={[styles.fdTableCell, styles.fdTableCellBold, { flex: 2 }]} numberOfLines={1}>{f.name}</Text>
                    <Text style={[styles.fdTableCell, styles.fdTableCellQty, { flex: 1, textAlign: 'right' }]}>{f.qty} {f.unit}</Text>
                    <TouchableOpacity onPress={() => removeFood(f.id)} style={{ paddingLeft: 10 }}>
                      <Ionicons name="trash-outline" size={15} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Submit */}
          <View style={styles.submitRow}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Submit</Text>}
            </TouchableOpacity>
          </View>
          <View style={{ height: 140 }} />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 18,
    paddingTop: 22,
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
  scrollContent: { paddingHorizontal: 22, paddingTop: 30 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  titleIcon: { marginRight: 12 },
  titleIconImage: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#00592d', letterSpacing: -0.5 },
  titleDivider: { height: 1, backgroundColor: '#A3A3A3', opacity: 0.3, marginHorizontal: -22, marginBottom: 25 },
  tabsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25, paddingHorizontal: 15 },
  tabButton: { flexDirection: 'row', width: '45%', height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  tabActive: { backgroundColor: '#D87A38', borderColor: '#C66C2E', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 5, elevation: 4 },
  tabInactive: { backgroundColor: '#FFFFFF', borderColor: '#666666' },
  tabText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  tabTextActive: { color: '#FFFFFF' },
  tabTextInactive: { color: '#222222' },

  formCard: { backgroundColor: '#00592d', borderRadius: 24, padding: 22, paddingBottom: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 10 },
  inputLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 2 },
  inputBox: { height: 42, borderWidth: 1, borderColor: '#71A987', borderRadius: 6, backgroundColor: 'transparent', paddingHorizontal: 12, color: '#FFFFFF', fontSize: 13, marginBottom: 18, textAlign: 'left' },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  rowInputsNoMargin: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },

  // â”€â”€ Food Details white card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  foodDetailsCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#E8EEE9', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 5 },
  foodDetailsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EAF2EC' },
  foodDetailsTitle: { fontSize: 16, fontWeight: '800', color: '#00592d', marginLeft: 8 },

  fdLabel: { fontSize: 11, fontWeight: '700', color: '#555', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  fdEmptyHint: { color: '#999', fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },

  loadingWrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  loadingText: { color: '#888', fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 14 },
  emptyIcon: { fontSize: 26, marginBottom: 4 },

  fdCatDropdown: {
    height: 42,
    borderWidth: 1,
    borderColor: '#C8DFD0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    marginBottom: 16,
    color: '#00592d',
  },
  fdInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 6,
  },
  fdFoodNameDropdown: {
    height: 42,
    borderWidth: 1,
    borderColor: '#C8DFD0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    color: '#00592d',
    width: '100%',
  },
  fdQtyInputNew: {
    height: 42,
    borderWidth: 1,
    borderColor: '#C8DFD0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    color: '#1a1a1a',
    fontSize: 12,
    textAlign: 'center',
    width: '100%',
  },
  fdUnitDropdownNew: {
    height: 42,
    borderWidth: 1,
    borderColor: '#C8DFD0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    color: '#00592d',
    width: '100%',
  },
  fdAddBtnNew: {
    backgroundColor: '#00592d',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  fdAddBtnTextNew: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  fdTableHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F9F6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 2 },
  fdTableCol: { fontSize: 10, fontWeight: '800', color: '#4A7A5A', textTransform: 'uppercase', letterSpacing: 0.4 },
  fdTableEmpty: { alignItems: 'center', paddingVertical: 20 },
  fdTableEmptyText: { color: '#bbb', fontSize: 12, fontStyle: 'italic' },
  fdTableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  fdTableRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F5F1' },
  fdTableCell: { fontSize: 12, color: '#555' },
  fdTableCellBold: { fontWeight: '700', color: '#1a1a1a' },
  fdTableCellQty: { color: '#00592d', fontWeight: '800' },

  submitRow: { alignItems: 'flex-end', marginTop: 20, paddingRight: 10 },
  submitBtn: { backgroundColor: '#D87A38', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12, minWidth: 120, alignItems: 'center' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalDone: { fontSize: 15, fontWeight: '700', color: '#00592d' },
  receivingAccHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  receivingAccTitle: {
    color: '#E8A835',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  disbursementHeader: {
    color: '#E8A835',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 15,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#71A987',
    marginBottom: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  markerFixed: {
    left: '50%',
    top: '50%',
    position: 'absolute',
    marginLeft: -20,
    marginTop: -40,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});
