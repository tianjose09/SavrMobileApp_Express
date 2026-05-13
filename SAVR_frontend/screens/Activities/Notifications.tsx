import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ApiService } from '../../services/api';

type NotificationItem = {
  id: number;
  type: 'financial' | 'food' | 'service' | 'badge' | 'system';
  title: string;
  time: string;
  desc: string;
};

function getTypeConfig(type: NotificationItem['type']) {
  switch (type) {
    case 'financial':
      return { icon: 'card-outline', bg: '#E8F5E9', color: '#00592d' };
    case 'food':
      return { icon: 'restaurant-outline', bg: '#FFF3E0', color: '#E65100' };
    case 'service':
      return { icon: 'people-outline', bg: '#E3F2FD', color: '#1565C0' };
    case 'badge':
      return { icon: 'ribbon-outline', bg: '#FFF8E1', color: '#B8860B' };
    case 'system':
      return { icon: 'megaphone-outline', bg: '#F3E5F5', color: '#7B1FA2' };
    default:
      return { icon: 'notifications-outline', bg: '#F3F4F6', color: '#6B7280' };
  }
}

export default function Notifications({ navigation }: any) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await ApiService.getNotifications();
      if (res?.data?.success) {
        setNotifications(res.data.notifications || []);
      }
    } catch (e) {
      console.error('Notifications fetch error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRead = async (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await ApiService.deleteNotification(id);
    } catch {
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications([]);
    try {
      await ApiService.deleteAllNotifications();
    } catch {
      fetchNotifications();
    }
  };

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#00592d' }} />
      <SafeAreaView style={styles.container}>
        {/* Green Header */}
        <View style={styles.greenHeader}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')
              }
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            {notifications.length > 0 && (
              <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.pageTitle}>Notifications</Text>
          <Text style={styles.pageSubtitle}>
            {notifications.length > 0
              ? `You have ${notifications.length} unread notification${notifications.length > 1 ? 's' : ''}`
              : 'You are all caught up!'}
          </Text>
        </View>

        {/* White Sheet */}
        <View style={styles.whiteSheet}>
          {isLoading ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="large" color="#00592d" />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={40} color="#00592d" />
              </View>
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptyDesc}>
                You're all caught up! Notifications about your donations and badges will appear here.
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {notifications.map((item) => {
                const cfg = getTypeConfig(item.type);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.card}
                    activeOpacity={0.75}
                    onPress={() => handleRead(item.id)}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
                    </View>

                    <View style={styles.cardBody}>
                      <View style={styles.cardTopRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.cardTime}>{item.time}</Text>
                      </View>
                      <Text style={styles.cardDesc}>{item.desc}</Text>
                      <Text style={styles.tapHint}>Tap to dismiss</Text>
                    </View>

                    <View style={styles.unreadDot} />
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
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

  markAllBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },

  markAllText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 20,
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

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 100,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: '#00592d',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00592d',
    position: 'absolute',
    top: 14,
    right: 14,
  },

  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },

  cardBody: {
    flex: 1,
  },

  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
    gap: 6,
  },

  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
  },

  cardTime: {
    fontSize: 11,
    color: '#909090',
    fontWeight: '500',
    flexShrink: 0,
  },

  cardDesc: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 6,
  },

  tapHint: {
    fontSize: 10,
    color: '#00592d',
    fontWeight: '700',
    opacity: 0.7,
  },
});
