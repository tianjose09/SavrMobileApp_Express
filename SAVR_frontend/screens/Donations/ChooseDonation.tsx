import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
  ActivityIndicator, StatusBar, Image, Animated, Easing,
  Alert, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ApiService } from '../../services/api';

export default function ChooseDonation({ navigation }: any) {
  const [pickups, setPickups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPickup, setEditingPickup] = useState<any>(null);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editTime, setEditTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(7, 0, 0, 0); return d;
  });
  const [editAddress, setEditAddress] = useState('');
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time' | null>(null);
  const [showIOSDate, setShowIOSDate] = useState(false);
  const [showIOSTime, setShowIOSTime] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchPickups = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getUpcomingPickups();
      if (response.data.success) {
        const sorted = (response.data.pickups || []).sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setPickups(sorted);
      }
    } catch (e) {
      console.error('Failed to fetch pickups', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchPickups);
    fetchPickups();
    return unsubscribe;
  }, [navigation]);

  const openEditModal = (pickup: any) => {
    setEditingPickup(pickup);
    if (pickup.preferred_date) {
      const [y, m, d] = pickup.preferred_date.split('-').map(Number);
      setEditDate(new Date(y, m - 1, d));
    } else {
      setEditDate(new Date());
    }
    const timeStr = (pickup.time_slot || '07:00').split(' ')[0].substring(0, 5);
    const [hh, mm] = timeStr.split(':').map(Number);
    const t = new Date(); t.setHours(hh || 7, mm || 0, 0, 0);
    setEditTime(t);
    setEditAddress(pickup.pickup_address || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPickup) return;
    setIsSaving(true);
    try {
      const preferredDate = editDate.toISOString().split('T')[0];
      const timeSlot = editTime.toTimeString().split(' ')[0].substring(0, 5);
      await ApiService.updatePickup(editingPickup.id, {
        preferred_date: preferredDate,
        time_slot: timeSlot,
        pickup_address: editAddress,
        schedule_type: editingPickup.status,
      });
      setEditModalVisible(false);
      fetchPickups();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update pickup.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePickup = (pickup: any) => {
    Alert.alert(
      'Delete Pickup',
      'Are you sure you want to delete this pickup? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deletePickup(pickup.id);
              setPickups(prev => prev.filter(p => p.id !== pickup.id));
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message || 'Failed to delete pickup.');
            }
          },
        },
      ]
    );
  };

  const displayedPickups = pickups.slice(0, 3);
  const hasMore = pickups.length > 3;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <StatusBar barStyle="light-content" backgroundColor="#00592d" translucent={false} />

      {/* HERO */}
      <View style={styles.heroBackground}>
        <View style={styles.topNav}>
          <Image source={require('../../assets/images/logo/logowhite.png')} style={styles.logoImage} resizeMode="contain" />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={{ position: 'relative' }}
              onPress={() => navigation.navigate('Notifications')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="notifications-outline" size={26} color="#FFF" style={{ marginRight: 15 }} />
              <View style={styles.badgeDot}>
                <Text style={styles.badgeText}>!</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.openDrawer?.()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="menu" size={34} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: '#FFF', opacity: 0.3, width: '100%', marginTop: 8 }} />
        <View style={styles.heroContent}>
          <Text style={styles.heroTitleMain}>
            CHOOSE WHAT TO <Text style={styles.heroTitleHighlight}>DONATE</Text>
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionOverline}>DONATION OPTIONS</Text>
            <Text style={styles.sectionTitle}>Ways to Contribute</Text>
          </View>
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>3 Categories</Text>
          </View>
        </View>

        {/* Donation Cards */}
        <View style={styles.cardsRow}>
          <TouchableOpacity activeOpacity={0.6} onPress={() => navigation.navigate('FinancialDonation')} style={styles.imageCardBtn}>
            <Image source={require('../../assets/images/cards/choosedonation_financial.png')} style={styles.cardImage} resizeMode="stretch" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.6} onPress={() => navigation.navigate('FoodDonationDetails')} style={styles.imageCardBtn}>
            <Image source={require('../../assets/images/cards/choosedonation_food.png')} style={styles.cardImage} resizeMode="stretch" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.6} onPress={() => navigation.navigate('ServiceDonation')} style={styles.imageCardBtn}>
            <Image source={require('../../assets/images/cards/choosedonation_service.png')} style={styles.cardImage} resizeMode="stretch" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Upcoming Pickups */}
        <View style={styles.pickupsHeaderInfoRow}>
          <Text style={styles.pickupsTitle}>Upcoming Pickups</Text>
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => navigation.navigate('AllUpcomingPickups')}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#00592d" style={{ marginVertical: 20 }} />
        ) : displayedPickups.length === 0 ? (
          <Text style={styles.noPickupsText}>You have no upcoming pickups scheduled.</Text>
        ) : (
          displayedPickups.map(item => (
            <View key={item.id} style={styles.pickupRow}>
              <View style={styles.pickupLeft}>
                <Text style={styles.pickupDateTime}>
                  {item.preferred_date || 'TBD'} | {item.time_slot || 'Anytime'}
                </Text>
                <Text style={styles.pickupAddress} numberOfLines={1}>
                  Address: {item.pickup_address || 'TBD'}
                </Text>
              </View>
              <View style={styles.pickupRight}>
                <TouchableOpacity onPress={() => openEditModal(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.editText}>edit</Text>
                </TouchableOpacity>
                <Text style={styles.pickupSep}>/</Text>
                <TouchableOpacity onPress={() => handleDeletePickup(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.deleteText}>delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Pickup</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#444" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Preferred Date</Text>
            <TouchableOpacity
              style={styles.modalInput}
              onPress={() => Platform.OS === 'ios' ? setShowIOSDate(true) : setDatePickerMode('date')}
            >
              <Text style={styles.modalInputText}>{editDate.toLocaleDateString()}</Text>
              <Ionicons name="calendar-outline" size={18} color="#00592d" />
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Time Slot</Text>
            <TouchableOpacity
              style={styles.modalInput}
              onPress={() => Platform.OS === 'ios' ? setShowIOSTime(true) : setDatePickerMode('time')}
            >
              <Text style={styles.modalInputText}>
                {editTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Ionicons name="time-outline" size={18} color="#00592d" />
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Pickup Address</Text>
            <TextInput
              style={styles.modalTextInput}
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder="Enter pickup address"
              placeholderTextColor="#B0B0B0"
              multiline
            />

            <TouchableOpacity
              style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
              onPress={handleSaveEdit}
              disabled={isSaving}
            >
              {isSaving
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.saveBtnText}>Save Changes</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* Android pickers */}
        {Platform.OS === 'android' && datePickerMode && (
          <DateTimePicker
            value={datePickerMode === 'date' ? editDate : editTime}
            mode={datePickerMode}
            minimumDate={datePickerMode === 'date' ? new Date() : undefined}
            display="default"
            onChange={(event, selectedDate) => {
              const mode = datePickerMode;
              setDatePickerMode(null);
              if (event.type === 'set' && selectedDate) {
                if (mode === 'date') setEditDate(selectedDate);
                else setEditTime(selectedDate);
              }
            }}
          />
        )}

        {/* iOS Date nested modal */}
        <Modal visible={showIOSDate} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowIOSDate(false)}><Text style={{ color: '#888', fontSize: 15 }}>Cancel</Text></TouchableOpacity>
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowIOSDate(false)}><Text style={{ color: '#00592d', fontSize: 15, fontWeight: '700' }}>Done</Text></TouchableOpacity>
              </View>
              <DateTimePicker value={editDate} mode="date" display="spinner" minimumDate={new Date()} onChange={(_, d) => { if (d) setEditDate(d); }} style={{ width: '100%' }} textColor="#1a1a1a" />
            </View>
          </View>
        </Modal>

        {/* iOS Time nested modal */}
        <Modal visible={showIOSTime} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowIOSTime(false)}><Text style={{ color: '#888', fontSize: 15 }}>Cancel</Text></TouchableOpacity>
                <Text style={styles.modalTitle}>Select Time</Text>
                <TouchableOpacity onPress={() => setShowIOSTime(false)}><Text style={{ color: '#00592d', fontSize: 15, fontWeight: '700' }}>Done</Text></TouchableOpacity>
              </View>
              <DateTimePicker value={editTime} mode="time" display="spinner" onChange={(_, d) => { if (d) setEditTime(d); }} style={{ width: '100%' }} textColor="#1a1a1a" />
            </View>
          </View>
        </Modal>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },

  badgeDot: {
    position: 'absolute',
    top: -3,
    right: 11,
    backgroundColor: '#E74C3C',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00592d',
  },
  badgeText: { color: '#FFF', fontSize: 8, fontWeight: 'bold' },

  heroBackground: {
    backgroundColor: '#00592d',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: Platform.OS === 'ios' ? 45 : 35,
    paddingBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 5,
    marginTop: 15,
  },
  logoImage: { width: 170, height: 58 },
  heroContent: { paddingHorizontal: 25, marginTop: 35, marginBottom: 25, alignItems: 'center' },
  heroTitleMain: { fontSize: 25, fontWeight: '800', color: '#FFF', letterSpacing: -0.5, textAlign: 'center' },
  heroTitleHighlight: { color: '#FACC15' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 25 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  sectionOverline: { color: '#00592d', fontWeight: '800', fontSize: 13, letterSpacing: 0.5, marginBottom: 2 },
  sectionTitle: { fontSize: 26, fontWeight: '800', color: '#B57448', letterSpacing: -1 },
  badgePill: { backgroundColor: '#F0F6F3', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  badgePillText: { color: '#666', fontWeight: 'bold', fontSize: 12 },

  cardsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  imageCardBtn: { width: '31%', aspectRatio: 0.62 },
  cardImage: { width: '105%', height: '80%', borderRadius: 16 },

  divider: { height: 1, backgroundColor: '#E0E0E0', marginTop: 10, marginBottom: 20 },

  pickupsHeaderInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  pickupsTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  viewAllBtn: { backgroundColor: '#CA8846', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20 },
  viewAllText: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  noPickupsText: { color: '#888', fontStyle: 'italic', fontSize: 13 },

  pickupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 20,
    marginBottom: 10,
    backgroundColor: '#FFF',
  },
  pickupLeft: { flex: 1, paddingRight: 10 },
  pickupDateTime: { fontSize: 12, fontWeight: '800', color: '#222', marginBottom: 4 },
  pickupAddress: { fontSize: 10, color: '#666' },
  pickupRight: { flexDirection: 'row', alignItems: 'center' },
  editText: { fontSize: 11, color: '#00592d', fontWeight: '700' },
  pickupSep: { fontSize: 11, color: '#CCC', marginHorizontal: 4 },
  deleteText: { fontSize: 11, color: '#D17C31', fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 36,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1A2E23' },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 6, marginTop: 12 },
  modalInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: '#FAFAFA',
  },
  modalInputText: { fontSize: 14, color: '#333', flex: 1 },
  modalTextInput: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    minHeight: 72,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA',
  },
  saveBtn: { backgroundColor: '#00592d', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
