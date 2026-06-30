import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
  Image,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import CustomDropdown from '../../components/CustomDropdown';
import ToastBanner from '../../components/ToastBanner';
import NotificationBell from '../../components/NotificationBell';

const TRANSPORT_CATEGORIES = [
  'No Liquid Foods',
  'No Frozen Foods',
  'No Glass Containers',
  'No Refrigerated Foods',
  'No Hot/Warm Foods',
  'No Bulk Produce',
  'No Raw Meat / Poultry',
  'No Raw Seafood / Fish',
  'No Bottled Beverages',
  'No Snacks / Sweets',
  'No Powdered Ingredients',
];

const VOLUNTEER_SKILLS = [
  'First Aid Certified',
  'Heavy Liftings',
  'Communication',
  'Cooking',
  'Driving',
  'Inventory Management',
  'Allergen Awareness',
  'Bilingual / Multilingual',
  'Physical Stamina',
  'Photography / Videography',
  'Grant Writing / Reporting',
];

const formatTimeWithAMPM = (date: Date | null) => {
  if (!date) return '-- : --';
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strMinutes = minutes < 10 ? '0' + minutes : minutes;
  const strHours = hours;
  return `${strHours}:${strMinutes} ${ampm}`;
};

const formatDateMMDDYYYY = (date: Date | null) => {
  if (!date) return 'mm/dd/yyyy';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const strMonth = month < 10 ? '0' + month : month;
  const strDay = day < 10 ? '0' + day : day;
  return `${strMonth}/${strDay}/${year}`;
};

