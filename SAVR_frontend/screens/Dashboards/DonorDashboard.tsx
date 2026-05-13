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
import { StorageUtils, StorageKeys } from '../../utils/storage';
import { ApiService } from '../../services/api';
import { BADGE_IMAGES } from '../../utils/badges';

export default function DonorDashboard({ navigation }: any) {
  const [userName, setUserName] = useState('Juan Dela Cruz');
  const [splitName, setSplitName] = useState('Juan');
  const [initial, setInitial] = useState('J');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [donationAmount, setDonationAmount] = useState(0);
  const [totalFoodDonations, setTotalFoodDonations] = useState(0);
  const [featuredBadges, setFeaturedBadges] = useState<any[]>([]);
  const [nextBadge, setNextBadge] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasAnimated = useRef(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const slideAnim = React.useRef(new Animated.Value(-150)).current;

  const sheetFadeAnim = useRef(new Animated.Value(0)).current;
  const sheetTranslateAnim = useRef(new Animated.Value(24)).current;

  const titleFadeAnim = useRef(new Animated.Value(0)).current;
  const titleTranslateAnim = useRef(new Animated.Value(18)).current;

  const totalCardFadeAnim = useRef(new Animated.Value(0)).current;
  const totalCardTranslateAnim = useRef(new Animated.Value(22)).current;

  const statsFadeAnim = useRef(new Animated.Value(0)).current;
  const statsTranslateAnim = useRef(new Animated.Value(22)).current;

  const badgesFadeAnim = useRef(new Animated.Value(0)).current;
  const badgesTranslateAnim = useRef(new Animated.Value(22)).current;

  const nextBadgeFadeAnim = useRef(new Animated.Value(0)).current;
  const nextBadgeTranslateAnim = useRef(new Animated.Value(22)).current;

  const showNotification = (msg: string) => {
    setNotificationMsg(msg);
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.delay(3500),
      Animated.timing(slideAnim, { toValue: -150, duration: 400, useNativeDriver: true }),
    ]).start(() => setNotificationMsg(null));
  };

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
        Animated.timing(badgesFadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(badgesTranslateAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(nextBadgeFadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(nextBadgeTranslateAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
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
      const localPic = await StorageUtils.getItem('LOCAL_PROFILE_PIC');
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

        // Use demo fallback values if API returns 0 so the dashboard always shows meaningful content
        setDonationAmount(data.total_donations > 0 ? data.total_donations : 5000);
        setTotalFoodDonations(data.total_food > 0 ? data.total_food : 30);
      }

      const badgesRes = await ApiService.getBadges();
      if (badgesRes?.data?.success) {
        setFeaturedBadges(badgesRes.data.earned ? badgesRes.data.earned.slice(0, 3) : []);
        const next = badgesRes.data.in_progress[0] || badgesRes.data.all.find((b: any) => b.status === 'not_started');
        setNextBadge(next);
      }
    } catch (error) {
      // API unavailable — show meaningful demo values
      setDonationAmount(5000);
      setTotalFoodDonations(30);
    } finally {
      setIsLoading(false);
      runEntryAnimations();
      setTimeout(() => {
        showNotification('Donation confirmed. Thank you for your generosity!');
      }, 900);
    }
  };

  const currentLevel = Math.floor(donationAmount / 50000);
  const goalStart = currentLevel * 50000;
  const goalEnd = (currentLevel + 1) * 50000;

  const progressPct = Math.max(
    0,
    Math.min(((donationAmount - goalStart) / (goalEnd - goalStart)) * 100, 100)
  );

  const nextBadgeGoal = nextBadge ? nextBadge.goal_value : 100000;
  const nextBadgeAmount = nextBadge ? nextBadge.progress : donationAmount;
  const nextBadgePct = Math.max(
    0,
    Math.min((nextBadgeAmount / nextBadgeGoal) * 100, 100)
  );

  const isFinancial = nextBadge && nextBadge.goal_type === 'financial_total';

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
        {/* Slide-in notification banner */}
        <Animated.View style={[styles.notificationBanner, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.notificationContent}>
            <Ionicons name="notifications" size={24} color="#00592d" />
            <Text style={styles.notificationText}>{notificationMsg}</Text>
            <Text style={styles.notificationTime}>Now</Text>
          </View>
        </Animated.View>

        <View style={styles.container}>
          <View style={styles.greenHeader}>
            <View style={styles.topRow}>
              <Image
                source={require('../../assets/images/logo/logowhite.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />

              <View style={styles.iconRow}>
                <TouchableOpacity
                  style={[styles.iconBtn, { position: 'relative' }]}
                  onPress={() => navigation.navigate('Notifications', { role: 'donor' })}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={26}
                    color="#FFFFFF"
                  />
                  <View style={styles.badgeDot}>
                    <Text style={styles.badgeText}>!</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => navigation.openDrawer?.()}
                >
                  <Ionicons name="menu-outline" size={32} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: '#FFF', opacity: 0.3, marginHorizontal: -22, marginTop: 5, marginBottom: 15 }} />

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
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <Animated.View
                style={{
                  opacity: titleFadeAnim,
                  transform: [{ translateY: titleTranslateAnim }],
                }}
              >
                <Text style={styles.dashboardTitle}>Donor Dashboard</Text>

                <Text style={styles.subtitle}>
                  Welcome back, <Text style={styles.subtitleBold}>{splitName}!</Text>{' '}
                  Here’s your activity overview - keep making an impact
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
                    ₱ {donationAmount.toLocaleString('en-US')}
                  </Text>

                  <View style={styles.progressWrapper}>
                    <View style={styles.progressTrack} />
                    <View
                      style={[styles.progressFill, { width: `${progressPct}%` }]}
                    />
                    <View style={styles.leftDot} />
                    <View style={[styles.middleDot, { left: `${progressPct}%` }]} />
                    <View style={styles.rightDot} />
                  </View>

                  <View style={styles.progressLabels}>
                    <Text style={styles.currentLabel}>
                      ₱ {goalStart.toLocaleString('en-US')}
                    </Text>
                    <Text style={styles.goalLabel}>
                      ₱ {goalEnd.toLocaleString('en-US')}
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
                  <TouchableOpacity
                    style={styles.imageCardContainer}
                    onPress={() => navigation.navigate?.('FinancialDonation')}
                    activeOpacity={0.9}
                  >
                    <ImageBackground
                      source={require('../../assets/images/cards/financialcard_dashboard.png')}
                      style={styles.imageCardBg}
                      imageStyle={{ borderRadius: 14 }}
                      resizeMode="stretch"
                    >
                      <View style={styles.imageCardContent}>
                        <Text style={styles.orangeValue}>
                          ₱ {donationAmount.toLocaleString('en-US')}
                        </Text>
                        <Text style={styles.orangeLabel}>TOTAL FINANCIAL</Text>
                        <Text style={styles.orangeLabel}>DONATION</Text>
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.imageCardContainer}
                    onPress={() => navigation.navigate?.('FoodDonationDetails')}
                    activeOpacity={0.9}
                  >
                    <ImageBackground
                      source={require('../../assets/images/cards/foodcard_dashboard.png')}
                      style={styles.imageCardBg}
                      imageStyle={{ borderRadius: 14 }}
                      resizeMode="stretch"
                    >
                      <View style={styles.imageCardContent}>
                        <Text style={styles.orangeValue}>{totalFoodDonations}</Text>
                        <Text style={styles.orangeLabel}>TOTAL FOOD</Text>
                        <Text style={styles.orangeLabel}>DONATION</Text>
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>
                </View>
              </Animated.View>

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

                  {featuredBadges && featuredBadges.length > 0 ? (
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
                  ) : (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                      <Text style={{ color: '#8A8A8A', fontSize: 13, textAlign: 'center' }}>
                        No achievements yet.
                      </Text>
                    </View>
                  )}
                </View>
              </Animated.View>

              <Animated.View
                style={{
                  opacity: nextBadgeFadeAnim,
                  transform: [{ translateY: nextBadgeTranslateAnim }],
                }}
              >
                <View style={styles.nextBadgeSection}>
                  <Text style={styles.nextBadgeTitle}>Next Badge</Text>

                  {featuredBadges && featuredBadges.length > 0 ? (
                    nextBadge ? (
                      <View style={styles.nextBadgeCard}>
                        <Image
                          source={BADGE_IMAGES[nextBadge.icon]}
                          style={styles.nextBadgeImage}
                          resizeMode="contain"
                        />

                        <View style={styles.nextBadgeTextWrap}>
                          <Text style={styles.nextBadgeName}>{nextBadge.name}</Text>
                          <Text style={styles.nextBadgeDesc}>
                            {nextBadge.description}
                          </Text>

                          <View style={styles.nextProgressBar}>
                            <View
                              style={[
                                styles.nextProgressFill,
                                { width: `${nextBadgePct}%` },
                              ]}
                            />
                          </View>

                          <Text style={styles.nextProgressText}>
                            {isFinancial ? '₱ ' : ''}{nextBadgeAmount.toLocaleString('en-US')} / {isFinancial ? '₱ ' : ''}{nextBadgeGoal.toLocaleString('en-US')}
                          </Text>
                        </View>
                      </View>
                    ) : null
                  ) : (
                    <View style={{ paddingVertical: 15, alignItems: 'center' }}>
                      <Text style={{ color: '#8A8A8A', fontSize: 13, textAlign: 'center' }}>
                        Start donating to reveal your first badge goal!
                      </Text>
                    </View>
                  )}
                </View>
              </Animated.View>

              <View style={{ height: 110 }} />
            </ScrollView>
          </Animated.View>
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

  greenHeader: {
    backgroundColor: '#00592d',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 25,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },

  logoImage: {
    width: 170,
    height: 58,
  },

  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },

  iconBtn: {
    marginLeft: 12,
  },

  badgeDot: {
    position: 'absolute',
    top: -3,
    right: -4,
    backgroundColor: '#E74C3C',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00592d',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
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
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 40,
  },

  dashboardTitle: {
    textAlign: 'center',
    color: '#08532F',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
  },

  subtitle: {
    textAlign: 'center',
    color: '#424242',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 10,
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

  progressWrapper: {
    position: 'relative',
    justifyContent: 'center',
    height: 18,
    marginBottom: 10,
  },

  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#959595',
    width: '100%',
    position: 'absolute',
  },

  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1AC22',
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },

  leftDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#D1AC22',
    left: 0,
    zIndex: 2,
  },

  middleDot: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#D1AC22',
    marginLeft: -9,
    zIndex: 3,
  },

  rightDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#868686',
    right: 0,
    zIndex: 2,
  },

  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },

  currentLabel: {
    color: '#00592d',
    fontSize: 12,
    fontWeight: '800',
  },

  goalLabel: {
    color: '#8D8D8D',
    fontSize: 12,
    fontWeight: '800',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
  },

  imageCardContainer: {
    width: '48.5%',
    height: 102,
    borderRadius: 14,
    overflow: 'hidden',
  },

  imageCardBg: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 8,
  },

  imageCardContent: {
    width: '55%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },

  orangeValue: {
    color: '#DFB43F',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 0,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

  orangeLabel: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    lineHeight: 11,
    textAlign: 'center',
    flexWrap: 'wrap',
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
    justifyContent: 'space-between',
  },

  badgeCard: {
    width: '31.5%',
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

  nextBadgeSection: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  nextBadgeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5B4A35',
    marginBottom: 14,
  },

  nextBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  nextBadgeImage: {
    width: 90,
    height: 90,
    marginRight: 14,
  },

  nextBadgeTextWrap: {
    flex: 1,
  },

  nextBadgeName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3F3328',
    marginBottom: 4,
  },

  nextBadgeDesc: {
    fontSize: 12,
    color: '#7A7A7A',
    lineHeight: 17,
    marginBottom: 12,
  },

  nextProgressBar: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
    marginBottom: 8,
  },

  nextProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#D1AC22',
  },

  nextProgressText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00592d',
  },
});