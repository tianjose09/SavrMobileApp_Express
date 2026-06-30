import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar,
  Animated,
  Linking,
  Dimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LandingPage({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('Home');

  // Animation values for page entrance
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Animation values for tab transitions
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;

  // Track scroll position for parallax scroll effects
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<any>(null);

  // Page entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Handle tab change with smooth fade + slide animation
  const handleTabChange = (tabKey: string) => {
    if (tabKey === activeTab) return;

    // Phase 1: Fade out + slide down slightly
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 10,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Scroll to top while hidden
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      setActiveTab(tabKey);

      // Reset position for slide-up entrance
      contentTranslateY.setValue(20);

      // Phase 2: Slide up + fade in with spring feel
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(contentTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const renderHomeContent = () => (
    <>
      <View style={styles.homeTopSection}>

        <View style={styles.heroSection}>
          <Text style={styles.heroHeadline}>
            Together, we fight hunger &{'\n'}
            ensure no food goes to{'\n'}
            <Text style={styles.heroHeadlineHighlight}>waste.</Text>
          </Text>

          <Text style={styles.heroParagraph}>
            We are a non-profit organization, we rescue surplus food from donors
            and deliver it to communities in need—fighting hunger while
            promoting sustainability and social responsibility.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statColumn}>
              <Text style={styles.statNumber}>3.2M+</Text>
              <Text style={styles.statLabel}>food distributed</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statNumber}>70+</Text>
              <Text style={styles.statLabel}>partners</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>provinces</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.homeBottomSection}>
        <View style={styles.donateNowContainer}>
          <TouchableOpacity
            style={styles.donateNowBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Login')}
          >
            <Image
              source={require('../../assets/images/icons/donatenowicon.png')}
              style={{ width: 28, height: 28, marginRight: 10, tintColor: '#FFF' }}
              resizeMode="contain"
            />
            <Text style={styles.donateNowText}>DONATE NOW</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=800' }}
            style={styles.mainImage}
          />
        </View>

        <Animated.View
          style={[styles.goalsContainer, {
            transform: [{
              translateY: scrollY.interpolate({
                inputRange: [0, 300],
                outputRange: [60, 0],
                extrapolate: 'clamp'
              })
            }]
          }]}
        >
          <Text style={styles.goalsTitle}>OUR MAIN GOALS</Text>

          <View style={styles.goalItem}>
            <Ionicons
              name="checkmark-circle"
              size={22}
              color="#2E8B57"
              style={styles.checkIcon}
            />
            <View style={styles.goalTextContainer}>
              <Text style={styles.goalItemTitle}>Hunger Relief</Text>
              <Text style={styles.goalItemDesc}>
                by distributing surplus food to religious orphanages, schools,
                parishes and other charitable institutions in communities in need.
              </Text>
            </View>
          </View>

          <View style={styles.goalItem}>
            <Ionicons
              name="checkmark-circle"
              size={22}
              color="#2E8B57"
              style={styles.checkIcon}
            />
            <View style={styles.goalTextContainer}>
              <Text style={styles.goalItemTitle}>Food Waste Reduction</Text>
              <Text style={styles.goalItemDesc}>
                through collaborating with food business to minimize excess and
                waste added to landfill.
              </Text>
            </View>
          </View>

          <View style={styles.goalItem}>
            <Ionicons
              name="checkmark-circle"
              size={22}
              color="#2E8B57"
              style={styles.checkIcon}
            />
            <View style={styles.goalTextContainer}>
              <Text style={styles.goalItemTitle}>Promote Learning Abilities</Text>
              <Text style={styles.goalItemDesc}>
                by providing nourishment to avoid brain damage especially for
                young children from newly born to 2 years old.
              </Text>
            </View>
          </View>

          <View style={styles.goalItem}>
            <Ionicons
              name="checkmark-circle"
              size={22}
              color="#00592d"
              style={styles.checkIcon}
            />
            <View style={styles.goalTextContainer}>
              <Text style={styles.goalItemTitle}>Community Empowerment</Text>
              <Text style={styles.goalItemDesc}>
                by providing nutritional education and supporting local
                hunger-fighting initiatives.
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </>
  );

  const renderMissionContent = () => (
    <View>
      {/* Hero Mission Header */}
      <LinearGradient
        colors={['#00592d', '#00592d', '#00592d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.missionHero}
      >
        <Text style={styles.missionHeroTitle}>Our Mission</Text>
        <Text style={styles.missionHeroText}>
          To combat food insecurity while fostering sustainability and social responsibility—making sure that surplus food reaches people who need it most instead of going to waste.
        </Text>
      </LinearGradient>


      {/* Our Initiatives Section — scroll-driven slide-up */}
      <Animated.View
        style={[
          styles.initiativesWrapper,
          {
            transform: [{
              translateY: scrollY.interpolate({
                inputRange: [0, 300],
                outputRange: [60, 0],
                extrapolate: 'clamp'
              })
            }]
          }
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrapper}>
            <MaterialCommunityIcons name="star-four-points" size={20} color="#D66F2B" />
          </View>
          <Text style={styles.sectionTitle}>Our Initiatives</Text>
        </View>

        {/* Initiative 1 - Food Rescue */}
        <View style={styles.initiativeCardModern}>
          <View style={styles.initiativeCardContent}>
            <View style={[styles.initiativeIconModern, styles.iconGreenBg]}>
              <MaterialCommunityIcons name="truck-fast" size={28} color="#1E7145" />
            </View>
            <View style={styles.initiativeTextContent}>
              <Text style={styles.initiativeCardTitleModern}>Food Rescue</Text>
              <Text style={styles.initiativeCardDescModern}>
                We rescue surplus or near-expiry food products that would otherwise go to waste and redistribute them to those facing food insecurity.
              </Text>
            </View>
          </View>
        </View>

        {/* Initiative 2 - Community Distribution */}
        <View style={styles.initiativeCardModern}>
          <View style={styles.initiativeCardContent}>
            <View style={[styles.initiativeIconModern, styles.iconGoldBg]}>
              <MaterialCommunityIcons name="hand-heart" size={28} color="#D8AA39" />
            </View>
            <View style={styles.initiativeTextContent}>
              <Text style={styles.initiativeCardTitleModern}>Community Distribution</Text>
              <Text style={styles.initiativeCardDescModern}>
                Our network of partners enables us to reach marginalized communities across the Philippines, ensuring that nutritious food reaches those who need it most.
              </Text>
            </View>
          </View>
        </View>

        {/* Initiative 3 - Education and Advocacy */}
        <View style={styles.initiativeCardModern}>
          <View style={styles.initiativeCardContent}>
            <View style={[styles.initiativeIconModern, styles.iconOrangeBg]}>
              <MaterialCommunityIcons name="school" size={28} color="#D66F2B" />
            </View>
            <View style={styles.initiativeTextContent}>
              <Text style={styles.initiativeCardTitleModern}>Education and Advocacy</Text>
              <Text style={styles.initiativeCardDescModern}>
                We raise awareness about food waste and hunger through educational initiatives and advocacy campaigns, empowering individuals and communities to take action.
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
      <View style={{ height: 100 }} />
    </View>
  );

  const renderInvolveContent = () => (
    <View style={styles.involveScrollContent}>
      <View style={styles.getInvolvedContainer}>
        <View style={styles.getInvolvedBadge}>
          <Text style={styles.getInvolvedBadgeText}>GET INVOLVED</Text>
        </View>

        <Text style={styles.getInvolvedHeadline}>Be part of the solution</Text>
        <Text style={styles.getInvolvedSub}>
          Whether you donate, partner with us, or support our mission in other
          ways, every contribution helps bring meals, hope, and care to people in need.
        </Text>

        {/* Cards — scroll-driven slide-up */}
        <Animated.View
          style={[
            styles.cardsColumn,
            {
              transform: [{
                translateY: scrollY.interpolate({
                  inputRange: [0, 300],
                  outputRange: [60, 0],
                  extrapolate: 'clamp'
                })
              }]
            }
          ]}
        >
          <View style={styles.actionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBox}>
                <MaterialCommunityIcons name="hand-heart" size={24} color="#D4AA3A" />
              </View>
              <Text style={styles.cardTitle}>Become a Donor</Text>
            </View>

            <Text style={styles.cardDesc}>
              Food, funds, or your time — every contribution helps provide meals
              and support people in need.
            </Text>

            <TouchableOpacity
              style={styles.cardBtn}
              onPress={() => navigation.navigate('DonorRegistration')}
            >
              <MaterialCommunityIcons name="hand-heart" size={16} color="#FFF" />
              <Text style={styles.cardBtnText}>Donate</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBox}>
                <MaterialCommunityIcons name="domain" size={24} color="#D4AA3A" />
              </View>
              <Text style={styles.cardTitle}>Become a Beneficiary</Text>
            </View>

            <Text style={styles.cardDesc}>
              Charities, orphanages, and community groups can join our network to receive warm, nutritious meals for those in need.
            </Text>

            <TouchableOpacity
              style={styles.cardBtn}
              onPress={() => navigation.navigate('BeneficiaryRegistration')}
            >
              <MaterialCommunityIcons name="home-group" size={16} color="#FFF" />
              <Text style={styles.cardBtnText}>Register as Beneficiary</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
      <View style={{ height: 100 }} />
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'Mission':
        return renderMissionContent();
      case 'Involve':
        return renderInvolveContent();
      default:
        return renderHomeContent();
    }
  };

  const navItems = [
    {
      key: 'Home',
      icon: 'home',
      type: 'Ionicons',
    },
    {
      key: 'Mission',
      icon: 'flag-outline',
      type: 'Ionicons',
    },
    {
      key: 'Involve',
      icon: 'hand-heart',
      type: 'MaterialCommunityIcons',
    },
  ];

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#00592d" translucent={false} />

        <View style={styles.fixedHeader}>
          <Image
            source={require('../../assets/images/logo/logowhite.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.authButtons}>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.8}
            >
              <Text style={styles.loginBtnText}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => navigation.navigate('Registration')}
              activeOpacity={0.8}
            >
              <Text style={styles.registerBtnText}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.container}>
          <Animated.ScrollView
            ref={scrollViewRef}
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }}>
              {renderContent()}
            </Animated.View>
            <View style={{ height: 100 }} />
          </Animated.ScrollView>
        </View>
      </SafeAreaView>

      <View style={[styles.bottomNav, { height: 65 + insets.bottom, paddingBottom: insets.bottom }]}>
        {[
          { key: 'Home', icon: 'home', label: 'Home', type: Ionicons },
          { key: 'Mission', icon: 'flag-outline', label: 'Mission', type: Ionicons },
          { key: 'Involve', icon: 'handshake-outline', label: 'Involve', type: MaterialCommunityIcons }
        ].map(item => {
          const isActive = activeTab === item.key;

          if (isActive) {
            return (
              <View key={item.key} style={styles.centerButtonWrapper}>
                <TouchableOpacity style={styles.centerButton} onPress={() => handleTabChange(item.key)} activeOpacity={0.9}>
                  <item.type name={item.icon as any} size={32} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <TouchableOpacity key={item.key} style={styles.navItem} onPress={() => handleTabChange(item.key)} activeOpacity={0.8}>
              <item.type name={item.icon as any} size={26} color="#A3C6B1" />
              <Text style={styles.navText}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const BRAND_GREEN = '#00592d';
const BRAND_YELLOW = '#D8AA39';
const OFF_WHITE = '#F5F6F1';
const ORANGE = '#D66F2B';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: OFF_WHITE,
  },

  container: {
    flex: 1,
    backgroundColor: OFF_WHITE,
  },

  scrollContent: {
    flexGrow: 1,
  },

  involveScrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  homeTopSection: {
    backgroundColor: BRAND_GREEN,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    paddingBottom: 28,
    overflow: 'hidden',
  },

  fixedHeader: {
    backgroundColor: BRAND_GREEN,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
  },

  logo: {
    width: 170,
    height: 58,
    marginBottom: 6,
  },

  authButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  loginBtn: {
    borderWidth: 1.5,
    borderColor: '#DDE7DF',
    borderRadius: 22,
    paddingVertical: 7,
    paddingHorizontal: 18,
    marginRight: 8,
  },

  loginBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },

  registerBtn: {
    backgroundColor: '#D8E5D8',
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },

  registerBtnText: {
    color: BRAND_GREEN,
    fontSize: 15,
    fontWeight: '700',
  },

  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 34,
  },

  heroHeadline: {
    fontSize: 32,
    lineHeight: 31,
    fontWeight: '800',
    color: '#FFF6EE',
    marginBottom: 18,
    letterSpacing: -1,
  },

  heroHeadlineHighlight: {
    color: '#F1BC3B',
  },

  heroParagraph: {
    color: '#F7F7F7',
    fontSize: 14,
    lineHeight: 17,
    marginBottom: 26,
    maxWidth: '95%',
    fontWeight: '500',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 34,
  },

  statColumn: {
    alignItems: 'flex-start',
  },

  statNumber: {
    color: '#F1BC3B',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },

  statLabel: {
    color: '#D4B24D',
    fontSize: 12,
    fontWeight: '600',
  },

  homeBottomSection: {
    backgroundColor: OFF_WHITE,
    paddingTop: 14,
    paddingHorizontal: 22,
  },

  donateNowContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 2,
  },

  donateNowBtn: {
    backgroundColor: BRAND_YELLOW,
    width: '88%',
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderWidth: 1.5,
    borderColor: '#8B6A17',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 5,
  },

  donateNowText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  imageWrapper: {
    width: '100%',
    borderRadius: 32,
    borderWidth: 5,
    borderColor: '#00592d',
    overflow: 'hidden',
    marginBottom: 24,
  },

  mainImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },

  goalsContainer: {
    paddingBottom: 10,
  },

  goalsTitle: {
    color: ORANGE,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 18,
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0.5, height: 1 },
    textShadowRadius: 2,
  },

  goalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  checkIcon: {
    marginRight: 10,
    marginTop: 2,
  },

  goalTextContainer: {
    flex: 1,
  },

  goalItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#222',
    marginBottom: 4,
  },

  goalItemDesc: {
    fontSize: 12,
    lineHeight: 16,
    color: '#666',
  },

  tabContentWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  missionHero: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },

  missionHeroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 12,
    textAlign: 'center',
  },

  missionHeroText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#FFF',
    textAlign: 'center',
    opacity: 0.95,
  },

  orgCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },

  orgCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  orgIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  orgHeaderText: {
    flex: 1,
  },

  orgCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },

  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  verifiedText: {
    fontSize: 11,
    color: '#D8AA39',
    marginLeft: 4,
    fontWeight: '500',
  },

  orgDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 12,
  },

  orgDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  orgDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },

  orgWebsiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },

  orgWebsiteText: {
    fontSize: 13,
    color: '#1E7145',
    fontWeight: '600',
  },

  initiativesWrapper: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  sectionIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF5F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
  },

  initiativeCardModern: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  initiativeCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  initiativeIconModern: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },

  iconGreenBg: {
    backgroundColor: '#E8F5E9',
  },

  iconGoldBg: {
    backgroundColor: '#FFF8E1',
  },

  iconOrangeBg: {
    backgroundColor: '#FFF5F0',
  },

  initiativeTextContent: {
    flex: 1,
  },

  initiativeCardTitleModern: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },

  initiativeCardDescModern: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666',
  },

  impactWrapper: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },

  impactCard: {
    backgroundColor: '#00592d',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#00592d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  impactTitleModern: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 20,
  },

  impactStatsModern: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  impactItemModern: {
    alignItems: 'center',
    flex: 1,
  },

  impactNumberModern: {
    fontSize: 24,
    fontWeight: '800',
    color: '#D8AA39',
    marginBottom: 6,
  },

  impactLabelModern: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.9,
    fontWeight: '500',
  },

  impactDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  getInvolvedContainer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#FCFAF5',
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 10,
  },

  getInvolvedBadge: {
    borderWidth: 1,
    borderColor: '#00592d',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 14,
  },

  getInvolvedBadgeText: {
    color: '#4EA976',
    fontWeight: 'bold',
    fontSize: 11,
  },

  getInvolvedHeadline: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },

  getInvolvedSub: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 10,
  },

  cardsColumn: {
    width: '100%',
    flexDirection: 'column',
    gap: 16,
  },

  actionCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  cardIconBox: {
    backgroundColor: '#FFF8E7',
    padding: 8,
    borderRadius: 10,
    marginRight: 12,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: BRAND_GREEN,
  },

  cardDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 18,
  },

  cardBtn: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  cardBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  partnerBenefitsCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },

  partnerBenefitsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E7145',
    marginBottom: 14,
    textAlign: 'center',
  },

  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  benefitText: {
    fontSize: 12,
    color: '#555',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },

  contactBtn: {
    backgroundColor: '#D8AA39',
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },

  contactBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },

  bottomNav: {
    flexDirection: 'row',
    height: 65,
    backgroundColor: '#00592d',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    width: '100%',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 8,
  },

  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 5,
  },

  centerButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 10,
  },

  centerButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#00592d',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -38,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },

  navText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    color: '#A3C6B1',
    letterSpacing: 0.5,
  },
});