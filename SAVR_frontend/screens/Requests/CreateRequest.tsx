import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  TextInput, Platform, Image, KeyboardAvoidingView, Alert, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ApiService } from '../../services/api';
import CustomDropdown from '../../components/CustomDropdown';
import NotificationBell from '../../components/NotificationBell';

// ─── Types ────────────────────────────────────────────────────────────────────
type FoodItem = { id: number; name: string; category: string; qty: string; unit: string };
type RequestedFood = { id: number; name: string; category: string; qty: string; unit: string };

// ─── Category icon map (MaterialCommunityIcons names) ────────────────────────
type IconEntry = { lib: 'mci' | 'ion'; name: string };
const ICON_COLOR = '#6B7280';
const ICON_COLOR_ACTIVE = '#fff';
const CATEGORY_ICON_MAP: Record<string, IconEntry> = {
  Meat: { lib: 'mci', name: 'food-steak' },
  Vegetables: { lib: 'mci', name: 'leaf' },
  Fruits: { lib: 'mci', name: 'fruit-cherries' },
  Grains: { lib: 'mci', name: 'barley' },
  'Canned Goods': { lib: 'mci', name: 'package-variant-closed' },
  Dairy: { lib: 'mci', name: 'cheese' },
  Seafood: { lib: 'ion', name: 'fish-outline' },
  Bakery: { lib: 'mci', name: 'bread-slice' },
  Beverages: { lib: 'mci', name: 'cup-water' },
  'Rice/Grains': { lib: 'mci', name: 'rice' },
  Mixed: { lib: 'mci', name: 'food-variant' },
};
const DEFAULT_CAT_ICON: IconEntry = { lib: 'mci', name: 'package-variant' };

function CatIcon({ cat, size = 22, active = false }: { cat: string; size?: number; active?: boolean }) {
  const entry = CATEGORY_ICON_MAP[cat] || DEFAULT_CAT_ICON;
  const c = active ? ICON_COLOR_ACTIVE : ICON_COLOR;
  if (entry.lib === 'ion') return <Ionicons name={entry.name as any} size={size} color={c} />;
  return <MaterialCommunityIcons name={entry.name as any} size={size} color={c} />;
}

// ─── Common units ─────────────────────────────────────────────────────────────
const UNIT_OPTIONS = ['kg', 'pcs'];

