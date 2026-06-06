import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ApiService } from '../../services/api';
import NotificationBell from '../../components/NotificationBell';

export default function Activities({ navigation }: any) {
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchActivities();
    }, [])
  );

  const fetchActivities = async () => {
    try {
      const response = await ApiService.getActivities();
      if (response?.data?.success) {
        setActivities(response.data.activities || []);
      } else {
        setActivities([]);
      }
    } catch (e) {
      console.error('Activities fetch error', e);
      setActivities([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivities();
  };

  const getIconForType = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'financial':
        return 'card-outline';
      case 'food':
        return 'restaurant-outline';
      case 'service':
        return 'people-outline';
      default:
        return 'document-text-outline';
    }
  };

  const getTypeColor = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'financial':
        return {
          bg: '#E8F5E9',
          icon: '#00592d',
        };
      case 'food':
        return {
          bg: '#FFF3E0',
          icon: '#EF6C00',
        };
      case 'service':
        return {
          bg: '#E0F2F1',
          icon: '#00796B',
        };
      default:
        return {
          bg: '#F3F4F6',
          icon: '#6B7280',
        };
    }
  };

  const getStatusStyle = (status: string) => {
    const lower = (status || '').toLowerCase();

    if (
      lower.includes('completed') ||
      lower.includes('success') ||
      lower.includes('approved') ||
      lower.includes('delivered') ||
      lower.includes('scheduled') ||
      lower.includes('submitted') ||
      lower.includes('processed')
    ) {
      return {
        bg: '#E6F4EA',
        text: '#00592d',
      };
    }

    if (
      lower.includes('pending') ||
      lower.includes('processing') ||
      lower.includes('ongoing') ||
      lower.includes('in progress')
    ) {
      return {
        bg: '#FFF4DB',
        text: '#A67C00',
      };
    }

    if (
      lower.includes('cancelled') ||
      lower.includes('rejected') ||
      lower.includes('failed')
    ) {
      return {
        bg: '#FDECEC',
        text: '#C62828',
      };
    }

    return {
      bg: '#EEF2F7',
      text: '#667085',
    };
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const typeStyle = getTypeColor(item.type);
    const statusStyle = getStatusStyle(item.status);

    return (
      <View style={styles.activityCard}>
        <View style={[styles.activityTopRow]}>
          <View style={[styles.iconContainer, { backgroundColor: typeStyle.bg }]}>
            <Ionicons
              name={getIconForType(item.type) as any}
              size={24}
              color={typeStyle.icon}
            />
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title || 'Recent Activity'}
              </Text>

              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: statusStyle.bg },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: statusStyle.text },
                  ]}
                >
                  {item.status || 'Update'}
                </Text>
              </View>
            </View>

            <Text style={styles.desc}>
              {(() => {
                const isMissedPickup = item.title?.toLowerCase().includes('missed pickup');
                const fallbackMsg = `Dear Donor,\n\nWe sincerely apologize for not being able to meet the scheduled pickup date. If possible, we kindly ask you to reschedule your preferred date and time.\n\nHow to reschedule:\n1. Log in to your account\n2. Click Donate on the Navigation Bar\n3. Under Upcoming Pickups, click Edit and update the date and time\n\nThank you for your understanding and cooperation.`;
                if (isMissedPickup && (!item.description || item.description.trim() === '')) {
                  return fallbackMsg;
                }
                return item.description || 'No description available.';
              })()}
            </Text>

            <View style={styles.bottomMetaRow}>
              <Text style={styles.typeText}>{item.type || 'Activity'}</Text>
              <View style={styles.dot} />
              <Text style={styles.timeText}>{item.time_ago || 'Just now'}</Text>
            </View>
          </View>
        </View>

        {index !== activities.length - 1 && <View style={styles.cardDivider} />}
      </View>
    );
  };

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#00592d' }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.greenHeader}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                navigation.canGoBack()
                  ? navigation.goBack()
                  : navigation.navigate('Home')
              }
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerIcons}>
              <NotificationBell navigation={navigation} color="#FFFFFF" size={25} />
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => navigation.openDrawer?.()}
              >
                <Ionicons name="menu-outline" size={30} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.pageTitle}>Recent Activity</Text>
          <Text style={styles.pageSubtitle}>
            Track your latest donations and impact updates
          </Text>
        </View>

        <View style={styles.whiteSheet}>
          {isLoading && !refreshing ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="large" color="#00592d" />
            </View>
          ) : (
            <FlatList
              data={activities}
              keyExtractor={(item, index) => `${item.id || index}`}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                activities.length > 0 ? (
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryLeft}>
                      <Text style={styles.summaryLabel}>Total Updates</Text>
                      <Text style={styles.summaryValue}>{activities.length}</Text>
                    </View>

                    <View style={styles.summaryRight}>
                      <Ionicons
                        name="time-outline"
                        size={18}
                        color="#00592d"
                      />
                      <Text style={styles.summaryRightText}>Latest Activity</Text>
                    </View>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons
                      name="documents-outline"
                      size={42}
                      color="#00592d"
                    />
                  </View>
                  <Text style={styles.emptyTitle}>No Activities Yet</Text>
                  <Text style={styles.emptyDesc}>
                    Your donations, requests, and impact updates will appear here.
                  </Text>
                </View>
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#00592d']}
                  tintColor="#00592d"
                />
              }
            />
          )}
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

  greenHeader: {
    backgroundColor: '#00592d',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 26,
  },

  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerIconButton: {
    marginLeft: 12,
  },

  pageTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },

  pageSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 20,
  },

  whiteSheet: {
    flex: 1,
    backgroundColor: '#F6F7F9',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
  },

  loaderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  summaryLeft: {
    flex: 1,
  },

  summaryLabel: {
    fontSize: 12,
    color: '#7A7A7A',
    fontWeight: '700',
    marginBottom: 4,
  },

  summaryValue: {
    fontSize: 26,
    color: '#00592d',
    fontWeight: '800',
  },

  summaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },

  summaryRightText: {
    marginLeft: 6,
    color: '#1E583A',
    fontSize: 12,
    fontWeight: '800',
  },

  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  activityTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  contentContainer: {
    flex: 1,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },

  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#2D2A26',
    marginRight: 8,
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },

  desc: {
    fontSize: 13.5,
    color: '#6E6E6E',
    lineHeight: 20,
    marginBottom: 10,
  },

  bottomMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  typeText: {
    fontSize: 12,
    color: '#00592d',
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A0A0A0',
    marginHorizontal: 8,
  },

  timeText: {
    fontSize: 12,
    color: '#909090',
    fontWeight: '600',
  },

  cardDivider: {
    marginTop: 14,
    height: 1,
    backgroundColor: '#F2F2F2',
    display: 'none',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 90,
    paddingHorizontal: 30,
  },

  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#2D2A26',
    marginBottom: 8,
  },

  emptyDesc: {
    fontSize: 14,
    color: '#7A7A7A',
    textAlign: 'center',
    lineHeight: 21,
  },
});