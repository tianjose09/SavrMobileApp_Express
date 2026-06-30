import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Animated, AppState, Image, ImageBackground, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StorageUtils, StorageKeys, getProfilePicKey } from '../../utils/storage';
import { ApiService } from '../../services/api';
import NotificationBell from '../../components/NotificationBell';

export default function BeneficiaryDashboard({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState('');
  const [splitName, setSplitName] = useState('Beneficiary Name');
  const [initial, setInitial] = useState('B');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [acceptedRequests, setAcceptedRequests] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

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

        } catch { }
      }
    } catch (e) {
      console.error('Failed to load dashboard', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color="#00592d" />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={{ height: insets.top, backgroundColor: '#00592d' }} />

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
                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#00592d' }}>{initial}</Text>
                  )}
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ color: '#E4B63F', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Good Day,</Text>
                  <Text style={[styles.profileName, { marginLeft: 0 }]} numberOfLines={1}>
                    {userName}
                  </Text>
                </View>
              </View>
            </View>

            {/* WHITE SHEET */}
            <View style={styles.whiteSheet}>
              <Text style={styles.dashboardTitle}>Beneficiary Dashboard</Text>
              <View style={styles.subtitleWrapper}>
                <Text style={styles.subtitle}>
                  Here's your beneficiary dashboard — we're here to support you in receiving the assistance you need.
                </Text>
              </View>

              <View style={styles.statsRow}>
                {/* Active Request Card */}
                <TouchableOpacity
                  style={styles.glassCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('HomeTabs', { screen: 'Track', params: { filter: 'Approved' } })}
                >
                  <View style={styles.glassCardBg}>
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.15)', 'rgba(0, 0, 0, 0.05)']}
                      style={styles.glassCardGloss}
                    />
                    <View style={styles.glassIconCol}>
                      <Image
                        source={require('../../assets/images/icons/activerequesticon.png')}
                        style={styles.glassIconImage}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.glassTextCol}>
                      <Text style={styles.glassValue}>{acceptedRequests}</Text>
                      <Text style={styles.glassLabel}>ACTIVE</Text>
                      <Text style={styles.glassLabel}>REQUEST</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Pending Request Card */}
                <TouchableOpacity
                  style={styles.glassCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('HomeTabs', { screen: 'Track', params: { filter: 'Pending' } })}
                >
                  <View style={styles.glassCardBg}>
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.15)', 'rgba(0, 0, 0, 0.05)']}
                      style={styles.glassCardGloss}
                    />
                    <View style={styles.glassIconCol}>
                      <Image
                        source={require('../../assets/images/icons/pendingrequesticon.png')}
                        style={styles.glassIconImage}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.glassTextCol}>
                      <Text style={styles.glassValue}>{pendingRequests}</Text>
                      <Text style={styles.glassLabel}>PENDING</Text>
                      <Text style={styles.glassLabel}>REQUEST</Text>
                    </View>
                  </View>
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
        <View style={{ height: 60 }} />
        </View>
      </ScrollView>
    </View>
  </View>
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
    backgroundColor: '#FFFFFF',
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
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 40,
  },
  scrollContent: {
    flexGrow: 1,
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
    marginBottom: 30,
    paddingHorizontal: 2,
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

  glassValue: {
    color: '#DFB43F',
    fontSize: 36,
    fontWeight: '900',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    textAlign: 'center',
  },

  glassLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
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
