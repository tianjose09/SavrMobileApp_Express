import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, StatusBar, Image, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';

export default function ChooseDonation({ navigation }: any) {
  const [pickups, setPickups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Trigger animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const fetchPickups = async () => {
      try {
        const response = await ApiService.getUpcomingPickups();
        if (response.data.success) {
          setPickups(response.data.pickups || []);
        }
      } catch (e) {
        console.error("Failed to fetch pickups", e);
      } finally {
        setLoading(false);
      }
    };

    // Refresh whenever screen focuses
    const unsubscribe = navigation.addListener('focus', () => {
      fetchPickups();
    });
    fetchPickups();

    return unsubscribe;
  }, [navigation]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <StatusBar barStyle="light-content" backgroundColor="#00592d" translucent={false} />
      {/* 
        HERO SECTION WITH CURVED BOTTOM
      */}
      <View style={styles.heroBackground}>
        {/* Top Navbar */}
        <View style={styles.topNav}>
          <Image source={require('../../assets/images/logo/logowhite.png')} style={styles.logoImage} resizeMode="contain" />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="notifications-outline" size={26} color="#FFF" style={{ marginRight: 15 }} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.openDrawer?.()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="menu" size={34} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: '#FFF', opacity: 0.3, width: '100%', alignSelf: 'center', marginTop: 8 }} />

        {/* Hero Content */}
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
            <Text style={styles.badgeText}>3 Categories</Text>
          </View>
        </View>

        {/* Donation Images Row */}
        <View style={styles.cardsRow}>
          {/* Financial */}
          <TouchableOpacity activeOpacity={0.6} onPress={() => navigation.navigate('FinancialDonation')} style={styles.imageCardBtn}>
            <Image source={require('../../assets/images/cards/choosedonation_financial.png')} style={styles.cardImage} resizeMode="stretch" />
          </TouchableOpacity>

          {/* Food */}
          <TouchableOpacity activeOpacity={0.6} onPress={() => navigation.navigate('FoodDonationDetails')} style={styles.imageCardBtn}>
            <Image source={require('../../assets/images/cards/choosedonation_food.png')} style={styles.cardImage} resizeMode="stretch" />
          </TouchableOpacity>

          {/* Service */}
          <TouchableOpacity activeOpacity={0.6} onPress={() => navigation.navigate('ServiceDonation')} style={styles.imageCardBtn}>
            <Image source={require('../../assets/images/cards/choosedonation_service.png')} style={styles.cardImage} resizeMode="stretch" />
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Upcoming Pickups */}
        <View style={styles.pickupsHeaderInfoRow}>
          <Text style={styles.pickupsTitle}>Upcoming Pickups</Text>
          <TouchableOpacity style={styles.viewAllBtn}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#00592d" style={{ marginVertical: 20 }} />
        ) : pickups.length === 0 ? (
          <Text style={styles.noPickupsText}>You have no upcoming pickups scheduled.</Text>
        ) : (
          pickups.map(item => (
            <View key={item.id} style={styles.pickupRow}>
              <View style={styles.pickupLeft}>
                <Text style={styles.pickupDateTime}>
                  {item.preferred_date || 'TBD'} | {item.time_slot || 'Anytime'}
                </Text>
                <Text style={styles.pickupAddress} numberOfLines={1}>
                  Address: {item.pickup_address || 'TBD'} | Contact: Pending
                </Text>
              </View>
              <View style={styles.pickupRight}>
                <TouchableOpacity>
                  <Text style={styles.editText}>edit</Text>
                </TouchableOpacity>
                <Text style={styles.pickupSep}>/</Text>
                <TouchableOpacity>
                  <Text style={styles.deleteText}>delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },

  heroBackground: {
    backgroundColor: '#00592d',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: Platform.OS === 'ios' ? 45 : 35,
    paddingBottom: 15,
    // Add shadow
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
  backButton: {
    padding: 5,
  },
  logoRow: { alignItems: 'center' },
  logoImage: { width: 170, height: 58 },

  heroContent: { paddingHorizontal: 25, marginTop: 35, marginBottom: 25, alignItems: 'center' },
  heroTitleMain: { fontSize: 25, fontWeight: '800', color: '#FFF', letterSpacing: -0.5, textAlign: 'center' },
  heroTitleHighlight: { color: '#FACC15' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 25 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  sectionOverline: { color: '#00592d', fontWeight: '800', fontSize: 13, letterSpacing: 0.5, marginBottom: 2 },
  sectionTitle: { fontSize: 26, fontWeight: '800', color: '#B57448', letterSpacing: -1 },
  badgePill: { backgroundColor: '#F0F6F3', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  badgeText: { color: '#666', fontWeight: 'bold', fontSize: 12 },

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
    backgroundColor: '#FFF'
  },
  pickupLeft: { flex: 1, paddingRight: 10 },
  pickupDateTime: { fontSize: 12, fontWeight: '800', color: '#222', marginBottom: 4 },
  pickupAddress: { fontSize: 10, color: '#666' },

  pickupRight: { flexDirection: 'row', alignItems: 'center' },
  editText: { fontSize: 11, color: '#888', fontWeight: '600' },
  pickupSep: { fontSize: 11, color: '#CCC', marginHorizontal: 4 },
  deleteText: { fontSize: 11, color: '#888', fontWeight: '600' }
});
