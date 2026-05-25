import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import NotificationBell from '../../components/NotificationBell';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Computes the "effective" display status for a request.
 *
 * Rules:
 *  - DB status = 'Approved' / 'Accepted' / 'Allocated'  AND  delivery_date_time exists
 *    AND  the scheduled delivery time has already passed  →  'In Transit'
 *  - DB status = 'Approved' / 'Accepted' / 'Allocated'  with NO delivery_date_time
 *    OR  the scheduled time has NOT yet passed  →  'Approved'
 *  - DB status = 'Cancelled' / 'Canceled'  →  'Cancelled'
 *  - DB status = 'Completed'  →  'Completed'
 *  - DB status = 'Pending'  →  'Pending'
 *  - Everything else (Rejected, Denied …)  →  'Rejected'
 */
function getEffectiveStatus(req: any): string {
  const raw = (req.status || 'PENDING').toUpperCase().trim();

  if (['CANCELLED', 'CANCELED'].includes(raw)) return 'Cancelled';
  if (raw === 'COMPLETED') return 'Completed';
  if (raw === 'PENDING') return 'Pending';

  if (['APPROVED', 'ACCEPTED', 'ALLOCATED', 'URGENT'].includes(raw)) {
    if (req.delivery_date_time) {
      const deliveryTime = new Date(req.delivery_date_time).getTime();
      const now = Date.now();
      if (now >= deliveryTime) {
        return 'In Transit';
      }
    }
    return 'Approved';
  }

  // Rejected / Denied / etc.
  if (
    ['REJECTED', 'DENIED', 'DECLINED', 'REFUSED', 'DISAPPROVED'].includes(raw) ||
    raw.includes('REJECT') ||
    raw.includes('DEN') ||
    raw.includes('DECLIN')
  ) {
    return 'Rejected';
  }

  return 'Pending';
}

function getStatusColor(effectiveStatus: string): string {
  switch (effectiveStatus) {
    case 'Pending':    return '#A87919';
    case 'Approved':   return '#00592d';
    case 'In Transit': return '#1565C0';
    case 'Completed':  return '#00592d';
    case 'Cancelled':  return '#C0392B';
    case 'Rejected':   return '#C0392B';
    default:           return '#555555';
  }
}

function getStatusBadgeColor(effectiveStatus: string): string {
  switch (effectiveStatus) {
    case 'Pending':    return '#FFF8E7';
    case 'Approved':   return '#E8F5E9';
    case 'In Transit': return '#E3F2FD';
    case 'Completed':  return '#E8F5E9';
    case 'Cancelled':  return '#FFEBEE';
    case 'Rejected':   return '#FFEBEE';
    default:           return '#F5F5F5';
  }
}

function getUrgencyColor(level: string): string {
  const l = (level || '').toUpperCase();
  if (l === 'HIGH') return '#F05858';
  if (l === 'MEDIUM') return '#E67E22';
  if (l === 'LOW') return '#3498DB';
  return '#888888';
}

