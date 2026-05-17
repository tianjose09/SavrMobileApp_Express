import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  TextInput, Platform, Image, KeyboardAvoidingView, Alert, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ApiService } from '../../services/api';
import CustomDropdown from '../../components/CustomDropdown';

// ─── Types ────────────────────────────────────────────────────────────────────
type FoodItem = { id: number; name: string; category: string; qty: string; unit: string };
type RequestedFood = { id: number; name: string; category: string; qty: string; unit: string };

// ─── Category icons map ───────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  Meat: '🥩', Vegetables: '🥦', Fruits: '🍎', Grains: '🌾',
  'Canned Goods': '🥫', Dairy: '🧀', Seafood: '🐟', Bakery: '🍞',
  Beverages: '🧃', 'Rice/Grains': '🌾', Mixed: '🍱',
};

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
  const [requestedFoods, setRequestedFoods] = useState<RequestedFood[]>([]);

  const [form, setForm] = useState({
    title: '', financial_amount: '', population: '',
    age_start: '', age_end: '', street: '', barangay: '',
    city_municipality: '', postal_zip_code: '', needed_date: '', urgency_level: '',
  });

  const updateForm = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  // Fetch inventory
  useEffect(() => {
    if (requestType !== 'food') return;
    setInventoryLoading(true);
    ApiService.getInventory()
      .then(res => {
        if (res.data?.success) {
          const raw = res.data.items || [];
          // items come as { id, name, category, qty: "10 kg" }
          const parsed: FoodItem[] = raw.map((i: any) => {
            const parts = String(i.qty || '').trim().split(' ');
            const unit = parts.length > 1 ? parts[parts.length - 1] : 'pcs';
            return { id: i.id, name: i.name, category: i.category || 'Other', qty: i.qty, unit };
          });
          setInventoryItems(parsed);
        }
      })
      .catch(() => {})
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
      setRequestedFoods(prev => prev.map(f => f.id === selectedItem.id ? { ...f, qty: itemQty } : f));
    } else {
      setRequestedFoods(prev => [...prev, { ...selectedItem, qty: itemQty }]);
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
            <NotificationBell navigation={navigation} color="#4A4A4A" size={26} />
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

            {requestType === 'food' ? (
              <View>
                {/* ── Food Selector Section ── */}
                <Text style={styles.sectionLabel}>
                  <MaterialCommunityIcons name="food-variant" size={14} color="#A5D1B8" />  Food Items Needed
                </Text>

                {/* Step 1 – Category Chips */}
                {inventoryLoading ? (
                  <ActivityIndicator color="#A5D1B8" style={{ marginBottom: 14 }} />
                ) : categories.length === 0 ? (
                  <Text style={styles.emptyHint}>No inventory available.</Text>
                ) : (
                  <>
                    <Text style={styles.stepLabel}>① Select a Category</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                      {categories.map(cat => (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                          onPress={() => {
                            setSelectedCategory(selectedCategory === cat ? null : cat);
                            setSelectedItem(null);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.categoryChipIcon}>{CATEGORY_ICONS[cat] || '📦'}</Text>
                          <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {/* Step 2 – Items in Category */}
                    {selectedCategory && (
                      <>
                        <Text style={styles.stepLabel}>② Choose a Food Item from <Text style={{ color: '#FFCF77' }}>{selectedCategory}</Text></Text>
                        {itemsInCategory.length === 0 ? (
                          <Text style={styles.emptyHint}>No items in this category.</Text>
                        ) : (
                          <View style={styles.itemGrid}>
                            {itemsInCategory.map(item => {
                              const isSelected = selectedItem?.id === item.id;
                              return (
                                <TouchableOpacity
                                  key={item.id}
                                  style={[styles.itemChip, isSelected && styles.itemChipActive]}
                                  onPress={() => {
                                    setSelectedItem(isSelected ? null : item);
                                    setItemQty('');
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[styles.itemChipName, isSelected && styles.itemChipNameActive]} numberOfLines={1}>{item.name}</Text>
                                  <Text style={styles.itemChipStock}>Stock: {item.qty}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}

                        {/* Step 3 – Qty + Add */}
                        {selectedItem && (
                          <View style={styles.addItemRow}>
                            <View style={styles.selectedItemBadge}>
                              <Text style={styles.selectedItemName} numberOfLines={1}>{selectedItem.name}</Text>
                            </View>
                            <TextInput
                              style={styles.qtyInput}
                              placeholder="Qty"
                              placeholderTextColor="#A5D1B8"
                              keyboardType="numeric"
                              value={itemQty}
                              onChangeText={setItemQty}
                              textAlign="center"
                            />
                            <Text style={styles.unitLabel}>{selectedItem.unit}</Text>
                            <TouchableOpacity style={styles.addBtn} onPress={addFoodToList} activeOpacity={0.8}>
                              <Ionicons name="add" size={20} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Requested Foods List */}
                {requestedFoods.length > 0 && (
                  <View style={styles.foodListCard}>
                    <View style={styles.foodListHeader}>
                      <Text style={styles.foodListTitle}>📋  Request List</Text>
                      <Text style={styles.foodListCount}>{requestedFoods.length} item{requestedFoods.length > 1 ? 's' : ''}</Text>
                    </View>
                    {requestedFoods.map((f, idx) => (
                      <View key={f.id} style={[styles.foodListRow, idx < requestedFoods.length - 1 && styles.foodListRowBorder]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.foodListName} numberOfLines={1}>{f.name}</Text>
                          <Text style={styles.foodListCategory}>{f.category}</Text>
                        </View>
                        <Text style={styles.foodListQty}>{f.qty} {f.unit}</Text>
                        <TouchableOpacity onPress={() => removeFood(f.id)} style={{ marginLeft: 10 }}>
                          <Ionicons name="trash-outline" size={16} color="#FF7A7A" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
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
                  <TextInput style={[styles.inputBox, { flex: 1, marginRight: 8 }]} placeholder="Min" placeholderTextColor="#A5D1B8" textAlign="center" keyboardType="numeric" value={form.age_start} onChangeText={(val) => updateForm('age_start', val)} />
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
                      <DateTimePicker
                        value={dateObj}
                        mode="date"
                        display="spinner"
                        minimumDate={new Date()}
                        onChange={(e, d) => { if (d) setDateObj(d); }}
                        style={{ width: '100%' }}
                        textColor="#1a1a1a"
                      />
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
  badgeDot: { position: 'absolute', top: -3, right: -4, backgroundColor: '#E74C3C', borderRadius: 9, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  badgeText: { color: '#FFF', fontSize: 8, fontWeight: 'bold' },
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

  // Food selector
  sectionLabel: { color: '#A5D1B8', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' },
  stepLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginBottom: 10 },
  emptyHint: { color: '#A5D1B8', fontSize: 12, marginBottom: 14, fontStyle: 'italic' },

  categoryChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#71A987', marginRight: 10, marginBottom: 14, backgroundColor: 'transparent' },
  categoryChipActive: { backgroundColor: '#D87A38', borderColor: '#D87A38' },
  categoryChipIcon: { fontSize: 16, marginRight: 6 },
  categoryChipText: { color: '#A5D1B8', fontSize: 12, fontWeight: '700' },
  categoryChipTextActive: { color: '#FFFFFF' },

  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  itemChip: { width: '47%', marginRight: '3%', marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#71A987' },
  itemChipActive: { backgroundColor: 'rgba(216,122,56,0.25)', borderColor: '#D87A38' },
  itemChipName: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginBottom: 3 },
  itemChipNameActive: { color: '#FFCF77' },
  itemChipStock: { color: '#A5D1B8', fontSize: 10 },

  addItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, marginBottom: 14, gap: 8 },
  selectedItemBadge: { flex: 1, backgroundColor: 'rgba(216,122,56,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  selectedItemName: { color: '#FFCF77', fontSize: 11, fontWeight: '700' },
  qtyInput: { width: 52, height: 36, borderWidth: 1, borderColor: '#71A987', borderRadius: 6, color: '#FFF', fontSize: 13, backgroundColor: 'transparent' },
  unitLabel: { color: '#A5D1B8', fontSize: 11, fontWeight: '700', minWidth: 28 },
  addBtn: { backgroundColor: '#D87A38', width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  foodListCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  foodListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  foodListTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  foodListCount: { color: '#A5D1B8', fontSize: 11 },
  foodListRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  foodListRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  foodListName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  foodListCategory: { color: '#A5D1B8', fontSize: 10, marginTop: 1 },
  foodListQty: { color: '#FFCF77', fontWeight: '800', fontSize: 13 },

  submitRow: { alignItems: 'flex-end', marginTop: 20, paddingRight: 10 },
  submitBtn: { backgroundColor: '#267A41', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12, minWidth: 120, alignItems: 'center' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // iOS date picker modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalDone: { fontSize: 15, fontWeight: '700', color: '#00592d' },
});