export default function ServiceDonation({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<'TRANSPORTATION' | 'VOLUNTEER'>('TRANSPORTATION');

  // Shared Form Fields
  const [address, setAddress] = useState('');
  const [frequency, setFrequency] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [allDay, setAllDay] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');

  // Transport Specific
  const [quantity, setQuantity] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [capacity, setCapacity] = useState('');
  const [maxDistance, setMaxDistance] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Volunteer Specific
  const [headcount, setHeadcount] = useState('');
  const [preferredWork, setPreferredWork] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // UI States
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'starts_at' | 'ends_at' | null>(null);
  const [showIOSDate, setShowIOSDate] = useState(false);
  const [tempDate, setTempDate] = useState(() => new Date());
  const [showIOSStartsAt, setShowIOSStartsAt] = useState(false);
  const [showIOSEndsAt, setShowIOSEndsAt] = useState(false);
  const [tempStartsAt, setTempStartsAt] = useState(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  });
  const [tempEndsAt, setTempEndsAt] = useState(() => {
    const d = new Date();
    d.setHours(17, 0, 0, 0);
    return d;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, title: '', message: '' });

  const resetForm = () => {
    setAddress('');
    setFrequency('');
    setDayOfWeek('');
    setDate(null);
    setStartsAt(null);
    setEndsAt(null);
    setAllDay(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setDescription('');
    setQuantity('');
    setVehicleType('');
    setCapacity('');
    setMaxDistance('');
    setSelectedCategories([]);
    setHeadcount('');
    setPreferredWork('');
    setSelectedSkills([]);
  };

  const formatDateString = (d: Date | null) => {
    if (!d) return 'mm/dd/yyyy';
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const onRefresh = () => {
    setRefreshing(true);
    resetForm();
    setTimeout(() => setRefreshing(false), 500);
  };

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const handleSubmit = async () => {
    // Basic validation
    const hasContactDetails = firstName && lastName && email;
    const hasFrequencyDate = activeTab === 'TRANSPORTATION' ? (startsAt && endsAt) : (frequency && ((frequency !== 'Monthly' && frequency !== 'One-Time') || date));
    const hasTabInfo = (activeTab === 'VOLUNTEER' && headcount.trim() && parseInt(headcount) > 0 && preferredWork) ||
      (activeTab === 'TRANSPORTATION' && quantity.trim() && parseInt(quantity) > 0 && vehicleType && capacity.trim() && parseInt(capacity) > 0);

    if (!hasContactDetails || !hasFrequencyDate || !hasTabInfo) {
      Alert.alert('Error', 'Please fill out all fields to submit donation.');
      return;
    }

    if (activeTab === 'VOLUNTEER' && frequency === 'Weekly' && !dayOfWeek) {
      Alert.alert('Error', 'Please select a day of the week for weekly donations.');
      return;
    }

    if (!allDay && activeTab === 'VOLUNTEER') {
      if (!startsAt || !endsAt) {
        Alert.alert('Error', 'Please fill out all fields to submit donation.');
        return;
      }
      const startsHours = startsAt.getHours();
      const endsHours = endsAt.getHours();
      if (startsHours < 8 || startsHours >= 17) {
        Alert.alert('Invalid Start Time', 'Please select a start time within working hours (8:00 AM to 5:00 PM).');
        return;
      }
      if (endsHours < 8 || endsHours > 17 || (endsHours === 17 && endsAt.getMinutes() > 0)) {
        Alert.alert('Invalid End Time', 'Please select an end time within working hours (8:00 AM to 5:00 PM).');
        return;
      }
      if (startsAt >= endsAt) {
        Alert.alert('Invalid Time Range', 'End time must be after start time.');
        return;
      }
    } else if (activeTab === 'TRANSPORTATION') {
      if (!startsAt || !endsAt) {
        Alert.alert('Error', 'Please select delivery and return dates.');
        return;
      }
      const startDay = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
      const endDay = new Date(endsAt.getFullYear(), endsAt.getMonth(), endsAt.getDate());
      if (startDay > endDay) {
        Alert.alert('Invalid Date Range', 'Return date cannot be before delivery date.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const serviceTypeLabel = activeTab === 'TRANSPORTATION' ? 'Transportation' : 'Volunteer Work';

      const startsAtStr = allDay || !startsAt ? null : formatTimeWithAMPM(startsAt);
      const endsAtStr   = allDay || !endsAt   ? null : formatTimeWithAMPM(endsAt);

      const payload: any = {
        service_type: serviceTypeLabel,
        contact_first_name: firstName,
        contact_last_name: lastName,
        contact_email: email,
        description,
        ...(activeTab === 'TRANSPORTATION' ? {
          // Transportation: date-based fields, no time parsing
          frequency: 'One-Time',
          service_date: startsAt ? startsAt.toISOString().split('T')[0] : null,
          return_date:  endsAt   ? endsAt.toISOString().split('T')[0]   : null,
          all_day: false,
          quantity: parseInt(quantity) || 1,
          vehicle_type: vehicleType || null,
          capacity: capacity || null,
          max_distance: '0',
          transport_categories: selectedCategories.length > 0 ? selectedCategories : null,
        } : {
          // Volunteer Work: time-based fields
          frequency: frequency || 'One-Time',
          day_of_week: frequency === 'Weekly' ? (dayOfWeek || null) : null,
          service_date: date ? date.toISOString().split('T')[0] : null,
          all_day: allDay,
          starts_at: startsAtStr,
          ends_at: endsAtStr,
          address: address || 'Volunteer',
          headcount: parseInt(headcount) || 1,
          preferred_work: preferredWork || null,
          skill_categories: selectedSkills.length > 0 ? selectedSkills : null,
        }),
      };

      const response = await ApiService.submitServiceDonation(payload);

      if (response.data.success) {
        const serviceLabel = activeTab === 'VOLUNTEER' ? 'Volunteer Work' : 'Transportation Service';
        const dateLabel = date ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'recurring schedule';
        
        Alert.alert(
          `${serviceLabel} Submitted!`,
          `Your ${serviceLabel.toLowerCase()} pledge for ${dateLabel} has been recorded. Thank you!`,
          [{ 
            text: 'OK', 
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'ChooseDonation' }],
              });
            } 
          }]
        );
      } else {
        Alert.alert('Error', response.data.message || 'Failed to submit service donation.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ToastBanner
        visible={toast.visible}
        title={toast.title}
        message={toast.message}
        type="service"
        onHide={() => setToast(t => ({ ...t, visible: false }))}
      />
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" translucent={false} />

      {/* TOP BAR HEADER */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={30} color="#00592d" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <NotificationBell navigation={navigation} color="#544434" size={28} style={{ marginRight: 5 }} />
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.openDrawer?.()}
          >
            <Ionicons name="menu-outline" size={32} color="#544434" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.titleSection}>
        <Image
          source={require('../../assets/images/cards/servicedonationicongreen.png')}
          style={styles.heroMainIconImage}
          resizeMode="contain"
        />
        <Text style={styles.mainTitle}>Service Donation</Text>
      </View>


      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00592d"
              colors={['#00592d']}
            />
          }
        >

          {/* TABS */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'TRANSPORTATION' ? styles.tabActive : styles.tabInactive,
                { marginRight: 15 }
              ]}
              onPress={() => setActiveTab('TRANSPORTATION')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'TRANSPORTATION' ? styles.tabTextActive : styles.tabTextInactive
                ]}
              >
                TRANSPORTATION
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'VOLUNTEER' ? styles.tabActive : styles.tabInactive
              ]}
              onPress={() => setActiveTab('VOLUNTEER')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'VOLUNTEER' ? styles.tabTextActive : styles.tabTextInactive
                ]}
              >
                VOLUNTEER WORK
              </Text>
            </TouchableOpacity>
          </View>

          {/* BIG GREEN CARD */}
          <View style={styles.greenCard}>

            {activeTab === 'TRANSPORTATION' ? (
              <>
                {/* Row 1: Type of Vehicle */}
                <View style={[styles.inputGroup, { width: '100%', marginBottom: 15 }]}>
                  <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>Type of Vehicle<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                  <CustomDropdown
                    selectedValue={vehicleType}
                    onValueChange={setVehicleType}
                    placeholder="Select Vehicle Type"
                    disableSort={true}
                    items={[
                      { label: "Sedan", value: "Sedan" },
                      { label: "Hatchback", value: "Hatchback" },
                      { label: "SUV (Sport Utility Vehicle)", value: "SUV (Sport Utility Vehicle)" },
                      { label: "Crossover", value: "Crossover" },
                      { label: "Pickup Truck", value: "Pickup Truck" },
                      { label: "Van / Minivan", value: "Van / Minivan" },
                      { label: "Cargo Van", value: "Cargo Van" },
                      { label: "Box Truck", value: "Box Truck" },
                      { label: "Wagon", value: "Wagon" },
                      { label: "Coupe", value: "Coupe" },
                      { label: "Convertible", value: "Convertible" },
                      { label: "Hybrid", value: "Hybrid" },
                      { label: "Electric Vehicle (EV)", value: "Electric Vehicle (EV)" },
                      { label: "Diesel Vehicle", value: "Diesel Vehicle" },
                      { label: "Refrigerated Truck", value: "Refrigerated Truck" },
                      { label: "Motorcycle", value: "Motorcycle" }
                    ]}
                    style={styles.inputBox}
                  />
                </View>

                {/* Row 2: Capacity (kg), Quantity */}
                <View style={[styles.row, { marginBottom: 15 }]}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 15 }]}>
                    <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>Capacity (kg)<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.inputInner}
                        placeholder="No."
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        keyboardType="numeric"
                        value={capacity}
                        onChangeText={setCapacity}
                      />
                    </View>
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>Quantity<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.inputInner}
                        placeholder="Qty."
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        keyboardType="numeric"
                        value={quantity}
                        onChangeText={setQuantity}
                      />
                    </View>
                  </View>
                </View>

                {/* Row 3: To Deliver At, To Return At */}
                <View style={[styles.row, { marginBottom: 15 }]}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 15 }]}>
                    <Text style={styles.label}>To Deliver At<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                    <TouchableOpacity
                      style={[
                        styles.inputBox,
                        { paddingLeft: 8, paddingRight: 6, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }
                      ]}
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          setTempStartsAt(startsAt || new Date());
                          setShowIOSStartsAt(true);
                        } else {
                          setDatePickerMode('starts_at');
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.inputInner,
                          { textAlign: 'left', lineHeight: 38, fontSize: 13, paddingRight: 18 },
                          !startsAt && { color: 'rgba(255,255,255,0.5)' }
                        ]}
                      >
                        {startsAt ? formatDateString(startsAt) : 'mm/dd/yyyy'}
                      </Text>
                      <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.7)" style={{ position: 'absolute', right: 4 }} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>To Return At<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                    <TouchableOpacity
                      style={[
                        styles.inputBox,
                        { paddingLeft: 8, paddingRight: 6, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }
                      ]}
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          setTempEndsAt(endsAt || new Date());
                          setShowIOSEndsAt(true);
                        } else {
                          setDatePickerMode('ends_at');
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.inputInner,
                          { textAlign: 'left', lineHeight: 38, fontSize: 13, paddingRight: 18 },
                          !endsAt && { color: 'rgba(255,255,255,0.5)' }
                        ]}
                      >
                        {endsAt ? formatDateString(endsAt) : 'mm/dd/yyyy'}
                      </Text>
                      <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.7)" style={{ position: 'absolute', right: 4 }} />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Row 1: Preferred Work, Headcount */}
                <View style={[styles.row, { marginBottom: 15 }]}>
                  <View style={[styles.inputGroup, { flex: 2.5, marginRight: 15 }]}>
                    <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>Preferred Work<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                    <CustomDropdown
                      selectedValue={preferredWork}
                      onValueChange={setPreferredWork}
                      placeholder="Select Work Type"
                      disableSort={true}
                      items={[
                        { label: "Cook / Food Prep", value: "Cook / Food Prep" },
                        { label: "Packing / Sorting", value: "Packing / Sorting" },
                        { label: "Delivery / Distribution", value: "Delivery / Distribution" },
                        { label: "Logistics / Warehouse", value: "Logistics / Warehouse" },
                        { label: "Event / Community Assistance", value: "Event / Community Assistance" },
                        { label: "Admin / Documentation", value: "Admin / Documentation" },
                        { label: "Medical Assistance", value: "Medical Assistance" }
                      ]}
                      style={styles.inputBox}
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>Headcount<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.inputInner}
                        placeholder="No."
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        keyboardType="numeric"
                        value={headcount}
                        onChangeText={setHeadcount}
                      />
                    </View>
                  </View>
                </View>
              </>
            )}

            {activeTab === 'VOLUNTEER' && (
              <>
                {/* Row 2: Frequency + Starts At + Ends At */}
                <View style={[styles.row, { marginBottom: 15 }]}>
                  <View style={[styles.inputGroup, { flex: 1.8, marginRight: 8 }]}>
                    <Text style={styles.label}>Frequency<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                    <CustomDropdown
                      selectedValue={frequency}
                      onValueChange={(val) => {
                        setFrequency(val);
                        setDate(null);
                        setDayOfWeek('');
                      }}
                      placeholder="Select Frequency"
                      disableSort={true}
                      items={[
                        { label: "Monthly", value: "Monthly" },
                        { label: "Weekly", value: "Weekly" },
                        { label: "Daily", value: "Daily" },
                        { label: "One-Time", value: "One-Time" }
                      ]}
                      style={styles.inputBox}
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1.1, marginRight: 8 }]}>
                    <Text style={styles.label}>Starts At<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                    <TouchableOpacity
                      style={[
                        styles.inputBox,
                        { paddingLeft: 6, paddingRight: 6, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' },
                        allDay && { opacity: 0.5 }
                      ]}
                      onPress={() => {
                        if (allDay) return;
                        if (Platform.OS === 'ios') {
                          const d = startsAt || new Date();
                          if (!startsAt) d.setHours(8, 0, 0, 0);
                          setTempStartsAt(d);
                          setShowIOSStartsAt(true);
                        } else {
                          setDatePickerMode('starts_at');
                        }
                      }}
                      disabled={allDay}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.inputInner,
                          { textAlign: 'left', lineHeight: 38, fontSize: 13, paddingRight: 14 },
                          (!startsAt && !allDay) && { color: 'rgba(255,255,255,0.5)' }
                        ]}
                        numberOfLines={1}
                      >
                        {allDay || !startsAt ? '-- : --' : formatTimeWithAMPM(startsAt)}
                      </Text>
                      <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.7)" style={{ position: 'absolute', right: 4 }} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputGroup, { flex: 1.1 }]}>
                    <Text style={styles.label}>Ends At<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                    <TouchableOpacity
                      style={[
                        styles.inputBox,
                        { paddingLeft: 6, paddingRight: 6, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' },
                        allDay && { opacity: 0.5 }
                      ]}
                      onPress={() => {
                        if (allDay) return;
                        if (Platform.OS === 'ios') {
                          const d = endsAt || new Date();
                          if (!endsAt) d.setHours(17, 0, 0, 0);
                          setTempEndsAt(d);
                          setShowIOSEndsAt(true);
                        } else {
                          setDatePickerMode('ends_at');
                        }
                      }}
                      disabled={allDay}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.inputInner,
                          { textAlign: 'left', lineHeight: 38, fontSize: 13, paddingRight: 14 },
                          (!endsAt && !allDay) && { color: 'rgba(255,255,255,0.5)' }
                        ]}
                        numberOfLines={1}
                      >
                        {allDay || !endsAt ? '-- : --' : formatTimeWithAMPM(endsAt)}
                      </Text>
                      <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.7)" style={{ position: 'absolute', right: 4 }} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* All Day checkbox */}
                <TouchableOpacity
                  style={[styles.checkboxRow, { marginBottom: 15 }]}
                  onPress={() => setAllDay(!allDay)}
                  activeOpacity={0.8}
                >
                  <View style={styles.checkbox}>
                    {allDay && <Ionicons name="checkmark" size={16} color="#00592d" />}
                  </View>
                  <Text style={styles.checkboxLabel}>All Day</Text>
                </TouchableOpacity>

                {/* Conditional Date / Schedule inputs below All Day */}
                {(frequency === 'Monthly' || frequency === 'One-Time') && (
                  <View style={[styles.inputGroup, { width: '100%', marginBottom: 15 }]}>
                    <Text style={styles.label}>Preferred Date<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                    <TouchableOpacity
                      style={[
                        styles.inputBox,
                        { paddingLeft: 8, paddingRight: 6, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }
                      ]}
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          setTempDate(date || new Date());
                          setShowIOSDate(true);
                        } else {
                          setDatePickerMode('date');
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.inputInner, { textAlign: 'left', lineHeight: 38, fontSize: 11, paddingRight: 18 }]}>
                        {formatDateMMDDYYYY(date)}
                      </Text>
                      <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.7)" style={{ position: 'absolute', right: 4 }} />
                    </TouchableOpacity>
                  </View>
                )}

                {frequency === 'Weekly' && (
                  <View style={[styles.inputGroup, { width: '100%', marginBottom: 15 }]}>
                    <Text style={styles.label}>Day of Week<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                    <CustomDropdown
                      selectedValue={dayOfWeek}
                      onValueChange={setDayOfWeek}
                      placeholder="Select Day"
                      disableSort={true}
                      items={[
                        { label: "Monday", value: "Monday" },
                        { label: "Tuesday", value: "Tuesday" },
                        { label: "Wednesday", value: "Wednesday" },
                        { label: "Thursday", value: "Thursday" },
                        { label: "Friday", value: "Friday" },
                        { label: "Saturday", value: "Saturday" },
                        { label: "Sunday", value: "Sunday" }
                      ]}
                      style={styles.inputBox}
                    />
                  </View>
                )}

                {frequency === 'Daily' && (
                  <View style={[styles.inputGroup, { width: '100%', marginBottom: 15 }]}>
                    <Text style={styles.label}>Schedule</Text>
                    <View style={[styles.inputBox, { justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ flex: 0, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' }}>
                        Repeats Every Day
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}



            {/* CATEGORIES / SKILLS */}
            <View style={{ marginTop: 5, marginBottom: 20 }}>
              <Text style={styles.boldSectionTitle}>
                {activeTab === 'TRANSPORTATION' ? 'Categories' : 'Skill Categories'}{' '}
                <Text style={styles.subtextWeight}>(Select those that apply)</Text>
              </Text>
              <View style={styles.pillsContainer}>
                {(activeTab === 'TRANSPORTATION' ? TRANSPORT_CATEGORIES : VOLUNTEER_SKILLS).map((item) => {
                  const isSelected = activeTab === 'TRANSPORTATION'
                    ? selectedCategories.includes(item)
                    : selectedSkills.includes(item);

                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.pillOutline, isSelected && styles.pillActive]}
                      activeOpacity={0.7}
                      onPress={() => activeTab === 'TRANSPORTATION' ? toggleCategory(item) : toggleSkill(item)}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* CONTACT PERSON */}
            <Text style={styles.boldSectionTitle}>Contact Person<Text style={{ color: '#E4B63F' }}> *</Text></Text>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 15 }]}>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.inputInner}
                    placeholder="Input First Name"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.inputInner}
                    placeholder="Input Last Name"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>
            </View>
            <View style={[styles.inputBox, { marginTop: 15 }]}>
              <TextInput
                style={styles.inputInner}
                placeholder="Input Email"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* EXTRA NOTES */}
            <Text style={[styles.boldSectionTitle, { marginTop: 20 }]}>
              Extra Notes <Text style={styles.subtextWeight}>(optional)</Text>
            </Text>
            <View style={[styles.inputBox, { height: 100, alignItems: 'flex-start' }]}>
              <TextInput
                style={[
                  styles.inputInner,
                  styles.textArea,
                  !description && { fontStyle: 'italic' }
                ]}
                placeholder="Input Address / Coverage"
                placeholderTextColor="rgba(255,255,255,0.5)"
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>

          </View>

          {/* BUTTONS ROW (OUTSIDE GREEN CARD) */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.orangeSubmitBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.orangeSubmitBtnText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>


        </ScrollView>
      </KeyboardAvoidingView>

      {/* Shared Absolute OS Date/Time Picker */}
      {Platform.OS === 'android' && datePickerMode && (
        <DateTimePicker
          value={
            datePickerMode === 'date'
              ? (date || new Date())
              : datePickerMode === 'starts_at'
                ? (startsAt || (activeTab === 'TRANSPORTATION' ? new Date() : (() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; })()))
                : (endsAt || (activeTab === 'TRANSPORTATION' ? new Date() : (() => { const d = new Date(); d.setHours(17, 0, 0, 0); return d; })()))
          }
          mode={
            datePickerMode === 'date' || (activeTab === 'TRANSPORTATION' && (datePickerMode === 'starts_at' || datePickerMode === 'ends_at'))
              ? 'date'
              : 'time'
          }
          display="default"
          initialInputMode={
            datePickerMode === 'starts_at' || datePickerMode === 'ends_at' ? 'keyboard' : 'default'
          }
          onChange={(event, selectedDate) => {
            const currentMode = datePickerMode;
            setDatePickerMode(null);
            if (event.type === 'set' && selectedDate) {
              if (currentMode === 'date') setDate(selectedDate);
              else if (currentMode === 'starts_at') setStartsAt(selectedDate);
              else if (currentMode === 'ends_at') setEndsAt(selectedDate);
            }
          }}
        />
      )}

      {/* iOS Date Modal */}
      <Modal visible={showIOSDate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowIOSDate(false)}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => { setDate(tempDate); setShowIOSDate(false); }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
              <DateTimePicker value={tempDate} mode="date" display="spinner" onChange={(_, d) => { if (d) setTempDate(d); }} style={{ width: '100%', alignSelf: 'center' }} textColor="#1a1a1a" />
            </View>
          </View>
        </View>
      </Modal>

      {/* iOS Starts At Modal */}
      <Modal visible={showIOSStartsAt} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowIOSStartsAt(false)}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>{activeTab === 'TRANSPORTATION' ? 'Select Delivery Date' : 'Select Start Time'}</Text>
              <TouchableOpacity onPress={() => { setStartsAt(tempStartsAt); setShowIOSStartsAt(false); }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
              <DateTimePicker
                value={tempStartsAt}
                mode={activeTab === 'TRANSPORTATION' ? 'date' : 'time'}
                display="spinner"
                onChange={(_, d) => { if (d) setTempStartsAt(d); }}
                style={{ width: '100%', alignSelf: 'center' }}
                textColor="#1a1a1a"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* iOS Ends At Modal */}
      <Modal visible={showIOSEndsAt} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowIOSEndsAt(false)}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>{activeTab === 'TRANSPORTATION' ? 'Select Return Date' : 'Select End Time'}</Text>
              <TouchableOpacity onPress={() => { setEndsAt(tempEndsAt); setShowIOSEndsAt(false); }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
              <DateTimePicker
                value={tempEndsAt}
                mode={activeTab === 'TRANSPORTATION' ? 'date' : 'time'}
                display="spinner"
                onChange={(_, d) => { if (d) setTempEndsAt(d); }}
                style={{ width: '100%', alignSelf: 'center' }}
                textColor="#1a1a1a"
              />
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },

  topHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 170,
    height: 58,
    marginBottom: 6,
  },
  iconBtn: {
    marginLeft: 10,
  },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 15 },

  titleSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 30,
    paddingBottom: 5,
    flexDirection: 'row',
  },
  heroMainIconImage: {
    width: 44,
    height: 44,
    marginRight: 10,
    tintColor: '#000000',
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5
  },

  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 25,
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 30,
    borderWidth: 1.5,
  },
  tabActive: {
    backgroundColor: '#F0B233',
    borderColor: '#F0B233',
  },
  tabInactive: {
    backgroundColor: '#FFF',
    borderColor: '#00592d',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#FFF',
  },
  tabTextInactive: {
    color: '#2B6E45',
  },

  greenCard: {
    backgroundColor: '#00592d',
    borderRadius: 30,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  inputGroup: {},

  label: { color: '#FFF', fontSize: 13, fontWeight: '800', marginBottom: 6, marginLeft: 2 },
  boldSectionTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: 12, marginLeft: 2 },
  subtextWeight: { fontWeight: '500', fontSize: 13 },

  inputBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  inputInner: {
    flex: 1,
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '500',
    height: '100%',
  },
  dropdownIcon: { marginLeft: 5 },
  absolutePicker: { display: 'none' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalDone: { fontSize: 15, fontWeight: '700', color: '#00592d' },

  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  pillOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 10,
  },
  pillActive: {
    backgroundColor: '#F0B233',
    borderColor: '#F0B233',
  },
  pillText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },

  textArea: {
    textAlignVertical: 'top',
    paddingTop: 10,
  },

  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 25,
    marginBottom: 10,
    width: '100%',
  },
  cancelBtn: {
    width: 90,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cancelBtnText: {
    color: '#777777',
    fontSize: 16,
    fontWeight: '700',
  },
  orangeSubmitBtn: {
    width: 130,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#CA6F2E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#CA6F2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  orangeSubmitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  }
});
