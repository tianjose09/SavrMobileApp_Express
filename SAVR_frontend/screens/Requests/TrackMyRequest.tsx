import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert, LayoutAnimation, UIManager, Platform,
  Modal, TextInput, KeyboardAvoidingView,
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
 *  - DB status = 'Allocated'  →  'In Transit'  (allocated = dispatched/in transit)
 *  - DB status = 'Approved' / 'Accepted' / 'Urgent'  AND  delivery_date_time exists
 *    AND  the scheduled delivery time has already passed  →  'In Transit'
 *  - DB status = 'Approved' / 'Accepted' / 'Urgent'  with NO delivery_date_time
 *    OR  the scheduled time has NOT yet passed  →  'Approved'
 *  - DB status = 'Done'  →  'Completed'
 *  - DB status = 'Cancelled' / 'Canceled'  →  'Rejected'
 *  - DB status = 'Completed'  →  'Completed'
 *  - DB status = 'Pending'  →  'Pending'
 *  - Everything else (Rejected, Denied …)  →  'Rejected'
 */
function getEffectiveStatus(req: any): string {
  const raw = (req.status || 'PENDING').toUpperCase().trim();

  if (['CANCELLED', 'CANCELED'].includes(raw)) return 'Rejected';
  if (raw === 'COMPLETED' || raw === 'DONE') return 'Completed';
  if (raw === 'PENDING') return 'Pending';

  // Explicitly dispatched / allocated / in transit status in DB always means 'In Transit'
  if (['ALLOCATED', 'IN TRANSIT', 'IN_TRANSIT', 'INTRANSIT'].includes(raw)) {
    return 'In Transit';
  }

  // Approved / Accepted requests show as 'Approved' unless the scheduled delivery time has passed
  if (['APPROVED', 'ACCEPTED', 'URGENT'].includes(raw)) {
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
    case 'Pending': return '#A87919';
    case 'Approved': return '#00592d';
    case 'In Transit': return '#A87919';
    case 'Completed': return '#00592d';
    case 'Rejected': return '#C0392B';
    default: return '#555555';
  }
}

