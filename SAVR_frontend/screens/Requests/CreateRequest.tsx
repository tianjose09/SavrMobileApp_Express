import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput, Platform, Image, KeyboardAvoidingView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ApiService } from '../../services/api';
import CustomDropdown from '../../components/CustomDropdown';

export default function CreateRequest({ navigation }: any) {
  const [requestType, setRequestType] = useState<'food' | 'financial'>('food');
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());

  // Ref lock strictly prevents duplicate rapid-tap submissions
  const isSubmitting = useRef(false);

  const [form, setForm] = useState({
    title: '',
    food_type: '',
    quantity: '',
    unit: '',
    financial_amount: '',
    population: '',
    age_start: '',
    age_end: '',
    street: '',
    barangay: '',
    city_municipality: '',
    postal_zip_code: '',
    needed_date: '',
    urgency_level: '',
  });

  const updateForm = (key: string, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || dateObj;
    setShowDatePicker(Platform.OS === 'ios');
    setDateObj(currentDate);

    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    updateForm('needed_date', `${yyyy}-${mm}-${dd}`);
  };

  const handleSubmit = async () => {
    if (isSubmitting.current) return;

    if (!form.title || !form.urgency_level) {
      Alert.alert('Error', 'Please fill out at least the title and urgency level.');
      return;
    }

    isSubmitting.current = true;
    setIsLoading(true);

    try {
      const payload = { ...form, type: requestType };
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
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerRow}>
          <Image source={require('../../assets/images/logo/logobrown.png')} style={{ width: 170, height: 58 }} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={{ marginRight: 15, position: 'relative' }}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={26} color="#4A4A4A" />
              <View style={styles.badgeDot}>
                <Text style={styles.badgeText}>!</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.openDrawer()}>
              <Ionicons name="menu-outline" size={34} color="#4A4A4A" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerDivider} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Title Section */}
          <View style={styles.titleRow}>
            <FontAwesome5 name="hand-holding-usd" size={40} color="#00592d" style={styles.titleIcon} />
            <Text style={styles.pageTitle}>Create Request</Text>
          </View>

          <View style={styles.titleDivider} />

          {/* Custom Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabButton, requestType === 'food' ? styles.tabActive : styles.tabInactive]}
              onPress={() => setRequestType('food')}
              activeOpacity={0.9}
            >
              <MaterialCommunityIcons
                name="basket-outline"
                size={22}
                color={requestType === 'food' ? '#FFFFFF' : '#222222'}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.tabText, requestType === 'food' ? styles.tabTextActive : styles.tabTextInactive]}>
                FOOD
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, requestType === 'financial' ? styles.tabActive : styles.tabInactive]}
              onPress={() => setRequestType('financial')}
              activeOpacity={0.9}
            >
              <FontAwesome5
                name="hand-holding-usd"
                size={18}
                color={requestType === 'financial' ? '#FFFFFF' : '#222222'}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.tabText, requestType === 'financial' ? styles.tabTextActive : styles.tabTextInactive]}>
                FINANCIAL
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>

            <Text style={styles.inputLabel}>Name of Request</Text>
            <TextInput
              style={styles.inputBox}
              value={form.title}
              onChangeText={(val) => updateForm('title', val)}
            />

            {requestType === 'food' ? (
              <View style={styles.rowInputs}>
                <View style={{ flex: 2, paddingRight: 10 }}>
                  <Text style={styles.inputLabel}>Type of Food Needed</Text>
                  <CustomDropdown
                    selectedValue={form.food_type}
                    onValueChange={(val) => updateForm('food_type', val)}
                    placeholder="Select Type"
                    items={[
                      { label: "Vegetables", value: "Vegetables" },
                      { label: "Canned Goods", value: "Canned Goods" },
                      { label: "Rice/Grains", value: "Rice/Grains" },
                      { label: "Mixed", value: "Mixed" }
                    ]}
                    style={styles.inputBox}
                  />
                </View>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.inputLabel}>Quantity</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="##"
                    placeholderTextColor="#A5D1B8"
                    textAlign="center"
                    keyboardType="numeric"
                    value={form.quantity}
                    onChangeText={(val) => updateForm('quantity', val)}
                  />
                </View>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.inputLabel}>Unit</Text>
                  <CustomDropdown
                    selectedValue={form.unit}
                    onValueChange={(val) => updateForm('unit', val)}
                    placeholder="Unit"
                    items={[
                      { label: "kg", value: "kg" },
                      { label: "pcs", value: "pcs" },
                      { label: "packs", value: "packs" },
                      { label: "sacks", value: "sacks" }
                    ]}
                    style={styles.inputBox}
                  />
                </View>
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

            <View style={styles.rowInputs}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.inputLabel} numberOfLines={1} adjustsFontSizeToFit>Number of Population</Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="##"
                  placeholderTextColor="#A5D1B8"
                  textAlign="center"
                  keyboardType="numeric"
                  value={form.population}
                  onChangeText={(val) => updateForm('population', val)}
                />
              </View>
              <View style={{ flex: 1.5 }}>
                <Text style={styles.inputLabel}>Age Range</Text>
                <View style={styles.rowInputsNoMargin}>
                  <TextInput
                    style={[styles.inputBox, { flex: 1, marginRight: 8 }]}
                    placeholder="Min"
                    placeholderTextColor="#A5D1B8"
                    textAlign="center"
                    keyboardType="numeric"
                    value={form.age_start}
                    onChangeText={(val) => updateForm('age_start', val)}
                  />
                  <TextInput
                    style={[styles.inputBox, { flex: 1 }]}
                    placeholder="Max"
                    placeholderTextColor="#A5D1B8"
                    textAlign="center"
                    keyboardType="numeric"
                    value={form.age_end}
                    onChangeText={(val) => updateForm('age_end', val)}
                  />
                </View>
              </View>
            </View>

            <Text style={styles.inputLabel}>Address/ Coverage</Text>
            <View style={[styles.rowInputsNoMargin, { marginBottom: 8 }]}>
              <TextInput
                style={[styles.inputBox, { flex: 1.5, marginRight: 8 }]}
                placeholder="Street"
                placeholderTextColor="#A5D1B8"
                textAlign="center"
                value={form.street}
                onChangeText={(val) => updateForm('street', val)}
              />
              <TextInput
                style={[styles.inputBox, { flex: 1.5 }]}
                placeholder="Brgy"
                placeholderTextColor="#A5D1B8"
                textAlign="center"
                value={form.barangay}
                onChangeText={(val) => updateForm('barangay', val)}
              />
            </View>
            <View style={[styles.rowInputsNoMargin, { marginBottom: 15 }]}>
              <TextInput
                style={[styles.inputBox, { flex: 2, marginRight: 8 }]}
                placeholder="City / Municipality"
                placeholderTextColor="#A5D1B8"
                textAlign="center"
                value={form.city_municipality}
                onChangeText={(val) => updateForm('city_municipality', val)}
              />
              <TextInput
                style={[styles.inputBox, { flex: 1 }]}
                placeholder="Zip"
                placeholderTextColor="#A5D1B8"
                textAlign="center"
                keyboardType="numeric"
                value={form.postal_zip_code}
                onChangeText={(val) => updateForm('postal_zip_code', val)}
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.inputLabel}>Date Needed</Text>
                <TouchableOpacity
                  style={[styles.inputBox, { justifyContent: 'center' }]}
                  onPress={() => Platform.OS !== 'ios' && setShowDatePicker(true)}
                  activeOpacity={0.8}
                >
                  <View pointerEvents="none" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <TextInput
                      style={{ color: '#FFF', flex: 1, fontSize: 13 }}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#A5D1B8"
                      value={form.needed_date}
                      editable={false}
                    />
                    <Ionicons name="calendar-outline" size={16} color="#FFF" />
                  </View>
                  {Platform.OS === 'ios' && (
                    <DateTimePicker
                      style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.011, zIndex: 999 }}
                      value={dateObj}
                      mode="date"
                      display="compact"
                      minimumDate={new Date()}
                      onChange={onDateChange}
                    />
                  )}
                </TouchableOpacity>
                {Platform.OS !== 'ios' && showDatePicker && (
                  <DateTimePicker
                    value={dateObj}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={onDateChange}
                  />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Urgency Level</Text>
                <CustomDropdown
                  selectedValue={form.urgency_level}
                  onValueChange={(val) => updateForm('urgency_level', val)}
                  placeholder="Select Level"
                  items={[
                    { label: "LOW", value: "LOW" },
                    { label: "MEDIUM", value: "MEDIUM" },
                    { label: "HIGH", value: "HIGH" }
                  ]}
                  style={styles.inputBox}
                />
              </View>
            </View>

          </View>

          {/* Submit Button */}
          <View style={styles.submitRow}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 50 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  topHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#FFFFFF'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  headerDivider: { height: 1, backgroundColor: '#E0E0E0', marginHorizontal: -20 },
  badgeDot: {
    position: 'absolute',
    top: -3,
    right: -4,
    backgroundColor: '#E74C3C',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 30,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  titleIcon: {
    marginRight: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#00592d',
    letterSpacing: -0.5,
  },
  titleDivider: {
    height: 1,
    backgroundColor: '#A3A3A3',
    opacity: 0.3,
    marginHorizontal: -22,
    marginBottom: 25,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    paddingHorizontal: 15,
  },
  tabButton: {
    flexDirection: 'row',
    width: '45%',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tabActive: {
    backgroundColor: '#D87A38',
    borderColor: '#C66C2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  tabInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#666666',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: '#222222',
  },
  formCard: {
    backgroundColor: '#00592d',
    borderRadius: 24,
    padding: 22,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 2,
  },
  inputBox: {
    height: 40,
    borderWidth: 1,
    borderColor: '#71A987',
    borderRadius: 6,
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 15,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowInputsNoMargin: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  submitRow: {
    alignItems: 'flex-end',
    marginTop: 20,
    paddingRight: 10,
  },
  submitBtn: {
    backgroundColor: '#267A41',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center'
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  }
});
