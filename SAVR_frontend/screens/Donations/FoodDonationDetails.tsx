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
      unit: '',
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
    ApiService.getInventoryCategories()
      .then(res => {
        const cats: string[] = res.data?.categories ?? [];
        if (cats.length > 0) {
          setCategoryItems(cats.map(c => ({ label: c, value: c })));
        }
      })
      .catch(() => {});
  }, []);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(),
        name: '',
        quantity: '',
        unit: '',
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
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
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
        <View style={styles.topHeaderWrap}>
          <View style={styles.topNav}>
            <Image
              source={require('../../assets/images/logo/logobrown.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />

            <View style={styles.topRightIcons}>
              <NotificationBell navigation={navigation} color="#544434" size={28} />

              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.openDrawer?.()}
              >
                <Ionicons name="menu-outline" size={36} color="#544434" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.topDivider} />

          <View style={styles.heroTitleWrap}>
            <Image
              source={require('../../assets/images/foodonationicon.png')}
              style={styles.heroMainIconImage}
              resizeMode="contain"
            />
            <Text style={styles.heroTitle}>Food Donation</Text>
          </View>
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
                  <Ionicons name="trash-outline" size={20} color="#FFF" />
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
                      { label: "Kilograms (kg)", value: "kg" },
                      { label: "Grams (g)", value: "g" },
                      { label: "Liters (L)", value: "L" },
                      { label: "Milliliters (ml)", value: "ml" },
                      { label: "Pieces (pcs)", value: "pcs" },
                      { label: "Boxes", value: "Boxes" },
                      { label: "Packs", value: "Packs" }
                    ]}
                    style={styles.input}
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
                          : 'DD / MM / YYYY'}
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

          <View style={styles.logisticsContainer}>
            <Text style={styles.logisticsHeader}>How will we receive this?</Text>

            <TouchableOpacity
              style={styles.logisticOption}
              onPress={() => handleNext('pickup')}
              activeOpacity={0.7}
            >
              <View style={styles.logisticIconBg}>
                <Ionicons name="location" size={24} color="#00592d" />
              </View>
              <View style={styles.logisticContent}>
                <Text style={styles.logisticTitle}>Request Pickup</Text>
                <Text style={styles.logisticDesc}>We'll route a SAVR transport.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CCC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logisticOption}
              onPress={() => handleNext('delivery')}
              activeOpacity={0.7}
            >
              <View style={[styles.logisticIconBg, { backgroundColor: '#E1EDCD' }]}>
                <Ionicons name="cube" size={24} color="#00592d" />
              </View>
              <View style={styles.logisticContent}>
                <Text style={styles.logisticTitle}>I'll Deliver It Directly</Text>
                <Text style={styles.logisticDesc}>Bring it safely to our warehouse.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CCC" />
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Android native date picker dialog */}
      {Platform.OS === 'android' && showDatePickerId !== null && (
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
      )}

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
            <DateTimePicker value={iosTempDate} mode="date" display="spinner" minimumDate={new Date()} onChange={(_, d) => { if (d) setIosTempDate(d); }} style={{ width: '100%' }} textColor="#1a1a1a" />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  topHeaderWrap: {
    backgroundColor: '#FFFFFF',
  },

  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },

  logoImage: {
    width: 170,
    height: 58,
  },

  topRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBtn: {
    marginLeft: 10,
  },

  topDivider: {
    height: 1,
    backgroundColor: '#544434',
    opacity: 0.5,
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
  },

  heroTitle: {
    fontSize: 40,
    fontWeight: '700',
    color: '#00592d',
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

  submitWrap: {
    alignItems: 'flex-end',
    marginTop: 12,
    marginBottom: 24,
  },

  submitBtn: {
    backgroundColor: '#e3ae10ff',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 124,
    alignItems: 'center',
  },

  submitText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
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

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalDone: { fontSize: 15, fontWeight: '700', color: '#00592d' },

});