import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Platform, StatusBar, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomDropdown from '../../components/CustomDropdown';
import { ApiService } from '../../services/api';

export default function AddFoodItem_Inventory({ navigation }: any) {
  const [foodName, setFoodName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');

  const [expiryText, setExpiryText] = useState('');
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setExpiryDate(selectedDate);
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      setExpiryText(`${yyyy}-${mm}-${dd}`);
    }
  };

  const handleAddFood = async () => {
    if (!foodName || !category || !quantity || !unit) {
      Alert.alert('Required', 'Please fill out all required fields first!');
      return;
    }

    if (expiryText) {
      const entered = new Date(expiryText);
      entered.setHours(0, 0, 0, 0);
      if (isNaN(entered.getTime())) {
        Alert.alert('Invalid Date', 'Please enter a valid expiration date (YYYY-MM-DD).');
        return;
      }
      if (entered < today) {
        Alert.alert('Invalid Date', 'Expiration date cannot be in the past.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await ApiService.addInventory({
        food_name:       foodName,
        category,
        quantity:        parseFloat(quantity),
        unit,
        expiration_date: expiryText || null,
        meal_type:       'Raw Ingredients',
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
          <TouchableOpacity style={{ marginRight: 15 }}>
            <Ionicons name="notifications-outline" size={28} color="#786F67" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation?.openDrawer?.()}>
            <Ionicons name="menu-outline" size={38} color="#786F67" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* TITLE */}
        <Text style={styles.heroTitle}>Add Food Items</Text>

        {/* GREEN CARD WRAPPER */}
        <View style={styles.card}>

          <View style={styles.inputGroupOuter}>
            <Text style={styles.label}>Food Item Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Rice, Canned Goods, Vegetables"
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={foodName}
              onChangeText={setFoodName}
            />
          </View>

          <View style={styles.inputGroupOuter}>
            <Text style={styles.label}>Category</Text>
            <CustomDropdown
              selectedValue={category}
              onValueChange={setCategory}
              placeholder="Select Category"
              items={[
                { label: "Canned Goods", value: "Canned Goods" },
                { label: "Grains & Cereals", value: "Grains & Cereals" },
                { label: "Dry Goods", value: "Dry Goods" },
                { label: "Meat", value: "Meat" },
                { label: "Protein Alternatives", value: "Protein Alternatives" },
                { label: "Dairy", value: "Dairy" },
                { label: "Fats & Oils", value: "Fats & Oils" },
                { label: "Fruits", value: "Fruits" },
                { label: "Vegetables", value: "Vegetables" },
                { label: "Sugars & Sweets", value: "Sugars & Sweets" },
              ]}
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroupOuter, { flex: 1, marginRight: 15 }]}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                placeholderTextColor="rgba(255,255,255,0.7)"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>

            <View style={[styles.inputGroupOuter, { flex: 1 }]}>
              <Text style={styles.label}>Unit</Text>
              <CustomDropdown
                selectedValue={unit}
                onValueChange={setUnit}
                placeholder="kg"
                items={[
                  { label: "kg", value: "kg" },
                  { label: "g", value: "g" },
                  { label: "L", value: "L" },
                  { label: "pcs", value: "pcs" },
                  { label: "Boxes", value: "Boxes" }
                ]}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.inputGroupOuter}>
            <Text style={styles.label}>Expiration Date (Optional)</Text>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput
                style={[styles.input, { paddingRight: 35 }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={expiryText}
                onChangeText={setExpiryText}
              />
              <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 50, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                <TouchableOpacity
                  onPress={() => Platform.OS !== 'ios' && setShowDatePicker(true)}
                  style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                  <Ionicons name="calendar-outline" size={20} color="rgba(255,255,255,0.9)" />
                </TouchableOpacity>
                {Platform.OS === 'ios' && (
                  <DateTimePicker
                    style={{ position: 'absolute', right: 0, width: 50, height: '100%', opacity: 0.011 }}
                    value={expiryDate}
                    mode="date"
                    display="compact"
                    minimumDate={today}
                    onChange={onDateChange}
                  />
                )}
              </View>
            </View>

            {Platform.OS !== 'ios' && showDatePicker && (
              <DateTimePicker
                value={expiryDate}
                mode="date"
                display="default"
                minimumDate={today}
                onChange={onDateChange}
              />
            )}
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleAddFood} disabled={isSubmitting}>
            <Text style={styles.submitBtnText}>
              {isSubmitting ? "ADDING..." : "+ ADD FOOD"}
            </Text>
          </TouchableOpacity>

        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
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
    paddingVertical: 16,
    paddingHorizontal: 26,
    backgroundColor: '#FFFFFF',
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 15,
    alignItems: 'center',
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
    backgroundColor: '#F5B922',
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
  }
});
