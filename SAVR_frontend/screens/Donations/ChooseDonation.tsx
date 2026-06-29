import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, StatusBar, Image, Animated, Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import NotificationBell from '../../components/NotificationBell';

const formatTimeSlotTo12Hour = (timeSlotStr: string | null | undefined): string => {
  if (!timeSlotStr) return 'Anytime';
  if (timeSlotStr.toUpperCase().includes('AM') || timeSlotStr.toUpperCase().includes('PM')) {
    return timeSlotStr;
  }
  const convertSingleTime = (timeStr: string) => {
    const trimmed = timeStr.trim();
    if (!trimmed) return '';
    const parts = trimmed.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1] || '0', 10);
    if (isNaN(hours)) return trimmed;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${strMinutes} ${ampm}`;
  };
  if (timeSlotStr.includes(' - ')) {
    const parts = timeSlotStr.split(' - ');
    const start = convertSingleTime(parts[0]);
    const end = convertSingleTime(parts[1]);
    return start && end ? `${start} - ${end}` : start || end || timeSlotStr;
  }
  return convertSingleTime(timeSlotStr);
};

export default function ChooseDonation({ navigation }: any) {
  const [pickups, setPickups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      console.warn('Failed to fetch pickups', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchPickups);
    fetchPickups();
    return unsubscribe;
  }, [navigation]);

  const displayedPickups = pickups.slice(0, 3);
  const hasMore = pickups.length > 3;

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#00592d' }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <StatusBar barStyle="light-content" backgroundColor="#00592d" translucent={false} />

          {/* TOP BAR HEADER */}
          <View style={styles.topHeader}>
            <Image source={require('../../assets/images/logo/logowhite.png')} style={styles.logoImage} resizeMode="contain" />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <NotificationBell navigation={navigation} color="#FFF" size={26} style={{ marginRight: 5 }} />
              <TouchableOpacity onPress={() => navigation.openDrawer?.()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="menu-outline" size={32} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* HERO */}
          <View style={styles.heroBackground}>
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
                  <Text style={styles.pickupDateTime}>
                    {item.preferred_date || 'TBD'} | {formatTimeSlotTo12Hour(item.time_slot)}
                  </Text>
                  <Text style={styles.pickupAddress} numberOfLines={1}>
                    Address: {item.pickup_address || 'TBD'}
                  </Text>
                </View>
              ))
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },

  topHeader: {
    backgroundColor: '#00592d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : 22,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
  },
  logoImage: { width: 170, height: 58, marginBottom: 6 },

  heroBackground: {
    backgroundColor: '#00592d',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: 20,
    paddingBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  heroContent: { paddingHorizontal: 25, marginTop: 15, marginBottom: 15, alignItems: 'center' },
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
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 20,
    marginBottom: 10,
    backgroundColor: '#FFF',
  },
  pickupDateTime: { fontSize: 12, fontWeight: '800', color: '#222', marginBottom: 4 },
  pickupAddress: { fontSize: 10, color: '#666' },
});
