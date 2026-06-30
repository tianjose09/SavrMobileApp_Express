import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, StatusBar, ScrollView, Alert, Modal, RefreshControl, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomDropdown from '../../components/CustomDropdown';
import { ApiService } from '../../services/api';
import NotificationBell from '../../components/NotificationBell';

export default function AddFoodItem_Inventory({ navigation }: any) {
  const [foodName, setFoodName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');

  const [expiryText, setExpiryText] = useState('');
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false); // Android
  const [showIOSDatePicker, setShowIOSDatePicker] = useState(false); // iOS Modal

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setFoodName('');
    setCategory('');
    setQuantity('');
    setUnit('kg');
    setExpiryText('');
    setExpiryDate(new Date());
    setTimeout(() => setRefreshing(false), 500);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'dismissed' || !selectedDate) return;
    }
    if (selectedDate) {
      setExpiryDate(selectedDate);
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      setExpiryText(`${mm}/${dd}/${yyyy}`);
    }
  };

  const confirmIOSExpiry = () => {
    const yyyy = expiryDate.getFullYear();
    const mm = String(expiryDate.getMonth() + 1).padStart(2, '0');
    const dd = String(expiryDate.getDate()).padStart(2, '0');
    setExpiryText(`${mm}/${dd}/${yyyy}`);
    setShowIOSDatePicker(false);
  };

  const handleAddFood = async () => {
    if (!foodName || !category || !quantity || !unit) {
      Alert.alert('Required', 'Please fill out all required fields first!');
      return;
    }

    if (!expiryText) {
      Alert.alert('Required', 'Please enter the expiration date.');
      return;
    }

    const parts = expiryText.split('/');
    if (parts.length !== 3) {
      Alert.alert('Invalid Date', 'Please enter a valid expiration date (MM/DD/YYYY).');
      return;
    }
    const mm = parts[0];
    const dd = parts[1];
    const yyyy = parts[2];
    const formattedExpiry = `${yyyy}-${mm}-${dd}`;

    const entered = new Date(formattedExpiry);
    entered.setHours(0, 0, 0, 0);
    if (isNaN(entered.getTime())) {
      Alert.alert('Invalid Date', 'Please enter a valid expiration date (MM/DD/YYYY).');
      return;
    }
    if (entered < today) {
      Alert.alert('Invalid Date', 'Expiration date cannot be in the past.');
      return;
    }

    setIsSubmitting(true);
    try {
      await ApiService.addInventory({
        food_name: foodName,
        category,
        quantity: parseFloat(quantity),
        unit,
        expiration_date: formattedExpiry || null,
        meal_type: 'Raw Ingredients',
      });

      Alert.alert(
        'Success',
        `You successfully added ${quantity} ${unit} of ${foodName}.`,
        [{ text: 'Okay', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Error adding food. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      {/* HEADER NAV - NEW STYLE MATCHING IMAGE */}
      <View style={styles.topNavLine}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5, paddingLeft: 0 }}>
          <Ionicons name="chevron-back" size={34} color="#0E6A31" style={{ marginLeft: -4 }} />
        </TouchableOpacity>

        <View style={styles.headerIcons}>
          <NotificationBell navigation={navigation} color="#786F67" size={28} />
          <TouchableOpacity onPress={() => navigation?.openDrawer?.()}>
            <Ionicons name="menu-outline" size={38} color="#786F67" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0e6a31"
              colors={['#0e6a31']}
            />
          }
        >

          {/* TITLE */}
          <Text style={styles.heroTitle}>Add Food Items</Text>

          {/* GREEN CARD WRAPPER */}
          <View style={styles.card}>

            <View style={styles.inputGroupOuter}>
              <Text style={styles.label}>Food Item Name <Text style={{ color: '#DCAB18' }}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Rice, Canned Goods, Vegetables"
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={foodName}
                onChangeText={setFoodName}
              />
            </View>

            <View style={styles.inputGroupOuter}>
              <Text style={styles.label}>Category <Text style={{ color: '#DCAB18' }}>*</Text></Text>
              <CustomDropdown
                selectedValue={category}
                onValueChange={(val) => {
                  setCategory(val);
                  if (val === 'Canned Goods') {
                    setUnit('pcs');
                  }
                }}
                placeholder="Select Category"
                items={[
                  { label: "Canned Goods: Non-Perishable", value: "Canned Goods" },
                  { label: "Dairy: Perishable", value: "Dairy" },
                  { label: "Dry Goods: Non-Perishable", value: "Dry Goods" },
                  { label: "Fats & Oils: Non-Perishable", value: "Fats & Oils" },
                  { label: "Fruits: Perishable", value: "Fruits" },
                  { label: "Grains & Cereals: Non-Perishable", value: "Grains & Cereals" },
                  { label: "Liquid Goods: Non-Perishable", value: "Liquid Goods" },
                  { label: "Beverages: Non-Perishable", value: "Beverages" },
                  { label: "Meat: Perishable", value: "Meat" },
                  { label: "Sugars & Sweets: Non-Perishable", value: "Sugars & Sweets" },
                  { label: "Protein Alternatives: Both", value: "Protein Alternatives" },
                  { label: "Vegetables: Perishable", value: "Vegetables" },
                ]}
                style={styles.input}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroupOuter, { flex: 1, marginRight: 15 }]}>
                <Text style={styles.label}>Quantity <Text style={{ color: '#DCAB18' }}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="Input Quantity"
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />
              </View>

              <View style={[styles.inputGroupOuter, { flex: 1 }]}>
                <Text style={styles.label}>Unit <Text style={{ color: '#DCAB18' }}>*</Text></Text>
                <CustomDropdown
                  selectedValue={unit}
                  onValueChange={setUnit}
                  placeholder="kg"
                  items={[
                    { label: "kg", value: "kg" },
                    { label: "pcs", value: "pcs" },
                    { label: "meal", value: "meal" },
                    { label: "L", value: "L" }
                  ]}
                  style={styles.input}
                  disableSort={true}
                />
              </View>
            </View>

            <View style={styles.inputGroupOuter}>
              <Text style={styles.label}>Expiration Date <Text style={{ color: '#DCAB18' }}>*</Text></Text>
              <View style={{ position: 'relative', justifyContent: 'center' }}>
                <TextInput
                  style={[styles.input, { paddingRight: 35 }]}
                  placeholder="mm/dd/yyyy"
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  value={expiryText}
                  onChangeText={setExpiryText}
                />
                <TouchableOpacity
                  onPress={() => Platform.OS === 'ios' ? setShowIOSDatePicker(true) : setShowDatePicker(true)}
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 50, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Ionicons name="calendar-outline" size={20} color="rgba(255,255,255,0.9)" />
                </TouchableOpacity>
              </View>
              {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker value={expiryDate} mode="date" display="default" minimumDate={today} onChange={onDateChange} />
              )}
              <Modal visible={showIOSDatePicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                  <View style={styles.modalSheet}>
                    <View style={styles.modalHeader}>
                      <TouchableOpacity onPress={() => setShowIOSDatePicker(false)}>
                        <Text style={styles.modalCancel}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={styles.modalTitle}>Expiration Date</Text>
                      <TouchableOpacity onPress={confirmIOSExpiry}>
                        <Text style={styles.modalDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
                      <DateTimePicker value={expiryDate} mode="date" display="spinner" minimumDate={today} onChange={(e, d) => { if (d) setExpiryDate(d); }} style={{ width: '100%', alignSelf: 'center' }} textColor="#1a1a1a" />
                    </View>
                  </View>
                </View>
              </Modal>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAddFood} disabled={isSubmitting}>
              <Text style={styles.submitBtnText}>
                {isSubmitting ? "ADDING..." : "+ ADD FOOD"}
              </Text>
            </TouchableOpacity>

          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topNavLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 26,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#EAEAEA',
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 15,
    alignItems: 'center',
    paddingBottom: 100,
  },
  heroTitle: {
    fontSize: 35,
    fontWeight: '700',
    color: '#0A552F',
    letterSpacing: -1.5,
    textAlign: 'center',
    marginBottom: 35,
  },

  card: {
    backgroundColor: '#0E6A31',
    borderRadius: 24,
    padding: 24,
    paddingBottom: 35,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  inputGroupOuter: {
    marginBottom: 20,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 2,
  },
  input: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4EA668',
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 15,
    color: '#FFF',
    fontSize: 13,
  },
  dateInputWrapper: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4EA668',
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 15,
    justifyContent: 'center',
    position: 'relative',
  },
  dateText: {
    color: '#FFF',
    fontSize: 13,
  },

  submitBtn: {
    backgroundColor: '#0E6A31',
    borderRadius: 22,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    marginHorizontal: 35,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalDone: { fontSize: 15, fontWeight: '700', color: '#0E6A31' },
});
