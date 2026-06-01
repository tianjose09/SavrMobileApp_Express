import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, StatusBar, Image, Alert, Animated } from 'react-native';
import { StorageUtils, StorageKeys, getProfilePicKey } from '../../utils/storage';
import { ApiService } from '../../services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NotificationBell from '../../components/NotificationBell';

export default function PkDashboard({ navigation }: any) {
  const [userName, setUserName] = useState('Loaves and Fishes');
  const [initial, setInitial] = useState('L');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [mealsServed, setMealsServed] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const bannerShownRef = React.useRef(false);
  const slideAnim = React.useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDashboardData();
    });
    fetchDashboardData();
    return unsubscribe;
  }, [navigation]);

  const showNotification = (msg: string) => {
    setNotificationMsg(msg);
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 400,
        useNativeDriver: true,
      })
    ]).start(() => setNotificationMsg(null));
  };

  const handleNotifications = () => {
    navigation.navigate('Notifications', { role: 'pk' });
  };

  const fetchDashboardData = async () => {
    const localName = await StorageUtils.getItem(StorageKeys.DISPLAY_NAME) || 'Loaves and Fishes';
    const picKey = await getProfilePicKey();
    const localPic = await StorageUtils.getItem(picKey);
    if (localPic) setProfilePic(localPic);

    setUserName(localName);
    setInitial(localName.charAt(0).toUpperCase());

    // 1. Fetch Dashboard Stats (Isolated Catch)
    try {
      const dashRes = await ApiService.getDashboard();
      if (dashRes.data && dashRes.data.success) {
        const data = dashRes.data;
        if (data.display_name) {
          setUserName(data.display_name);
          setInitial(data.display_name.charAt(0).toUpperCase());
          StorageUtils.setItem(StorageKeys.DISPLAY_NAME, data.display_name);
        }
        setMealsServed(data.total_meals_served || 0);
        setActivities(data.recent_activities || []);
      }

      try {
        const critRes = await ApiService.getCriticalNotifications();
        setUnreadCount(critRes?.data?.notifications?.length || 0);
      } catch { }
    } catch (e) {
      console.log('Backend dashboard API pending');
    }

    // 2. Fetch Live Inventory specifically for metrics calculations identically to the FoodInventory logic!
    try {
      let items = [];
      try {
        const invRes = await ApiService.getInventory();
        if (invRes.data && invRes.data.success) {
          items = invRes.data.items || [];
        } else {
          throw new Error('API not available yet');
        }
      } catch (err) {
        items = [];
      }

      setInventoryCount(items.length);

      // Extract raw numbers safely across all syntax formats "48 kg" etc
      const lowStock = items.filter((i: any) => {
        const qtyVal = parseFloat(i.quantity || i.qty);
        return !isNaN(qtyVal) && qtyVal <= 10;
      });
      setLowStockCount(lowStock.length);

      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);

      const expiring = items.filter((i: any) => {
        const expDate = i.expiry_date || i.expiry;
        if (!expDate) return false;
        const exp = new Date(expDate);
        return exp >= now && exp <= nextWeek;
      });
      setExpiringCount(expiring.length);

      if (!bannerShownRef.current) {
        if (lowStock.length > 0) {
          bannerShownRef.current = true;
          setTimeout(() => showNotification(`${lowStock.length} item(s) are low on stock.`), 800);
        } else if (expiring.length > 0) {
          bannerShownRef.current = true;
          setTimeout(() => showNotification(`${expiring.length} item(s) are expiring soon.`), 800);
        }
      }

    } catch (e) {
      console.log('Failed to parse inventory stats', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#00592d' }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#00592d', position: 'relative' }}>
        {/* Slide-in notification banner */}
        <Animated.View style={[styles.notificationBanner, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.notificationContent}>
            <Ionicons name="notifications" size={24} color="#00592d" />
            <Text style={styles.notificationText}>{notificationMsg}</Text>
            <Text style={styles.notificationTime}>Now</Text>
          </View>
        </Animated.View>

        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#236B40" translucent={false} />

          {/* TOP BAR HEADER */}
          <View style={styles.topHeader}>
            <Image
              source={require('../../assets/images/logo/logowhite.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <NotificationBell navigation={navigation} color="#FFFFFF" size={26} style={{ marginRight: 5 }} />
              <TouchableOpacity
                onPress={() => navigation.openDrawer()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="menu-outline" size={32} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} bounces={false}>

            {/* PROFILE HEADER SECTION */}
            <View style={styles.profileHeader}>
              <View style={styles.profileRow}>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatarCircle}>
                  {profilePic ? (
                    <Image source={{ uri: profilePic }} style={{ width: '100%', height: '100%', borderRadius: 30 }} />
                  ) : (
                    <Text style={styles.avatarText}>{initial || 'P'}</Text>
                  )}
                </TouchableOpacity>
                <Text style={styles.userName}>{userName}</Text>
              </View>
            </View>

            {/* WHITE BODY SECTION */}
            <View style={styles.whiteBody}>
              <Text style={styles.mainTitle}>Kitchen Dashboard</Text>
              <Text style={styles.subTitle}>
                Welcome back, <Text style={{ fontWeight: '800', color: '#111' }}>{userName}</Text>! Here's your activity{"\n"}overview
              </Text>

              {/* 4 CARDS GRID */}
              <View style={styles.gridContainer}>
                {/* Card 1 */}
                <LinearGradient
                  colors={['#F9D038', '#D39C16']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.card}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.15)', 'rgba(0, 0, 0, 0.05)']}
                    style={styles.glassCardGloss}
                  />
                  <View style={styles.cardIconWrap}>
                    <MaterialCommunityIcons name="package-variant-closed" size={48} color="#FFF" />
                  </View>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardValue}>{inventoryCount}</Text>
                    <Text style={styles.cardLabel}>Inventory Items</Text>
                  </View>
                </LinearGradient>

                {/* Card 2 */}
                <LinearGradient
                  colors={['#F9D038', '#D39C16']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.card}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.15)', 'rgba(0, 0, 0, 0.05)']}
                    style={styles.glassCardGloss}
                  />
                  <View style={styles.cardIconWrap}>
                    <Ionicons name="restaurant" size={46} color="#FFF" />
                  </View>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardValue}>{mealsServed}</Text>
                    <Text style={styles.cardLabel}>Meals Served</Text>
                  </View>
                </LinearGradient>

                {/* Card 3 */}
                <LinearGradient
                  colors={['#00592d', '#003d1f']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.card}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.15)', 'rgba(0, 0, 0, 0.05)']}
                    style={styles.glassCardGloss}
                  />
                  <View style={styles.cardIconWrap}>
                    <Ionicons name="warning-outline" size={54} color="#FFF" />
                  </View>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardValue}>{lowStockCount}</Text>
                    <Text style={styles.cardLabel}>Low Stock</Text>
                  </View>
                </LinearGradient>

                {/* Card 4 */}
                <LinearGradient
                  colors={['#00592d', '#003d1f']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.card}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.15)', 'rgba(0, 0, 0, 0.05)']}
                    style={styles.glassCardGloss}
                  />
                  <View style={styles.cardIconWrap}>
                    <Ionicons name="hourglass-outline" size={44} color="#FFF" />
                  </View>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardValue}>{expiringCount}</Text>
                    <Text style={styles.cardLabel}>Expiring Soon</Text>
                  </View>
                </LinearGradient>
              </View>

              <View style={styles.divider} />

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Activities</Text>
                <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('PartnerKitchenRecentActivities')}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>

              {/* Activities List */}
              <View style={styles.activitiesContainer}>
                {isLoading && activities.length === 0 ? (
                  <ActivityIndicator style={{ padding: 20 }} color="#236B40" />
                ) : activities.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <Text style={{ fontSize: 14, color: '#888', fontWeight: '600' }}>No recent activities yet.</Text>
                  </View>
                ) : (
                  activities.slice(0, 3).map((act, i) => (
                    <View key={i} style={styles.activityRow}>
                      <View style={styles.activityLeft}>
                        <Text style={styles.actTitle}>{act.title}</Text>
                        <Text style={styles.actDesc}>{act.description}</Text>
                      </View>
                      <Text style={styles.actTime}>{act.time_ago}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={{ height: 120 }} />
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#00592d' },
  scrollContent: { flexGrow: 1 },

  notificationBanner: {
    position: 'absolute',
    top: 10,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 24,
    padding: 18,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationText: {
    color: '#00592d',
    fontSize: 14.5,
    fontWeight: '700',
    marginLeft: 14,
    flex: 1,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  notificationTime: {
    color: '#8A9A8A',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 8,
    alignSelf: 'flex-start',
    marginTop: 2,
  },

  topHeader: {
    backgroundColor: '#00592d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
  },
  logoImage: {
    width: 170,
    height: 58,
    marginBottom: 6,
  },
  profileHeader: {
    backgroundColor: '#00592d',
    paddingHorizontal: 22,
    paddingTop: 5,
    paddingBottom: 25,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#F0E2A3',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    color: '#236B40',
    fontSize: 28,
    fontWeight: '900'
  },
  userName: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 14,
    maxWidth: '75%',
    letterSpacing: -0.5,
  },

  whiteBody: {
    backgroundColor: '#F9FAFB',
    flex: 1,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingTop: 35,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  mainTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#00592d',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subTitle: {
    fontSize: 16,
    color: '#444',
    textAlign: 'center',
    marginBottom: 35,
    lineHeight: 22,
  },

  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    height: 110,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
    overflow: 'hidden',
  },
  cardIconWrap: {
    width: '45%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 2,
    includeFontPadding: false,
  },
  cardLabel: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },

  divider: {
    height: 1,
    backgroundColor: '#CCCCCC',
    marginTop: 6,
    marginBottom: 4,
    marginHorizontal: 15,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
  },
  viewAllBtn: {
    backgroundColor: '#D67D3E',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  viewAllText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  activitiesContainer: {
    paddingHorizontal: 5,
  },
  activityRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#AAAAAA',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityLeft: {
    flex: 1,
    paddingRight: 10,
  },
  actTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
    marginBottom: 4,
  },
  actDesc: {
    fontSize: 11,
    color: '#555',
  },
  actTime: {
    fontSize: 11,
    color: '#888',
  },
  bottomBar: {
    position: 'absolute',
    bottom: -10,
    width: '100%',
    height: 120,
    backgroundColor: '#1F5A37',
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 25,
    paddingHorizontal: 15,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconGhostWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  navItemInnerBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#1E583A',
  },
  navLabelLine: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  navItemActive: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeNavIconBg: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassCardGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  }
});
