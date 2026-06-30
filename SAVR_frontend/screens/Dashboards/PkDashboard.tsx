import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageUtils, StorageKeys, getProfilePicKey } from '../../utils/storage';
import { ApiService } from '../../services/api';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NotificationBell from '../../components/NotificationBell';

export default function PkDashboard({ navigation }: any) {
  const insets = useSafeAreaInsets();
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
  const [staffRequests, setStaffRequests] = useState<any[]>([]);
  const bannerShownRef = React.useRef(false);
  const slideAnim = React.useRef(new Animated.Value(-150)).current;

  // Scroll tracking for parallax slide-up animation (matching Landing Page)
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const staffRequestsScrollTranslateY = scrollY.interpolate({
    inputRange: [0, 250],
    outputRange: [0, -20],
    extrapolate: 'clamp'
  });

  const activitiesScrollTranslateY = scrollY.interpolate({
    inputRange: [0, 250],
    outputRange: [0, -20],
    extrapolate: 'clamp'
  });

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

  const handleCookMeal = (mealName: string, qty: number, mealRequestId: number) => {
    navigation.navigate('Ingredients', {
      screen: 'IngrMealPlanning',
      params: {
        targetPax: qty,
        mealName: mealName,
        mealRequestId,
      }
    });
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

    // Fetch Staff Meal Requests from dedicated endpoint
    try {
      const reqRes = await ApiService.getMealRequests();
      const payload = reqRes.data;
      const list = Array.isArray(payload)
        ? payload
        : (payload?.data || payload?.requests || payload?.meal_requests || []);
      setStaffRequests(list);
    } catch (err: any) {
      console.log('[MealRequests] fetch failed:', err?.response?.status, err?.response?.data || err?.message);
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
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={{ height: insets.top, backgroundColor: '#00592d' }} />

      {/* Slide-in notification banner */}
      <Animated.View style={[styles.notificationBanner, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.notificationContent}>
          <Ionicons name="notifications" size={24} color="#00592d" />
          <Text style={styles.notificationText}>{notificationMsg}</Text>
          <Text style={styles.notificationTime}>Now</Text>
        </View>
      </Animated.View>

      <View style={[styles.container, { flex: 1 }]}>
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

        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          style={{ backgroundColor: '#F9FAFB' }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >

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
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: '#E8A835', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Good Day,</Text>
                <Text style={[styles.userName, { marginLeft: 0 }]} numberOfLines={1}>{userName}</Text>
              </View>
            </View>
          </View>

          {/* WHITE BODY SECTION */}
          <View style={styles.whiteBody}>
            <Text style={styles.mainTitle}>Kitchen Dashboard</Text>
            <Text style={styles.subTitle}>
              Here's your kitchen dashboard — keep making an impact!
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
                colors={['#008f51', '#00592d']}
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
                colors={['#008f51', '#00592d']}
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

            {/* STAFF MEAL REQUESTS */}
            <Animated.View
              style={{
                marginTop: 25,
                paddingBottom: 15,
                paddingHorizontal: 4,
                transform: [{ translateY: staffRequestsScrollTranslateY }]
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <FontAwesome5 name="sync-alt" size={12} color="#00592d" />
                <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '800', color: '#00592d', letterSpacing: 0.5 }}>STAFF MEAL REQUESTS</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.drivesScroll}>
                {staffRequests.map((reqItem, idx) => {
                  const gradientColors: [string, string] = idx % 2 === 0
                    ? ['#E29C20', '#E29C20']
                    : ['#D87A38', '#D87A38'];

                  const mealItems: any[] = Array.isArray(reqItem.items) ? reqItem.items : [];
                  const mainMeal = mealItems[0] || { food_name: 'Meal', quantity: 0, unit: 'servings' };

                  return (
                    <View style={styles.driveCard} key={reqItem.id || idx}>
                      <LinearGradient
                        colors={gradientColors}
                        style={styles.driveCardGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <LinearGradient
                          colors={['rgba(255, 255, 255, 0.15)', 'rgba(0, 0, 0, 0.05)']}
                          style={StyleSheet.absoluteFillObject}
                        />

                        <View style={styles.driveCardContent}>
                          <View>
                            <Text style={styles.driveName} numberOfLines={2}>{reqItem.drive_title}</Text>
                            <View style={styles.driveTopRow}>
                              <View style={styles.driveStatusWrap}>
                                <Text style={styles.driveStatus}>Meal Prep</Text>
                              </View>
                              <View style={[styles.driveUrgencyWrap, { backgroundColor: reqItem.urgency?.toLowerCase() === 'high' ? '#D0112B' : (reqItem.urgency?.toLowerCase() === 'medium' ? '#B45309' : '#00592d') }]}>
                                <Text style={styles.driveUrgency}>{reqItem.urgency ? reqItem.urgency.charAt(0).toUpperCase() + reqItem.urgency.slice(1).toLowerCase() : ''} Urgency</Text>
                              </View>
                            </View>
                            {reqItem.start_date && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <FontAwesome5 name="calendar-alt" size={10} color="rgba(255,255,255,0.7)" />
                                <Text style={[styles.driveDate, { marginBottom: 0, marginLeft: 6 }]}>
                                  {new Date(reqItem.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  {reqItem.end_date ? ` - ${new Date(reqItem.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                                </Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.driveItemsBox}>
                            <Text style={styles.driveItemsLabel}>MEALS TO PREPARE</Text>
                            {mealItems.slice(0, 2).map((item: any, i: number) => (
                              <View key={i} style={styles.driveItemRow}>
                                <Text style={styles.driveItemName} numberOfLines={1}>{item.food_name}</Text>
                                <Text style={styles.driveItemQty}>{Math.round(item.quantity)} {item.unit}</Text>
                              </View>
                            ))}
                            {mealItems.length > 2 && (
                              <View style={styles.driveItemRow}>
                                <Text style={styles.driveItemName}>+ {mealItems.length - 2} more items</Text>
                              </View>
                            )}
                          </View>

                          <TouchableOpacity
                            style={styles.driveBtn}
                            onPress={() => handleCookMeal(mainMeal.food_name, Math.round(parseFloat(mainMeal.quantity)) || 0, reqItem.id)}
                          >
                            <Text style={styles.driveBtnText}>Cook This Meal</Text>
                            <FontAwesome5 name="chevron-right" size={9} color="#FFFFFF" style={{ marginLeft: 6 }} />
                          </TouchableOpacity>
                        </View>
                      </LinearGradient>
                    </View>
                  );
                })}
                {staffRequests.length === 0 && (
                  <View style={styles.driveEmpty}>
                    <Text style={styles.driveEmptyText}>No active meal requests at the moment.</Text>
                  </View>
                )}
              </ScrollView>
            </Animated.View>

            <View style={styles.divider} />

            <Animated.View style={{ transform: [{ translateY: activitiesScrollTranslateY }] }}>
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
                  activities.slice(0, 2).map((act, i) => (
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
            </Animated.View>

            <View style={{ height: 60 }} />
          </View>
        </Animated.ScrollView>
      </View>
    </View>
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
    paddingBottom: 75,
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
    marginBottom: 15,
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
  },
  drivesScroll: {
    paddingRight: 16,
  },
  driveCard: {
    width: 270,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  driveCardGradient: {
    borderRadius: 16,
  },
  driveCardContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 130,
    height: 270,
    justifyContent: 'space-between',
  },
  driveTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  driveStatusWrap: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  driveStatus: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  driveUrgencyWrap: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  driveUrgency: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  driveName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  driveDate: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '600',
  },
  driveItemsBox: {
    marginBottom: 12,
  },
  driveItemsLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 6,
  },
  driveItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 4,
  },
  driveItemName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  driveItemQty: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  driveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingVertical: 8,
    marginTop: 4,
  },
  driveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  driveEmpty: {
    paddingVertical: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: 260,
  },
  driveEmptyText: {
    color: '#8A8A8A',
    fontSize: 12,
    fontStyle: 'italic',
  },
});
