import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, StatusBar, Platform, Image, TextInput, ScrollView, Modal, RefreshControl, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import ToastBanner from '../../components/ToastBanner';
import NotificationBell from '../../components/NotificationBell';

export default function FoodDonationPickup({ route, navigation }: any) {
  const initialType = route.params?.initialScheduleType || 'pickup';
  const [scheduleType, setScheduleType] = useState<'pickup' | 'delivery'>(initialType);
  const [pickupAddress, setPickupAddress] = useState('');
  const [toast, setToast] = useState({ visible: false, title: '', message: '' });
  const [refreshing, setRefreshing] = useState(false);

  // PICKUP States
  const [pickupDate, setPickupDate] = useState<Date | null>(null);
  const [pickupTimeFrom, setPickupTimeFrom] = useState<Date | null>(null);
  const [pickupTimeTo, setPickupTimeTo] = useState<Date | null>(null);
  const [dateInput, setDateInput] = useState('');
  const [timeFromInput, setTimeFromInput] = useState('');
  const [ampmFrom, setAmpmFrom] = useState<'AM' | 'PM'>('AM');
  const [timeToInput, setTimeToInput] = useState('');
  const [ampmTo, setAmpmTo] = useState<'AM' | 'PM'>('PM');

  // DELIVERY States
  const [deliveryDate, setDeliveryDate] = useState<Date | null>(null);
  const [deliveryTimeFrom, setDeliveryTimeFrom] = useState<Date | null>(null);
  const [deliveryTimeTo, setDeliveryTimeTo] = useState<Date | null>(null);
  const [deliveryDateInput, setDeliveryDateInput] = useState('');
  const [deliveryTimeFromInput, setDeliveryTimeFromInput] = useState('');
  const [deliveryAmpmFrom, setDeliveryAmpmFrom] = useState<'AM' | 'PM'>('AM');
  const [deliveryTimeToInput, setDeliveryTimeToInput] = useState('');
  const [deliveryAmpmTo, setDeliveryAmpmTo] = useState<'AM' | 'PM'>('PM');

  const onRefresh = () => {
    setRefreshing(true);
    setPickupAddress('');
    setPickupDate(null);
    setPickupTimeFrom(null);
    setPickupTimeTo(null);
    setDateInput('');
    setTimeFromInput('');
    setTimeToInput('');
    setAmpmFrom('AM');
    setAmpmTo('PM');

    setDeliveryDate(null);
    setDeliveryTimeFrom(null);
    setDeliveryTimeTo(null);
    setDeliveryDateInput('');
    setDeliveryTimeFromInput('');
    setDeliveryTimeToInput('');
    setDeliveryAmpmFrom('AM');
    setDeliveryAmpmTo('PM');
    setTimeout(() => setRefreshing(false), 500);
  };

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

  const [showIOSDate, setShowIOSDate] = useState(false);
  const [showIOSDateFrom, setShowIOSDateFrom] = useState(false);
  const [showIOSDateTo, setShowIOSDateTo] = useState(false);

  const GREEN = '#00592d';

  const getToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const getTomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); return d; };

  // Parse "MM/DD/YYYY" → Date
  const parseDateInput = (text: string): Date | null => {
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const m = parseInt(match[1]) - 1;
    const d = parseInt(match[2]);
    const y = parseInt(match[3]);
    const date = new Date(y, m, d);
    if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) return null;
    return date;
  };

  // Parse "H:MM" + AM/PM → Date
  const parseTimeText = (text: string, ampm: 'AM' | 'PM'): Date | null => {
    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    let h = parseInt(match[1]);
    const min = parseInt(match[2]);
    if (h < 1 || h > 12 || min < 0 || min > 59) return null;
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const date = new Date();
    date.setHours(h, min, 0, 0);
    return date;
  };

  // Auto-format date as user types (inserts slashes)
  const handleDateInputChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    let formatted = '';
    if (digits.length <= 2) formatted = digits;
    else if (digits.length <= 4) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    else formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
    
    if (scheduleType === 'pickup') {
      setDateInput(formatted);
      setPickupDate(parseDateInput(formatted));
    } else {
      setDeliveryDateInput(formatted);
      setDeliveryDate(parseDateInput(formatted));
    }
  };

  const formatTimeDigits = (text: string): string => {
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length <= 1) return digits;
    if (digits.length === 2) {
      const firstVal = parseInt(digits[0], 10);
      if (firstVal >= 2) {
        return digits[0] + ':' + digits[1];
      }
      return digits;
    }
    if (digits.length === 3) {
      const firstVal = parseInt(digits[0], 10);
      if (firstVal >= 2) {
        return digits[0] + ':' + digits.slice(1, 3);
      }
      return digits.slice(0, 1) + ':' + digits.slice(1, 3);
    }
    return digits.slice(0, 2) + ':' + digits.slice(2, 4);
  };

  // Auto-format time as user types (inserts colon, supports 1-digit hours like 3:15)
  const handleTimeFromChange = (text: string) => {
    const formatted = formatTimeDigits(text);
    
    if (scheduleType === 'pickup') {
      setTimeFromInput(formatted);
      setPickupTimeFrom(parseTimeText(formatted, ampmFrom));
    } else {
      setDeliveryTimeFromInput(formatted);
      setDeliveryTimeFrom(parseTimeText(formatted, deliveryAmpmFrom));
    }
  };

  const handleTimeToChange = (text: string) => {
    const formatted = formatTimeDigits(text);
    
    if (scheduleType === 'pickup') {
      setTimeToInput(formatted);
      setPickupTimeTo(parseTimeText(formatted, ampmTo));
    } else {
      setDeliveryTimeToInput(formatted);
      setDeliveryTimeTo(parseTimeText(formatted, deliveryAmpmTo));
    }
  };

  const toggleAmpmFrom = () => {
    if (scheduleType === 'pickup') {
      const next = ampmFrom === 'AM' ? 'PM' : 'AM';
      setAmpmFrom(next);
      if (timeFromInput.match(/^\d{1,2}:\d{2}$/)) setPickupTimeFrom(parseTimeText(timeFromInput, next));
    } else {
      const next = deliveryAmpmFrom === 'AM' ? 'PM' : 'AM';
      setDeliveryAmpmFrom(next);
      if (deliveryTimeFromInput.match(/^\d{1,2}:\d{2}$/)) setDeliveryTimeFrom(parseTimeText(deliveryTimeFromInput, next));
    }
  };

  const toggleAmpmTo = () => {
    if (scheduleType === 'pickup') {
      const next = ampmTo === 'AM' ? 'PM' : 'AM';
      setAmpmTo(next);
      if (timeToInput.match(/^\d{1,2}:\d{2}$/)) setPickupTimeTo(parseTimeText(timeToInput, next));
    } else {
      const next = deliveryAmpmTo === 'AM' ? 'PM' : 'AM';
      setDeliveryAmpmTo(next);
      if (deliveryTimeToInput.match(/^\d{1,2}:\d{2}$/)) setDeliveryTimeTo(parseTimeText(deliveryTimeToInput, next));
    }
  };

  const openAndroidDate = () => {
    const isPickup = scheduleType === 'pickup';
    const currentDateValue = isPickup ? pickupDate : deliveryDate;
    DateTimePickerAndroid.open({
      value: currentDateValue || getToday(),
      mode: 'date',
      // @ts-ignore accentColor exists at runtime but missing from older type definitions
      accentColor: GREEN,
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          const today = getToday();
          const selectedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          if (selectedDay < today) {
            Alert.alert('Invalid Date', 'Date cannot be in the past.');
            return;
          }
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          const y = date.getFullYear();
          if (isPickup) {
            setPickupDate(date);
            setDateInput(`${m}/${d}/${y}`);
          } else {
            setDeliveryDate(date);
            setDeliveryDateInput(`${m}/${d}/${y}`);
          }
        }
      },
    });
  };

  const openAndroidTimeFrom = () => {
    const isPickup = scheduleType === 'pickup';
    const currentTimeFrom = isPickup ? pickupTimeFrom : deliveryTimeFrom;
    const d = currentTimeFrom ? new Date(currentTimeFrom) : new Date();
    if (!currentTimeFrom) d.setHours(7, 0, 0, 0);
    DateTimePickerAndroid.open({
      value: d,
      mode: 'time',
      is24Hour: false,
      // @ts-ignore accentColor exists at runtime but missing from older type definitions
      accentColor: GREEN,
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          let h = date.getHours();
          const min = date.getMinutes();
          const ap: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
          h = h % 12 || 12;
          const formatted = `${h}:${String(min).padStart(2, '0')}`;
          if (isPickup) {
            setPickupTimeFrom(date);
            setTimeFromInput(formatted);
            setAmpmFrom(ap);
          } else {
            setDeliveryTimeFrom(date);
            setDeliveryTimeFromInput(formatted);
            setDeliveryAmpmFrom(ap);
          }
        }
      },
    });
  };

  const openAndroidTimeTo = () => {
    const isPickup = scheduleType === 'pickup';
    const currentTimeTo = isPickup ? pickupTimeTo : deliveryTimeTo;
    const d = currentTimeTo ? new Date(currentTimeTo) : new Date();
    if (!currentTimeTo) d.setHours(9, 0, 0, 0);
    DateTimePickerAndroid.open({
      value: d,
      mode: 'time',
      is24Hour: false,
      // @ts-ignore accentColor exists at runtime but missing from older type definitions
      accentColor: GREEN,
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          let h = date.getHours();
          const min = date.getMinutes();
          const ap: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
          h = h % 12 || 12;
          const formatted = `${h}:${String(min).padStart(2, '0')}`;
          if (isPickup) {
            setPickupTimeTo(date);
            setTimeToInput(formatted);
            setAmpmTo(ap);
          } else {
            setDeliveryTimeTo(date);
            setDeliveryTimeToInput(formatted);
            setDeliveryAmpmTo(ap);
          }
        }
      },
    });
  };

  const [tempPickupDate, setTempPickupDate] = useState(() => getToday());
  const [tempPickupTimeFrom, setTempPickupTimeFrom] = useState(() => {
    const d = new Date(); d.setHours(7, 0, 0, 0); return d;
  });
  const [tempPickupTimeTo, setTempPickupTimeTo] = useState(() => {
    const d = new Date(); d.setHours(9, 0, 0, 0); return d;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const mapRef = useRef<MapView>(null);
  const isProgrammaticMove = useRef(false);
  const isMapDragged = useRef(false);

  const { foodItems } = route.params || { foodItems: [] };

  const geocodeAddress = async (address: string) => {
    if (!address.trim()) return;
    setIsGeocoding(true);
    try {
      let results: any[] = [];
      try {
        results = await Location.geocodeAsync(address);
      } catch (nativeErr) {
        console.log('Native geocoding failed, trying Nominatim fallback:', nativeErr);
      }

      if (!results || results.length === 0) {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=ph`,
          { headers: { 'User-Agent': 'SavrMobileApp' } }
        );
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          results = [{
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon),
          }];
        }
      }

      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        const newRegion = { latitude, longitude, latitudeDelta: 0.0422, longitudeDelta: 0.0221 };
        isProgrammaticMove.current = true;
        setLocation(newRegion);
        mapRef.current?.animateToRegion(newRegion, 800);
      } else {
        Alert.alert('Address Not Found', 'Could not locate that address. Try adding more detail (city, country).');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      Alert.alert('Error', 'Failed to locate the address. Check your connection and try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    setIsReverseGeocoding(true);
    try {
      let place = null;
      try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (results && results.length > 0) {
          place = results[0];
        }
      } catch (nativeErr) {
        console.log('Native reverse geocoding failed, trying Nominatim fallback:', nativeErr);
      }

      if (!place) {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          { headers: { 'User-Agent': 'SavrMobileApp' } }
        );
        const data = await response.json();
        if (data && data.address) {
          const addr = data.address;
          place = {
            streetNumber: addr.house_number || '',
            street: addr.road || addr.suburb || '',
            district: addr.suburb || addr.neighbourhood || addr.quarter || '',
            city: addr.city || addr.town || addr.municipality || '',
            subregion: addr.county || '',
            region: addr.state || '',
            country: addr.country || '',
            postalCode: addr.postcode || '',
          };
        }
      }

      if (place) {
        const parts = [place.streetNumber, place.street, place.district, place.city, place.region, place.country]
          .filter(Boolean);
        setPickupAddress(parts.join(', '));
      }
    } catch (err) {
      console.error('Reverse geocoding error:', err);
    } finally {
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

        let place = null;
        try {
          const results = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (results && results.length > 0) {
            place = results[0];
          }
        } catch (nativeErr) {
          console.log('Native reverse geocoding on mount failed, trying Nominatim fallback:', nativeErr);
        }

        if (!place) {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
              { headers: { 'User-Agent': 'SavrMobileApp' } }
            );
            const data = await response.json();
            if (data && data.address) {
              const addr = data.address;
              place = {
                streetNumber: addr.house_number || '',
                street: addr.road || addr.suburb || '',
                district: addr.suburb || addr.neighbourhood || addr.quarter || '',
                city: addr.city || addr.town || addr.municipality || '',
                subregion: addr.county || '',
                region: addr.state || '',
                country: addr.country || '',
                postalCode: addr.postcode || '',
              };
            }
          } catch {}
        }

        if (place) {
          const parts = [place.streetNumber, place.street, place.city, place.region, place.country]
            .filter(Boolean);
          setPickupAddress(parts.join(', '));
        }
      } catch (e) { }
    })();
  }, []);

  const handleSubmit = async () => {
    const isPickup = scheduleType === 'pickup';
    const targetDate = isPickup ? pickupDate : deliveryDate;
    const targetTimeFrom = isPickup ? pickupTimeFrom : deliveryTimeFrom;
    const targetTimeTo = isPickup ? pickupTimeTo : deliveryTimeTo;

    if (!targetDate) {
      Alert.alert('Error', 'Please select a preferred date.');
      return;
    }

    if (isPickup) {
      const today = getToday();
      if (targetDate < today) {
        Alert.alert('Invalid Date', 'Please select today or a future date.');
        return;
      }
    } else {
      const tomorrow = getTomorrow();
      if (targetDate < tomorrow) {
        Alert.alert('Invalid Date', 'Please select a date starting from tomorrow onwards.');
        return;
      }
    }

    if (!targetTimeFrom || !targetTimeTo) {
      Alert.alert('Error', 'Please select both start and end times for the slot.');
      return;
    }

    const fromHours = targetTimeFrom.getHours();
    const fromMinutes = targetTimeFrom.getMinutes();
    const toHours = targetTimeTo.getHours();
    const toMinutes = targetTimeTo.getMinutes();

    if (isPickup) {
      if (fromHours < 7 || fromHours > 21 || (fromHours === 21 && fromMinutes > 0)) {
        Alert.alert('Invalid Time', 'Please select a start time between 7:00 AM and 9:00 PM.');
        return;
      }
      if (toHours < 7 || toHours > 21 || (toHours === 21 && toMinutes > 0)) {
        Alert.alert('Invalid Time', 'Please select an end time between 7:00 AM and 9:00 PM.');
        return;
      }
    } else {
      if (fromHours < 7 || fromHours > 17 || (fromHours === 17 && fromMinutes > 0)) {
        Alert.alert('Invalid Time', 'Please select a start time between 7:00 AM and 5:00 PM.');
        return;
      }
      if (toHours < 7 || toHours > 17 || (toHours === 17 && toMinutes > 0)) {
        Alert.alert('Invalid Time', 'Please select an end time between 7:00 AM and 5:00 PM.');
        return;
      }
    }

    if (targetTimeFrom >= targetTimeTo) {
      Alert.alert('Invalid Time Slot', 'End time must be after the start time.');
      return;
    }

    const now = new Date();
    const isToday =
      targetDate.getFullYear() === now.getFullYear() &&
      targetDate.getMonth() === now.getMonth() &&
      targetDate.getDate() === now.getDate();
    if (isToday) {
      const startDateTime = new Date(targetDate);
      startDateTime.setHours(fromHours, fromMinutes, 0, 0);
      if (startDateTime <= now) {
        Alert.alert('Invalid Time', 'The selected start time has already passed. Please choose a future time.');
        return;
      }
    }

    if (isPickup && !pickupAddress.trim()) {
      Alert.alert('Error', 'Please enter a pickup address.');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('schedule_type', scheduleType);

      if (isPickup) {
        formData.append('pickup_latitude', location.latitude.toString());
        formData.append('pickup_longitude', location.longitude.toString());
        formData.append('pickup_address', pickupAddress.trim() || `${location.latitude}, ${location.longitude}`);
      } else {
        formData.append('pickup_latitude', '14.5332');
        formData.append('pickup_longitude', '121.0189');
        formData.append('pickup_address', 'Room 300, DHI Building, No. 2 Lapu Lapu Avenue, Magallanes, Makati City 1232 , Metro Manila, Philippines');
      }

      const finalDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      const fromStr = targetTimeFrom.toTimeString().split(' ')[0].substring(0, 5);
      const toStr = targetTimeTo.toTimeString().split(' ')[0].substring(0, 5);
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

      foodItems.forEach((item: any) => {
        if (item.photoUri) {
          let filename = item.photoUri.split('/').pop() || `food_photo.jpg`;
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          if (!match) filename = `${filename}.jpg`;
          // @ts-ignore
          formData.append('food_images', { uri: item.photoUri, name: filename, type });
        }
      });

      const response = await ApiService.submitFoodDonation(formData);
      if (response.data.success) {
        const donatedItemsStr = foodItems.map((fi: any) => `${fi.quantity} of ${fi.type}`).join(', ');
        if (isPickup) {
          Alert.alert(
            'Pickup Scheduled!',
            `You have scheduled a pickup for ${donatedItemsStr}. We will be in touch to confirm your pickup schedule. Thank you for your contribution!`,
            [{ 
              text: 'OK', 
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'ChooseDonation' }],
                });
              }
            }]
          );
        } else {
          Alert.alert(
            'Delivery Scheduled!',
            `You have scheduled to deliver ${donatedItemsStr}. Please deliver to our warehouse at Room 300, DHI Building, No. 2 Lapu Lapu Avenue, Magallanes, Makati City 1232 during your selected slot. Thank you for your contribution!`,
            [{ 
              text: 'OK', 
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'ChooseDonation' }],
                });
              }
            }]
          );
        }
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00592d"
            colors={['#00592d']}
          />
        }
      >
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
          <Text style={styles.inputLabel}>{scheduleType === 'pickup' ? 'Pickup Address' : 'Drop-off Address'}<Text style={{ color: '#E4B63F' }}> *</Text></Text>

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
            onPanDrag={() => {
              if (scheduleType === 'pickup') isMapDragged.current = true;
            }}
            onRegionChangeComplete={(reg, details) => {
              if (scheduleType === 'pickup') {
                setLocation(reg);
                const wasDragged = details?.isGesture || isMapDragged.current;
                if (isProgrammaticMove.current) {
                  isProgrammaticMove.current = false;
                  isMapDragged.current = false;
                } else if (wasDragged) {
                  isMapDragged.current = false;
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
            <Text style={styles.inputLabel}>Preferred Date<Text style={{ color: '#E4B63F' }}> *</Text></Text>
            <View style={styles.pickerInputWrapper}>
              <TextInput
                style={styles.pickerTextInput}
                placeholder="MM/DD/YYYY"
                placeholderTextColor="rgba(0,89,45,0.45)"
                value={scheduleType === 'pickup' ? dateInput : deliveryDateInput}
                onChangeText={handleDateInputChange}
                keyboardType="numeric"
                maxLength={10}
              />
              <TouchableOpacity
                style={styles.pickerIconBtn}
                onPress={() => {
                  const isPickup = scheduleType === 'pickup';
                  const currentVal = isPickup ? pickupDate : deliveryDate;
                  if (Platform.OS === 'ios') {
                    setTempPickupDate(currentVal || getToday());
                    setShowIOSDate(true);
                  } else {
                    openAndroidDate();
                  }
                }}
              >
                <Ionicons name="calendar-outline" size={20} color="#8CA697" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.inputLabel}>Time Slot<Text style={{ color: '#E4B63F' }}> *</Text></Text>
            <View style={styles.timeSlotRow}>
              <View style={styles.halfInput}>
                <Text style={styles.timeLabel}>From</Text>
                <View style={styles.pickerInputWrapper}>
                  <TextInput
                    style={[styles.pickerTextInput, { flex: 1 }]}
                    placeholder="--:--"
                    placeholderTextColor="rgba(0,89,45,0.45)"
                    value={scheduleType === 'pickup' ? timeFromInput : deliveryTimeFromInput}
                    onChangeText={handleTimeFromChange}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                  <TouchableOpacity style={styles.ampmBtn} onPress={toggleAmpmFrom}>
                    <Text style={styles.ampmText}>{scheduleType === 'pickup' ? ampmFrom : deliveryAmpmFrom}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pickerIconBtn}
                    onPress={() => {
                      const isPickup = scheduleType === 'pickup';
                      const currentVal = isPickup ? pickupTimeFrom : deliveryTimeFrom;
                      if (Platform.OS === 'ios') {
                        const d = currentVal ? new Date(currentVal) : new Date();
                        if (!currentVal) d.setHours(7, 0, 0, 0);
                        setTempPickupTimeFrom(d);
                        setShowIOSDateFrom(true);
                      } else {
                        openAndroidTimeFrom();
                      }
                    }}
                  >
                    <Ionicons name="time-outline" size={20} color="#8CA697" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.halfInput}>
                <Text style={styles.timeLabel}>To</Text>
                <View style={styles.pickerInputWrapper}>
                  <TextInput
                    style={[styles.pickerTextInput, { flex: 1 }]}
                    placeholder="--:--"
                    placeholderTextColor="rgba(0,89,45,0.45)"
                    value={scheduleType === 'pickup' ? timeToInput : deliveryTimeToInput}
                    onChangeText={handleTimeToChange}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                  <TouchableOpacity style={styles.ampmBtn} onPress={toggleAmpmTo}>
                    <Text style={styles.ampmText}>{scheduleType === 'pickup' ? ampmTo : deliveryAmpmTo}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pickerIconBtn}
                    onPress={() => {
                      const isPickup = scheduleType === 'pickup';
                      const currentVal = isPickup ? pickupTimeTo : deliveryTimeTo;
                      if (Platform.OS === 'ios') {
                        const d = currentVal ? new Date(currentVal) : new Date();
                        if (!currentVal) d.setHours(9, 0, 0, 0);
                        setTempPickupTimeTo(d);
                        setShowIOSDateTo(true);
                      } else {
                        openAndroidTimeTo();
                      }
                    }}
                  >
                    <Ionicons name="time-outline" size={20} color="#8CA697" />
                  </TouchableOpacity>
                </View>
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
                <TouchableOpacity onPress={() => {
                  const m = String(tempPickupDate.getMonth() + 1).padStart(2, '0');
                  const d = String(tempPickupDate.getDate()).padStart(2, '0');
                  const y = tempPickupDate.getFullYear();
                  if (scheduleType === 'pickup') {
                    setPickupDate(tempPickupDate);
                    setDateInput(`${m}/${d}/${y}`);
                  } else {
                    setDeliveryDate(tempPickupDate);
                    setDeliveryDateInput(`${m}/${d}/${y}`);
                  }
                  setShowIOSDate(false);
                }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempPickupDate}
                mode="date"
                display="spinner"
                minimumDate={scheduleType === 'pickup' ? getToday() : getTomorrow()}
                onChange={(_, d) => { if (d) setTempPickupDate(d); }}
                style={{ width: 320, alignSelf: 'center' }}
                textColor="#1a1a1a"
              />
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
                <TouchableOpacity onPress={() => {
                  let h = tempPickupTimeFrom.getHours();
                  const min = tempPickupTimeFrom.getMinutes();
                  const ap: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
                  h = h % 12 || 12;
                  const formatted = `${h}:${String(min).padStart(2, '0')}`;
                  if (scheduleType === 'pickup') {
                    setPickupTimeFrom(tempPickupTimeFrom);
                    setTimeFromInput(formatted);
                    setAmpmFrom(ap);
                  } else {
                    setDeliveryTimeFrom(tempPickupTimeFrom);
                    setDeliveryTimeFromInput(formatted);
                    setDeliveryAmpmFrom(ap);
                  }
                  setShowIOSDateFrom(false);
                }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
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
                <TouchableOpacity onPress={() => {
                  let h = tempPickupTimeTo.getHours();
                  const min = tempPickupTimeTo.getMinutes();
                  const ap: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
                  h = h % 12 || 12;
                  const formatted = `${h}:${String(min).padStart(2, '0')}`;
                  if (scheduleType === 'pickup') {
                    setPickupTimeTo(tempPickupTimeTo);
                    setTimeToInput(formatted);
                    setAmpmTo(ap);
                  } else {
                    setDeliveryTimeTo(tempPickupTimeTo);
                    setDeliveryTimeToInput(formatted);
                    setDeliveryAmpmTo(ap);
                  }
                  setShowIOSDateTo(false);
                }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
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

        {/* Extra bottom spacing for Android navigation bar overlap prevention */}
        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    paddingBottom: 130,
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
    marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : 20,
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
    paddingVertical: 0,
  },
  pickerIconBtn: {
    padding: 5,
  },
  ampmBtn: {
    backgroundColor: '#00592d',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ampmText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
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
