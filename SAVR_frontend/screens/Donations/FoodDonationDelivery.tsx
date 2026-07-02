import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, StatusBar, Platform, ScrollView, Modal, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import NotificationBell from '../../components/NotificationBell';

export default function FoodDonationDelivery({ route, navigation }: any) {
  // Exact coordinates for 107 Marcos Alvarez Avenue, Talon Kuatro, Las Piñas
  const warehouseLocation = {
    latitude: 14.4378,
    longitude: 120.9836,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  };

  const [deliveryDate, setDeliveryDate] = useState<Date | null>(null);
  const [deliveryTimeFrom, setDeliveryTimeFrom] = useState<Date | null>(null);
  const [deliveryTimeTo, setDeliveryTimeTo] = useState<Date | null>(null);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time_from' | 'time_to' | null>(null);
  const [showIOSDate, setShowIOSDate] = useState(false);
  const [showIOSDateFrom, setShowIOSDateFrom] = useState(false);
  const [showIOSDateTo, setShowIOSDateTo] = useState(false);
  const getTomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); return d; };
  const [tempDate, setTempDate] = useState(() => getTomorrow());
  const [tempTimeFrom, setTempTimeFrom] = useState(() => {
    const d = new Date();
    d.setHours(7, 0, 0, 0);
    return d;
  });
  const [tempTimeTo, setTempTimeTo] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setDeliveryDate(null);
    setDeliveryTimeFrom(null);
    setDeliveryTimeTo(null);
    setTimeout(() => setRefreshing(false), 500);
  };

  const { foodItems } = route.params || { foodItems: [] };

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

  const handleSubmit = async () => {
    if (!deliveryDate) {
      Alert.alert('Error', 'Please select a preferred date.');
      return;
    }
    const tomorrow = getTomorrow();
    if (deliveryDate < tomorrow) {
      Alert.alert('Invalid Date', 'Please select a date starting from tomorrow onwards.');
      return;
    }
    if (!deliveryTimeFrom || !deliveryTimeTo) {
      Alert.alert('Error', 'Please select both start and end times for the slot.');
      return;
    }
    const fromHours = deliveryTimeFrom.getHours();
    const fromMinutes = deliveryTimeFrom.getMinutes();
    const toHours = deliveryTimeTo.getHours();
    const toMinutes = deliveryTimeTo.getMinutes();

    if (fromHours < 7 || fromHours > 17 || (fromHours === 17 && fromMinutes > 0)) {
      Alert.alert('Invalid Time', 'Please select a start time between 7:00 AM and 5:00 PM.');
      return;
    }
    if (toHours < 7 || toHours > 17 || (toHours === 17 && toMinutes > 0)) {
      Alert.alert('Invalid Time', 'Please select an end time between 7:00 AM and 5:00 PM.');
      return;
    }
    if (deliveryTimeFrom >= deliveryTimeTo) {
      Alert.alert('Invalid Time Slot', 'End time must be after the start time.');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('schedule_type', 'delivery');
      formData.append('pickup_address', '107 Marcos Alvarez Avenue, Talon Kuatro, Las Piñas 1747, Metro Manila, Philippines');
      formData.append('pickup_latitude', '14.4378');
      formData.append('pickup_longitude', '120.9836');

      const dateStr = deliveryDate.toISOString().split('T')[0];
      const fromStr = deliveryTimeFrom.toTimeString().split(' ')[0].substring(0, 5);
      const toStr = deliveryTimeTo.toTimeString().split(' ')[0].substring(0, 5);
      const timeStr = `${fromStr} - ${toStr}`;
      formData.append('preferred_date', dateStr);
      formData.append('time_slot', timeStr);

      formData.append('food_items', JSON.stringify(foodItems.map((fi: any) => ({
        type: fi.type,
        quantity: fi.quantity,
        expiry_date: fi.expiryDate
      }))));

      foodItems.forEach((item: any, idx: number) => {
        if (item.photoUri) {
          const filename = item.photoUri.split('/').pop() || `food_${idx}.jpg`;
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image`;
          // @ts-ignore
          formData.append(`food_images[${idx}]`, { uri: item.photoUri, name: filename, type });
        }
      });

      const response = await ApiService.submitFoodDonation(formData);
      if (response.data.success) {
        const donatedItemsStr = foodItems.map((fi: any) => `${fi.quantity} of ${fi.type}`).join(', ');
        Alert.alert(
          'Delivery Scheduled!',
          `You have scheduled delivery of ${donatedItemsStr}. We'll see you at the warehouse on the selected date!`,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'ChooseDonation' }],
                });
              }
            },
          ]
        );
      } else {
        Alert.alert('Error', response.data.message || 'Failed to submit.');
      }
    } catch (e: any) {
      const errors = e.response?.data?.errors;
      let specificError = null;
      if (errors && Object.values(errors).length > 0) {
        specificError = (Object.values(errors)[0] as string[])[0];
      }
      Alert.alert('Error', specificError || e.response?.data?.message || 'Connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

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
          <TouchableOpacity onPress={() => navigation.openDrawer?.()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu-outline" size={32} color="#544434" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00592d"
            colors={['#00592d']}
          />
        }
      >
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={warehouseLocation}
            zoomEnabled={false}
            scrollEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          />
          <View pointerEvents="none" style={styles.markerFixed}>
            <Ionicons name="location" size={44} color="red" />
          </View>
        </View>

        <View style={styles.bottomPanel}>
          {/* Drop-off Address Card */}
          <View style={styles.addressOverlay}>
            <Ionicons name="location" size={20} color="#00592d" style={{ marginRight: 6, marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressTitle}>HQ Drop-off Point</Text>
              <Text style={styles.addressText}>107 Marcos Alvarez Avenue, Talon Kuatro, Las Piñas 1747, Metro Manila, Philippines.</Text>
            </View>
          </View>
          <Text style={styles.deliveryHintText}>
            Please bring your donation to this address on your selected date and time.
          </Text>

          {/* DATE & TIME FIELDS */}
          <View style={styles.dateTimeSectionWrap}>
            <View style={styles.fieldContainer}>
              <Text style={styles.inputLabel}>Preferred Date<Text style={{ color: '#E4B63F' }}> *</Text></Text>
              <TouchableOpacity
                style={styles.pickerInputWrapper}
                onPress={() => {
                  if (Platform.OS === 'ios') { setTempDate(deliveryDate || new Date()); setShowIOSDate(true); }
                  else setDatePickerMode('date');
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.pickerTextInput, !deliveryDate && { color: 'rgba(0,89,45,0.45)' }]}>
                  {deliveryDate ? deliveryDate.toLocaleDateString() : 'mm/dd/yyyy'}
                </Text>
                <View style={styles.pickerIconBtn}>
                  <Ionicons name="calendar-outline" size={20} color="#8CA697" />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.inputLabel}>Time Slot<Text style={{ color: '#E4B63F' }}> *</Text></Text>
              <View style={styles.timeSlotRow}>
                <View style={styles.halfInput}>
                  <Text style={styles.timeLabel}>From</Text>
                  <TouchableOpacity
                    style={styles.pickerInputWrapper}
                    onPress={() => {
                      const d = deliveryTimeFrom || new Date();
                      d.setHours(7, 0, 0, 0);
                      setTempTimeFrom(d);
                      if (Platform.OS === 'ios') { setShowIOSDateFrom(true); }
                      else setDatePickerMode('time_from');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.pickerTextInput, !deliveryTimeFrom && { color: 'rgba(0,89,45,0.45)' }]}>
                      {deliveryTimeFrom ? formatTimeWithAMPM(deliveryTimeFrom) : '--:-- --'}
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
                      const d = deliveryTimeTo || new Date();
                      d.setHours(9, 0, 0, 0);
                      setTempTimeTo(d);
                      if (Platform.OS === 'ios') { setShowIOSDateTo(true); }
                      else setDatePickerMode('time_to');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.pickerTextInput, !deliveryTimeTo && { color: 'rgba(0,89,45,0.45)' }]}>
                      {deliveryTimeTo ? formatTimeWithAMPM(deliveryTimeTo) : '--:-- --'}
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
                  <TouchableOpacity onPress={() => { setDeliveryDate(tempDate); setShowIOSDate(false); }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
                </View>
                <DateTimePicker value={tempDate} mode="date" display="spinner" minimumDate={getTomorrow()} onChange={(_, d) => { if (d) setTempDate(d); }} style={{ width: '100%', alignSelf: 'center' }} textColor="#1a1a1a" />
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
                  <TouchableOpacity onPress={() => { setDeliveryTimeFrom(tempTimeFrom); setShowIOSDateFrom(false); }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
                </View>
                <DateTimePicker value={tempTimeFrom} mode="time" display="spinner" onChange={(_, d) => { if (d) setTempTimeFrom(d); }} style={{ width: '100%', alignSelf: 'center' }} textColor="#1a1a1a" />
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
                  <TouchableOpacity onPress={() => { setDeliveryTimeTo(tempTimeTo); setShowIOSDateTo(false); }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
                </View>
                <DateTimePicker value={tempTimeTo} mode="time" display="spinner" onChange={(_, d) => { if (d) setTempTimeTo(d); }} style={{ width: '100%', alignSelf: 'center' }} textColor="#1a1a1a" />
              </View>
            </View>
          </Modal>

          <TouchableOpacity
            style={[styles.confirmBtn, isLoading && { backgroundColor: '#A7C2B2' }]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Confirm Delivery</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Shared Absolute OS Date/Time Picker */}
      {Platform.OS !== 'ios' && datePickerMode && (
        <DateTimePicker
          value={
            datePickerMode === 'date'
              ? (deliveryDate || new Date())
              : datePickerMode === 'time_from'
              ? (deliveryTimeFrom || (() => { const d = new Date(); d.setHours(7, 0, 0, 0); return d; })())
              : (deliveryTimeTo || (() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; })())
          }
          mode={datePickerMode === 'date' ? 'date' : 'time'}
          minimumDate={datePickerMode === 'date' ? getTomorrow() : undefined}
          display="default"
          onChange={(event, selectedDate) => {
            const currentMode = datePickerMode;
            setDatePickerMode(null);

            if (event.type === 'set' && selectedDate) {
              if (currentMode === 'date') setDeliveryDate(selectedDate);
              else if (currentMode === 'time_from') setDeliveryTimeFrom(selectedDate);
              else if (currentMode === 'time_to') setDeliveryTimeTo(selectedDate);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollContent: { paddingBottom: 130 },

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
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },

  mapContainer: { height: 250, position: 'relative', zIndex: 1, overflow: 'visible' },
  map: { flex: 1 },
  markerFixed: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -44,
    zIndex: 999,
    elevation: 999,
  },
  addressOverlay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FAF4',
    borderWidth: 1.5,
    borderColor: '#00592d',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  addressTitle: { fontSize: 15, fontWeight: '800', color: '#00592d', marginBottom: 2 },
  addressText: { fontSize: 13, color: '#00592d', fontWeight: '600' },

  bottomPanel: {
    backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 15, marginTop: -20,
  },
  inputLabel: {
    fontSize: 19,
    fontWeight: '700',
    color: '#00592d',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  dateTimeSectionWrap: {
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
    marginTop: -10,
    marginBottom: 20,
    lineHeight: 18,
  },
  pickerInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8CA697',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 15,
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

  confirmBtn: {
    backgroundColor: '#CA6F2E', height: 60, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#CA6F2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalDone: { fontSize: 15, fontWeight: '700', color: '#00592d' },
});
