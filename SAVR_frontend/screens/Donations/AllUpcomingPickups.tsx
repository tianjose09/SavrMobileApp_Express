import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ApiService } from '../../services/api';

type Pickup = {
  id: number;
  status: string;
  preferred_date: string | null;
  time_slot: string;
  pickup_address: string | null;
  created_at: string;
};

export default function AllUpcomingPickups({ navigation }: any) {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPickup, setEditingPickup] = useState<Pickup | null>(null);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editTime, setEditTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(7, 0, 0, 0); return d;
  });
  const [editAddress, setEditAddress] = useState('');
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPickups = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ApiService.getUpcomingPickups();
      if (res?.data?.success) {
        // Sort latest to oldest by created_at descending (already comes DESC from backend, but reinforce)
        const sorted = (res.data.pickups as Pickup[]).sort((a, b) => {
          const da = new Date(a.created_at).getTime();
          const db2 = new Date(b.created_at).getTime();
          return db2 - da;
        });
        setPickups(sorted);
      }
    } catch (e) {
      console.error('Failed to fetch pickups', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchPickups);
    fetchPickups();
    return unsub;
  }, [navigation, fetchPickups]);

  const handleDeletePickup = (pickup: Pickup) => {
    Alert.alert(
      'Delete Pickup',
      'Are you sure you want to delete this pickup? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deletePickup(pickup.id);
              setPickups(prev => prev.filter(p => p.id !== pickup.id));
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message || 'Failed to delete pickup.');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (pickup: Pickup) => {
    setEditingPickup(pickup);
    // Parse date
    if (pickup.preferred_date) {
      const [y, m, d] = pickup.preferred_date.split('-').map(Number);
      setEditDate(new Date(y, m - 1, d));
    } else {
      setEditDate(new Date());
    }
    // Parse time from time_slot e.g. "07:00 - 08:00" or "07:00:00"
    const timeStr = (pickup.time_slot || '07:00').split(' ')[0].substring(0, 5);
    const [hh, mm] = timeStr.split(':').map(Number);
    const t = new Date(); t.setHours(hh || 7, mm || 0, 0, 0);
    setEditTime(t);
    setEditAddress(pickup.pickup_address || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPickup) return;
    setIsSaving(true);
    try {
      const preferredDate = editDate.toISOString().split('T')[0];
      const timeSlot = editTime.toTimeString().split(' ')[0].substring(0, 5);
      await ApiService.updatePickup(editingPickup.id, {
        preferred_date: preferredDate,
        time_slot: timeSlot,
        pickup_address: editAddress,
        schedule_type: editingPickup.status,
      });
      setEditModalVisible(false);
      fetchPickups();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update pickup.');
    } finally {
      setIsSaving(false);
    }
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
    return '#888';
  };

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#00592d' }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F3F3' }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>All Upcoming Pickups</Text>
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
                <Text style={styles.emptyText}>No upcoming pickups found.</Text>
              </View>
            ) : (
              pickups.map((pickup, idx) => (
                <View key={pickup.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardNumberBadge}>
                      <Text style={styles.cardNumberText}>#{idx + 1}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(pickup.status) + '20' }]}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(pickup.status) }]} />
                      <Text style={[styles.statusText, { color: getStatusColor(pickup.status) }]}>
                        {pickup.status.charAt(0).toUpperCase() + pickup.status.slice(1)}
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
                      <Text style={styles.infoValue}>{pickup.time_slot || 'TBD'}</Text>
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
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => openEditModal(pickup)}
                    >
                      <Ionicons name="pencil-outline" size={15} color="#FFFFFF" />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeletePickup(pickup)}
                    >
                      <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* Edit Modal */}
        <Modal
          visible={editModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Pickup</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#444" />
                </TouchableOpacity>
              </View>

              {/* Date */}
              <Text style={styles.modalLabel}>Preferred Date</Text>
              <TouchableOpacity
                style={styles.modalInput}
                onPress={() => Platform.OS !== 'ios' && setDatePickerMode('date')}
              >
                <Text style={styles.modalInputText}>{editDate.toLocaleDateString()}</Text>
                {Platform.OS === 'ios' && (
                  <DateTimePicker
                    style={styles.iosPicker}
                    value={editDate}
                    mode="date"
                    display="compact"
                    minimumDate={new Date()}
                    onChange={(_, d) => { if (d) setEditDate(d); }}
                  />
                )}
                <Ionicons name="calendar-outline" size={18} color="#00592d" />
              </TouchableOpacity>

              {/* Time */}
              <Text style={styles.modalLabel}>Time Slot</Text>
              <TouchableOpacity
                style={styles.modalInput}
                onPress={() => Platform.OS !== 'ios' && setDatePickerMode('time')}
              >
                <Text style={styles.modalInputText}>
                  {editTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {Platform.OS === 'ios' && (
                  <DateTimePicker
                    style={styles.iosPicker}
                    value={editTime}
                    mode="time"
                    display="compact"
                    onChange={(_, d) => { if (d) setEditTime(d); }}
                  />
                )}
                <Ionicons name="time-outline" size={18} color="#00592d" />
              </TouchableOpacity>

              {/* Address */}
              <Text style={styles.modalLabel}>Pickup Address</Text>
              <TextInput
                style={styles.modalTextInput}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Enter pickup address"
                placeholderTextColor="#B0B0B0"
                multiline
              />

              <TouchableOpacity
                style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                onPress={handleSaveEdit}
                disabled={isSaving}
              >
                {isSaving
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.saveBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* Android pickers */}
          {Platform.OS !== 'ios' && datePickerMode && (
            <DateTimePicker
              value={datePickerMode === 'date' ? editDate : editTime}
              mode={datePickerMode}
              minimumDate={datePickerMode === 'date' ? new Date() : undefined}
              display="default"
              onChange={(event, selectedDate) => {
                const mode = datePickerMode;
                setDatePickerMode(null);
                if (event.type === 'set' && selectedDate) {
                  if (mode === 'date') setEditDate(selectedDate);
                  else setEditTime(selectedDate);
                }
              }}
            />
          )}
        </Modal>
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
    paddingVertical: 14,
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
    paddingBottom: 40,
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

  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#EEF2EF',
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#00592d',
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#D17C31',
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A2E23',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    marginBottom: 6,
    marginTop: 14,
  },
  modalInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: '#FAFAFA',
  },
  modalInputText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  iosPicker: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.011,
    zIndex: 999,
  },
  modalTextInput: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    minHeight: 72,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA',
  },
  saveBtn: {
    backgroundColor: '#00592d',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
