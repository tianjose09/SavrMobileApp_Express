import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, StatusBar, Platform, Image, TextInput, ScrollView, SafeAreaView, Modal } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import ToastBanner from '../../components/ToastBanner';
import NotificationBell from '../../components/NotificationBell';

export default function FoodDonationPickup({ route, navigation }: any) {
  const initialType = route.params?.initialScheduleType || 'pickup';
  const [scheduleType, setScheduleType] = useState<'pickup' | 'delivery'>(initialType);
  const [pickupAddress, setPickupAddress] = useState('');
  const [toast, setToast] = useState({ visible: false, title: '', message: '' });

  useEffect(() => {
    if (route.params?.initialScheduleType) {
      setScheduleType(route.params.initialScheduleType);
    }
  }, [route.params?.initialScheduleType]);

  const [location, setLocation] = useState({
    latitude: 14.4445, // roughly Las Pinas
    longitude: 120.9842,
    latitudeDelta: 0.0422,
    longitudeDelta: 0.0221,
  });

  const [pickupDate, setPickupDate] = useState<Date | null>(null);
  const [pickupTimeFrom, setPickupTimeFrom] = useState<Date | null>(null);
  const [pickupTimeTo, setPickupTimeTo] = useState<Date | null>(null);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time_from' | 'time_to' | null>(null);
  const [showIOSDate, setShowIOSDate] = useState(false);
  const [showIOSDateFrom, setShowIOSDateFrom] = useState(false);
  const [showIOSDateTo, setShowIOSDateTo] = useState(false);
  const [tempPickupDate, setTempPickupDate] = useState(() => new Date());
  const [tempPickupTimeFrom, setTempPickupTimeFrom] = useState(() => {
    const d = new Date();
    d.setHours(7, 0, 0, 0);
    return d;
  });
  const [tempPickupTimeTo, setTempPickupTimeTo] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const mapRef = useRef<MapView>(null);
  const isProgrammaticMove = useRef(false);

  const { foodItems } = route.params || { foodItems: [] };

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
        setPickupAddress(parts.join(', '));
      }
    } catch {}
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
          setPickupAddress(parts.join(', '));
        }
      } catch (e) { }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!pickupDate) {
      Alert.alert('Error', 'Please select a preferred date.');
      return;
    }
    if (!pickupTimeFrom || !pickupTimeTo) {
      Alert.alert('Error', 'Please select both start and end times for the slot.');
      return;
    }
    const fromHours = pickupTimeFrom.getHours();
    const fromMinutes = pickupTimeFrom.getMinutes();
    const toHours = pickupTimeTo.getHours();
    const toMinutes = pickupTimeTo.getMinutes();

    if (fromHours < 7 || fromHours > 21 || (fromHours === 21 && fromMinutes > 0)) {
      Alert.alert('Invalid Time', 'Please select a start time between 7:00 AM and 9:00 PM.');
      return;
    }
    if (toHours < 7 || toHours > 21 || (toHours === 21 && toMinutes > 0)) {
      Alert.alert('Invalid Time', 'Please select an end time between 7:00 AM and 9:00 PM.');
      return;
    }
    if (pickupTimeFrom >= pickupTimeTo) {
      Alert.alert('Invalid Time Slot', 'End time must be after the start time.');
      return;
    }
    if (scheduleType === 'pickup' && !pickupAddress.trim()) {
      Alert.alert('Error', 'Please enter a pickup address.');
      return;
    }
    setIsLoading(true);
    try {
      const formData = new FormData();

      formData.append('schedule_type', scheduleType);

      if (scheduleType === 'pickup') {
        formData.append('pickup_latitude', location.latitude.toString());
        formData.append('pickup_longitude', location.longitude.toString());
        formData.append('pickup_address', pickupAddress.trim() || `${location.latitude}, ${location.longitude}`);
      } else {
        formData.append('pickup_latitude', '14.5332');
        formData.append('pickup_longitude', '121.0189');
        formData.append('pickup_address', 'Room 300, DHI Building, No. 2 Lapu Lapu Avenue, Magallanes, Makati City 1232 , Metro Manila, Philippines');
      }

      const finalDateStr = pickupDate.toISOString().split('T')[0];
      const fromStr = pickupTimeFrom.toTimeString().split(' ')[0].substring(0, 5);
      const toStr = pickupTimeTo.toTimeString().split(' ')[0].substring(0, 5);
      const finalTimeStr = `${fromStr} - ${toStr}`;
      formData.append('preferred_date', finalDateStr);
      formData.append('time_slot', finalTimeStr);

      formData.append('food_items', JSON.stringify(foodItems.map((fi: any) => ({
        type: fi.type,
        quantity: fi.quantity,
        expiry_date: fi.expiryDate,
        category: fi.category || '',
        special_notes: fi.specialNotes || '',
        photo_filename: fi.photoUri ? fi.photoUri.split('/').pop() : null,
      }))));

      // Use plain 'food_images' field name (not indexed) so multer .array() picks them up
      foodItems.forEach((item: any) => {
        if (item.photoUri) {
          const filename = item.photoUri.split('/').pop() || `food_photo.jpg`;
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          // @ts-ignore
          formData.append('food_images', { uri: item.photoUri, name: filename, type });
        }
      });

      const response = await ApiService.submitFoodDonation(formData);
      if (response.data.success) {
        const donatedItemsStr = foodItems.map((fi: any) => `${fi.quantity} of ${fi.type}`).join(', ');
        setToast({
          visible: true,
          title: 'Food Donation Received!',
          message: `You successfully donated ${donatedItemsStr}. Thank you for your contribution!`,
        });
        setTimeout(() => navigation.navigate('HomeTabs', { screen: 'Home' }), 4500);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to submit.');
      }
    } catch (e: any) {
      console.log('Submit pickup error:', JSON.stringify(e?.response?.data ?? e?.message));
      const msg = e?.response?.data?.message
        || e?.response?.data?.errors
        || e?.message
        || 'Connection error. Make sure you are connected to the same network as the server.';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeWithAMPM = (date: Date | null) => {
    if (!date) return '--:-- --';
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${strMinutes} ${ampm}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ToastBanner
        visible={toast.visible}
        title={toast.title}
        message={toast.message}
        type="success"
        onHide={() => setToast(t => ({ ...t, visible: false }))}
      />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* TOP NAV & HERO */}
        <View style={styles.topHeaderWrap}>
          <View style={styles.topNav}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 10, paddingVertical: 5 }}>
              <Ionicons name="chevron-back" size={32} color="#544434" />
            </TouchableOpacity>

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
        </View>

        <View style={styles.scheduleTitleWrap}>
          <Text style={styles.scheduleTitle}>Schedule Pickup & Delivery</Text>
        </View>

        {/* TOGGLE BUTTONS */}
        <View style={styles.toggleWrap}>
          <TouchableOpacity
            style={[styles.toggleBtn, scheduleType === 'pickup' && styles.toggleBtnActive]}
            onPress={() => setScheduleType('pickup')}
          >
            <Text style={[styles.toggleBtnText, scheduleType === 'pickup' && styles.toggleBtnTextActive]}>PICK UP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, scheduleType === 'delivery' && styles.toggleBtnActive]}
            onPress={() => setScheduleType('delivery')}
          >
            <Text style={[styles.toggleBtnText, scheduleType === 'delivery' && styles.toggleBtnTextActive]}>DELIVERY</Text>
          </TouchableOpacity>
        </View>

        {/* ADDRESS SECTION */}
        <View style={styles.addressSection}>
          <Text style={styles.inputLabel}>{scheduleType === 'pickup' ? 'Pickup Address' : 'Drop-off Address'}</Text>

          {scheduleType === 'pickup' ? (
            <View style={styles.addressInputRow}>
              <TextInput
                style={[styles.addressInput, { flex: 1 }]}
                placeholder="Enter pickup address"
                placeholderTextColor="rgba(0,89,45,0.45)"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                onSubmitEditing={() => geocodeAddress(pickupAddress)}
                returnKeyType="search"
              />
            </View>
          ) : (
            <View>
              <View style={styles.warehouseAddressWrap}>
                <Ionicons name="location" size={22} color="#00592d" style={{ marginRight: 6, flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }} />
                <Text style={styles.warehouseAddressText}>Room 300, DHI Building, No. 2 Lapu Lapu Avenue, Magallanes, Makati City 1232, Metro Manila, Philippines</Text>
              </View>
              <Text style={styles.deliveryHintText}>
                Please bring your donation to this address on your selected date and time.
              </Text>
            </View>
          )}
        </View>

        {/* MAP */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={scheduleType === 'pickup' ? location : {
              latitude: 14.5332,
              longitude: 121.0189,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008,
            }}
            scrollEnabled={scheduleType === 'pickup'}
            zoomEnabled={scheduleType === 'pickup'}
            pitchEnabled={scheduleType === 'pickup'}
            rotateEnabled={scheduleType === 'pickup'}
            onRegionChangeComplete={(reg) => {
              if (scheduleType === 'pickup') {
                setLocation(reg);
                if (isProgrammaticMove.current) {
                  isProgrammaticMove.current = false;
                } else {
                  reverseGeocode(reg.latitude, reg.longitude);
                }
              }
            }}
          />
          {scheduleType === 'pickup' && (
            <View pointerEvents="none" style={styles.markerFixed}>
              <Ionicons name="location" size={40} color="red" />
            </View>
          )}
          {scheduleType === 'delivery' && (
            <View pointerEvents="none" style={styles.markerFixed}>
              <Ionicons name="location" size={40} color="red" />
            </View>
          )}
        </View>

        {/* DATE & TIME FIELDS */}
        <View style={styles.dateTimeSectionWrap}>
          <View style={styles.fieldContainer}>
            <Text style={styles.inputLabel}>Preferred Date</Text>
            <TouchableOpacity
              style={styles.pickerInputWrapper}
              onPress={() => {
                if (Platform.OS === 'ios') { setTempPickupDate(pickupDate || new Date()); setShowIOSDate(true); }
                else setDatePickerMode('date');
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.pickerTextInput, !pickupDate && { color: 'rgba(0,89,45,0.45)' }]}>
                {pickupDate ? pickupDate.toLocaleDateString() : 'mm/dd/yyyy'}
              </Text>
              <View style={styles.pickerIconBtn}>
                <Ionicons name="calendar-outline" size={20} color="#8CA697" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.inputLabel}>Time Slot</Text>
            <View style={styles.timeSlotRow}>
              <View style={styles.halfInput}>
                <Text style={styles.timeLabel}>From</Text>
                <TouchableOpacity
                  style={styles.pickerInputWrapper}
                  onPress={() => {
                    const d = pickupTimeFrom || new Date();
                    d.setHours(7, 0, 0, 0);
                    setTempPickupTimeFrom(d);
                    if (Platform.OS === 'ios') { setShowIOSDateFrom(true); }
                    else setDatePickerMode('time_from');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pickerTextInput, !pickupTimeFrom && { color: 'rgba(0,89,45,0.45)' }]}>
                    {pickupTimeFrom ? formatTimeWithAMPM(pickupTimeFrom) : '--:-- --'}
                  </Text>
                  <View style={styles.pickerIconBtn}>
                    <Ionicons name="time-outline" size={20} color="#8CA697" />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.halfInput}>
                <Text style={styles.timeLabel}>To</Text>
                <TouchableOpacity
                  style={styles.pickerInputWrapper}
                  onPress={() => {
                    const d = pickupTimeTo || new Date();
                    d.setHours(9, 0, 0, 0);
                    setTempPickupTimeTo(d);
                    if (Platform.OS === 'ios') { setShowIOSDateTo(true); }
                    else setDatePickerMode('time_to');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pickerTextInput, !pickupTimeTo && { color: 'rgba(0,89,45,0.45)' }]}>
                    {pickupTimeTo ? formatTimeWithAMPM(pickupTimeTo) : '--:-- --'}
                  </Text>
                  <View style={styles.pickerIconBtn}>
                    <Ionicons name="time-outline" size={20} color="#8CA697" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* iOS Date Picker Modal */}
        <Modal visible={showIOSDate} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowIOSDate(false)}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => { setPickupDate(tempPickupDate); setShowIOSDate(false); }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
              </View>
              <DateTimePicker value={tempPickupDate} mode="date" display="spinner" minimumDate={new Date()} onChange={(_, d) => { if (d) setTempPickupDate(d); }} style={{ width: '100%', alignSelf: 'center' }} textColor="#1a1a1a" />
            </View>
          </View>
        </Modal>

        {/* iOS Time From Modal */}
        <Modal visible={showIOSDateFrom} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowIOSDateFrom(false)}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
                <Text style={styles.modalTitle}>Select Start Time</Text>
                <TouchableOpacity onPress={() => { setPickupTimeFrom(tempPickupTimeFrom); setShowIOSDateFrom(false); }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
              </View>
              <DateTimePicker value={tempPickupTimeFrom} mode="time" display="spinner" onChange={(_, d) => { if (d) setTempPickupTimeFrom(d); }} style={{ width: '100%', alignSelf: 'center' }} textColor="#1a1a1a" />
            </View>
          </View>
        </Modal>

        {/* iOS Time To Modal */}
        <Modal visible={showIOSDateTo} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowIOSDateTo(false)}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
                <Text style={styles.modalTitle}>Select End Time</Text>
                <TouchableOpacity onPress={() => { setPickupTimeTo(tempPickupTimeTo); setShowIOSDateTo(false); }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
              </View>
              <DateTimePicker value={tempPickupTimeTo} mode="time" display="spinner" onChange={(_, d) => { if (d) setTempPickupTimeTo(d); }} style={{ width: '100%', alignSelf: 'center' }} textColor="#1a1a1a" />
            </View>
          </View>
        </Modal>

        <View style={styles.submitWrap}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, isLoading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Shared Android date/time picker */}
      {Platform.OS === 'android' && datePickerMode && (
        <DateTimePicker
          value={
            datePickerMode === 'date'
              ? (pickupDate || new Date())
              : datePickerMode === 'time_from'
              ? (pickupTimeFrom || (() => { const d = new Date(); d.setHours(7, 0, 0, 0); return d; })())
              : (pickupTimeTo || (() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; })())
          }
          mode={datePickerMode === 'date' ? 'date' : 'time'}
          minimumDate={datePickerMode === 'date' ? new Date() : undefined}
          display="default"
          onChange={(event, selectedDate) => {
            const currentMode = datePickerMode;
            setDatePickerMode(null);
            if (event.type === 'set' && selectedDate) {
              if (currentMode === 'date') setPickupDate(selectedDate);
              else if (currentMode === 'time_from') setPickupTimeFrom(selectedDate);
              else if (currentMode === 'time_to') setPickupTimeTo(selectedDate);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    paddingBottom: 60,
  },

  topHeaderWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 12,
    marginTop: 12,
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
    marginLeft: 18,
  },
  topDivider: {
    height: 1,
    backgroundColor: '#544434',
    opacity: 0.5,
  },
  heroTitleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 5,
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

  scheduleTitleWrap: {
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 20,
  },
  scheduleTitle: {
    fontSize: 25,
    fontWeight: '700',
    color: '#00592d',
  },

  toggleWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 38,
    marginBottom: 26,
    gap: 15,
  },
  toggleBtn: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#00592d',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#F0B233',
    borderColor: '#F0B233',
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00592d',
    letterSpacing: 0.5,
  },
  toggleBtnTextActive: {
    color: '#FFF',
  },

  addressSection: {
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 19,
    fontWeight: '700',
    color: '#00592d',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  addressInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#8CA697',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 48,
    fontSize: 14,
    color: '#00592d',
    backgroundColor: '#F5F7F5',
  },
  geocodeBtn: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: '#D17C31',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warehouseAddressWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  warehouseAddressText: {
    fontSize: 15,
    color: '#00592d',
    flex: 1,
    lineHeight: 20,
  },

  mapContainer: {
    height: 250,
    marginHorizontal: 30,
    borderWidth: 1,
    borderColor: '#CCC',
    marginBottom: 25,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  markerFixed: {
    left: '50%', top: '50%', position: 'absolute',
    marginLeft: -20, marginTop: -40,
    justifyContent: 'flex-end', alignItems: 'center',
  },

  dateTimeSectionWrap: {
    paddingHorizontal: 30,
    marginBottom: 30,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  timeSlotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#777777',
    marginBottom: 6,
  },
  halfInput: {
    width: '48%',
  },
  deliveryHintText: {
    fontSize: 13,
    color: '#777777',
    marginTop: 10,
    lineHeight: 18,
  },
  pickerInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8CA697',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
    backgroundColor: '#F5F7F5',
  },
  pickerTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#00592d',
    fontWeight: '600',
    lineHeight: 48,
  },
  pickerIconBtn: {
    padding: 5,
    overflow: 'hidden',
  },
  invisiblePicker: { display: 'none' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalDone: { fontSize: 15, fontWeight: '700', color: '#00592d' },

  submitWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 30,
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
    width: 130,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#CA6F2E',
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
    fontSize: 16,
    fontWeight: '700',
  },

});