function getStatusBadgeColor(effectiveStatus: string): string {
  switch (effectiveStatus) {
    case 'Pending': return '#FFF8E7';
    case 'Approved': return '#E8F5E9';
    case 'In Transit': return '#FFF8E7';
    case 'Completed': return '#E8F5E9';
    case 'Rejected': return '#FFEBEE';
    default: return '#F5F5F5';
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

const FILTERS = ['All', 'Pending', 'Approved', 'In Transit', 'Completed', 'Rejected'] as const;
type FilterType = typeof FILTERS[number];

export default function TrackMyRequest({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('All');
  const [requestsData, setRequestsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
    FOOD: true,
    FINANCIAL: false,
  });
  const [receiptModal, setReceiptModal] = useState<{
    visible: boolean;
    requestId: number | null;
    foodItems: any[];
    receivedItemsMap: Record<string, number>;
    dispatchedItems: any[];
    dispatchedQty: number | null;
    // legacy fallback
    totalQty: number | null;
    receivedQty: number;
    unit: string;
  }>({
    visible: false,
    requestId: null,
    foodItems: [],
    receivedItemsMap: {},
    dispatchedItems: [],
    dispatchedQty: null,
    totalQty: null,
    receivedQty: 0,
    unit: '',
  });
  const [itemInputs, setItemInputs] = useState<Record<string, string>>({});
  const [qtyInput, setQtyInput] = useState('');
  const [remarksInput, setRemarksInput] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState<'complete' | 'partial'>('complete');

  // Timer that re-computes effective statuses every 30 s (catches In Transit transitions live)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      fetchRequests();
      if (route?.params?.filter) {
        setSelectedFilter(route.params.filter);
        navigation.setParams({ filter: undefined });
      }
    });
    fetchRequests();
    if (route?.params?.filter) {
      setSelectedFilter(route.params.filter);
      navigation.setParams({ filter: undefined });
    }
    return () => unsubscribeFocus();
  }, [navigation, route?.params]);

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

  const handleReceivedRequest = (req: any) => {
    const foodItems = Array.isArray(req.food_items) && req.food_items.length > 0 ? req.food_items : [];

    const receivedItemsMap: Record<string, number> = {};
    if (req.received_items) {
      try {
        const existing = Array.isArray(req.received_items)
          ? req.received_items
          : JSON.parse(req.received_items || '[]');
        for (const item of existing) {
          receivedItemsMap[item.food_name] = parseFloat(item.received_qty || '0');
        }
      } catch { }
    }

    const dispatchedItems = Array.isArray(req.dispatched_items) ? req.dispatched_items : [];

    setItemInputs({});
    setQtyInput('');
    setRemarksInput('');

    // Auto-calculate delivery status based on dispatched qty vs requested remaining qty
    let isPartial = false;
    if (foodItems.length > 0) {
      for (const item of foodItems) {
        const name = item.food_name || item.name || 'Unknown';
        const requested = parseFloat(item.qty || item.quantity || '0');
        const alreadyReceived = receivedItemsMap[name] || 0;
        const remaining = Math.max(0, requested - alreadyReceived);
        
        const dispItem = dispatchedItems.find((d: any) => (d.food_name || d.name) === name);
        const dispQty = dispItem ? parseFloat(dispItem.received_qty ?? dispItem.qty ?? dispItem.quantity ?? 0) : remaining;
        
        if (dispQty < remaining) {
          isPartial = true;
          break;
        }
      }
    } else if (req.quantity) {
      const total = parseFloat(req.quantity);
      const alreadyReceived = parseFloat(req.received_quantity || '0');
      const remaining = Math.max(0, total - alreadyReceived);
      const dispQty = req.dispatched_quantity !== null ? parseFloat(req.dispatched_quantity) : remaining;
      if (dispQty < remaining) {
        isPartial = true;
      }
    }

    setDeliveryStatus(isPartial ? 'partial' : 'complete');

    setReceiptModal({
      visible: true,
      requestId: req.id,
      foodItems,
      receivedItemsMap,
      dispatchedItems,
      dispatchedQty: req.dispatched_quantity !== null ? parseFloat(req.dispatched_quantity) : null,
      totalQty: req.quantity ? parseFloat(req.quantity) : null,
      receivedQty: parseFloat(req.received_quantity || '0'),
      unit: req.unit && req.unit !== 'null' ? req.unit : '',
    });
  };

  const handleSubmitReceipt = async () => {
    if (!receiptModal.requestId) return;

    const isComplete = deliveryStatus === 'complete';
    
    // Dynamically build message based on actual database quantities
    let dynamicMsg = '';
    if (isComplete) {
      if (receiptModal.foodItems.length > 0) {
        const list = receiptModal.foodItems.map(item => {
          const name = item.food_name || item.name || 'Unknown';
          const requested = parseFloat(item.qty || item.quantity || '0');
          return `${name} (${requested} ${item.unit || ''})`;
        });
        dynamicMsg = `All items received: ${list.join(', ')}.`;
      } else if (receiptModal.totalQty) {
        dynamicMsg = `All items received: ${receiptModal.totalQty} ${receiptModal.unit || 'units'}.`;
      } else {
        dynamicMsg = "All items have been received.";
      }
    } else {
      if (receiptModal.foodItems.length > 0) {
        const list = receiptModal.foodItems.map(item => {
          const name = item.food_name || item.name || 'Unknown';
          const requested = parseFloat(item.qty || item.quantity || '0');
          const alreadyReceived = receiptModal.receivedItemsMap[name] || 0;
          const dispItem = receiptModal.dispatchedItems.find((d: any) => (d.food_name || d.name) === name);
          const dispQty = dispItem ? parseFloat(dispItem.received_qty ?? dispItem.qty ?? dispItem.quantity ?? 0) : Math.max(0, requested - alreadyReceived);
          const currentTotalReceived = alreadyReceived + dispQty;
          return `${name} (${currentTotalReceived}/${requested} ${item.unit || ''})`;
        });
        dynamicMsg = `Not all requested items have been received. You received ${list.join(', ')} due to lack of supply. Some items are incomplete.`;
      } else if (receiptModal.totalQty) {
        const dispQty = receiptModal.dispatchedQty !== null ? receiptModal.dispatchedQty : (receiptModal.totalQty - receiptModal.receivedQty);
        const currentTotalReceived = receiptModal.receivedQty + dispQty;
        dynamicMsg = `Not all requested items have been received. You received ${currentTotalReceived}/${receiptModal.totalQty} ${receiptModal.unit || 'units'} due to lack of supply. Some items are incomplete.`;
      } else {
        dynamicMsg = "Not all requested items have been received. The delivery was partial due to lack of supply. Some items are incomplete.";
      }
    }

    const finalRemarks = dynamicMsg;

    // Per-item mode
    if (receiptModal.foodItems.length > 0) {
      const receivedItems: { food_name: string; received_qty: number; unit: string }[] = [];
      for (const item of receiptModal.foodItems) {
        const name = item.food_name || item.name || 'Unknown';
        const requested = parseFloat(item.qty || item.quantity || '0');
        const alreadyReceived = receiptModal.receivedItemsMap[name] || 0;
        const remaining = Math.max(0, requested - alreadyReceived);
        
        // Use dispatched value if set, otherwise fallback to remaining (complete)
        const dispItem = receiptModal.dispatchedItems.find((d: any) => (d.food_name || d.name) === name);
        const val = dispItem ? parseFloat(dispItem.received_qty ?? dispItem.qty ?? dispItem.quantity ?? 0) : remaining;
        receivedItems.push({ food_name: name, received_qty: val, unit: item.unit || '' });
      }

      setReceiptModal(m => ({ ...m, visible: false }));
      try {
        const res = await ApiService.completeBeneficiaryRequest(
          receiptModal.requestId, undefined, receivedItems, finalRemarks
        );
        if (res.data.success) {
          if (isComplete) {
            Alert.alert('✅ Request Completed!', dynamicMsg);
          } else {
            Alert.alert('📦 Partial Receipt Recorded', dynamicMsg);
          }
          fetchRequests();
        } else {
          Alert.alert('Error', res.data.message || 'Failed to record receipt.');
        }
      } catch (error: any) {
        Alert.alert('Error', error.response?.data?.message || 'Connection error.');
      }
      return;
    }

    // Legacy single-qty mode
    let receivedQty = 0;
    if (receiptModal.totalQty) {
      const remaining = receiptModal.totalQty - receiptModal.receivedQty;
      receivedQty = receiptModal.dispatchedQty !== null ? receiptModal.dispatchedQty : remaining;
    }

    setReceiptModal(m => ({ ...m, visible: false }));

    try {
      const res = await ApiService.completeBeneficiaryRequest(
        receiptModal.requestId, receivedQty, undefined, finalRemarks
      );
      if (res.data.success) {
        if (isComplete) {
          Alert.alert('✅ Request Completed!', dynamicMsg);
        } else {
          Alert.alert('📦 Partial Receipt Recorded', dynamicMsg);
        }
        fetchRequests();
      } else {
        Alert.alert('Error', res.data.message || 'Failed to record receipt.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Connection error.');
    }
  };

  const toggleGroup = (group: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Filter requests based on selected tab — re-evaluated on every tick (for In Transit)
  const filteredRequests = requestsData.filter(req => {
    if (selectedFilter === 'All') return true;
    // Approved tab matches by raw DB status so the same request shows in both Approved and In Transit
    if (selectedFilter === 'Approved') {
      const raw = (req.status || '').toUpperCase().trim();
      return ['APPROVED', 'ACCEPTED', 'ALLOCATED', 'URGENT', 'IN TRANSIT', 'IN_TRANSIT', 'INTRANSIT'].includes(raw);
    }
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
          {!isFood && req.bank_name && renderSummaryRow('Receiving Method', req.bank_name)}
          {!isFood && req.account_name && renderSummaryRow('Account Name', req.account_name)}
          {!isFood && req.account_number && renderSummaryRow('Account No.', req.account_number)}

          {renderSummaryRow('Target Population', req.population)}
          {renderSummaryRow('Age Range', req.age_min && req.age_max ? `${req.age_min}–${req.age_max} Years` : 'All Ages')}
          {renderSummaryRow('Date Needed', req.request_date ? new Date(req.request_date).toLocaleDateString('en-PH') : null)}
          {renderSummaryRow('Date Submitted', req.created_at ? new Date(req.created_at).toLocaleDateString('en-PH') : null)}

          {/* Scheduled Delivery — shown once in transit */}
          {['In Transit', 'Completed'].includes(effectiveStatus) && (
            <View style={styles.reportTableRow}>
              <Text style={styles.reportTableCellLabel}>Scheduled Delivery</Text>
              <Text style={[
                styles.reportTableCellValue,
                effectiveStatus === 'In Transit' ? { color: '#00592d', fontWeight: '700' } : {},
              ]}>
                {formatDeliveryDateTime(req.delivery_date_time)}
              </Text>
            </View>
          )}

          {/* Received progress — per item when food_items present, otherwise single qty */}
          {effectiveStatus === 'In Transit' && Array.isArray(req.food_items) && req.food_items.length > 0 && (() => {
            const rMap: Record<string, number> = {};
            try {
              const ri = Array.isArray(req.received_items) ? req.received_items : JSON.parse(req.received_items || '[]');
              for (const item of ri) rMap[item.food_name] = parseFloat(item.received_qty || '0');
            } catch { }
            return (
              <View style={styles.reportTableRow}>
                <Text style={styles.reportTableCellLabel}>Received</Text>
                <View style={{ flex: 1.8 }}>
                  {req.food_items.map((item: any, i: number) => {
                    const name = item.food_name || item.name || 'Unknown';
                    const requested = parseFloat(item.qty || item.quantity || '0');
                    const received = rMap[name] || 0;
                    const done = received >= requested;
                    return (
                      <Text key={i} style={[styles.reportTableCellValue, i > 0 && { marginTop: 4 }, { color: done ? '#00592d' : '#00796B', fontWeight: '700' }]}>
                        {name}: {received} / {requested} {item.unit || ''}
                      </Text>
                    );
                  })}
                </View>
              </View>
            );
          })()}
          {effectiveStatus === 'In Transit' && req.quantity && !(Array.isArray(req.food_items) && req.food_items.length > 0) && (
            <View style={styles.reportTableRow}>
              <Text style={styles.reportTableCellLabel}>Received</Text>
              <Text style={[styles.reportTableCellValue, { color: '#00796B', fontWeight: '700' }]}>
                {parseFloat(req.received_quantity || '0')} / {req.quantity} {req.unit && req.unit !== 'null' ? req.unit : ''}
              </Text>
            </View>
          )}

          <View style={styles.reportTableRow}>
            <Text style={styles.reportTableCellLabel}>Address</Text>
            <Text style={styles.reportTableCellValue}>
              {[req.street, req.barangay, req.city, req.zip_code].filter(Boolean).join(', ') || 'N/A'}
            </Text>
          </View>

          {/* Remarks — shown when beneficiary left a note on receipt */}
          {req.remarks ? (
            <View style={styles.reportTableRow}>
              <Text style={styles.reportTableCellLabel}>Your Remarks</Text>
              <Text style={[styles.reportTableCellValue, { color: '#555', fontStyle: 'italic' }]}>
                {req.remarks}
              </Text>
            </View>
          ) : null}
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
              onPress={() => handleReceivedRequest(req)}
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

        {/* TOP BAR HEADER */}
        <View style={styles.topHeader}>
          <Image source={require('../../assets/images/logo/logowhite.png')} style={styles.logoImage} resizeMode="contain" />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NotificationBell navigation={navigation} color="#FFF" size={26} style={{ marginRight: 5 }} />
            <TouchableOpacity onPress={() => navigation.openDrawer()}>
              <Ionicons name="menu-outline" size={32} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* HEADER TITLES SECTION */}
        <View style={styles.headerTitlesSection}>
          <Text style={styles.mainTitle}>My Request</Text>
          <Text style={styles.subTitle}>View and track the status of your submitted requests.</Text>
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

      {/* Receipt Modal */}
      <Modal visible={receiptModal.visible} transparent animationType="fade" onRequestClose={() => setReceiptModal(m => ({ ...m, visible: false }))}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Confirm Receipt</Text>

              {(() => {
                const isComplete = deliveryStatus === 'complete';
                let dynamicExplanation = '';
                
                if (isComplete) {
                  if (receiptModal.foodItems.length > 0) {
                    const list = receiptModal.foodItems.map(item => {
                      const name = item.food_name || item.name || 'Unknown';
                      const requested = parseFloat(item.qty || item.quantity || '0');
                      return `${name} (${requested} ${item.unit || ''})`;
                    });
                    dynamicExplanation = `All items received: ${list.join(', ')}.`;
                  } else if (receiptModal.totalQty) {
                    dynamicExplanation = `All items received: ${receiptModal.totalQty} ${receiptModal.unit || 'units'}.`;
                  } else {
                    dynamicExplanation = "All items have been received.";
                  }
                } else {
                  if (receiptModal.foodItems.length > 0) {
                    const list = receiptModal.foodItems.map(item => {
                      const name = item.food_name || item.name || 'Unknown';
                      const requested = parseFloat(item.qty || item.quantity || '0');
                      const alreadyReceived = receiptModal.receivedItemsMap[name] || 0;
                      const dispItem = receiptModal.dispatchedItems.find((d: any) => (d.food_name || d.name) === name);
                      const dispQty = dispItem ? parseFloat(dispItem.received_qty ?? dispItem.qty ?? dispItem.quantity ?? 0) : Math.max(0, requested - alreadyReceived);
                      const currentTotalReceived = alreadyReceived + dispQty;
                      return `${name} (${currentTotalReceived}/${requested} ${item.unit || ''})`;
                    });
                    dynamicExplanation = `Not all requested items have been received. You received ${list.join(', ')} due to lack of supply. Some items are incomplete.`;
                  } else if (receiptModal.totalQty) {
                    const dispQty = receiptModal.dispatchedQty !== null ? receiptModal.dispatchedQty : (receiptModal.totalQty - receiptModal.receivedQty);
                    const currentTotalReceived = receiptModal.receivedQty + dispQty;
                    dynamicExplanation = `Not all requested items have been received. You received ${currentTotalReceived}/${receiptModal.totalQty} ${receiptModal.unit || 'units'} due to lack of supply. Some items are incomplete.`;
                  } else {
                    dynamicExplanation = "Not all requested items have been received. The delivery was partial due to lack of supply. Some items are incomplete.";
                  }
                }

                return (
                  <>
                    <View style={styles.deliveryStatusContainer}>
                      {isComplete ? (
                        <View style={[styles.statusOptionCard, styles.statusOptionCardActiveComplete]}>
                          <Ionicons name="checkmark-circle" size={24} color="#00592d" />
                          <View style={styles.statusOptionTextWrap}>
                            <Text style={[styles.statusOptionTitle, styles.statusOptionTitleActive]}>
                              Complete Delivery
                            </Text>
                            <Text style={styles.statusOptionSub}>
                              All requested items are being completed and received in full.
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={[styles.statusOptionCard, styles.statusOptionCardActivePartial]}>
                          <Ionicons name="alert-circle" size={24} color="#D87A38" />
                          <View style={styles.statusOptionTextWrap}>
                            <Text style={[styles.statusOptionTitle, styles.statusOptionTitleActive]}>
                              Partial Delivery
                            </Text>
                            <Text style={styles.statusOptionSub}>
                              Some items are missing or the quantity is incomplete.
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Shipment Details list */}
                    <View style={styles.shipmentDetailsSection}>
                      <Text style={styles.shipmentDetailsLabel}>Shipment Details:</Text>
                      {receiptModal.foodItems.length > 0 ? (
                        receiptModal.foodItems.map((item: any, i: number) => {
                          const name = item.food_name || item.name || 'Unknown';
                          const requested = parseFloat(item.qty || item.quantity || '0');
                          const alreadyReceived = receiptModal.receivedItemsMap[name] || 0;
                          const remaining = Math.max(0, requested - alreadyReceived);
                          const dispItem = receiptModal.dispatchedItems.find((d: any) => (d.food_name || d.name) === name);
                          const dispQty = dispItem ? parseFloat(dispItem.received_qty ?? dispItem.qty ?? dispItem.quantity ?? 0) : remaining;

                          return (
                            <View key={i} style={styles.shipmentDetailRow}>
                              <Text style={styles.shipmentItemName}>{name}</Text>
                              <Text style={styles.shipmentItemQty}>
                                {dispQty} / {requested} {item.unit || ''}
                              </Text>
                            </View>
                          );
                        })
                      ) : (
                        <View style={styles.shipmentDetailRow}>
                          <Text style={styles.shipmentItemName}>Quantity</Text>
                          <Text style={styles.shipmentItemQty}>
                            {receiptModal.dispatchedQty !== null ? receiptModal.dispatchedQty : (receiptModal.totalQty ? (receiptModal.totalQty - receiptModal.receivedQty) : 0)} / {receiptModal.totalQty} {receiptModal.unit || ''}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Explanation Banner */}
                    <View style={[styles.explanationBanner, isComplete ? styles.explanationBannerComplete : styles.explanationBannerPartial]}>
                      <Text style={[styles.explanationText, isComplete ? styles.explanationTextComplete : styles.explanationTextPartial]}>
                        {dynamicExplanation}
                      </Text>
                    </View>
                  </>
                );
              })()}



              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setReceiptModal(m => ({ ...m, visible: false }))}>
                  <Text style={styles.modalCancelText}>Not Yet</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSubmitReceipt}>
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
  },
  logoImage: {
    width: 170,
    height: 58,
    marginBottom: 6,
  },
  headerTitlesSection: {
    backgroundColor: '#00592d',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 20,
    alignItems: 'center',
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
    justifyContent: 'center',
    backgroundColor: '#00592d',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: '#E8A835',
    shadowColor: '#00592d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  receivedBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  emptyText: {
    textAlign: 'center',
    paddingVertical: 30,
    color: '#888888',
    fontSize: 14,
    fontWeight: '500',
  },

  // Receipt Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
  },
  deliveryStatusContainer: {
    gap: 12,
    marginBottom: 20,
  },
  statusOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  statusOptionCardActiveComplete: {
    borderColor: '#00592d',
    backgroundColor: '#E8F5E9',
  },
  statusOptionCardActivePartial: {
    borderColor: '#D87A38',
    backgroundColor: '#FFF3E0',
  },
  statusOptionTextWrap: {
    flex: 1,
  },
  statusOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  statusOptionTitleActive: {
    color: '#111',
  },
  statusOptionSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 16,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalInfoLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  modalInfoValue: { fontSize: 13, color: '#111', fontWeight: '700' },
  modalDesc: { fontSize: 14, color: '#555', lineHeight: 21, marginBottom: 20 },
  modalInputLabel: { fontSize: 13, fontWeight: '700', color: '#333', marginTop: 16, marginBottom: 8 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
    marginBottom: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: '#555' },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#00592d',
  },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  itemInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    gap: 10,
  },
  itemInputName: { fontSize: 13, fontWeight: '700', color: '#111' },
  itemInputSub: { fontSize: 11, color: '#888', marginTop: 2 },

  // Remarks section
  remarksSection: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 14,
  },
  remarksLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  remarksOptional: {
    fontWeight: '400',
    color: '#999',
    fontSize: 12,
  },
  remarksInput: {
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#111',
    minHeight: 70,
  },

  // Progress banner (single-qty mode)
  modalProgressBanner: {
    backgroundColor: '#F0F8F4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#00592d',
  },
  modalProgressText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  modalProgressSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    lineHeight: 17,
  },

  // Recap banner (per-item mode when partially received before)
  modalRecapBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E0F2F1',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  modalRecapText: {
    flex: 1,
    fontSize: 12,
    color: '#00796B',
    lineHeight: 17,
  },
  shipmentDetailsSection: {
    marginTop: 8,
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  shipmentDetailsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  shipmentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  shipmentItemName: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  shipmentItemQty: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  explanationBanner: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  explanationBannerComplete: {
    backgroundColor: '#FFF8E7',
    borderColor: '#E8A835',
  },
  explanationBannerPartial: {
    backgroundColor: '#FFF3E0',
    borderColor: '#D87A38',
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  explanationTextComplete: {
    color: '#A87919',
  },
  explanationTextPartial: {
    color: '#8C4D11',
  },
});

