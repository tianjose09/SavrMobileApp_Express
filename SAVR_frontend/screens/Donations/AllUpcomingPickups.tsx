import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
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
  pickup_now: boolean;
  preferred_date: string | null;
  time_slot: string;
  pickup_address: string | null;
  delivery_note: string | null;
  tracking_link: string | null;
  created_at: string;
};

export default function AllUpcomingPickups({ navigation }: any) {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [deliveryModal, setDeliveryModal] = useState<{ visible: boolean; pickup: Pickup | null; note: string; trackingLink: string }>({
    visible: false, pickup: null, note: '', trackingLink: '',
  });
  const [staffOnWayModal, setStaffOnWayModal] = useState<{ visible: boolean; pickup: Pickup | null }>({
    visible: false, pickup: null,
  });

  const fetchPickups = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ApiService.getUpcomingPickups();
      if (res?.data?.success) {
        const PICKUP_STATUSES = ['approved', 'accepted', 'confirmed', 'scheduled', 'pending', 'in_transit'];
        const sorted = (res.data.pickups as Pickup[])
          .filter(p => PICKUP_STATUSES.includes((p.status || '').toLowerCase()))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

  const openDeliveryModal = (pickup: Pickup) => {
    setDeliveryModal({ visible: true, pickup, note: '', trackingLink: '' });
  };

  const silentRefresh = async () => {
    try {
      const res = await ApiService.getUpcomingPickups();
      if (res?.data?.success) {
        const PICKUP_STATUSES = ['approved', 'accepted', 'confirmed', 'scheduled', 'pending', 'in_transit'];
        const sorted = (res.data.pickups as Pickup[])
          .filter(p => PICKUP_STATUSES.includes((p.status || '').toLowerCase()))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setPickups(sorted);
      }
    } catch {}
  };

  const submitDelivery = async () => {
    const pickup = deliveryModal.pickup;
    if (!pickup) return;
    const noteValue = deliveryModal.note.trim();
    const trackingLinkValue = deliveryModal.trackingLink.trim();
    setDeliveryModal({ visible: false, pickup: null, note: '', trackingLink: '' });
    setActionLoading(pickup.id);
    try {
      // @ts-ignore
      const res = await ApiService.confirmDelivery(pickup.id, noteValue || undefined, trackingLinkValue || undefined);
      if (res?.data?.success) {
        setPickups(prev => prev.map(p =>
          p.id === pickup.id
            ? { ...p, status: 'in_transit', delivery_note: noteValue || null, tracking_link: trackingLinkValue || null }
            : p
        ));
        Alert.alert('Staff Notified', 'The staff has been informed that you are on the way to the warehouse.');
        silentRefresh();
      } else {
        Alert.alert('Error', res?.data?.message || 'Failed to notify staff.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'An error occurred.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineEarly = async (pickup: Pickup) => {
    setStaffOnWayModal({ visible: false, pickup: null });
    setActionLoading(pickup.id);
    try {
      // @ts-ignore
      const res = await ApiService.declineEarly(pickup.id);
      if (res?.data?.success) {
        setPickups(prev => prev.map(p =>
          p.id === pickup.id ? { ...p, status: 'accepted', pickup_now: false } : p
        ));
        Alert.alert('Pickup Declined', 'Staff has been notified. Your pickup is still approved and can be rescheduled.');
        silentRefresh();
      } else {
        Alert.alert('Error', res?.data?.message || 'Failed to decline pickup.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'An error occurred.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePickup = (pickup: Pickup) => {
    const isScheduledOrApproved = ['scheduled', 'approved', 'accepted', 'confirmed'].includes(pickup.status.toLowerCase());

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
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'scheduled') return '#00592d';
    if (s === 'approved' || s === 'accepted' || s === 'confirmed') return '#00592d';
    if (s === 'pending') return '#D17C31';
    if (s === 'in_transit') return '#2E7D32';
    if (s === 'missed') return '#C62828';
    return '#888';
  };

  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'missed') return 'Missed';
    if (s === 'in_transit') return 'In Transit';
    if (s === 'accepted' || s === 'confirmed') return 'Approved';
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
                  if (pickup.mode !== 'delivery' && pickup.pickup_now) {
                    return (
                      <TouchableOpacity
                        style={[styles.swipeDeleteAction, { backgroundColor: '#D97706' }]}
                        onPress={() => setStaffOnWayModal({ visible: true, pickup })}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="close-circle" size={22} color="#FFF" />
                        <Text style={styles.swipeDeleteText}>Decline</Text>
                      </TouchableOpacity>
                    );
                  }
                  if (pickup.status.toLowerCase() === 'pending') {
                    return (
                      <TouchableOpacity
                        style={styles.swipeDeleteAction}
                        onPress={() => handleDeletePickup(pickup)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="trash" size={22} color="#FFF" />
                        <Text style={styles.swipeDeleteText}>Delete</Text>
                      </TouchableOpacity>
                    );
                  }
                  return null;
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
                                backgroundColor: pickup.mode === 'delivery' ? '#FAF5F0' : '#F0FDF4',
                                borderColor: pickup.mode === 'delivery' ? '#EADEC9' : '#BBF7D0'
                              }
                            ]}>
                              <Text style={[
                                styles.modeText,
                                { color: pickup.mode === 'delivery' ? '#8A5E38' : '#15803D' }
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

                        {pickup.mode !== 'delivery' && pickup.pickup_now && (
                          <>
                            <View style={styles.staffOnWayBadge}>
                              <Ionicons name="car-outline" size={15} color="#92400E" />
                              <Text style={styles.staffOnWayText}>Staff picking up TODAY</Text>
                            </View>
                            <View style={styles.declineActionWrapper}>
                              <TouchableOpacity
                                style={[styles.actionBtn, styles.declineBtn]}
                                onPress={() => setStaffOnWayModal({ visible: true, pickup })}
                                disabled={actionLoading !== null}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.declineBtnText}>Decline Pickup</Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        )}

                        {pickup.mode === 'delivery' && (
                          <>
                            <View style={styles.deliveryReminder}>
                              <Ionicons name="information-circle-outline" size={16} color="#92400E" />
                              <Text style={styles.deliveryReminderText}>
                                Reminder: You scheduled to deliver this donation to the food bank yourself.
                              </Text>
                            </View>

                            {pickup.status.toLowerCase() === 'in_transit' ? (
                              <>
                                {pickup.tracking_link ? (
                                  <View style={[styles.deliveryNoteWrap, { marginBottom: 12 }]}>
                                    <Ionicons name="link-outline" size={13} color="#555" style={{ marginRight: 5 }} />
                                    <Text style={styles.deliveryNoteText} numberOfLines={2}>{pickup.tracking_link}</Text>
                                  </View>
                                ) : null}
                                <View style={{
                                  backgroundColor: '#E8F5E9',
                                  borderColor: '#A5D6A7',
                                  borderWidth: 1.5,
                                  borderRadius: 24,
                                  paddingVertical: 12,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexDirection: 'row',
                                  gap: 8,
                                  marginTop: 8,
                                }}>
                                  <Ionicons name="car-outline" size={18} color="#2E7D32" />
                                  <Text style={{ color: '#2E7D32', fontSize: 14, fontWeight: '700' }}>In Transit</Text>
                                </View>
                              </>
                            ) : ['approved', 'accepted', 'confirmed'].includes(pickup.status.toLowerCase()) ? (
                              <View style={styles.deliveryActions}>
                                <TouchableOpacity
                                  style={[styles.actionBtn, styles.confirmBtn, { flex: 1 }]}
                                  onPress={() => openDeliveryModal(pickup)}
                                  disabled={actionLoading !== null}
                                  activeOpacity={0.8}
                                >
                                  {actionLoading === pickup.id
                                    ? <ActivityIndicator size="small" color="#FFF" />
                                    : <Text style={styles.confirmText}>Deliver Now</Text>}
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={{
                                backgroundColor: '#FFF8E7',
                                borderColor: '#FDE68A',
                                borderWidth: 1.5,
                                borderRadius: 24,
                                paddingVertical: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                gap: 8,
                                marginTop: 8,
                              }}>
                                <Ionicons name="time-outline" size={18} color="#92400E" />
                                <Text style={{ color: '#92400E', fontSize: 14, fontWeight: '700' }}>Awaiting Staff Approval</Text>
                              </View>
                            )}
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

      {/* Staff Is On The Way Modal */}
      <Modal
        visible={staffOnWayModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setStaffOnWayModal({ visible: false, pickup: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Ionicons name="car-outline" size={22} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: '#D97706' }]}>Staff Is On The Way!</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              A staff member is already heading to your location to pick up your donation. Are you sure you want to decline?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setStaffOnWayModal({ visible: false, pickup: null })}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Okay, Got It</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#C62828' }]}
                onPress={() => staffOnWayModal.pickup && handleDeclineEarly(staffOnWayModal.pickup)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>Decline Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Deliver Now Modal */}
      <Modal
        visible={deliveryModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeliveryModal(prev => ({ ...prev, visible: false }))}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Ionicons name="car-outline" size={22} color="#00592d" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>On The Way</Text>
              </View>
              <Text style={styles.modalSubtitle}>
                Notify the staff that you are now heading to the warehouse.
              </Text>
              <Text style={styles.modalNoteLabel}>Tracking / Delivery Link <Text style={{ color: '#999', fontWeight: '400' }}>(optional)</Text></Text>
              <TextInput
                style={styles.modalNoteInput}
                placeholder="Enter tracking link or info..."
                placeholderTextColor="#AAAAAA"
                value={deliveryModal.trackingLink}
                onChangeText={(text) => setDeliveryModal(prev => ({ ...prev, trackingLink: text }))}
                multiline
                numberOfLines={3}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setDeliveryModal(prev => ({ ...prev, visible: false }))}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={submitDelivery}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalConfirmText}>Yes, Notify</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  staffOnWayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
    gap: 6,
  },
  staffOnWayText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '700',
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
  declineActionWrapper: {
    marginTop: 14,
  },
  declineBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C62828',
  },
  declineBtnText: {
    color: '#C62828',
    fontSize: 13,
    fontWeight: '700',
  },
  inTransitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  inTransitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1565C0',
  },
  deliveryNoteWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  deliveryNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#555',
    lineHeight: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 22,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#00592d',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 18,
  },
  modalNoteLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  modalNoteInput: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#222',
    backgroundColor: '#FAFAFA',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#777',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#00592d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
