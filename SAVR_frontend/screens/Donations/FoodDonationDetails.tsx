import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  StatusBar,
  SafeAreaView,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CustomDropdown from '../../components/CustomDropdown';
import { ApiService } from '../../services/api';
import NotificationBell from '../../components/NotificationBell';

interface FoodItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  expiryDate: Date | null;
  specialNotes: string;
  photoUri: string | null;
}

export default function FoodDonationDetails({ navigation }: any) {
  const [items, setItems] = useState<FoodItem[]>([
    {
      id: '1',
      name: '',
      quantity: '',
      unit: 'kg',
      category: '',
      expiryDate: null,
      specialNotes: '',
      photoUri: null,
    },
  ]);
  const [showDatePickerId, setShowDatePickerId] = useState<string | null>(null);
  const [showIOSDatePickerId, setShowIOSDatePickerId] = useState<string | null>(null);
  const [iosTempDate, setIosTempDate] = useState(new Date());
  const [categoryItems, setCategoryItems] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    const BASE_CATEGORIES = [
      { label: 'Canned Goods: Non-Perishable', value: 'Canned Goods' },
      { label: 'Dairy: Perishable', value: 'Dairy' },
      { label: 'Dry Goods: Non-Perishable', value: 'Dry Goods' },
      { label: 'Fats & Oils: Non-Perishable', value: 'Fats & Oils' },
      { label: 'Fruits: Perishable', value: 'Fruits' },
      { label: 'Grains & Cereals: Non-Perishable', value: 'Grains & Cereals' },
      { label: 'Beverages: Non-Perishable', value: 'Beverages' },
      { label: 'Meat: Perishable', value: 'Meat' },
      { label: 'Sugars & Sweets: Non-Perishable', value: 'Sugars & Sweets' },
      { label: 'Protein Alternatives: Both', value: 'Protein Alternatives' },
      { label: 'Vegetables: Perishable', value: 'Vegetables' },
      { label: 'Prepared Meals: Perishable', value: 'Prepared Meals' },
    ];
    ApiService.getInventoryCategories()
      .then(res => {
        const apiCats: string[] = res.data?.categories ?? [];
        const baseValues = new Set(BASE_CATEGORIES.map(c => c.value));
        const extra = apiCats
          .filter(c => !baseValues.has(c))
          .map(c => ({ label: c, value: c }));
        setCategoryItems([...BASE_CATEGORIES, ...extra]);
      })
      .catch(() => {
        setCategoryItems(BASE_CATEGORIES);
      });
  }, []);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(),
        name: '',
        quantity: '',
        unit: 'kg',
        category: '',
        expiryDate: null,
        specialNotes: '',
        photoUri: null,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    } else {
      Alert.alert('Notice', 'You must donate at least one item.');
    }
  };

  const updateItem = (id: string, field: keyof FoodItem, value: any) => {
    setItems(items.map((item) => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'category' && value === 'Canned Goods') {
          updated.unit = 'pcs';
        }
        return updated;
      }
      return item;
    }));
  };

  const pickImage = async (id: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      updateItem(id, 'photoUri', result.assets[0].uri);
    }
  };

  const handleNext = (method: 'pickup' | 'delivery') => {
    if (items.length === 0) {
      Alert.alert('Error', 'Please add at least one food item.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name.trim() || !item.quantity.trim() || !item.category) {
        Alert.alert('Error', 'Please fill out all fields to submit donation.');
        return;
      }
    }

    navigation.navigate('FoodDonationPickup', {
      initialScheduleType: method,
      foodItems: items.map((item) => ({
        type: item.name || '',
        quantity: item.quantity ? `${item.quantity} ${item.unit || ''}`.trim() : '',
        expiryDate: item.expiryDate ? item.expiryDate.toISOString().split('T')[0] : null,
        photoUri: item.photoUri,
        category: item.category || '',
        specialNotes: item.specialNotes || '',
      })),
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F3" translucent={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* TOP BAR HEADER */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={30} color="#00592d" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NotificationBell navigation={navigation} color="#544434" size={28} style={{ marginRight: 5 }} />
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.openDrawer?.()}
            >
              <Ionicons name="menu-outline" size={32} color="#544434" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroTitleWrap}>
          <Image
            source={require('../../assets/images/foodonationicon.png')}
            style={styles.heroMainIconImage}
            resizeMode="contain"
          />
          <Text style={styles.heroTitle}>Food Donation</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerFlexRow}>
            <Text style={styles.sectionTitle}>Food Donation Details</Text>
            <TouchableOpacity style={styles.addMoreBtn} onPress={addItem} activeOpacity={0.8}>
              <Text style={styles.addMoreText}>Add More</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, index) => (
            <View key={item.id} style={styles.greenCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardNumber}>ITEM {index + 1}</Text>
                <TouchableOpacity
                  onPress={() => removeItem(item.id)}
                  style={styles.deleteIconWrap}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Food Item Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Canned vegetables, Fresh fruits"
                  placeholderTextColor="rgba(255,255,255,0.65)"
                  value={item.name}
                  onChangeText={(val) => updateItem(item.id, 'name', val)}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="##"
                    placeholderTextColor="rgba(255,255,255,0.65)"
                    keyboardType="numeric"
                    value={item.quantity}
                    onChangeText={(val) => updateItem(item.id, 'quantity', val)}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Units</Text>
                  <CustomDropdown
                    selectedValue={item.unit}
                    onValueChange={(val) => updateItem(item.id, 'unit', val)}
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

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Category</Text>
                  <CustomDropdown
                    selectedValue={item.category}
                    onValueChange={(val) => updateItem(item.id, 'category', val)}
                    placeholder="Select Category"
                    items={categoryItems}
                    style={styles.input}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1.2 }]}>
                  <Text style={styles.label}>Expiration Date</Text>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => {
                      if (Platform.OS === 'ios') {
                        setIosTempDate(item.expiryDate || new Date());
                        setShowIOSDatePickerId(item.id);
                      } else {
                        setShowDatePickerId(item.id);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                      <Text
                        style={[
                          styles.dateText,
                          !item.expiryDate && { color: 'rgba(255,255,255,0.65)' },
                        ]}
                      >
                        {item.expiryDate
                          ? item.expiryDate.toLocaleDateString()
                          : 'mm/dd/yyyy'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color={item.expiryDate ? "#FFF" : "rgba(255,255,255,0.65)"} />
                    </View>
                  </TouchableOpacity>


                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Special Notes</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="Allergies, storage requirements, etc."
                  placeholderTextColor="rgba(255,255,255,0.65)"
                  value={item.specialNotes}
                  onChangeText={(val) => updateItem(item.id, 'specialNotes', val)}
                />
              </View>

              <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage(item.id)} activeOpacity={0.8}>
                  {item.photoUri ? (
                    <Image
                      source={{ uri: item.photoUri }}
                      style={styles.uploadedImage}
                    />
                  ) : (
                    <View style={styles.uploadInner}>
                      <Ionicons name="cloud-upload-outline" size={32} color="#D8EBDD" />
                      <Text style={styles.uploadText}>Tap to Upload Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Button Row */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => handleNext('pickup')}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnText}>Next</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Android native date picker dialog */}
      {
        Platform.OS === 'android' && showDatePickerId !== null && (
          <DateTimePicker
            value={items.find(i => i.id === showDatePickerId)?.expiryDate || new Date()}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(event, date) => {
              const currentId = showDatePickerId;
              setShowDatePickerId(null);
              if (event.type === 'set' && date && currentId) {
                updateItem(currentId, 'expiryDate', date);
              }
            }}
          />
        )
      }

      {/* iOS date picker modal */}
      <Modal visible={showIOSDatePickerId !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowIOSDatePickerId(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Expiration Date</Text>
              <TouchableOpacity onPress={() => {
                if (showIOSDatePickerId) updateItem(showIOSDatePickerId, 'expiryDate', iosTempDate);
                setShowIOSDatePickerId(null);
              }}>
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker value={iosTempDate} mode="date" display="spinner" minimumDate={new Date()} onChange={(_, d) => { if (d) setIosTempDate(d); }} style={{ width: '100%', alignSelf: 'center' }} textColor="#1a1a1a" />
          </View>
        </View>
      </Modal>

    </SafeAreaView >
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
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 170,
    height: 58,
    marginBottom: 6,
  },
  iconBtn: {
    marginLeft: 10,
  },

  heroTitleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 30,
    paddingBottom: 25,
    flexDirection: 'row',
  },

  heroMainIconImage: {
    width: 60,
    height: 60,
    marginRight: 12,
    tintColor: '#000000',
  },

  heroTitle: {
    fontSize: 40,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: - 0.5,
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  headerFlexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 26,
    marginTop: 8,
  },

  sectionTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: '#212020ff',
    letterSpacing: -0.5,
  },

  addMoreBtn: {
    borderWidth: 1.2,
    borderColor: '#C97B37',
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 5,
    backgroundColor: '#F8F7F4',
  },

  addMoreText: {
    color: '#2D1D0F',
    fontSize: 14,
    fontWeight: '800',
  },

  greenCard: {
    backgroundColor: '#00592d',
    padding: 20,
    borderRadius: 22,
    marginBottom: 20,
    shadowColor: '#2F8E55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  cardNumber: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },

  deleteIconWrap: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    padding: 6,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },

  inputGroup: {
    marginBottom: 12,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  label: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    marginLeft: 2,
  },

  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    height: 48,
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },

  notesInput: {
    height: 38,
  },

  dateInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    height: 48,
    borderRadius: 4,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },

  dateText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },

  uploadBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    height: 250,
    borderRadius: 8,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
  },

  uploadInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  uploadText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },

  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },



  logisticsContainer: {
    marginTop: 10,
  },

  logisticsHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#e6a52eff',
    marginBottom: 15,
    letterSpacing: -0.5,
  },

  logisticOption: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    alignItems: 'center',
    borderColor: '#E1E9E4',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },

  logisticIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E1EDCD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },

  logisticContent: {
    flex: 1,
  },

  logisticTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#00592d',
    marginBottom: 2,
  },

  logisticDesc: {
    fontSize: 12,
    color: '#8A8177',
    marginTop: 2,
  },

  submitGenericBtn: {
    backgroundColor: '#FBBE28',
    borderRadius: 25,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },

  submitGenericBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  logisticOptionActive: {
    borderColor: '#00592d',
    borderWidth: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    marginTop: 25,
    marginBottom: 10,
  },
  cancelBtn: {
    width: 90,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cancelBtnText: {
    color: '#777777',
    fontSize: 16,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#CA6F2E',
    width: 130,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#CA6F2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalDone: { fontSize: 15, fontWeight: '700', color: '#00592d' },

});