import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
  AppState,
  ImageBackground,
  Animated,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { StorageUtils, StorageKeys, getProfilePicKey } from '../../utils/storage';
import { ApiService } from '../../services/api';

export default function BeneficiaryDashboard({ navigation }: any) {
  const [userName, setUserName] = useState('');
  const [splitName, setSplitName] = useState('Beneficiary Name');
  const [initial, setInitial] = useState('B');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [acceptedRequests, setAcceptedRequests] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const bannerShownRef = React.useRef(false);
  const slideAnim = React.useRef(new Animated.Value(-150)).current;

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
      }),
    ]).start(() => setNotificationMsg(null));
  };

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      fetchDashboardData();
    });

    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        fetchDashboardData();
      }
    });

    fetchDashboardData();

    return () => {
      unsubscribeFocus();
      appStateSubscription.remove();
    };
  }, [navigation]);

  const fetchDashboardData = async () => {
    const localName =
      (await StorageUtils.getItem(StorageKeys.DISPLAY_NAME)) || 'Beneficiary Name';
    const picKey = await getProfilePicKey();
      const localPic = await StorageUtils.getItem(picKey);
    if (localPic) setProfilePic(localPic);

    setUserName(localName);
    setInitial(localName.charAt(0).toUpperCase());
    setSplitName(localName.split(' ')[0]);

    try {
      const dashRes = await ApiService.getDashboard();
      if (dashRes?.data?.success) {
        const data = dashRes.data;

        if (data.display_name) {
          setUserName(data.display_name);
          setInitial(data.display_name.charAt(0).toUpperCase());
          setSplitName(data.display_name.split(' ')[0]);
          StorageUtils.setItem(StorageKeys.DISPLAY_NAME, data.display_name);
        }

        setPendingRequests(data.pending_requests ?? 0);
        setAcceptedRequests(data.accepted_requests ?? 0);

        try {
          const critRes = await ApiService.getCriticalNotifications();
          setUnreadCount(critRes?.data?.notifications?.length || 0);

          if (!bannerShownRef.current) {
            const allRes = await ApiService.getNotifications();
            const successNotifs = (allRes?.data?.notifications || []).filter((n: any) => !n.is_critical);
            if (successNotifs.length > 0) {
              bannerShownRef.current = true;
              setTimeout(() => showNotification(successNotifs[0].title), 800);
            }
          }
        } catch {}
      }
    } catch (e) {
      console.error('Failed to load dashboard', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
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
          {/* GREEN HEADER */}
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
                  onPress={() => navigation.navigate('Notifications', { role: 'beneficiary' })}
                >
                  <Ionicons name="notifications-outline" size={26} color="#FFFFFF" />
                  {unreadCount > 0 && (
                    <View style={styles.badgeDot}>
                      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => navigation.openDrawer?.()}
                >
                  <Ionicons name="menu-outline" size={32} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: '#FFF', opacity: 0.3, marginHorizontal: -16, marginTop: 5, marginBottom: 15 }} />

            <View style={styles.profileRow}>
              <TouchableOpacity
                style={styles.avatarCircle}
                onPress={() => navigation.navigate?.('Profile')}
              >
                {profilePic ? (
                  <Image source={{ uri: profilePic }} style={{ width: '100%', height: '100%', borderRadius: 50 }} />
                ) : (
                  <Text style={{ fontSize: 28, fontWeight: '800', color: '#00592d' }}>{initial}</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.profileName} numberOfLines={1}>
                {userName}
              </Text>
            </View>
          </View>

          {/* WHITE SHEET */}
          <View style={styles.whiteSheet}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <Text style={styles.dashboardTitle}>Beneficiary Dashboard</Text>

              <View style={styles.subtitleWrapper}>
                <Text style={styles.subtitle}>
                  Welcome back, <Text style={styles.subtitleBold}>{userName}!</Text> Here's{'\n'}your activity overview
                </Text>
              </View>

              <View style={styles.statsRow}>
                {/* Active Request Card */}
                <TouchableOpacity style={styles.imageCardContainer} activeOpacity={0.9} onPress={() => navigation.navigate('HomeTabs', { screen: 'Track' })}>
                  <ImageBackground
                    source={require('../../assets/images/cards/activerequest_card.png')}
                    style={styles.imageCardBg}
                    imageStyle={{ borderRadius: 14 }}
                    resizeMode="contain"
                  >
                    <View style={styles.cardRightStack}>
                      <Text style={styles.cardNumber}>{acceptedRequests}</Text>
                      <Text style={styles.cardLabel}>ACCEPTED REQUEST</Text>
                    </View>
                  </ImageBackground>
                </TouchableOpacity>

                {/* Pending Request Card */}
                <TouchableOpacity style={styles.imageCardContainer} activeOpacity={0.9} onPress={() => navigation.navigate('HomeTabs', { screen: 'Track' })}>
                  <ImageBackground
                    source={require('../../assets/images/cards/pendingrequest_card.png')}
                    style={styles.imageCardBg}
                    imageStyle={{ borderRadius: 14 }}
                    resizeMode="contain"
                  >
                    <View style={styles.cardRightStack}>
                      <Text style={styles.cardNumber}>{pendingRequests}</Text>
                      <Text style={styles.cardLabel}>PENDING REQUEST</Text>
                    </View>
                  </ImageBackground>
                </TouchableOpacity>
              </View>

              {/* Need Support Banner */}
              <View style={styles.supportBanner}>
                <View style={styles.supportLeftStack}>
                  <Text style={styles.supportLine1}>Need support for your</Text>
                  <Text style={styles.supportLine2}>community?</Text>

                  <View style={styles.supportMainWrap}>
                    <Text style={styles.supportMain}>Submit a new</Text>
                    <Text style={styles.supportMain}>request</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.yellowButton}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('HomeTabs', { screen: 'Request' })}
                >
                  <Text style={styles.yellowBtnText}>Request</Text>
                  <Text style={styles.yellowBtnText}>Now</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}


