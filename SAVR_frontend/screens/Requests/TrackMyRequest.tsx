import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert, LayoutAnimation, UIManager, Platform,
  Modal, TextInput,
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

// Spec: delivery has started when its scheduled date+time <= now
function deliveryStarted(batch: any): boolean {
  if (!batch.delivery_date) return false;
  const t = /^\d{1,2}:\d{2}/.test(batch.delivery_time_start || '')
    ? batch.delivery_time_start.slice(0, 5)
    : '00:00';
  return new Date(`${batch.delivery_date.slice(0, 10)}T${t}:00`) <= new Date();
}

// Request-level status — no batch logic here (batches get their own separate cards)
function getEffectiveStatus(req: any): string {
  const raw = (req.status || 'PENDING').toUpperCase().trim();

  if (['CANCELLED', 'CANCELED'].includes(raw)) return 'Cancelled';
  if (raw === 'COMPLETED' || raw === 'DONE') return 'Completed';
  if (
    ['REJECTED', 'DENIED', 'DECLINED', 'REFUSED', 'DISAPPROVED'].includes(raw) ||
    raw.includes('REJECT') || raw.includes('DEN') || raw.includes('DECLIN')
  ) return 'Rejected';
  if (raw === 'PENDING') return 'Pending';

  if (['APPROVED', 'ACCEPTED', 'ALLOCATED', 'URGENT', 'IN TRANSIT', 'IN_TRANSIT', 'INTRANSIT'].includes(raw)) {
    // Drive-based completion: Done, or end_date passed
    const driveStatus = (req.drive_status || '').toLowerCase();
    if (driveStatus === 'done') return 'Completed';
    if (req.drive_end_date) {
      const end = new Date(req.drive_end_date + 'T00:00:00');
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (end < today) return 'Completed';
    }
    return 'Approved';
  }

  return 'Pending';
}

// Spec §3: in_transit/delivered are always active; pending/accepted only when date has arrived
function batchIsInTransit(batch: any): boolean {
  const s = (batch.status || '').toLowerCase();
  if (['in_transit', 'delivered'].includes(s)) return true;
  if (['pending', 'accepted'].includes(s)) {
    if (!batch.delivery_date) return false;
    const todayStr = new Date().toISOString().slice(0, 10);
    return batch.delivery_date.slice(0, 10) <= todayStr;
  }
  return false;
}

// Spec §3: missed = staff flagged it, OR in-transit batch whose date is strictly past
function isMissedBatch(batch: any): boolean {
  const s = (batch.status || '').toLowerCase();
  if (['notified', 'missed'].includes(s)) return true;
  if (!batch.delivery_date) return false;
  const todayStr = new Date().toISOString().slice(0, 10);
  return batchIsInTransit(batch) && batch.delivery_date.slice(0, 10) < todayStr;
}

// In Transit = active + not missed | Delivery Missed = missed | null = done/future/cancelled
function getBatchEffectiveStatus(batch: any): 'In Transit' | 'Delivery Missed' | null {
  const s = (batch.status || '').toLowerCase();
  if (['completed', 'cancelled'].includes(s)) return null;
  if (isMissedBatch(batch)) return 'Delivery Missed';
  if (batchIsInTransit(batch)) return 'In Transit';
  return null; // future-dated pending/accepted — stays in Approved
}

function getStatusColor(effectiveStatus: string): string {
  switch (effectiveStatus) {
    case 'Pending': return '#A87919';
    case 'Approved': return '#00592d';
    case 'In Transit': return '#A87919';
    case 'Completed': return '#00592d';
    case 'Cancelled': return '#C0392B';
    case 'Rejected': return '#C0392B';
    case 'Delivery Missed': return '#C0392B';
    default: return '#555555';
  }
}

