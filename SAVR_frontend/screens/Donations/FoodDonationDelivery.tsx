import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, StatusBar, Platform, ScrollView, SafeAreaView } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';

export default function FoodDonationDelivery({ route, navigation }: any) {
  const warehouseLocation = {
    latitude: 14.5547,
    longitude: 121.0244,
    latitudeDelta: 0.05,
    longitudeDelta: 0.02,
  };

  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date());
  const [deliveryTime, setDeliveryTime] = useState<Date>(new Date());
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { foodItems } = route.params || { foodItems: [] };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('schedule_type', 'delivery');
      formData.append('pickup_address', 'Room 300, DHI Building, No. 2 Lapu Lapu Avenue, Magallanes, Makati City 1232, Metro Manila, Philippines');
      formData.append('pickup_latitude', '14.5547');
      formData.append('pickup_longitude', '121.0244');

      const dateStr = deliveryDate.toISOString().split('T')[0];
      const timeStr = deliveryTime.toTimeString().split(' ')[0].substring(0, 5);
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
        navigation.popToTop();
        Alert.alert('Success', `You donated ${donatedItemsStr}! See you at the warehouse.`, [
          { text: 'OK', onPress: () => navigation.navigate('HomeTabs', { screen: 'Home' }) },
        ]);
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
      <StatusBar barStyle="light-content" backgroundColor="#00592d" translucent={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBackground}>
          <View style={styles.topNav}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('FoodDonationDetails')}>
              <Ionicons name="chevron-back" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroTitleMain}>
              SCHEDULE <Text style={styles.heroTitleHighlight}>DROP-OFF</Text>
            </Text>
          </View>
        </View>

        <View style={styles.mapContainer}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={warehouseLocation}
            zoomEnabled={false}
            scrollEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker
              coordinate={{ latitude: warehouseLocation.latitude, longitude: warehouseLocation.longitude }}
            >
              <Ionicons name="business" size={40} color="#1E583A" />
            </Marker>
          </MapView>
          <View style={styles.addressOverlay}>
            <Text style={styles.addressTitle}>HQ Drop-off Point</Text>
            <Text style={[styles.addressText, { textAlign: 'center' }]}>Room 300, DHI Building, No. 2 Lapu Lapu Avenue, Magallanes, Makati City 1232 , Metro Manila, Philippines.</Text>
          </View>
        </View>

        <View style={styles.bottomPanel}>
          <Text style={styles.sectionTitle}>Expected Arrival Time</Text>

          <View style={styles.dateRow}>
            <TouchableOpacity style={[styles.dateBtn, { position: 'relative' }]} onPress={() => Platform.OS !== 'ios' && setDatePickerMode('date')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
                <Text style={styles.dateLabel}>Date: </Text>
                <Text style={styles.dateValue}>{deliveryDate.toLocaleDateString()}</Text>
              </View>
              {Platform.OS === 'ios' && (
                <DateTimePicker
                  style={styles.invisiblePicker}
                  value={deliveryDate}
                  mode="date"
                  display="compact"
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    if (date) setDeliveryDate(date);
                  }}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.dateBtn, { position: 'relative' }]} onPress={() => Platform.OS !== 'ios' && setDatePickerMode('time')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
                <Text style={styles.dateLabel}>Time: </Text>
                <Text style={styles.dateValue}>
                  {deliveryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              {Platform.OS === 'ios' && (
                <DateTimePicker
                  style={styles.invisiblePicker}
                  value={deliveryTime}
                  mode="time"
                  display="compact"
                  onChange={(event, date) => {
                    if (date) setDeliveryTime(date);
                  }}
                />
              )}
            </TouchableOpacity>
          </View>



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
          value={datePickerMode === 'date' ? deliveryDate : deliveryTime}
          mode={datePickerMode}
          minimumDate={datePickerMode === 'date' ? new Date() : undefined}
          display="default"
          onChange={(event, selectedDate) => {
            const currentMode = datePickerMode;
            setDatePickerMode(null);

            if (event.type === 'set' && selectedDate) {
              if (currentMode === 'date') setDeliveryDate(selectedDate);
              else if (currentMode === 'time') setDeliveryTime(selectedDate);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollContent: { paddingBottom: 60 },

  heroBackground: {
    backgroundColor: '#1E583A',
    borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
    paddingBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8,
    zIndex: 2

  },
  topNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15,
  },
  backButton: { padding: 5 },
  logoRow: { alignItems: 'center' },
  logoText: { color: '#FFF', fontSize: 14, fontFamily: 'sans-serif' },
  logoSub: { color: '#FFF', fontSize: 9, opacity: 0.8, marginTop: -2 },
  heroContent: { paddingHorizontal: 25 },
  heroTitleMain: { fontSize: 24, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  heroTitleHighlight: { color: '#FACC15' },

  mapContainer: { height: 250, position: 'relative', marginTop: -25 },
  map: { flex: 1 },
  addressOverlay: {
    position: 'absolute', top: 40, alignSelf: 'center', left: '10%', right: '10%',
    backgroundColor: 'rgba(255,255,255,0.95)', padding: 15, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3, alignItems: 'center'
  },
  addressTitle: { fontSize: 15, fontWeight: '800', color: '#00592d', marginBottom: 2 },
  addressText: { fontSize: 13, color: '#666', fontWeight: '600' },

  bottomPanel: {
    backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 15, marginTop: -20,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#CA6F2E', marginBottom: 15 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  dateBtn: {
    width: '48%', backgroundColor: '#F0F6F3', height: 50, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#226E45'
  },
  dateLabel: { fontSize: 13, color: '#00592d', fontWeight: '800' },
  dateValue: { fontSize: 13, fontWeight: '800', color: '#111' },

  confirmBtn: {
    backgroundColor: '#CA6F2E', height: 60, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#CA6F2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  invisiblePicker: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.011,
    zIndex: 999,
  }
});