const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F3',
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
  container: {
    flex: 1,
    backgroundColor: '#00592d',
  },
  greenHeader: {
    backgroundColor: '#00592d',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 25,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoImage: {
    width: 170,
    height: 58,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    marginLeft: 15,
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
  profileName: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 14,
    maxWidth: '75%',
    letterSpacing: -0.5,
  },
  whiteSheet: {
    flex: 1,
    backgroundColor: '#F9F8F4',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: 'hidden',
    marginTop: -2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 40,
  },
  dashboardTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#00592d',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitleWrapper: {
    alignItems: 'center',
    marginBottom: 40,
  },
  subtitle: {
    fontSize: 16,
    color: '#3A3A3A',
    lineHeight: 24,
    textAlign: 'center',
  },
  subtitleBold: {
    fontWeight: '800',
    color: '#3A3A3A',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    paddingHorizontal: 2,
  },
  imageCardContainer: {
    width: '48%',
    height: 100,
    shadowColor: '#CE7841',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
  imageCardBg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRightStack: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '36%',
    marginTop: '-8%',
  },
  cardNumber: {
    color: '#EBC455',
    fontSize: 40,
    fontWeight: '800',
    textShadowColor: 'rgba(152, 70, 20, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  cardLabel: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  supportBanner: {
    backgroundColor: '#00592d',
    borderRadius: 22,
    flexDirection: 'row',
    paddingVertical: 22,
    paddingLeft: 22,
    paddingRight: 18,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 5,
    shadowColor: '#00592d',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 8,
  },
  supportLeftStack: {
    flex: 1,
  },
  supportLine1: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  supportLine2: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  supportMainWrap: {
    marginTop: 0,
  },
  supportMain: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  yellowButton: {
    backgroundColor: '#EAC352',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#EAC352',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  yellowBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
});