function getStatusBadgeColor(effectiveStatus: string): string {
  switch (effectiveStatus) {
    case 'Pending': return '#FFF8E7';
    case 'Approved': return '#E8F5E9';
    case 'In Transit': return '#FFF8E7';
    case 'Completed': return '#E8F5E9';
    case 'Cancelled': return '#FFEBEE';
    case 'Rejected': return '#FFEBEE';
    case 'Delivery Missed': return '#FFEBEE';
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
    stopId: number | null;
    batchDate: string | null;
    batchTime: string | null;
  }>({ visible: false, requestId: null, stopId: null, batchDate: null, batchTime: null });

  const [itemsModal, setItemsModal] = useState<{
    visible: boolean;
    requestName: string;
    requestStatus: string;
    foodItems: { food_name: string; food_type: string; qty: number; unit: string; name?: string; category?: string }[];
    deliveryFoodItems: { food_name: string; qty: number; unit: string; category: string }[];
    allBatches: any[];
  }>({ visible: false, requestName: '', requestStatus: '', foodItems: [], deliveryFoodItems: [], allBatches: [] });

  const [noteModal, setNoteModal] = useState<{
    visible: boolean;
    requestId: number | null;
    noteText: string;
  }>({ visible: false, requestId: null, noteText: '' });


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
    } catch (error: any) {
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

  const handleReceivedRequest = (req: any, batch: any) => {
    setReceiptModal({
      visible: true,
      requestId: req.id,
      stopId: batch.stop_id ?? null,
      batchDate: batch.delivery_date ?? null,
      batchTime: batch.delivery_time_start ?? null,
    });
  };

  const handleViewItems = (req: any) => {
    setItemsModal({
      visible: true,
      requestName: req.request_name || 'Request',
      foodItems: Array.isArray(req.food_items) ? req.food_items : [],
      deliveryFoodItems: Array.isArray(req._activeBatch?.delivery_food_items)
        ? req._activeBatch.delivery_food_items
        : Array.isArray(req.delivery_food_items) ? req.delivery_food_items : [],
      allBatches: Array.isArray(req.delivery_batches) ? req.delivery_batches : [],
      requestStatus: req._cardStatus || getEffectiveStatus(req),
    });
  };

  const handleSubmitReceipt = async () => {
    if (!receiptModal.requestId) return;
    if (!receiptModal.stopId) {
      Alert.alert('No Delivery', 'No pending delivery stop found for this request.');
      return;
    }
    const { requestId, stopId } = receiptModal;
    setReceiptModal(m => ({ ...m, visible: false }));
    try {
      const res = await ApiService.receiveBeneficiaryStop(requestId, stopId);
      if (res.data.success) {
        // Optimistically mark that batch as received locally — request stays in Approved
        // until staff marks Done or drive expires (never completed by beneficiary confirm alone)
        setRequestsData(prev => prev.map(req => {
          if (req.id !== requestId) return req;
          const updatedBatches = (req.delivery_batches || []).map((b: any) =>
            b.stop_id === stopId ? { ...b, status: 'completed' } : b
          );
          return { ...req, delivery_batches: updatedBatches };
        }));
        // Always re-fetch so the Approved tab shows updated cumulative received amounts
        fetchRequests();
        if (res.data.goal_met) {
          Alert.alert('Delivery Confirmed!', 'Items received! Your request will be marked complete once the staff finalises it.');
        } else {
          Alert.alert('Delivery Confirmed!', res.data.message || 'Delivery confirmed. Your request stays open until fully fulfilled.');
        }
      } else {
        Alert.alert('Error', res.data.message || 'Failed to confirm receipt.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Connection error.');
    }
  };

  const handleSendNote = async () => {
    // Note sending functionality (stubbed for now if no endpoint exists)
    console.log("Sending Note:", noteModal.noteText, "for request:", noteModal.requestId);
    setNoteModal(m => ({ ...m, visible: false }));
    Alert.alert('Note Sent', 'Thank you for your feedback.');
  };

  const toggleGroup = (group: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Build all cards: one request card per request + separate batch cards for In Transit / Delivery Missed
  const allCards = requestsData.flatMap((req: any) => {
    const cards: any[] = [];
    const reqStatus = getEffectiveStatus(req);
    const batches: any[] = Array.isArray(req.delivery_batches) ? req.delivery_batches : [];
    const activeBatch =
      batches.find((b: any) => b.status === 'pending' && deliveryStarted(b)) ||
      batches.find((b: any) => b.status === 'pending') ||
      batches[0] || null;

    // Always one request-level card
    cards.push({ ...req, _cardType: 'request', _cardStatus: reqStatus, _activeBatch: activeBatch });

    // While drive is ongoing (Approved), each started/missed batch gets its own separate card
    if (reqStatus === 'Approved') {
      for (const batch of batches) {
        const batchStatus = getBatchEffectiveStatus(batch);
        if (batchStatus) {
          cards.push({ ...req, _cardType: 'batch', _cardStatus: batchStatus, _activeBatch: batch });
        }
      }
    }

    return cards;
  });

  // Filter the expanded cards
  const filteredCards = allCards.filter((card: any) => {
    if (selectedFilter === 'All') return true;
    const s = card._cardStatus;
    if (selectedFilter === 'Rejected') return ['Rejected', 'Cancelled', 'Delivery Missed'].includes(s);
    return s === selectedFilter;
  });

  const financialRequests = filteredCards.filter((c: any) => c.type?.toLowerCase() === 'financial');
  const foodRequests = filteredCards.filter((c: any) => c.type?.toLowerCase() !== 'financial');

  const renderSummaryRow = (label: string, value: string | number | null | undefined) => (
    <View style={styles.reportTableRow}>
      <Text style={styles.reportTableCellLabel}>{label}</Text>
      <Text style={styles.reportTableCellValue}>{value || 'N/A'}</Text>
    </View>
  );

  const renderRequestCard = (req: any, idx: number, isFirst: boolean) => {
    const effectiveStatus = req._cardStatus || getEffectiveStatus(req);
    const statusColor = getStatusColor(effectiveStatus);
    const statusBg = getStatusBadgeColor(effectiveStatus);
    const isFood = req.type?.toLowerCase() !== 'financial';
    const activeBatch: any = req._activeBatch || null;
    const allBatches: any[] = Array.isArray(req.delivery_batches) ? req.delivery_batches : [];

    return (
      <View key={`${req.id}-${idx}`}>
        {!isFirst && <View style={styles.groupItemDivider} />}

        {/* Title + Status Badge + three-dot */}
        <View style={styles.titleStatusRow}>
          <Text style={[styles.reportMainTitle, { flex: 1 }]} numberOfLines={2}>
            {req.request_name || 'Untitled Request'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {effectiveStatus.toUpperCase()}
              </Text>
            </View>
            {isFood && (
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => handleViewItems(req)}>
                <Ionicons name="ellipsis-vertical" size={18} color="#555" />
              </TouchableOpacity>
            )}
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

          {isFood && renderSummaryRow(
            'Food Categories',
            Array.isArray(req.food_items) && req.food_items.length > 0
              ? [...new Set(req.food_items.map((item: any) => item.food_type || item.category || '').filter(Boolean))].join(', ')
              : req.food_type
          )}

          {isFood && Array.isArray(req.food_items) && req.food_items.length > 0 && (
            <View style={styles.reportTableRow}>
              <Text style={styles.reportTableCellLabel}>Items</Text>
              <View style={{ flex: 1.8 }}>
                {req.food_items.map((item: any, i: number) => {
                  const name = item.food_name || item.name || 'Unknown';
                  const category = item.food_type || item.category || '';
                  const rQty = item.qty ?? item.quantity ?? 0;
                  const rUnit = item.unit || '';

                  // Approved: show cumulative received so far
                  const receivedItems = Array.isArray(req.received_items) ? req.received_items : [];
                  const receivedEntry = receivedItems.find((ri: any) => (ri.food_name || '').toLowerCase() === name.toLowerCase());
                  const receivedQty = receivedEntry ? parseFloat(receivedEntry.received_qty || '0') : 0;

                  // In Transit: use this batch card's own items (activeBatch), not the top-level field
                  const delivItems: any[] = Array.isArray(activeBatch?.delivery_food_items)
                    ? activeBatch.delivery_food_items
                    : Array.isArray(req.delivery_food_items) ? req.delivery_food_items : [];
                  const delivEntry = effectiveStatus === 'In Transit'
                    ? delivItems.find((d: any) => (d.food_name || '').toLowerCase() === name.toLowerCase())
                    : null;

                  return (
                    <View key={i} style={{ marginTop: i > 0 ? 10 : 0 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 5 }}>
                        {name}{category ? ` · ${category}` : ''}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        <View style={styles.badgeRequested}>
                          <Text style={styles.badgeRequestedText}>REQUESTED: {rQty} {rUnit}</Text>
                        </View>
                        {effectiveStatus === 'Approved' && receivedQty > 0 && (
                          <View style={styles.badgeReceived}>
                            <Text style={styles.badgeReceivedText}>RECEIVED: {receivedQty} {rUnit}</Text>
                          </View>
                        )}
                        {effectiveStatus === 'In Transit' && (
                          delivEntry ? (
                            <View style={styles.badgeDelivering}>
                              <Text style={styles.badgeDeliveringText}>DELIVERING: {delivEntry.qty} {delivEntry.unit}</Text>
                            </View>
                          ) : (
                            <View style={styles.badgeNone}>
                              <Text style={styles.badgeNoneText}>DELIVERING: —</Text>
                            </View>
                          )
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {!isFood && renderSummaryRow('Amount Needed', req.amount ? `₱${parseFloat(req.amount).toLocaleString()}` : null)}
          {!isFood && (req.receiving_method) && renderSummaryRow('Receiving Method', req.receiving_method)}
          {!isFood && req.account_name && renderSummaryRow('Account Name', req.account_name)}
          {!isFood && req.account_number && renderSummaryRow('Account No.', req.account_number)}

          {/* Financial disbursements — shows each partial payment sent by staff */}
          {!isFood && (() => {
            let disbursements: any[] = [];
            try {
              const raw = req.dispatched_items;
              disbursements = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
              if (!Array.isArray(disbursements)) disbursements = [];
            } catch { disbursements = []; }
            const totalSent: number = parseFloat(req.dispatched_quantity || '0');
            if (totalSent <= 0 && disbursements.length === 0) return null;
            return (
              <View style={styles.reportTableRow}>
                <Text style={styles.reportTableCellLabel}>Amount Sent</Text>
                <View style={{ flex: 1.8 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: disbursements.length > 0 ? 8 : 0 }}>
                    <View style={styles.badgeReceived}>
                      <Text style={styles.badgeReceivedText}>SENT: ₱{totalSent.toLocaleString()}</Text>
                    </View>
                    {req.amount && totalSent < parseFloat(req.amount) && (
                      <View style={styles.badgeRequested}>
                        <Text style={styles.badgeRequestedText}>REMAINING: ₱{(parseFloat(req.amount) - totalSent).toLocaleString()}</Text>
                      </View>
                    )}
                  </View>
                  {disbursements.map((d: any, i: number) => (
                    <Text key={i} style={{ fontSize: 11, color: '#555', marginTop: 3 }}>
                      ₱{parseFloat(d.amount || '0').toLocaleString()}{d.date ? '  ·  ' + new Date(d.date).toLocaleDateString('en-PH') : ''}{d.notes ? '  ·  ' + d.notes : ''}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })()}

          {renderSummaryRow('Target Population', req.population)}
          {renderSummaryRow('Age Range', req.age_min && req.age_max ? `${req.age_min}–${req.age_max} Years Old` : 'All Ages')}
          {renderSummaryRow('Start Date', (req.start_date || req.created_at) ? new Date(req.start_date || req.created_at).toLocaleDateString('en-PH') : null)}
          {renderSummaryRow('End Date', req.end_date ? new Date(req.end_date).toLocaleDateString('en-PH') : null)}

          {/* Scheduled Delivery from active batch */}
          {(['In Transit', 'Completed'].includes(effectiveStatus)) && activeBatch?.delivery_date && (
            <View style={styles.reportTableRow}>
              <Text style={styles.reportTableCellLabel}>Scheduled Delivery</Text>
              <Text style={[styles.reportTableCellValue, effectiveStatus === 'In Transit' ? { color: '#00592d', fontWeight: '700' } : {}]}>
                {activeBatch.delivery_date}{activeBatch.delivery_time_start ? ' · ' + activeBatch.delivery_time_start + (activeBatch.delivery_time_end ? ' - ' + activeBatch.delivery_time_end : '') : ''}
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

        {/* Cancel — only pending requests */}
        {effectiveStatus === 'Pending' && (
          <View style={styles.actionRowContainer}>
            <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.8} onPress={() => handleCancelRequest(req.id)}>
              <Text style={styles.cancelBtnText}>Cancel This Request</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Per-batch row — In Transit only; multiple batches already expanded to separate cards */}
        {effectiveStatus === 'In Transit' && activeBatch && (
          <View style={styles.batchSection}>
            {allBatches.length > 1 && (
              <Text style={styles.batchSectionLabel}>
                BATCH {activeBatch.batch_number} OF {allBatches.length}
                {activeBatch.delivery_date ? '  ·  ' + activeBatch.delivery_date : ''}
              </Text>
            )}
            <View style={[styles.batchRow, { justifyContent: 'flex-end', borderBottomWidth: 0, paddingBottom: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {activeBatch.status === 'completed' || activeBatch.status === 'missed' ? (
                  <View style={styles.batchConfirmedBadge}>
                    <Text style={styles.batchConfirmedText}>Received</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.receivedBtn} activeOpacity={0.8} onPress={() => handleReceivedRequest(req, activeBatch)}>
                    <Ionicons name="checkmark-circle" size={14} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.receivedBtnText}>I Received This</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
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

      {/* Items Detail Modal (three-dots view) */}
      <Modal visible={itemsModal.visible} transparent animationType="fade" onRequestClose={() => setItemsModal(m => ({ ...m, visible: false }))}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Requested Items</Text>
            <Text style={[styles.modalDesc, { marginBottom: 12 }]}>{itemsModal.requestName}</Text>

            {/* Column headers */}
            <View style={{ flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: '#DDD', marginBottom: 4 }}>
              <Text style={{ flex: 2, fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 0.5 }}>ITEM</Text>
              <Text style={{ width: 90, fontSize: 11, fontWeight: '800', color: '#00592d', letterSpacing: 0.5, textAlign: 'center' }}>REQUESTED</Text>
              {itemsModal.requestStatus === 'In Transit' && (
                <Text style={{ width: 90, fontSize: 11, fontWeight: '800', color: '#A87919', letterSpacing: 0.5, textAlign: 'center' }}>DELIVERING</Text>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Requested vs Delivering table */}
              {itemsModal.foodItems.map((item, i) => {
                const itemName = item.food_name || item.name || 'Unknown';
                const itemCategory = item.food_type || item.category || '';
                const showDelivering = itemsModal.requestStatus === 'In Transit';
                const delivItem = showDelivering
                  ? itemsModal.deliveryFoodItems.find(d => (d.food_name || '').toLowerCase() === itemName.toLowerCase())
                  : null;
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}>
                    <View style={{ flex: 2 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#111' }}>{itemName}</Text>
                      {itemCategory ? <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{itemCategory}</Text> : null}
                    </View>
                    <View style={{ width: 90, alignItems: 'center' }}>
                      <View style={styles.badgeRequested}>
                        <Text style={styles.badgeRequestedText}>{item.qty} {item.unit}</Text>
                      </View>
                    </View>
                    {showDelivering && (
                      <View style={{ width: 90, alignItems: 'center' }}>
                        {delivItem ? (
                          <View style={styles.badgeDelivering}>
                            <Text style={styles.badgeDeliveringText}>{delivItem.qty} {delivItem.unit}</Text>
                          </View>
                        ) : (
                          <View style={styles.badgeNone}>
                            <Text style={styles.badgeNoneText}>—</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Delivered Batches section */}
              {itemsModal.allBatches.length > 0 && (() => {
                const visibleBatches = itemsModal.requestStatus === 'Completed'
                  ? itemsModal.allBatches
                  : itemsModal.allBatches.filter((b: any) => b.status === 'completed');
                if (visibleBatches.length === 0) return null;
                return (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 0.8, marginBottom: 8 }}>DELIVERED BATCHES</Text>
                    {visibleBatches.map((batch: any, i: number) => (
                      <View key={i} style={{ backgroundColor: '#F8FBF9', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#00592d', marginBottom: 4 }}>
                          Batch {batch.batch_number}{batch.delivery_date ? '  ·  ' + batch.delivery_date : ''}
                        </Text>
                        {(batch.delivered_food_items || []).map((fi: any, j: number) => (
                          <Text key={j} style={{ fontSize: 12, color: '#333', marginTop: 2 }}>
                            {fi.food_name}  {fi.qty} {fi.unit}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })()}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, { marginTop: 16, alignSelf: 'stretch', alignItems: 'center' }]}
              onPress={() => setItemsModal(m => ({ ...m, visible: false }))}
            >
              <Text style={styles.modalConfirmText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Note Modal */}
      <Modal visible={noteModal.visible} transparent animationType="fade" onRequestClose={() => setNoteModal(m => ({ ...m, visible: false }))}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Send a Note</Text>
              <TouchableOpacity onPress={() => setNoteModal(m => ({ ...m, visible: false }))}>
                <Ionicons name="close" size={20} color="#888" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { marginBottom: 16 }]}>
              Let us know if anything was missing, incorrect, or if you have any concerns about this delivery.
            </Text>
            <View style={{
              borderWidth: 1.5,
              borderColor: '#DDDDDD',
              borderRadius: 10,
              padding: 10,
              minHeight: 100,
              marginBottom: 20
            }}>
              <TextInput
                style={{ fontSize: 14, color: '#111', flex: 1, textAlignVertical: 'top' }}
                placeholder="e.g. We received fewer items than expected, some packages were damaged..."
                placeholderTextColor="#999"
                multiline
                value={noteModal.noteText}
                onChangeText={text => setNoteModal(m => ({ ...m, noteText: text }))}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={{ backgroundColor: '#F3F4F6', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' }} onPress={() => setNoteModal(m => ({ ...m, visible: false }))}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#555' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ backgroundColor: '#00592d', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', flex: 1 }} onPress={handleSendNote}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Send Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receipt Modal */}
      <Modal visible={receiptModal.visible} transparent animationType="fade" onRequestClose={() => setReceiptModal(m => ({ ...m, visible: false }))}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Receipt</Text>
            <Text style={styles.modalDesc}>
              Have you received the items in this delivery?
              {receiptModal.batchDate
                ? '\n\nScheduled: ' + new Date(receiptModal.batchDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                : ''}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setReceiptModal(m => ({ ...m, visible: false }))}>
                <Text style={styles.modalCancelText}>Not Yet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSubmitReceipt}>
                <Text style={styles.modalConfirmText}>Yes, Received</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  noteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
  },
  noteBtnText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
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

  batchSection: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 12,
    marginTop: 8,
  },
  batchSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#AAAAAA',
    letterSpacing: 1,
    marginBottom: 8,
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  batchLabel: { fontSize: 13, fontWeight: '700', color: '#222' },
  batchDate: { fontSize: 11, color: '#888', marginTop: 2 },
  batchConfirmedBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  batchConfirmedText: { fontSize: 12, fontWeight: '800', color: '#00592d' },

  badgeRequested: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  badgeRequestedText: { fontSize: 11, fontWeight: '800', color: '#00592d' },
  badgeReceived: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  badgeReceivedText: { fontSize: 11, fontWeight: '800', color: '#1565C0' },
  badgeDelivering: {
    backgroundColor: '#FFF8E7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeDeliveringText: { fontSize: 11, fontWeight: '800', color: '#A87919' },
  badgeNone: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeNoneText: { fontSize: 11, fontWeight: '700', color: '#888' },

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

