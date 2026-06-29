import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ApiService } from '../../services/api';
import { BADGE_IMAGES } from '../../utils/badges';
import NotificationBell from '../../components/NotificationBell';

export default function AchievementBadges({ navigation }: any) {
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [featuredBadges, setFeaturedBadges] = useState<any[]>([]);
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [totalUnlocked, setTotalUnlocked] = useState(0);
  const [summaryBadge, setSummaryBadge] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchBadges = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ApiService.getBadges();
      if (response?.data?.success) {
        const all = (response.data.all ?? []) as any[];
        const sortedAll = [...all].sort((a: any, b: any) => {
          const aPriority = a.status === 'earned' ? 1 : a.status === 'in_progress' ? 2 : 3;
          const bPriority = b.status === 'earned' ? 1 : b.status === 'in_progress' ? 2 : 3;
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          const aGoal = parseFloat(a.goal_value) || 0;
          const bGoal = parseFloat(b.goal_value) || 0;
          return aGoal - bGoal;
        });
        setAllBadges(sortedAll);

        // Only truly earned badges, sorted lowest goal first
        const earned = all
          .filter((b: any) => b.status === 'earned')
          .sort((a: any, b: any) => parseFloat(a.goal_value) - parseFloat(b.goal_value));

        setFeaturedBadges(earned.slice(0, 3));
        setTotalUnlocked(earned.length);

        // Summary image = the HIGHEST earned badge (most prestigious)
        const highest = earned.length > 0 ? earned[earned.length - 1] : null;
        setSummaryBadge(highest);
      }
    } catch (error) {
      console.error('Failed to fetch badges', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBadges();
    }, [fetchBadges])
  );

  const renderStatusPill = (status: string) => {
    const isEarned = status === 'earned';
    const isProgress = status === 'in_progress';

    const pillStyle =
      isEarned
        ? styles.statusEarned
        : isProgress
          ? styles.statusProgress
          : styles.statusLocked;

    const textStyle =
      isEarned
        ? styles.statusEarnedText
        : isProgress
          ? styles.statusProgressText
          : styles.statusLockedText;
    
    // Map status string to readable labels
    const displayStatus = isEarned ? 'Earned' : isProgress ? 'In Progress' : 'Locked';

    return (
      <View style={[styles.statusPill, pillStyle]}>
        <Text style={[styles.statusTextBase, textStyle]}>{displayStatus}</Text>
      </View>
    );
  };

  const renderProgressBar = (badge: any) => {
    if (badge.status === 'earned' || !badge.goal_value) return null;
    const pct = Math.min((badge.progress ?? 0) / badge.goal_value, 1);
    return (
      <View style={styles.progressBarWrap}>
        <View style={[styles.progressBarFill, { width: `${Math.round(pct * 100)}%` as any }]} />
        <Text style={styles.progressBarLabel}>
          {badge.progress ?? 0} / {badge.goal_value}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <>
        <SafeAreaView style={{ flex: 0, backgroundColor: '#00592d' }} edges={['top']} />
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F8F8', justifyContent: 'center', alignItems: 'center' }} edges={['bottom']}>
          <ActivityIndicator size="large" color="#00592d" />
          <Text style={{ marginTop: 12, color: '#00592d', fontWeight: '700' }}>Loading badges...</Text>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#00592d' }} edges={['top']} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F8F8' }} edges={['bottom']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          <View style={styles.greenHeader}>
            <View style={styles.topRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.navigate('Home')}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.iconRow}>
                <NotificationBell navigation={navigation} color="#FFFFFF" size={26} />
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => navigation.openDrawer?.()}
                >
                  <Ionicons name="menu-outline" size={32} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.pageTitle}>Achievement Badges</Text>
          </View>

          <View style={styles.whiteSheet}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <View>
                  <Text style={styles.summaryLabel}>Total Unlocked</Text>
                  <Text style={styles.summaryCount}>{totalUnlocked} Badges</Text>
                </View>

                <View style={styles.updatedPill}>
                  <Text style={styles.updatedText}>Updated Today</Text>
                </View>
              </View>

              <View style={styles.summaryBody}>
                {summaryBadge && BADGE_IMAGES[summaryBadge.icon] ? (
                  <Image
                    source={BADGE_IMAGES[summaryBadge.icon]}
                    style={styles.summaryBadgeImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.summaryBadgeImage, { backgroundColor: '#EFEFEF', borderRadius: 50, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="lock-closed" size={32} color="#C0C0C0" />
                  </View>
                )}

                <View style={styles.summaryTextContent}>
                  <Text style={styles.impactTitle}>
                    {totalUnlocked > 0 ? "Your impact is growing" : "No achievements yet"}
                  </Text>
                  <Text style={styles.impactDesc}>
                    {totalUnlocked > 0
                      ? "You've already unlocked several badges through meaningful support, consistent donations, and long-term community impact."
                      : "You haven't unlocked any badges yet. Start donating or supporting to earn your first badge!"}
                  </Text>

                  <View style={styles.tagsRow}>
                    <View style={styles.tagGreen}>
                      <Text style={styles.tagGreenText}>
                        {totalUnlocked > 0 ? `${Math.min(3, totalUnlocked)} Featured Badges` : "0 Badges"}
                      </Text>
                    </View>
                    <View style={styles.tagYellow}>
                      <Text style={styles.tagYellowText}>
                        {totalUnlocked > 0 ? "Next milestone soon" : "Start your journey"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {!showAllBadges ? (
              <View style={styles.featuredSection}>
                <Text style={styles.highlightsText}>HIGHLIGHTS</Text>

                <View style={styles.featuredHeaderRow}>
                  <Text style={styles.featuredTitle}>Featured Badges</Text>
                  <TouchableOpacity
                    style={styles.viewDetailsPill}
                    onPress={() => setShowAllBadges(true)}
                  >
                    <Text style={styles.viewDetailsText}>View Details</Text>
                  </TouchableOpacity>
                </View>

                {featuredBadges && featuredBadges.length > 0 ? (
                  <View style={[
                    styles.badgesRow,
                    {
                      justifyContent: featuredBadges.length === 3 ? 'space-between' : 'flex-start',
                      gap: featuredBadges.length === 3 ? 0 : 12,
                    }
                  ]}>
                    {featuredBadges.map((badge) => {
                      const imgSource = BADGE_IMAGES[badge.icon];
                      if (!imgSource) return null;
                      return (
                        <View style={styles.badgeCard} key={badge.id}>
                          <Image
                            source={imgSource}
                            style={styles.badgeImage}
                            resizeMode="contain"
                          />
                          <Text style={styles.badgeName}>{badge.name}</Text>
                          <Text style={styles.badgeDesc}>{badge.description}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#8A8A8A', fontSize: 13, textAlign: 'center' }}>
                      No featured badges yet. Complete your first donation to start earning!
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.allBadgesSection}>
                <View style={styles.allBadgesHeader}>
                  <View>
                    <Text style={styles.progressLabel}>YOUR PROGRESS</Text>
                    <Text style={styles.allBadgesTitle}>Achievement Badges</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.seeAllPill}
                    onPress={() => setShowAllBadges(false)}
                  >
                    <Text style={styles.seeAllText}>See All</Text>
                  </TouchableOpacity>
                </View>

                {allBadges.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: '#8A8A8A', fontSize: 13, textAlign: 'center' }}>
                      No badges in progress yet. Start donating to earn your first badge!
                    </Text>
                  </View>
                ) : (
                  allBadges.map((badge) => {
                    const isEarned = badge.status === 'earned';
                    return (
                      <View style={styles.badgeListCard} key={badge.id}>
                        <View style={styles.badgeListImageWrap}>
                          <Image
                            source={BADGE_IMAGES[badge.icon]}
                            style={[styles.badgeListImage, !isEarned && { opacity: 0.2 }]}
                            resizeMode="contain"
                          />
                          {!isEarned && (
                            <View style={styles.lockOverlay}>
                              <Ionicons name="lock-closed" size={24} color="#8A8A8A" />
                            </View>
                          )}
                        </View>

                        <View style={styles.badgeListTextWrap}>
                          <Text style={styles.badgeListName} numberOfLines={2} adjustsFontSizeToFit>{badge.name}</Text>
                          <Text style={styles.badgeListDesc}>{badge.description}</Text>
                          {renderProgressBar(badge)}
                        </View>

                        {renderStatusPill(badge.status)}
                      </View>
                    );
                  })
                )}
              </View>
            )}

            <View style={styles.nextGoalCard}>
              <View style={styles.nextGoalTextCol}>
                <Text style={styles.nextGoalLabel}>NEXT GOAL</Text>
                <Text style={styles.nextGoalTitle}>
                  Unlock more{'\n'}achievements
                </Text>
                <Text style={styles.nextGoalDesc}>
                  Continue donating and supporting
                </Text>
              </View>

              <TouchableOpacity
                style={styles.donateBtn}
                onPress={() => navigation.navigate?.('Donate')}
              >
                <Ionicons
                  name="heart-outline"
                  size={20}
                  color="#FFFFFF"
                  style={{ marginBottom: 4 }}
                />
                <Text style={styles.donateBtnText}>Donate Now</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 50 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#F8F8F8',
  },

  greenHeader: {
    backgroundColor: '#00592d',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 40,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },

  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBtn: {
    marginLeft: 15,
  },

  pageTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },

  whiteSheet: {
    backgroundColor: '#F8F8F8',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    marginTop: -30,
    paddingTop: 0,
    paddingHorizontal: 16,
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },

  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },

  summaryLabel: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },

  summaryCount: {
    color: '#1E583A',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  updatedPill: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },

  updatedText: {
    color: '#00592d',
    fontSize: 10,
    fontWeight: '800',
  },

  summaryBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  summaryBadgeImage: {
    width: 105,
    height: 105,
    marginRight: 14,
  },

  summaryTextContent: {
    flex: 1,
  },

  impactTitle: {
    color: '#5D4A38',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },

  impactDesc: {
    color: '#8A8A8A',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  tagGreen: {
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },

  tagGreenText: {
    color: '#00592d',
    fontSize: 9,
    fontWeight: '800',
  },

  tagYellow: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },

  tagYellowText: {
    color: '#B8860B',
    fontSize: 9,
    fontWeight: '800',
  },

  featuredSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },

  highlightsText: {
    color: '#00592d',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  featuredHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  featuredTitle: {
    color: '#5D4A38',
    fontSize: 22,
    fontWeight: '800',
  },

  viewDetailsPill: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },

  viewDetailsText: {
    color: '#00592d',
    fontSize: 11,
    fontWeight: '800',
  },

  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },

  badgeCard: {
    width: '31.5%',
    backgroundColor: '#FDFDFD',
    borderRadius: 16,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2F2F2',
  },

  badgeImage: {
    width: 72,
    height: 72,
    marginBottom: 12,
  },

  badgeName: {
    color: '#4A3B2B',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },

  badgeDesc: {
    color: '#8A8A8A',
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 11,
  },

  allBadgesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 18,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },

  allBadgesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },

  progressLabel: {
    color: '#2E8B57',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },

  allBadgesTitle: {
    color: '#5B4A38',
    fontSize: 22,
    fontWeight: '800',
  },

  seeAllPill: {
    backgroundColor: '#E3F2E6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },

  seeAllText: {
    color: '#1E7145',
    fontSize: 11,
    fontWeight: '800',
  },

  badgeListCard: {
    backgroundColor: '#FCFCFC',
    borderWidth: 1,
    borderColor: '#ECECEC',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  badgeListImageWrap: {
    position: 'relative',
    marginRight: 12,
    width: 68,
    height: 68,
  },

  badgeListImage: {
    width: '100%',
    height: '100%',
  },

  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  badgeListTextWrap: {
    flex: 1,
    paddingRight: 6,
  },

  badgeListName: {
    color: '#4A3B2B',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },

  badgeListDesc: {
    color: '#8A8A8A',
    fontSize: 10.5,
    lineHeight: 15,
  },

  statusPill: {
    minWidth: 76,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusEarned: {
    backgroundColor: '#DFF1E3',
  },

  statusProgress: {
    backgroundColor: '#F5ECD5',
  },

  statusLocked: {
    backgroundColor: '#EEEEEE',
  },

  statusTextBase: {
    fontSize: 10.5,
    fontWeight: '800',
  },

  statusEarnedText: {
    color: '#00592d',
  },

  statusProgressText: {
    color: '#9B8A5A',
  },

  statusLockedText: {
    color: '#7D7D7D',
  },

  nextGoalCard: {
    backgroundColor: '#EEDAC0',
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  nextGoalTextCol: {
    width: '60%',
  },

  nextGoalLabel: {
    color: '#8A6746',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },

  nextGoalTitle: {
    color: '#5D4A38',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 8,
  },

  nextGoalDesc: {
    color: '#8A6746',
    fontSize: 11,
  },

  donateBtn: {
    backgroundColor: '#00592d',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
  },

  donateBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  progressBarWrap: {
    marginTop: 8,
    height: 6,
    backgroundColor: '#EBEBEB',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },

  progressBarFill: {
    height: '100%',
    backgroundColor: '#00592d',
    borderRadius: 3,
  },

  progressBarLabel: {
    fontSize: 9,
    color: '#8A8A8A',
    marginTop: 3,
    fontWeight: '700',
  },
});