import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { ApiService } from '../../services/api';

const formatTimeSlotTo12Hour = (timeSlotStr: string | null | undefined): string => {
  if (!timeSlotStr) return 'Anytime';
  if (timeSlotStr.toUpperCase().includes('AM') || timeSlotStr.toUpperCase().includes('PM')) {
    return timeSlotStr;
  }
  const convertSingleTime = (timeStr: string) => {
    const trimmed = timeStr.trim();
    if (!trimmed) return '';
    const parts = trimmed.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1] || '0', 10);
    if (isNaN(hours)) return trimmed;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${strMinutes} ${ampm}`;
  };
  if (timeSlotStr.includes(' - ')) {
    const parts = timeSlotStr.split(' - ');
    const start = convertSingleTime(parts[0]);
    const end = convertSingleTime(parts[1]);
    return start && end ? `${start} - ${end}` : start || end || timeSlotStr;
  }
  return convertSingleTime(timeSlotStr);
};

type Pickup = {
  id: number;
  status: string;
  mode?: string;
  preferred_date: string | null;
  time_slot: string;
  pickup_address: string | null;
  created_at: string;
};

export default function AllUpcomingPickups({ navigation }: any) {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchPickups = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ApiService.getUpcomingPickups();
      if (res?.data?.success) {
        const APPROVED_STATUSES = ['approved', 'accepted', 'scheduled', 'pending'];
        const sorted = (res.data.pickups as Pickup[])
          .filter(p => APPROVED_STATUSES.includes((p.status || '').toLowerCase()))
          .sort((a, b) => {
            const da = new Date(a.created_at).getTime();
            const db2 = new Date(b.created_at).getTime();
            return db2 - da;
          });
        setPickups(sorted);
      }
    } catch (e) {
      console.warn('Failed to fetch pickups', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchPickups);
    fetchPickups();
    return unsub;
  }, [navigation, fetchPickups]);

  const handleConfirmDelivery = async (pickup: Pickup) => {
    Alert.alert(
      'Confirm Delivery',
      'Are you sure you want to confirm that you have delivered this donation to the food bank?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActionLoading(pickup.id);
            try {
              // @ts-ignore
              const res = await ApiService.confirmDelivery(pickup.id);
              if (res?.data?.success) {
                Alert.alert('Delivery Confirmed', 'Thank you so much for your delivery! The record is now completed.');
                fetchPickups();
              } else {
                Alert.alert('Error', res?.data?.message || 'Failed to confirm delivery.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'An error occurred while confirming delivery.');
            } finally {
              setActionLoading(null);
            }
          }
        }
      ]
    );
  };

  const handleReportArrival = async (pickup: Pickup) => {
    setActionLoading(pickup.id);
    try {
      // @ts-ignore
      const res = await ApiService.reportArrival(pickup.id);
      if (res?.data?.success) {
        Alert.alert('Arrival Sent', 'Staff has been notified that you have arrived with the donation!');
      } else {
        Alert.alert('Error', res?.data?.message || 'Failed to report arrival.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'An error occurred while reporting arrival.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePickup = (pickup: Pickup) => {
    const isScheduledOrApproved = ['scheduled', 'approved'].includes(pickup.status.toLowerCase());

    Alert.alert(
      isScheduledOrApproved ? 'Decline Scheduled Pickup' : 'Cancel Pickup',
      isScheduledOrApproved 
        ? 'Are you sure you want to decline this scheduled pickup? Staff will be notified.'
        : 'Are you sure you want to cancel/delete this pickup request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: isScheduledOrApproved ? 'Yes, Decline' : 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(pickup.id);
            try {
              let res;
              if (isScheduledOrApproved) {
                // @ts-ignore
                res = await ApiService.declinePickup(pickup.id);
              } else {
                res = await ApiService.deletePickup(pickup.id);
              }
              if (res?.data?.success) {
                Alert.alert('Success', isScheduledOrApproved ? 'Pickup declined successfully.' : 'Pickup deleted successfully.');
                fetchPickups();
              } else {
                Alert.alert('Error', res?.data?.message || 'Failed to cancel pickup.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'An error occurred while cancelling pickup.');
            } finally {
              setActionLoading(null);
            }
          }
        }
      ]
    );
  };

  const formatDisplayDate = (dateStr: string | null) => {
    if (!dateStr) return 'Date TBD';
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
  };

  const getStatusColor = (status: string) => {
    if (status === 'scheduled') return '#00592d';
    if (status === 'pending') return '#D17C31';
    if (status === 'missed') return '#C62828';
    return '#888';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'missed') return 'Missed';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#00592d' }} edges={['top']} />
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F3F3' }} edges={['bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upcoming Pickups & Delivery</Text>
          <View style={{ width: 40 }} />
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#00592d" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {pickups.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="cube-outline" size={52} color="#B0B0B0" />
                <Text style={styles.emptyText}>No upcoming pickups or deliveries found.</Text>
              </View>
            ) : (
              pickups.map((pickup, idx) => {
                const renderRightActions = () => {
                  const isDeclinable = ['scheduled', 'approved'].includes(pickup.status.toLowerCase());
                  return (
                    <TouchableOpacity
                      style={[styles.swipeDeleteAction, isDeclinable && { backgroundColor: '#D97706' }]}
                      onPress={() => handleDeletePickup(pickup)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={isDeclinable ? "close-circle" : "trash"} size={22} color="#FFF" />
                      <Text style={styles.swipeDeleteText}>{isDeclinable ? 'Decline' : 'Delete'}</Text>
                    </TouchableOpacity>
                  );
                };

                return (
                  <Swipeable
                    key={pickup.id}
                    renderRightActions={renderRightActions}
                    overshootRight={false}
                    friction={2}
                  >
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          <View style={styles.cardNumberBadge}>
                            <Text style={styles.cardNumberText}>#{idx + 1}</Text>
                          </View>
                          {pickup.mode && (
                            <View style={[
                              styles.modeBadge,
                              { 
                                backgroundColor: pickup.mode === 'delivery' ? '#EFF6FF' : '#F0FDF4',
                                borderColor: pickup.mode === 'delivery' ? '#BFDBFE' : '#BBF7D0'
                              }
                            ]}>
                              <Text style={[
                                styles.modeText,
                                { color: pickup.mode === 'delivery' ? '#1D4ED8' : '#15803D' }
                              ]}>
                                {pickup.mode === 'delivery' ? 'Delivery' : 'Pickup'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(pickup.status) + '20' }]}>
                          <View style={[styles.statusDot, { backgroundColor: getStatusColor(pickup.status) }]} />
                          <Text style={[styles.statusText, { color: getStatusColor(pickup.status) }]}>
                            {getStatusLabel(pickup.status)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardBody}>
                        <View style={styles.infoRow}>
                          <Ionicons name="calendar-outline" size={16} color="#00592d" />
                          <Text style={styles.infoLabel}>Date:</Text>
                          <Text style={styles.infoValue}>{formatDisplayDate(pickup.preferred_date)}</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Ionicons name="time-outline" size={16} color="#00592d" />
                          <Text style={styles.infoLabel}>Time:</Text>
                          <Text style={styles.infoValue}>{formatTimeSlotTo12Hour(pickup.time_slot)}</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Ionicons name="location-outline" size={16} color="#00592d" />
                          <Text style={styles.infoLabel}>Address:</Text>
                          <Text style={styles.infoValue} numberOfLines={2}>
                            {pickup.pickup_address || 'No address provided'}
                          </Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Ionicons name="time-outline" size={16} color="#888" />
                          <Text style={styles.infoLabelGray}>Submitted:</Text>
                          <Text style={styles.infoValueGray}>{pickup.created_at}</Text>
                        </View>

                        {pickup.mode === 'delivery' && (
                          <>
                            <View style={styles.deliveryReminder}>
                              <Ionicons name="information-circle-outline" size={16} color="#92400E" />
                              <Text style={styles.deliveryReminderText}>
                                Reminder: You scheduled to deliver this donation to the food bank yourself.
                              </Text>
                            </View>

                            <View style={styles.deliveryActions}>
                              <TouchableOpacity
                                style={[styles.actionBtn, styles.imHereBtn]}
                                onPress={() => handleReportArrival(pickup)}
                                disabled={actionLoading !== null}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.imHereText}>I'm Here</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.actionBtn, styles.confirmBtn]}
                                onPress={() => handleConfirmDelivery(pickup)}
                                disabled={actionLoading !== null}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.confirmText}>Confirm Delivery</Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  </Swipeable>
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#00592d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 130,
  },

  emptyWrap: {
    marginTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 14,
    color: '#8A8A8A',
    fontSize: 15,
    fontWeight: '600',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FBF9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EF',
  },
  cardNumberBadge: {
    backgroundColor: '#00592d',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
  },
  cardNumberText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D4A3A',
    minWidth: 50,
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    flexWrap: 'wrap',
  },
  infoLabelGray: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9A9A9A',
    minWidth: 62,
  },
  infoValueGray: {
    fontSize: 12,
    color: '#B0B0B0',
    flex: 1,
  },
  swipeDeleteAction: {
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 18,
    marginBottom: 16,
  },
  swipeDeleteText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  modeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  deliveryReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    gap: 8,
  },
  deliveryReminderText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  deliveryActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  imHereBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#00592d',
  },
  imHereText: {
    color: '#00592d',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    backgroundColor: '#00592d',
    borderColor: '#00592d',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
