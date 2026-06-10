import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  preferred_date: string | null;
  time_slot: string;
  pickup_address: string | null;
  created_at: string;
};

export default function AllUpcomingPickups({ navigation }: any) {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchPickups = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ApiService.getUpcomingPickups();
      if (res?.data?.success) {
        const sorted = (res.data.pickups as Pickup[]).sort((a, b) => {
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
                  </View>

                </View>
              ))
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

});