export default function CreateRequest({ navigation }: any) {
  const [requestType, setRequestType] = useState<'food' | 'financial'>('food');
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false); // Android
  const [showIOSPicker, setShowIOSPicker] = useState(false);   // iOS Modal
  const [dateObj, setDateObj] = useState(new Date());
  const isSubmitting = useRef(false);

  // Inventory state
  const [inventoryItems, setInventoryItems] = useState<FoodItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [itemQty, setItemQty] = useState('');
  const [itemUnit, setItemUnit] = useState('kg');
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [requestedFoods, setRequestedFoods] = useState<RequestedFood[]>([]);

  const [form, setForm] = useState({
    title: '', financial_amount: '', population: '',
    age_start: '', age_end: '', street: '', barangay: '',
    city_municipality: '', postal_zip_code: '', needed_date: '', urgency_level: '',
  });

  const updateForm = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  // Fetch inventory — all data comes live from the food_inventory table via ApiService.getInventory()
  useEffect(() => {
    if (requestType !== 'food') return;
    setInventoryLoading(true);
    ApiService.getInventory()
      .then(res => {
        if (res.data?.success) {
          const raw = res.data.items || [];
          const parsed: FoodItem[] = raw.map((i: any) => ({
            id: i.id,
            name: i.name,
            category: i.category || 'Other',
            qty: i.qty,
            unit: i.unit || 'pcs',
          }));
          setInventoryItems(parsed);
        }
      })
      .catch(() => { })
      .finally(() => setInventoryLoading(false));
  }, [requestType]);

  const categories = [...new Set(inventoryItems.map(i => i.category))].sort();
  const itemsInCategory = selectedCategory
    ? inventoryItems.filter(i => i.category === selectedCategory)
    : [];

  const onDateChange = (event: any, selectedDate?: Date) => {
    // Android: dismiss fires with undefined — just close picker, don't update
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

  const addFoodToList = () => {
    if (!selectedItem) return;
    if (!itemQty || isNaN(Number(itemQty)) || Number(itemQty) <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
      return;
    }
    const already = requestedFoods.find(f => f.id === selectedItem.id);
    if (already) {
      setRequestedFoods(prev => prev.map(f => f.id === selectedItem.id ? { ...f, qty: itemQty, unit: itemUnit } : f));
    } else {
      setRequestedFoods(prev => [...prev, { ...selectedItem, qty: itemQty, unit: itemUnit }]);
    }
    setSelectedItem(null);
    setItemQty('');
    setShowItemModal(false);
  };

  const removeFood = (id: number) => setRequestedFoods(prev => prev.filter(f => f.id !== id));

  const handleSubmit = async () => {
    if (isSubmitting.current) return;
    if (!form.title || !form.urgency_level) {
      Alert.alert('Error', 'Please fill out at least the Name of Drive and Urgency Level.');
      return;
    }
    if (requestType === 'food' && requestedFoods.length === 0) {
      Alert.alert('Error', 'Please add at least one food item to your request.');
      return;
    }
    isSubmitting.current = true;
    setIsLoading(true);
    try {
      const payload = {
        ...form,
        type: requestType,
        food_items: requestedFoods.map(f => ({ id: f.id, name: f.name, category: f.category, qty: f.qty, unit: f.unit })),
      };
      const res = await ApiService.submitBeneficiaryRequest(payload);
      if (res.data.success) {
        Alert.alert('Success', 'Your request has been submitted successfully.');
        navigation.navigate('HomeTabs', { screen: 'Track' });
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerRow}>
          <Image source={require('../../assets/images/logo/logobrown.png')} style={{ width: 170, height: 58 }} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <NotificationBell navigation={navigation} />
            <TouchableOpacity onPress={() => navigation.openDrawer()}>
              <Ionicons name="menu-outline" size={34} color="#4A4A4A" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerDivider} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Title */}
          <View style={styles.titleRow}>
            <FontAwesome5 name="hand-holding-usd" size={40} color="#00592d" style={styles.titleIcon} />
            <Text style={styles.pageTitle}>Create Request</Text>
          </View>
          <View style={styles.titleDivider} />

          {/* Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity style={[styles.tabButton, requestType === 'food' ? styles.tabActive : styles.tabInactive]} onPress={() => setRequestType('food')} activeOpacity={0.9}>
              <MaterialCommunityIcons name="basket-outline" size={22} color={requestType === 'food' ? '#FFFFFF' : '#222222'} style={{ marginRight: 8 }} />
              <Text style={[styles.tabText, requestType === 'food' ? styles.tabTextActive : styles.tabTextInactive]}>FOOD</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, requestType === 'financial' ? styles.tabActive : styles.tabInactive]} onPress={() => setRequestType('financial')} activeOpacity={0.9}>
              <FontAwesome5 name="hand-holding-usd" size={18} color={requestType === 'financial' ? '#FFFFFF' : '#222222'} style={{ marginRight: 8 }} />
              <Text style={[styles.tabText, requestType === 'financial' ? styles.tabTextActive : styles.tabTextInactive]}>FINANCIAL</Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>

            <Text style={styles.inputLabel}>Name of Drive</Text>
            <TextInput
              style={styles.inputBox}
              placeholder="eg. Kapatiran Fire Tondo Relief"
              placeholderTextColor="#A5D1B8"
              value={form.title}
              onChangeText={(val) => updateForm('title', val)}
            />

            {requestType === 'financial' && (
              <View>
                <Text style={styles.inputLabel}>Amount of Money Needed</Text>

                <TextInput
                  style={styles.inputBox}
                  keyboardType="numeric"
                  value={form.financial_amount}
                  onChangeText={(val) => updateForm('financial_amount', val)}
                />
              </View>
            )}

            {/* Population & Age */}
            <View style={styles.rowInputs}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.inputLabel} numberOfLines={1} adjustsFontSizeToFit>No. of Population</Text>
                <TextInput style={styles.inputBox} placeholder="##" placeholderTextColor="#A5D1B8" textAlign="center" keyboardType="numeric" value={form.population} onChangeText={(val) => updateForm('population', val)} />
              </View>
              <View style={{ flex: 1.5 }}>
                <Text style={styles.inputLabel}>Age Range</Text>
                <View style={styles.rowInputsNoMargin}>
                  <TextInput style={[styles.inputBox, { flex: 1 }]} placeholder="Min" placeholderTextColor="#A5D1B8" textAlign="center" keyboardType="numeric" value={form.age_start} onChangeText={(val) => updateForm('age_start', val)} />
                  <Text style={{ color: '#e4e1e1ff', fontSize: 12, fontWeight: '500', alignSelf: 'center', marginBottom: 15, paddingHorizontal: 6 }}>-</Text>
                  <TextInput style={[styles.inputBox, { flex: 1 }]} placeholder="Max" placeholderTextColor="#A5D1B8" textAlign="center" keyboardType="numeric" value={form.age_end} onChangeText={(val) => updateForm('age_end', val)} />
                </View>
              </View>
            </View>

            {/* Address */}
            <Text style={styles.inputLabel}>Address / Coverage</Text>
            <View style={[styles.rowInputsNoMargin, { marginBottom: 8 }]}>
              <TextInput style={[styles.inputBox, { flex: 1.5, marginRight: 8 }]} placeholder="Street" placeholderTextColor="#A5D1B8" textAlign="center" value={form.street} onChangeText={(val) => updateForm('street', val)} />
              <TextInput style={[styles.inputBox, { flex: 1.5 }]} placeholder="Brgy" placeholderTextColor="#A5D1B8" textAlign="center" value={form.barangay} onChangeText={(val) => updateForm('barangay', val)} />
            </View>
            <View style={[styles.rowInputsNoMargin, { marginBottom: 15 }]}>
              <TextInput style={[styles.inputBox, { flex: 2, marginRight: 8 }]} placeholder="City / Municipality" placeholderTextColor="#A5D1B8" textAlign="center" value={form.city_municipality} onChangeText={(val) => updateForm('city_municipality', val)} />
              <TextInput style={[styles.inputBox, { flex: 1 }]} placeholder="Zip" placeholderTextColor="#A5D1B8" textAlign="center" keyboardType="numeric" value={form.postal_zip_code} onChangeText={(val) => updateForm('postal_zip_code', val)} />
            </View>

            {/* Date & Urgency */}
            <View style={styles.rowInputs}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.inputLabel}>Date Needed</Text>

                {/* Trigger button — works for both platforms */}
                <TouchableOpacity
                  style={[styles.inputBox, { justifyContent: 'center' }]}
                  onPress={() => {
                    if (Platform.OS === 'ios') setShowIOSPicker(true);
                    else setShowDatePicker(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: form.needed_date ? '#FFF' : '#A5D1B8', fontSize: 13, flex: 1 }}>
                      {form.needed_date || 'YYYY-MM-DD'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#FFF" />
                  </View>
                </TouchableOpacity>

                {/* Android native picker */}
                {Platform.OS === 'android' && showDatePicker && (
                  <DateTimePicker
                    value={dateObj}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={onDateChange}
                  />
                )}

                {/* iOS Modal picker */}
                <Modal visible={showIOSPicker} transparent animationType="slide">
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                      <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowIOSPicker(false)}>
                          <Text style={styles.modalCancel}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Date Needed</Text>
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
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Urgency Level</Text>
                <CustomDropdown
                  selectedValue={form.urgency_level}
                  onValueChange={(val) => updateForm('urgency_level', val)}
                  placeholder="Select Level"
                  items={[{ label: 'LOW', value: 'LOW' }, { label: 'MEDIUM', value: 'MEDIUM' }, { label: 'HIGH', value: 'HIGH' }]}
                  style={styles.inputBox}
                />
              </View>
            </View>
          </View>

          {/* ── Food Details Card (outside green card) ── */}
          {requestType === 'food' && (
            <View style={styles.foodDetailsCard}>
              <View style={styles.foodDetailsHeader}>
                <MaterialCommunityIcons name="food-variant" size={18} color="#00592d" />
                <Text style={styles.foodDetailsTitle}>Food Details</Text>
              </View>

              {/* Category selector */}
              <Text style={styles.fdLabel}>Select Food Categories</Text>
              {inventoryLoading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color="#00592d" size="small" />
                  <Text style={styles.loadingText}>Loading...</Text>
                </View>
              ) : categories.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <MaterialCommunityIcons name="package-variant" size={32} color="#ccc" />
                  <Text style={styles.fdEmptyHint}>No inventory available.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{ paddingRight: 8 }}>
                  {categories.map(cat => {
                    const isActive = selectedCategory === cat;
                    const count = inventoryItems.filter(i => i.category === cat).length;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.fdCatCard, isActive && styles.fdCatCardActive]}
                        onPress={() => { setSelectedCategory(isActive ? null : cat); setSelectedItem(null); setItemQty(''); }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.fdCatIconWrap, isActive && styles.fdCatIconWrapActive]}>
                          <CatIcon cat={cat} size={22} active={isActive} />
                        </View>
                        <Text style={[styles.fdCatName, isActive && styles.fdCatNameActive]} numberOfLines={1}>{cat}</Text>
                        <View style={[styles.fdCatBadge, isActive && styles.fdCatBadgeActive]}>
                          <Text style={[styles.fdCatBadgeText, isActive && styles.fdCatBadgeTextActive]}>{count}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Items list */}
              {selectedCategory && (
                <View style={styles.fdItemsWrap}>
                  <View style={styles.fdItemsHeader}>
                    <Text style={styles.fdItemsTitle}>{selectedCategory}</Text>
                    <Text style={styles.fdItemsCount}>{itemsInCategory.length} items</Text>
                  </View>
                  {itemsInCategory.length === 0 ? (
                    <Text style={styles.fdEmptyHint}>No items in this category.</Text>
                  ) : (
                    itemsInCategory.map((item, idx) => {
                      const isSel = selectedItem?.id === item.id;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.fdItemRow, isSel && styles.fdItemRowActive, idx < itemsInCategory.length - 1 && styles.fdItemRowBorder]}
                          onPress={() => {
                            setSelectedItem(isSel ? null : item);
                            setItemQty('');
                            setItemUnit(item.category === 'Canned Goods' ? 'pcs' : (item.unit || 'kg'));
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.fdItemIcon, isSel && styles.fdItemIconActive]}>
                            <CatIcon cat={item.category} size={18} active={false} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.fdItemName, isSel && styles.fdItemNameActive]} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.fdItemCat}>{item.category}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.fdItemStockLabel}>In Stock</Text>
                          </View>
                          {isSel && <Ionicons name="checkmark-circle" size={20} color="#00592d" style={{ marginLeft: 8 }} />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}

              {/* Qty + Add row */}
              {selectedItem && (
                <View style={styles.fdAddRow}>
                  <View style={styles.fdAddBadge}>
                    <CatIcon cat={selectedItem.category} size={13} active={false} />
                    <Text style={[styles.fdAddName, { marginLeft: 5 }]} numberOfLines={1}>{selectedItem.name}</Text>
                  </View>
                  <TextInput
                    style={styles.fdQtyInput}
                    placeholder="Qty"
                    placeholderTextColor="#aaa"
                    keyboardType="numeric"
                    value={itemQty}
                    onChangeText={setItemQty}
                    textAlign="center"
                  />
                  {/* Unit selector */}
                  <TouchableOpacity style={styles.fdUnitBtn} onPress={() => setShowUnitPicker(true)} activeOpacity={0.8}>
                    <Text style={styles.fdUnitBtnText}>{itemUnit}</Text>
                    <Ionicons name="chevron-down" size={11} color="#00592d" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fdAddBtn} onPress={addFoodToList} activeOpacity={0.8}>
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.fdAddBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Unit picker modal */}
              <Modal visible={showUnitPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                  <View style={styles.modalSheet}>
                    <View style={styles.modalHeader}>
                      <TouchableOpacity onPress={() => setShowUnitPicker(false)}>
                        <Text style={styles.modalCancel}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={styles.modalTitle}>Select Unit</Text>
                      <View style={{ width: 60 }} />
                    </View>
                    <ScrollView style={{ maxHeight: 320 }}>
                      {(selectedItem?.category === 'Canned Goods' ? ['pcs'] : ['kg', 'pcs']).map(u => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.unitPickerRow, itemUnit === u && styles.unitPickerRowActive]}
                          onPress={() => { setItemUnit(u); setShowUnitPicker(false); }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.unitPickerText, itemUnit === u && styles.unitPickerTextActive]}>{u}</Text>
                          {itemUnit === u && <Ionicons name="checkmark" size={18} color="#00592d" />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

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
                  <View key={f.id} style={[styles.fdTableRow, idx < requestedFoods.length - 1 && styles.fdTableRowBorder]}>
                    <Text style={[styles.fdTableCell, { flex: 1 }]} numberOfLines={1}>{f.category}</Text>
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
          <View style={{ height: 50 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topHeader: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#FFFFFF' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  headerDivider: { height: 1, backgroundColor: '#E0E0E0', marginHorizontal: -20 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 30 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  titleIcon: { marginRight: 12 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#00592d', letterSpacing: -0.5 },
  titleDivider: { height: 1, backgroundColor: '#A3A3A3', opacity: 0.3, marginHorizontal: -22, marginBottom: 25 },
  tabsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25, paddingHorizontal: 15 },
  tabButton: { flexDirection: 'row', width: '45%', height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  tabActive: { backgroundColor: '#D87A38', borderColor: '#C66C2E', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 5, elevation: 4 },
  tabInactive: { backgroundColor: '#FFFFFF', borderColor: '#666666' },
  tabText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  tabTextActive: { color: '#FFFFFF' },
  tabTextInactive: { color: '#222222' },

  formCard: { backgroundColor: '#00592d', borderRadius: 24, padding: 22, paddingBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 10 },
  inputLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginBottom: 6, marginLeft: 2 },
  inputBox: { height: 40, borderWidth: 1, borderColor: '#71A987', borderRadius: 6, backgroundColor: 'transparent', paddingHorizontal: 12, color: '#FFFFFF', fontSize: 13, marginBottom: 15 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  rowInputsNoMargin: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },

  // ── Food Details white card ───────────────────────────────────────────────────
  foodDetailsCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginTop: 18, borderWidth: 1, borderColor: '#E8EEE9', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 5 },
  foodDetailsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EAF2EC' },
  foodDetailsTitle: { fontSize: 16, fontWeight: '800', color: '#00592d', marginLeft: 8 },

  fdLabel: { fontSize: 11, fontWeight: '700', color: '#555', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  fdEmptyHint: { color: '#999', fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },

  loadingWrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  loadingText: { color: '#888', fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 14 },
  emptyIcon: { fontSize: 26, marginBottom: 4 },

  catScroll: { marginBottom: 16 },
  fdCatCard: { alignItems: 'center', marginRight: 10, backgroundColor: '#F5F9F6', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1.5, borderColor: '#C8DFD0', minWidth: 74, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  fdCatCardActive: { backgroundColor: '#00592d', borderColor: '#00592d', shadowColor: '#00592d', shadowOpacity: 0.25, elevation: 5 },
  fdCatIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EEF7F1', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  fdCatIconWrapActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  fdCatName: { color: '#4A7A5A', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  fdCatNameActive: { color: '#FFF' },
  fdCatBadge: { marginTop: 5, backgroundColor: '#E4F0E8', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 1 },
  fdCatBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  fdCatBadgeText: { color: '#4A7A5A', fontSize: 9, fontWeight: '800' },
  fdCatBadgeTextActive: { color: '#FFF' },

  fdItemsWrap: { borderRadius: 12, borderWidth: 1, borderColor: '#E8EEE9', overflow: 'hidden', marginBottom: 14 },
  fdItemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F5F9F6', paddingHorizontal: 14, paddingVertical: 10 },
  fdItemsTitle: { fontSize: 13, fontWeight: '800', color: '#00592d' },
  fdItemsCount: { fontSize: 11, color: '#888' },
  fdItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 12 },
  fdItemRowActive: { backgroundColor: '#F0FAF4' },
  fdItemRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F5F1' },
  fdItemIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#EEF7F1', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  fdItemIconActive: { backgroundColor: '#D4EDDA' },
  fdItemName: { color: '#1a1a1a', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  fdItemNameActive: { color: '#00592d' },
  fdItemCat: { color: '#999', fontSize: 10 },
  fdItemStock: { color: '#4A7A5A', fontSize: 12, fontWeight: '800' },
  fdItemStockActive: { color: '#00592d' },
  fdItemStockLabel: { color: '#aaa', fontSize: 9, marginTop: 1 },

  fdAddRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5FBF7', borderRadius: 12, padding: 10, marginBottom: 16, gap: 8, borderWidth: 1, borderColor: '#C8DFD0' },
  fdAddBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E4F0E8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  fdAddName: { color: '#00592d', fontSize: 11, fontWeight: '700', flex: 1 },
  fdQtyInput: { width: 50, height: 36, borderWidth: 1, borderColor: '#C8DFD0', borderRadius: 6, color: '#1a1a1a', fontSize: 13, backgroundColor: '#FFF' },
  fdUnitBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF7F1', borderRadius: 6, borderWidth: 1, borderColor: '#C8DFD0', paddingHorizontal: 8, paddingVertical: 6, gap: 3, minWidth: 44 },
  fdUnitBtnText: { color: '#00592d', fontSize: 12, fontWeight: '800' },
  fdAddBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00592d', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
  fdAddBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  unitPickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  unitPickerRowActive: { backgroundColor: '#F0FAF4' },
  unitPickerText: { fontSize: 15, color: '#333', fontWeight: '500' },
  unitPickerTextActive: { color: '#00592d', fontWeight: '800' },

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
  submitBtn: { backgroundColor: '#267A41', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12, minWidth: 120, alignItems: 'center' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalDone: { fontSize: 15, fontWeight: '700', color: '#00592d' },
});
