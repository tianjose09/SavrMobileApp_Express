import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ImageBackground,
  Animated,
  AppState,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StorageUtils, StorageKeys, getProfilePicKey } from '../../utils/storage';
import { ApiService } from '../../services/api';
import { BADGE_IMAGES } from '../../utils/badges';
import NotificationBell from '../../components/NotificationBell';

export default function DonorDashboard({ navigation }: any) {
  const [userName, setUserName] = useState('Juan Dela Cruz');
  const [splitName, setSplitName] = useState('Juan');
  const [initial, setInitial] = useState('J');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [donationAmount, setDonationAmount] = useState(0);
  const [totalFoodDonations, setTotalFoodDonations] = useState(0);
  const [totalFinancialCount, setTotalFinancialCount] = useState(0);
  const [totalServiceDonations, setTotalServiceDonations] = useState(0);
  const [featuredBadges, setFeaturedBadges] = useState<any[]>([]);
  const [nextBadge, setNextBadge] = useState<any>(null);
  const [nextFoodBadge, setNextFoodBadge] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ongoingDrives, setOngoingDrives] = useState<any[]>([]);
  const hasAnimated = useRef(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const sheetFadeAnim = useRef(new Animated.Value(0)).current;
  const sheetTranslateAnim = useRef(new Animated.Value(24)).current;

  const titleFadeAnim = useRef(new Animated.Value(0)).current;
  const titleTranslateAnim = useRef(new Animated.Value(18)).current;

  const totalCardFadeAnim = useRef(new Animated.Value(0)).current;
  const totalCardTranslateAnim = useRef(new Animated.Value(22)).current;

  const statsFadeAnim = useRef(new Animated.Value(0)).current;
  const statsTranslateAnim = useRef(new Animated.Value(22)).current;

  const drivesFadeAnim = useRef(new Animated.Value(0)).current;
  const drivesTranslateAnim = useRef(new Animated.Value(22)).current;

  const badgesFadeAnim = useRef(new Animated.Value(0)).current;
  const badgesTranslateAnim = useRef(new Animated.Value(22)).current;


  const runEntryAnimations = () => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    Animated.parallel([
      Animated.timing(sheetFadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(sheetTranslateAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();

    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(titleFadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(titleTranslateAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(totalCardFadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(totalCardTranslateAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(statsFadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(statsTranslateAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(drivesFadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(drivesTranslateAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(badgesFadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(badgesTranslateAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]),

    ]).start();
  };

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      fetchDashboardData();
    });

    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') fetchDashboardData();
    });

    fetchDashboardData();

    return () => {
      unsubscribeFocus();
      appStateSubscription.remove();
    };
  }, [navigation]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const localName =
        (await StorageUtils.getItem(StorageKeys.DISPLAY_NAME)) || 'Juan Dela Cruz';
      const picKey = await getProfilePicKey();
      const localPic = await StorageUtils.getItem(picKey);
      if (localPic) setProfilePic(localPic);

      setUserName(localName);
      setSplitName(localName.split(' ')[0]);
      setInitial(localName.charAt(0).toUpperCase());

      const dashRes = await ApiService.getDashboard();

      if (dashRes?.data?.success) {
        const data = dashRes.data;

        if (data.display_name) {
          setUserName(data.display_name);
          setSplitName(data.display_name.split(' ')[0]);
          setInitial(data.display_name.charAt(0).toUpperCase());
          StorageUtils.setItem(StorageKeys.DISPLAY_NAME, data.display_name);
        }

        setDonationAmount(data.total_donations || 0);
        setTotalFoodDonations(data.total_food || 0);
        setTotalFinancialCount(data.total_financial_count || 0);
        setTotalServiceDonations(data.total_service || 0);
      }

      const badgesRes = await ApiService.getBadges();
      if (badgesRes?.data?.success) {
        // Use only truly earned badges for the featured section
        const earnedBadges = badgesRes.data.earned || [];
        setFeaturedBadges(earnedBadges.slice(0, 3));
        // Next badge = first in_progress, else first not_started
        const next = (badgesRes.data.in_progress || [])[0]
          || (badgesRes.data.all || []).find((b: any) => b.status === 'not_started');
        setNextBadge(next || null);
        // Food-specific badge for the progress bar (never replaced by financial/service)
        const allBadges = badgesRes.data.all || [];
        const inProgress = badgesRes.data.in_progress || [];
        const nextFood = inProgress.find((b: any) => b.goal_type === 'food_count')
          || allBadges.find((b: any) => b.goal_type === 'food_count' && b.status !== 'earned');
        setNextFoodBadge(nextFood || null);
      }

      try {
        const critRes = await ApiService.getCriticalNotifications();
        setUnreadCount(critRes?.data?.notifications?.length || 0);
      } catch { }

      try {
        const drivesRes = await ApiService.getActiveDrives();
        if (drivesRes?.data?.success) {
          setOngoingDrives(drivesRes.data.active_drives || []);
        }
      } catch (err) {
        console.log('Failed to fetch active drives', err);
      }
    } catch (error) {
      console.error('Dashboard load failed', error);
    } finally {
      setIsLoading(false);
      runEntryAnimations();
    }
  };

  // Total donations made = food + financial count + service (all categories)
  const totalDonationsMade = totalFoodDonations + totalFinancialCount + totalServiceDonations;

  // Progress bar is always food-donation focused
  const nextBadgeGoal = nextFoodBadge ? parseFloat(nextFoodBadge.goal_value) || 0 : 0;
  const nextBadgeAmount = nextFoodBadge ? parseFloat(nextFoodBadge.progress) || 0 : 0;
  const nextBadgeName = nextFoodBadge?.name || '';
  const progressPct = nextBadgeGoal > 0
    ? Math.max(0, Math.min((nextBadgeAmount / nextBadgeGoal) * 100, 100))
    : 100;


  const handleSupportDrive = (drive: any) => {
    const type = (drive.type || 'Food').toLowerCase();
    if (type === 'financial') {
      navigation.navigate('Donate', {
        screen: 'FinancialDonation',
        params: { driveId: drive.id, driveName: drive.request_name }
      });
    } else if (type === 'service') {
      navigation.navigate('Donate', {
        screen: 'ServiceDonation',
        params: { driveId: drive.id, driveName: drive.request_name }
      });
    } else {
      navigation.navigate('Donate', {
        screen: 'FoodDonationDetails',
        params: { driveId: drive.id, driveName: drive.request_name, driveItems: drive.food_items || [] }
      });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F3F3', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00592d" />
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#00592d' }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF', position: 'relative' }}>
        <View style={styles.container}>
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
                onPress={() => navigation.openDrawer?.()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="menu-outline" size={32} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* PROFILE HEADER SECTION */}
            <View style={styles.profileHeader}>
              <View style={styles.profileRow}>
                <TouchableOpacity
                  style={styles.avatarCircle}
                  onPress={() => navigation.navigate?.('Profile')}
                >
                  {profilePic ? (
                    <Image source={{ uri: profilePic }} style={{ width: '100%', height: '100%', borderRadius: 50 }} />
                  ) : (
                    <Text style={{ fontSize: 26, fontWeight: '800', color: '#00592d' }}>{initial}</Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.profileName} numberOfLines={1}>
                  {userName}
                </Text>
              </View>
            </View>

            <Animated.View
              style={[
                styles.whiteSheet,
                {
                  opacity: sheetFadeAnim,
                  transform: [{ translateY: sheetTranslateAnim }],
                },
              ]}
            >
              <Animated.View
                style={{
                  opacity: titleFadeAnim,
                  transform: [{ translateY: titleTranslateAnim }],
                }}
              >
                <Text style={styles.dashboardTitle}>Good Day, {splitName}!</Text>

                <Text style={styles.subtitle}>
                  Here’s your donor dashboard — keep making an impact!
                </Text>
              </Animated.View>

              <Animated.View
                style={{
                  opacity: totalCardFadeAnim,
                  transform: [{ translateY: totalCardTranslateAnim }],
                }}
              >
                <View style={styles.totalCard}>
                  <View style={styles.totalTitleRow}>
                    <FontAwesome5
                      name="hand-holding-heart"
                      size={18}
                      color="#1E583A"
                    />
                    <Text style={styles.totalTitle}> Total Donations Made</Text>
                  </View>

                  <Text style={styles.totalAmount}>
                    {totalDonationsMade.toLocaleString('en-US')}
                  </Text>

                  {/* Progress bar: flex-based for reliable RN rendering */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { flex: progressPct }]} />
                    <View style={{ flex: 100 - progressPct }} />
                  </View>

                  <View style={styles.progressLabels}>
                    <Text style={styles.currentLabel} numberOfLines={1}>
                      {nextBadgeAmount} donations
                    </Text>
                    <Text style={styles.goalLabel} numberOfLines={1} adjustsFontSizeToFit>
                      {nextFoodBadge ? `${nextBadgeGoal} donations · ${nextBadgeName}` : 'All food badges earned!'}
                    </Text>
                  </View>
                </View>
              </Animated.View>

              <Animated.View
                style={{
                  opacity: statsFadeAnim,
                  transform: [{ translateY: statsTranslateAnim }],
                }}
              >
                <View style={styles.statsRow}>
                  {/* Financial Card */}
                  <View style={styles.glassCard}>
                    <View style={styles.glassCardBg}>
                      <LinearGradient
                        colors={['rgba(255, 255, 255, 0.15)', 'rgba(0, 0, 0, 0.05)']}
                        style={styles.glassCardGloss}
                      />
                      <View style={styles.glassIconCol}>
                        <Image
                          source={require('../../assets/images/icons/financialicon.png')}
                          style={styles.glassIconImage}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={styles.glassTextCol}>
                        <Text style={styles.orangeValue} numberOfLines={1} adjustsFontSizeToFit>₱ {donationAmount.toLocaleString('en-US')}</Text>
                        <Text style={styles.orangeLabel}>TOTAL FINANCIAL</Text>
                        <Text style={styles.orangeLabel}>DONATION</Text>
                      </View>
                    </View>
                  </View>

                  {/* Food Card */}
                  <View style={styles.glassCard}>
                    <View style={styles.glassCardBg}>
                      <LinearGradient
                        colors={['rgba(255, 255, 255, 0.15)', 'rgba(0, 0, 0, 0.05)']}
                        style={styles.glassCardGloss}
                      />
                      <View style={styles.glassIconCol}>
                        <Image
                          source={require('../../assets/images/icons/foodicon.png')}
                          style={styles.glassIconImage}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={styles.glassTextCol}>
                        <Text style={styles.orangeValue} numberOfLines={1} adjustsFontSizeToFit>{totalFoodDonations}</Text>
                        <Text style={styles.orangeLabel}>TOTAL FOOD</Text>
                        <Text style={styles.orangeLabel}>DONATION</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Animated.View>



              {featuredBadges && featuredBadges.length > 0 && (
                <Animated.View
                  style={{
                    opacity: badgesFadeAnim,
                    transform: [{ translateY: badgesTranslateAnim }],
                  }}
                >
                  <View style={styles.badgesSection}>
                    <View style={styles.badgesHeader}>
                      <Text style={styles.badgesTitle}>Achievement Badges</Text>

                      <TouchableOpacity
                        style={styles.viewAllButton}
                        onPress={() => navigation.navigate?.('Badges')}
                      >
                        <Text style={styles.viewAllText}>View All</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.badgesRow}>
                      {featuredBadges.map((badge, idx) => (
                        <View style={styles.badgeCard} key={badge.id || idx}>
                          <Image
                            source={BADGE_IMAGES[badge.icon]}
                            style={styles.badgeImage}
                            resizeMode="contain"
                          />
                          <Text style={styles.badgeName}>{badge.name}</Text>
                          <Text style={styles.badgeDesc}>{badge.description}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </Animated.View>
              )}

              <Animated.View
                style={{
                  opacity: drivesFadeAnim,
                  transform: [{ translateY: drivesTranslateAnim }],
                  marginTop: 32,
                  paddingBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <FontAwesome5 name="sync-alt" size={12} color="#00592d" />
                  <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '800', color: '#00592d', letterSpacing: 0.5 }}>ONGOING FOOD DRIVES</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.drivesScroll}>
                  {ongoingDrives.map((drive, idx) => {
                    const isFinancial = drive.type === 'Financial';
                    // Alternating solid colors: flat yellow first (even indices), flat orange second (odd indices)
                    const gradientColors: [string, string] = idx % 2 === 0 
                      ? ['#E29C20', '#E29C20'] // Flat golden yellow
                      : ['#D87A38', '#D87A38']; // Flat terracotta orange (matches top cards)
                    return (
                      <View style={styles.driveCard} key={drive.id || idx}>
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
                              <Text style={styles.driveName} numberOfLines={2}>{drive.request_name}</Text>
                              <View style={styles.driveTopRow}>
                                <View style={styles.driveStatusWrap}>
                                  <Text style={styles.driveStatus}>{drive.type || 'Food'}</Text>
                                </View>
                                <View style={[styles.driveUrgencyWrap, { backgroundColor: drive.urgency === 'High' ? '#D0112B' : (drive.urgency === 'Medium' ? '#B45309' : '#00592d') }]}>
                                  <Text style={styles.driveUrgency}>{drive.urgency} Urgency</Text>
                                </View>
                              </View>
                              {drive.start_date && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                  <FontAwesome5 name="calendar-alt" size={10} color="rgba(255,255,255,0.7)" />
                                  <Text style={[styles.driveDate, { marginBottom: 0, marginLeft: 6 }]}>
                                    {new Date(drive.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} 
                                    {drive.end_date ? ` - ${new Date(drive.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                                  </Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.driveItemsBox}>
                              {isFinancial ? (
                                <View style={styles.financialBox}>
                                  <Text style={[styles.driveItemsLabel, { marginBottom: 4, opacity: 1 }]}>AMOUNT NEEDED</Text>
                                  <Text style={[styles.driveItemText, { fontSize: 20, fontWeight: '800' }]}>P {Number(drive.amount || 0).toLocaleString()}</Text>
                                </View>
                              ) : (
                                <>
                                  <Text style={styles.driveItemsLabel}>REQUESTED ITEMS</Text>
                                  {drive.food_items?.slice(0, 2).map((item: any, i: number) => (
                                    <View key={i} style={styles.driveItemRow}>
                                      <Text style={styles.driveItemName} numberOfLines={1}>{item.food_name || item.name}</Text>
                                      <Text style={styles.driveItemQty}>{item.qty || item.quantity} {item.unit}</Text>
                                    </View>
                                  ))}
                                  {drive.food_items && drive.food_items.length > 2 && (
                                    <View style={styles.driveItemRow}>
                                      <Text style={styles.driveItemName}>+ {drive.food_items.length - 2} more items</Text>
                                    </View>
                                  )}
                                </>
                              )}
                            </View>

                            <TouchableOpacity style={styles.driveBtn} onPress={() => handleSupportDrive(drive)}>
                              <Text style={styles.driveBtnText}>Support This Drive</Text>
                              <FontAwesome5 name="chevron-right" size={9} color="#FFFFFF" style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                          </View>
                        </LinearGradient>
                      </View>
                    );
                  })}
                  {ongoingDrives.length === 0 && (
                    <View style={styles.driveEmpty}>
                      <Text style={styles.driveEmptyText}>No active drives at the moment.</Text>
                    </View>
                  )}
                </ScrollView>
              </Animated.View>


            </Animated.View>
          </ScrollView>
        </View>

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00592d',
  },

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
  },

  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#F0E2A3',
  },

  profileName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    flexShrink: 1,
  },

  whiteSheet: {
    flex: 1,
    backgroundColor: '#F3F3F3',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 40,
  },

  scrollContent: {
    flexGrow: 1,
  },

  dashboardTitle: {
    textAlign: 'center',
    color: '#08532F',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
  },

  dashboardName: {
    textAlign: 'center',
    color: '#08532F',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.3,
  },

  subtitle: {
    textAlign: 'center',
    color: '#424242',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 25,
    paddingHorizontal: 15,
  },

  subtitleBold: {
    fontWeight: '800',
    color: '#222222',
  },

  totalCard: {
    backgroundColor: '#F7F7F7',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 24,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  totalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  totalTitle: {
    color: '#0D5B33',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },

  totalAmount: {
    textAlign: 'center',
    color: '#15412A',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 22,
  },

  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E0E0E0',
    width: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 10,
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#D1AC22',
  },

  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 4,
  },

  currentLabel: {
    flex: 1,
    color: '#00592d',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'left',
  },

  goalLabel: {
    flex: 2,
    color: '#8D8D8D',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
  },

  glassCard: {
    width: '48.5%',
    height: 110,
    borderRadius: 18,
    backgroundColor: '#D87A38',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },

  glassCardBg: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    position: 'relative',
  },

  glassCardGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  glassIconCol: {
    width: '38%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  glassIconImage: {
    width: 54,
    height: 54,
  },

  glassTextCol: {
    width: '62%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  orangeValue: {
    color: '#DFB43F',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    textAlign: 'center',
  },

  orangeLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
    textAlign: 'center',
  },

  badgesSection: {
    backgroundColor: '#FAFAFA',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  badgesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  badgesTitle: {
    color: '#5B4A35',
    fontSize: 18,
    fontWeight: '800',
  },

  viewAllButton: {
    backgroundColor: '#00592d',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },

  viewAllText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
  },

  badgeCard: {
    flex: 1,
    maxWidth: '32%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E1D7',
  },

  badgeImage: {
    width: 92,
    height: 92,
    marginBottom: 8,
  },

  badgeName: {
    color: '#5B4A35',
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },

  badgeDesc: {
    color: '#8A8A8A',
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
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
    // Premium shadows
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },

  driveCardGradient: {
    borderRadius: 16,
  },

  watermarkContainer: {
    position: 'absolute',
    right: -15,
    bottom: -15,
  },

  driveCardContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
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

  financialBox: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
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

  driveItemText: {
    color: '#FFFFFF',
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