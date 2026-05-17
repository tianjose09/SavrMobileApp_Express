import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator, Alert, LayoutAnimation, UIManager, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export default function TrackMyRequest({ navigation }: any) {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [requestsData, setRequestsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Group-based expansion
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
    'FOOD': true,
    'FINANCIAL': false,
  });

  const filters = ['All', 'Pending', 'Accepted', 'Completed', 'Rejected'];

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      fetchRequests();
    });

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
        }
      }
    ]);
  };

  const toggleGroup = (group: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const getUrgencyColor = (level: string) => {
    const l = level?.toUpperCase();
    if (l === 'HIGH') return '#F05858';
    if (l === 'MEDIUM') return '#E67E22';
    if (l === 'LOW') return '#3498DB';
    return '#888888';
  };

  const getStatusColor = (status: string) => {
    const s = status?.toUpperCase();
    if (s === 'PENDING') return '#A87919';
    if (s === 'COMPLETED' || s === 'APPROVED' || s === 'ACCEPTED') return '#00592d';
    if (s === 'REJECTED' || s === 'CANCELLED') return '#C0392B';
    return '#555555';
  };

  const getMappedFilterStatus = (status: string) => {
    const s = status?.toUpperCase() || 'PENDING';
    if (['PENDING'].includes(s)) return 'Pending';
    if (['ACCEPTED', 'ALLOCATED', 'URGENT'].includes(s)) return 'Accepted';
    if (['COMPLETED', 'FULFILLED'].includes(s)) return 'Completed';
    if (['REJECTED', 'CANCELLED'].includes(s)) return 'Rejected';
    return 'Pending';
  };

  const filteredRequests = selectedFilter === 'All'
    ? requestsData
    : requestsData.filter(req => getMappedFilterStatus(req.status) === selectedFilter);

  const foodRequests = filteredRequests.filter(req => req.type?.toLowerCase() === 'food');
  const financialRequests = filteredRequests.filter(req => req.type?.toLowerCase() === 'financial');

  const renderSummaryRow = (label: string, value: string | number) => (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value || 'N/A'}</Text>
    </View>
  );

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#00592d' }} />
      <SafeAreaView style={styles.container}>

        {/* Top Heavy Green Header */}
        <View style={styles.topHeader}>
          {/* Logo and Nav */}
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

        {/* Filters Row */}
        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {filters.map((filter, index) => (
              <TouchableOpacity
                key={index}
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

            {/* Report List */}
            <View style={styles.reportContainer}>

              {/* GROUP: FOOD REQUESTS - ALWAYS VISIBLE */}
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
                      foodRequests.map((req, idx) => (
                        <View key={req.id}>
                          {idx > 0 && <View style={styles.groupItemDivider} />}

                          <View style={styles.titleStatusRow}>
                            <Text style={styles.reportMainTitle} numberOfLines={2}>{req.request_name || 'Untitled Request'}</Text>
                            <Text style={[styles.reportHeaderStatus, { color: getStatusColor(req.status || 'Pending') }]}>
                              {req.status?.toUpperCase() || 'PENDING'}
                            </Text>
                          </View>

                          <View style={styles.reportTable}>
                            <View style={styles.reportTableRow}>
                              <Text style={styles.reportTableCellLabel}>Urgency</Text>
                              <Text style={[styles.reportTableCellValue, { color: getUrgencyColor(req.urgency || 'UNKNOWN'), fontWeight: 'bold' }]}>
                                {req.urgency?.toUpperCase() || 'N/A'}
                              </Text>
                            </View>

                            {renderSummaryRow('Food Type', req.food_type)}
                            {renderSummaryRow('Quantity', req.quantity ? `${req.quantity} ${req.unit && req.unit !== 'null' ? req.unit : ''}`.trim() : 'N/A')}
                            {renderSummaryRow('Target Population', req.population)}
                            {renderSummaryRow('Age Range', req.age_min && req.age_max ? `${req.age_min}-${req.age_max} Years` : 'All Ages')}
                            {renderSummaryRow('Date Needed', req.request_date ? new Date(req.request_date).toLocaleDateString() : 'N/A')}
                            {renderSummaryRow('Date Submitted', req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A')}

                            <View style={styles.reportTableRow}>
                              <Text style={styles.reportTableCellLabel}>Address</Text>
                              <Text style={styles.reportTableCellValue}>
                                {[req.street, req.barangay, req.city, req.zip_code].filter(Boolean).join(', ') || 'N/A'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.actionRowContainer}>
                            {req.status?.toUpperCase() === 'PENDING' && (
                              <TouchableOpacity style={styles.reportTableAction} activeOpacity={0.8} onPress={() => handleCancelRequest(req.id)}>
                                <Text style={styles.reportTableActionText}>Cancel This Request</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.emptyText, { paddingVertical: 20 }]}>No food requests found.</Text>
                    )}
                  </View>
                )}
              </View>

              {/* GROUP: FINANCIAL REQUESTS - ALWAYS VISIBLE */}
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
                      financialRequests.map((req, idx) => (
                        <View key={req.id}>
                          {idx > 0 && <View style={styles.groupItemDivider} />}

                          <View style={styles.titleStatusRow}>
                            <Text style={styles.reportMainTitle} numberOfLines={2}>{req.request_name || 'Untitled Request'}</Text>
                            <Text style={[styles.reportHeaderStatus, { color: getStatusColor(req.status || 'Pending') }]}>
                              {req.status?.toUpperCase() || 'PENDING'}
                            </Text>
                          </View>

                          <View style={styles.reportTable}>
                            <View style={styles.reportTableRow}>
                              <Text style={styles.reportTableCellLabel}>Urgency</Text>
                              <Text style={[styles.reportTableCellValue, { color: getUrgencyColor(req.urgency || 'UNKNOWN'), fontWeight: 'bold' }]}>
                                {req.urgency?.toUpperCase() || 'N/A'}
                              </Text>
                            </View>

                            {renderSummaryRow('Amount Needed', req.amount ? `₱${req.amount}` : 'N/A')}
                            {renderSummaryRow('Target Population', req.population)}
                            {renderSummaryRow('Age Range', req.age_min && req.age_max ? `${req.age_min}-${req.age_max} Years` : 'All Ages')}
                            {renderSummaryRow('Date Needed', req.request_date ? new Date(req.request_date).toLocaleDateString() : 'N/A')}
                            {renderSummaryRow('Date Submitted', req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A')}

                            <View style={styles.reportTableRow}>
                              <Text style={styles.reportTableCellLabel}>Address</Text>
                              <Text style={styles.reportTableCellValue}>
                                {[req.street, req.barangay, req.city, req.zip_code].filter(Boolean).join(', ') || 'N/A'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.actionRowContainer}>
                            {req.status?.toUpperCase() === 'PENDING' && (
                              <TouchableOpacity style={styles.reportTableAction} activeOpacity={0.8} onPress={() => handleCancelRequest(req.id)}>
                                <Text style={styles.reportTableActionText}>Cancel This Request</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.emptyText, { paddingVertical: 20 }]}>No financial requests found.</Text>
                    )}
                  </View>
                )}
              </View>

            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Pure white for report feel
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
    marginBottom: 10
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  badgeDot: {
    position: 'absolute',
    top: -3,
    right: -4,
    backgroundColor: '#E74C3C',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00592d',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  headerTitles: {
    alignItems: 'center', // Center aligned top header block!
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
  filterWrapper: {
    marginTop: 25,
    marginBottom: 15,
  },
  filterScroll: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: 22,
    paddingVertical: 10,
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
  scrollContent: {
    paddingTop: 10,
  },
  sectionHeaderRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#444444',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dropdownBtn: {
    width: 26,
    height: 18,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },

  // FLAT REPORT FORMAT STYLES
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
    paddingBottom: 20, // Reduced bottom padding slightly
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
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.3,
    marginRight: 10,
  },
  reportHeaderStatus: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
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
  summaryRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  summaryLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  summaryValue: {
    flex: 1.8,
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },
  actionRowContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end', // ALIGN Right!
    marginTop: 15,
  },
  reportTableAction: {
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  reportTableActionText: {
    color: '#C0392B',
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'none', // NO UNDERLINE!
    textTransform: 'uppercase',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 40,
    color: '#888888',
    fontSize: 14,
    fontWeight: '500',
  }
});