function formatDeliveryDateTime(iso: string | null): string {
  if (!iso) return 'Not yet scheduled';
  const d = new Date(iso);
  return d.toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

const FILTERS = ['All', 'Pending', 'Approved', 'In Transit', 'Completed', 'Cancelled'] as const;
type FilterType = typeof FILTERS[number];

export default function TrackMyRequest({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('All');
  const [requestsData, setRequestsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
    FOOD: true,
    FINANCIAL: false,
  });

  // Timer that re-computes effective statuses every 30 s (catches In Transit transitions live)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', fetchRequests);
    fetchRequests();
    return () => unsubscribeFocus();
  }, [navigation]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const res = await ApiService.getMyRequests();
      if (res.data.success) {
        setRequestsData(res.data.requests);
      }
    } catch (error) {
      console.error('Failed to fetch requests', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRequest = (id: number) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await ApiService.cancelBeneficiaryRequest(id);
            if (res.data.success) {
              fetchRequests();
            } else {
              Alert.alert('Error', res.data.message || 'Failed to cancel request.');
            }
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Connection error.');
          }
        },
      },
    ]);
  };

  const handleReceivedRequest = (id: number) => {
    Alert.alert(
      'Confirm Receipt',
      'Are you sure you have received this request? This action cannot be undone.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Yes, I Received It',
          onPress: async () => {
            try {
              const res = await ApiService.completeBeneficiaryRequest(id);
              if (res.data.success) {
                Alert.alert('Thank you!', 'Your request has been marked as received.');
                fetchRequests();
              } else {
                Alert.alert('Error', res.data.message || 'Failed to complete request.');
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Connection error.');
            }
          },
        },
      ]
    );
  };

  const toggleGroup = (group: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Filter requests based on selected tab — re-evaluated on every tick (for In Transit)
  const filteredRequests = requestsData.filter(req => {
    if (selectedFilter === 'All') return true;
    return getEffectiveStatus(req) === selectedFilter;
  });

  const financialRequests = filteredRequests.filter(req => req.type?.toLowerCase() === 'financial');
  const foodRequests = filteredRequests.filter(req => req.type?.toLowerCase() !== 'financial');

  const renderSummaryRow = (label: string, value: string | number | null | undefined) => (
    <View style={styles.reportTableRow}>
      <Text style={styles.reportTableCellLabel}>{label}</Text>
      <Text style={styles.reportTableCellValue}>{value || 'N/A'}</Text>
    </View>
  );

  const renderRequestCard = (req: any, idx: number, isFirst: boolean) => {
    const effectiveStatus = getEffectiveStatus(req);
    const statusColor = getStatusColor(effectiveStatus);
    const statusBg = getStatusBadgeColor(effectiveStatus);
    const isFood = req.type?.toLowerCase() !== 'financial';

    return (
      <View key={req.id}>
        {!isFirst && <View style={styles.groupItemDivider} />}

        {/* Title + Status Badge */}
        <View style={styles.titleStatusRow}>
          <Text style={styles.reportMainTitle} numberOfLines={2}>
            {req.request_name || 'Untitled Request'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {effectiveStatus.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Details Table */}
        <View style={styles.reportTable}>
          <View style={styles.reportTableRow}>
            <Text style={styles.reportTableCellLabel}>Urgency</Text>
            <Text style={[styles.reportTableCellValue, { color: getUrgencyColor(req.urgency || 'UNKNOWN'), fontWeight: 'bold' }]}>
              {req.urgency?.toUpperCase() || 'N/A'}
            </Text>
          </View>

          {isFood && renderSummaryRow('Food Categories', req.food_type)}

          {isFood && Array.isArray(req.food_items) && req.food_items.length > 0 && (
            <View style={styles.reportTableRow}>
              <Text style={styles.reportTableCellLabel}>Food Items</Text>
              <View style={{ flex: 1.8 }}>
                {req.food_items.map((item: any, i: number) => (
                  <Text key={i} style={[styles.reportTableCellValue, i > 0 && { marginTop: 4 }]}>
                    {item.food_name || item.name || 'Unknown'} — {item.qty ?? item.quantity ?? 0} {item.unit || ''}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {isFood && renderSummaryRow(
            'Quantity',
            req.quantity ? `${req.quantity} ${req.unit && req.unit !== 'null' ? req.unit : ''}`.trim() : null
          )}

          {!isFood && renderSummaryRow('Amount Needed', req.amount ? `₱${req.amount}` : null)}

          {renderSummaryRow('Target Population', req.population)}
          {renderSummaryRow('Age Range', req.age_min && req.age_max ? `${req.age_min}–${req.age_max} Years` : 'All Ages')}
          {renderSummaryRow('Date Needed', req.request_date ? new Date(req.request_date).toLocaleDateString('en-PH') : null)}
          {renderSummaryRow('Date Submitted', req.created_at ? new Date(req.created_at).toLocaleDateString('en-PH') : null)}

          {/* Scheduled Delivery — shown once approved */}
          {['Approved', 'In Transit', 'Completed'].includes(effectiveStatus) && (
            <View style={styles.reportTableRow}>
              <Text style={styles.reportTableCellLabel}>Scheduled Delivery</Text>
              <Text style={[
                styles.reportTableCellValue,
                effectiveStatus === 'In Transit' ? { color: '#1565C0', fontWeight: '700' } : {},
              ]}>
                {formatDeliveryDateTime(req.delivery_date_time)}
              </Text>
            </View>
          )}

          <View style={styles.reportTableRow}>
            <Text style={styles.reportTableCellLabel}>Address</Text>
            <Text style={styles.reportTableCellValue}>
              {[req.street, req.barangay, req.city, req.zip_code].filter(Boolean).join(', ') || 'N/A'}
            </Text>
          </View>
        </View>

        {/* Action Row */}
        <View style={styles.actionRowContainer}>
          {/* Cancel — only when Pending */}
          {effectiveStatus === 'Pending' && (
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.8}
              onPress={() => handleCancelRequest(req.id)}
            >
              <Text style={styles.cancelBtnText}>Cancel This Request</Text>
            </TouchableOpacity>
          )}

          {/* Received — only when In Transit */}
          {effectiveStatus === 'In Transit' && (
            <TouchableOpacity
              style={styles.receivedBtn}
              activeOpacity={0.8}
              onPress={() => handleReceivedRequest(req.id)}
            >
              <Ionicons name="checkmark-circle" size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.receivedBtnText}>I Received This</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Green status-bar fill */}
      <View style={{ height: insets.top, backgroundColor: '#00592d' }} />

      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>

        {/* Header */}
        <View style={styles.topHeader}>
          <View style={styles.headerRow}>
            <Image source={require('../../assets/images/logo/logowhite.png')} style={{ width: 170, height: 58 }} resizeMode="contain" />
            <View style={styles.headerIcons}>
              <NotificationBell navigation={navigation} color="#FFF" size={26} />
              <TouchableOpacity onPress={() => navigation.openDrawer()}>
                <Ionicons name="menu" size={34} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: '#FFF', opacity: 0.3, marginHorizontal: -20, marginTop: 5, marginBottom: 15 }} />
          <View style={styles.headerTitles}>
            <Text style={styles.mainTitle}>My Request</Text>
            <Text style={styles.subTitle}>View and track the status of your submitted requests.</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterPill, selectedFilter === filter ? styles.filterPillActive : styles.filterPillInactive]}
                onPress={() => setSelectedFilter(filter)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, selectedFilter === filter ? styles.filterTextActive : styles.filterTextInactive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#00592d" />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.reportContainer}>

              {/* FOOD REQUESTS */}
              <View style={styles.reportSection}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportHeaderType}>FOOD REQUEST</Text>
                  <TouchableOpacity onPress={() => toggleGroup('FOOD')} style={styles.toggleSquareBtn}>
                    <Ionicons name={expandedGroups['FOOD'] ? 'chevron-up' : 'chevron-down'} size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {expandedGroups['FOOD'] && (
                  <View>
                    {foodRequests.length > 0 ? (
                      foodRequests.map((req, idx) => renderRequestCard(req, idx, idx === 0))
                    ) : (
                      <Text style={styles.emptyText}>No food requests found.</Text>
                    )}
                  </View>
                )}
              </View>

              {/* FINANCIAL REQUESTS */}
              <View style={styles.reportSection}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportHeaderType}>FINANCIAL REQUEST</Text>
                  <TouchableOpacity onPress={() => toggleGroup('FINANCIAL')} style={styles.toggleSquareBtn}>
                    <Ionicons name={expandedGroups['FINANCIAL'] ? 'chevron-up' : 'chevron-down'} size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {expandedGroups['FINANCIAL'] && (
                  <View>
                    {financialRequests.length > 0 ? (
                      financialRequests.map((req, idx) => renderRequestCard(req, idx, idx === 0))
                    ) : (
                      <Text style={styles.emptyText}>No financial requests found.</Text>
                    )}
                  </View>
                )}
              </View>

            </View>
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    backgroundColor: '#00592d',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 25,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  headerTitles: {
    alignItems: 'center',
    marginTop: 15,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#E8A835',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },

  // Filters
  filterWrapper: {
    marginTop: 25,
    marginBottom: 15,
  },
  filterScroll: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 10,
  },
  filterPillActive: {
    backgroundColor: '#E8A835',
  },
  filterPillInactive: {
    backgroundColor: '#F3F3F3',
  },
  filterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterTextInactive: {
    color: '#444444',
  },

  scrollContent: { paddingTop: 10 },

  // Report layout
  reportContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
  },
  reportSection: {
    borderTopWidth: 2,
    borderTopColor: '#222222',
    borderBottomWidth: 8,
    borderBottomColor: '#F5F5F5',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportHeaderType: {
    fontSize: 11,
    fontWeight: '800',
    color: '#777777',
    letterSpacing: 1,
  },
  toggleSquareBtn: {
    backgroundColor: '#D87A38',
    width: 22,
    height: 16,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  groupItemDivider: {
    height: 1,
    backgroundColor: '#DDDDDD',
    marginVertical: 25,
  },
  reportMainTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.3,
    marginRight: 10,
  },

  // Status badge (pill)
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Table
  reportTable: {
    borderTopWidth: 1,
    borderTopColor: '#DDDDDD',
  },
  reportTableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  reportTableCellLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  reportTableCellValue: {
    flex: 1.8,
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },

  // Actions
  actionRowContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    color: '#C0392B',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  receivedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1565C0',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  receivedBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  emptyText: {
    textAlign: 'center',
    paddingVertical: 30,
    color: '#888888',
    fontSize: 14,
    fontWeight: '500',
  },
});
