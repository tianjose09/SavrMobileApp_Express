import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type NotificationItem = {
  id: string;
  type: 'financial' | 'food' | 'service' | 'badge' | 'system';
  title: string;
  time: string;
  desc: string;
  read?: boolean;
};

const DONOR_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    type: 'financial',
    title: 'Financial Donation Confirmed',
    time: 'Just now',
    desc: 'Your financial donation of ₱5,000 has been successfully received. Thank you for your generosity!',
    read: false,
  },
  {
    id: '2',
    type: 'food',
    title: 'Food Donation Received',
    time: '2 hours ago',
    desc: 'Your food donation of 30kg of Rice has been received and logged in our system.',
    read: false,
  },
  {
    id: '3',
    type: 'service',
    title: 'Volunteer Service Logged',
    time: '5 hours ago',
    desc: 'Your service volunteer work on May 8, 2026 has been recorded. Thank you for your time and effort!',
    read: false,
  },
  {
    id: '4',
    type: 'food',
    title: 'Pickup Scheduled',
    time: 'Yesterday',
    desc: 'Your food donation pickup is scheduled for tomorrow, May 9, 2026 at 9:00 AM. Please be ready.',
    read: true,
  },
  {
    id: '5',
    type: 'badge',
    title: 'Badge Unlocked',
    time: 'Yesterday',
    desc: 'Congratulations! You have unlocked the "First Step" badge for your first donation. Keep it up!',
    read: true,
  },
  {
    id: '6',
    type: 'financial',
    title: 'Donation Milestone Reached',
    time: '2 days ago',
    desc: 'You have reached a total of ₱10,000 in financial donations. You are making a real difference!',
    read: true,
  },
  {
    id: '7',
    type: 'food',
    title: 'Food Donation Delivered',
    time: '3 days ago',
    desc: 'Your donated 15kg of Canned Goods has been successfully delivered to the beneficiary community.',
    read: true,
  },
  {
    id: '8',
    type: 'system',
    title: 'Community Announcement',
    time: 'Last week',
    desc: 'The next community feeding program is scheduled for May 20, 2026. Join us as a volunteer!',
    read: true,
  },
];

const PK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'pk1',
    type: 'food',
    title: 'Low Stock Alert',
    time: 'Just now',
    desc: '3 inventory items have fallen below the minimum threshold. Restock Eggs, Milk, and Carrots soon.',
    read: false,
  },
  {
    id: 'pk2',
    type: 'food',
    title: 'Donation Received',
    time: '1 hour ago',
    desc: '80 pieces of Carrots and 17 kg of Chicken have been added to your inventory from a new donor.',
    read: false,
  },
  {
    id: 'pk3',
    type: 'system',
    title: 'Meal Service Logged',
    time: '3 hours ago',
    desc: 'Today\'s meal service has been recorded — 120 meals were successfully served to beneficiaries.',
    read: false,
  },
  {
    id: 'pk4',
    type: 'badge',
    title: 'Expiry Warning',
    time: 'Yesterday',
    desc: 'Milk (17 L) is expiring on Jan 30, 2026. Please prioritize its use or arrange for redistribution.',
    read: true,
  },
  {
    id: 'pk5',
    type: 'financial',
    title: 'Inventory Updated',
    time: 'Yesterday',
    desc: '50 kg of Rice and 680 pcs of Bread have been added to inventory. Total items: 7.',
    read: true,
  },
  {
    id: 'pk6',
    type: 'service',
    title: 'New Volunteer Assigned',
    time: '2 days ago',
    desc: 'A volunteer has been assigned to assist your kitchen on May 11, 2026. Check the schedule for details.',
    read: true,
  },
  {
    id: 'pk7',
    type: 'system',
    title: 'Monthly Summary Ready',
    time: '3 days ago',
    desc: 'Your April 2026 kitchen summary is ready. Total meals served: 3,240. View the full report in Summary.',
    read: true,
  },
  {
    id: 'pk8',
    type: 'system',
    title: 'Community Feeding Schedule',
    time: 'Last week',
    desc: 'The next community feeding event is on May 20, 2026. Prepare inventory stocks accordingly.',
    read: true,
  },
];

const BENEFICIARY_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'b1',
    type: 'food',
    title: 'Food Request Approved',
    time: 'Just now',
    desc: 'Your food assistance request for May 9, 2026 has been approved. Please proceed to the pickup point.',
    read: false,
  },
  {
    id: 'b2',
    type: 'system',
    title: 'Pickup Ready',
    time: '1 hour ago',
    desc: 'Your food pack is ready for pickup at Loaves and Fishes Kitchen. Bring your beneficiary ID.',
    read: false,
  },
  {
    id: 'b3',
    type: 'service',
    title: 'Assistance Scheduled',
    time: '4 hours ago',
    desc: 'Your next food assistance is scheduled for May 16, 2026. You will receive a reminder the day before.',
    read: false,
  },
  {
    id: 'b4',
    type: 'food',
    title: 'Request Received',
    time: 'Yesterday',
    desc: 'We have received your food assistance request. Processing usually takes 1-2 business days.',
    read: true,
  },
  {
    id: 'b5',
    type: 'system',
    title: 'Community Feeding Event',
    time: 'Yesterday',
    desc: 'A community feeding event is happening on May 20, 2026 at Barangay Hall. No registration needed.',
    read: true,
  },
  {
    id: 'b6',
    type: 'badge',
    title: 'Profile Verified',
    time: '2 days ago',
    desc: 'Your beneficiary profile has been verified. You are now eligible for full food assistance benefits.',
    read: true,
  },
  {
    id: 'b7',
    type: 'food',
    title: 'Previous Pickup Confirmed',
    time: '4 days ago',
    desc: 'Your food pack pickup on May 5, 2026 has been confirmed and recorded in the system.',
    read: true,
  },
  {
    id: 'b8',
    type: 'system',
    title: 'Program Announcement',
    time: 'Last week',
    desc: 'SAVR has expanded its coverage. New pickup locations are now available in your area.',
    read: true,
  },
];

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

export default function Notifications({ navigation, route }: any) {
  const role = route?.params?.role || 'donor';
  const initialList =
    role === 'pk' ? PK_NOTIFICATIONS :
    role === 'beneficiary' ? BENEFICIARY_NOTIFICATIONS :
    DONOR_NOTIFICATIONS;
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialList);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
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

            {unreadCount > 0 && (
              <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.pageTitle}>Notifications</Text>
          <Text style={styles.pageSubtitle}>
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'You are all caught up!'}
          </Text>
        </View>

        {/* White Sheet */}
        <View style={styles.whiteSheet}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {notifications.map((item) => {
              const cfg = getTypeConfig(item.type);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.card, !item.read && styles.cardUnread]}
                  activeOpacity={0.75}
                  onPress={() => markRead(item.id)}
                >


                  <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.cardTime}>{item.time}</Text>
                    </View>
                    <Text style={styles.cardDesc}>{item.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 40 }} />
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#00592d',
    backgroundColor: '#F0FAF5',
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
    fontWeight: '700',
    color: '#2D2A26',
  },

  cardTitleUnread: {
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
  },
});
