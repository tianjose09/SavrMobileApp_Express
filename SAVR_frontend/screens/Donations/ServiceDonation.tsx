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
  SafeAreaView,
  Modal,
} from 'react-native';
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

export default function ServiceDonation({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<'TRANSPORTATION' | 'VOLUNTEER'>('TRANSPORTATION');

  // Shared Form Fields
  const [address, setAddress] = useState('');
  const [frequency, setFrequency] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState<Date>(new Date());
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
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time' | null>(null);
  const [showIOSDate, setShowIOSDate] = useState(false);
  const [showIOSTime, setShowIOSTime] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, title: '', message: '' });

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
    if (!address || !firstName || !lastName || !email) {
      Alert.alert('Error', 'Please fill in required fields (Address, Contact details).');
      return;
    }

    const hours = time.getHours();
    if (hours < 8 || hours >= 17) {
      Alert.alert('Invalid Time', 'Please select a time within working hours (8:00 AM to 5:00 PM).');
      return;
    }

    setIsLoading(true);
    try {
      const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const serviceTypeLabel = activeTab === 'TRANSPORTATION' ? 'Transportation' : 'Volunteer Work';
      const payload: any = {
        service_type: serviceTypeLabel,
        frequency: frequency || 'One-time',
        service_date: date.toISOString().split('T')[0],
        service_time: timeString,
        address,
        contact_first_name: firstName,
        contact_last_name: lastName,
        contact_email: email,
        description,
        ...(activeTab === 'TRANSPORTATION' ? {
          quantity: parseInt(quantity) || 1,
          vehicle_type: vehicleType || null,
          capacity: capacity || null,
          max_distance: maxDistance || null,
          transport_categories: selectedCategories.length > 0 ? selectedCategories : null,
        } : {
          headcount: parseInt(headcount) || 1,
          preferred_work: preferredWork || null,
          skill_categories: selectedSkills.length > 0 ? selectedSkills : null,
        }),
      };

      const response = await ApiService.submitServiceDonation(payload);

      if (response.data.success) {
        const serviceLabel = activeTab === 'VOLUNTEER' ? 'Volunteer Work' : 'Transportation Service';
        const dateLabel = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        setToast({
          visible: true,
          title: `${serviceLabel} Submitted!`,
          message: `Your ${serviceLabel.toLowerCase()} pledge for ${dateLabel} has been recorded. Thank you!`,
        });
        // Reset form fields
        setAddress('');
        setFrequency('');
        setDate(new Date());
        setTime(new Date());
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
        setTimeout(() => navigation.navigate('HomeTabs', { screen: 'Home' }), 4500);
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
        <Image
          source={require('../../assets/images/logo/logobrown.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

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

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1.5, marginRight: 15 }]}>
                <Text style={styles.label}>Address / Coverage</Text>
                <CustomDropdown
                  selectedValue={address}
                  onValueChange={setAddress}
                  placeholder="Select a City / Region"
                  items={[
                    { label: "NCR (Metro Manila)", value: "NCR" },
                    { label: "Region I (Ilocos)", value: "Region I" },
                    { label: "Region II (Cagayan Valley)", value: "Region II" },
                    { label: "Region III (Central Luzon)", value: "Region III" },
                    { label: "Region IV-A (CALABARZON)", value: "Region IV-A" },
                    { label: "Region IV-B (MIMAROPA)", value: "Region IV-B" },
                    { label: "Region V (Bicol)", value: "Region V" },
                    { label: "Region VI (Western Visayas)", value: "Region VI" },
                    { label: "Region VII (Central Visayas)", value: "Region VII" },
                    { label: "Region VIII (Eastern Visayas)", value: "Region VIII" },
                    { label: "Region IX (Zamboanga)", value: "Region IX" },
                    { label: "Region X (Northern Mindanao)", value: "Region X" },
                    { label: "Region XI (Davao)", value: "Region XI" },
                    { label: "Region XII (SOCCSKSARGEN)", value: "Region XII" },
                    { label: "Region XIII (Caraga)", value: "Region XIII" },
                    { label: "BARMM", value: "BARMM" }
                  ]}
                  style={styles.inputBox}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>{activeTab === 'TRANSPORTATION' ? 'Quantity' : 'Headcount'}</Text>
                <View style={[styles.inputBox, { justifyContent: 'center' }]}>
                  <TextInput
                    style={[styles.inputInner, { textAlign: 'center' }]}
                    placeholder="##"
                    placeholderTextColor="#FFF"
                    keyboardType="numeric"
                    value={activeTab === 'TRANSPORTATION' ? quantity : headcount}
                    onChangeText={activeTab === 'TRANSPORTATION' ? setQuantity : setHeadcount}
                  />
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { width: '100%' }]}>
                <Text style={styles.label}>Frequency</Text>
                <CustomDropdown
                  selectedValue={frequency}
                  onValueChange={setFrequency}
                  placeholder="Select Frequency"
                  items={[
                    { label: "One-time", value: "One-time" },
                    { label: "Weekly", value: "Weekly" },
                    { label: "Monthly", value: "Monthly" },
                    { label: "Yearly", value: "Yearly" }
                  ]}
                  style={styles.inputBox}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 15 }]}>
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity
                  style={[styles.inputBox, { justifyContent: 'center' }]}
                  onPress={() => {
                    if (Platform.OS === 'ios') { setTempDate(date); setShowIOSDate(true); }
                    else setDatePickerMode('date');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.inputInner, { textAlign: 'center', lineHeight: 38 }]}>{date.toLocaleDateString()}</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Time</Text>
                <TouchableOpacity
                  style={[styles.inputBox, { justifyContent: 'center' }]}
                  onPress={() => {
                    if (Platform.OS === 'ios') { setTempTime(time); setShowIOSTime(true); }
                    else setDatePickerMode('time');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.inputInner, { textAlign: 'center', lineHeight: 38 }]}>
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {activeTab === 'TRANSPORTATION' ? (
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1.8, marginRight: 15 }]}>
                  <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>Type of Vehicle</Text>
                  <CustomDropdown
                    selectedValue={vehicleType}
                    onValueChange={setVehicleType}
                    placeholder="Select Vehicle"
                    items={[
                      { label: "Sedan", value: "Sedan" },
                      { label: "Hatchback", value: "Hatchback" },
                      { label: "SUV (Sport Utility Vehicle)", value: "SUV (Sport Utility Vehicle)" },
                      { label: "Crossover", value: "Crossover" },
                      { label: "Pickup truck", value: "Pickup truck" },
                      { label: "Van / Minivan", value: "Van / Minivan" },
                      { label: "Cargo van", value: "Cargo van" },
                      { label: "Box truck", value: "Box truck" },
                      { label: "Wagon", value: "Wagon" },
                      { label: "Coupe", value: "Coupe" },
                      { label: "Convertible", value: "Convertible" },
                      { label: "Hybrid", value: "Hybrid" },
                      { label: "Electric vehicle (EV)", value: "Electric vehicle (EV)" },
                      { label: "Diesel vehicle", value: "Diesel vehicle" },
                      { label: "Refrigerated truck", value: "Refrigerated truck" },
                      { label: "Motorcycle", value: "Motorcycle" }
                    ]}
                    style={styles.inputBox}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 15 }]}>
                  <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>Capacity</Text>
                  <View style={[styles.inputBox, { justifyContent: 'center' }]}>
                    <TextInput
                      style={[styles.inputInner, { textAlign: 'center' }]}
                      placeholder="##"
                      placeholderTextColor="#FFF"
                      keyboardType="numeric"
                      value={capacity}
                      onChangeText={setCapacity}
                    />
                  </View>
                </View>
                <View style={[styles.inputGroup, { flex: 1.2 }]}>
                  <Text style={[styles.label, { fontSize: 11 }]} numberOfLines={1} adjustsFontSizeToFit>Max Distance</Text>
                  <View style={[styles.inputBox, { justifyContent: 'center' }]}>
                    <TextInput
                      style={[styles.inputInner, { textAlign: 'center' }]}
                      placeholder="## km"
                      placeholderTextColor="#FFF"
                      keyboardType="numeric"
                      value={maxDistance}
                      onChangeText={setMaxDistance}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View style={[styles.inputGroup, { width: '100%' }]}>
                <Text style={styles.label}>Preferred Work</Text>
                <CustomDropdown
                  selectedValue={preferredWork}
                  onValueChange={setPreferredWork}
                  placeholder="Select Work Type"
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
            <Text style={styles.boldSectionTitle}>Contact Person</Text>
            <View style={styles.row}>
              <View style={[styles.inputBox, { flex: 1, marginRight: 15 }]}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="Input First Name"
                  placeholderTextColor="#FFF"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
              <View style={[styles.inputBox, { flex: 1 }]}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="Input Last Name"
                  placeholderTextColor="#FFF"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>
            <View style={[styles.inputBox, { marginTop: 15 }]}>
              <TextInput
                style={styles.inputInner}
                placeholder="Input Email"
                placeholderTextColor="#FFF"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* EXTRA NOTES */}
            <Text style={[styles.boldSectionTitle, { marginTop: 20 }]}>
              {activeTab === 'TRANSPORTATION' ? 'Service Description / Extra Notes' : 'Extra Notes'}
            </Text>
            <View style={[styles.inputBox, { height: 100, alignItems: 'flex-start' }]}>
              <TextInput
                style={[styles.inputInner, styles.textArea]}
                placeholder="Input Address / Coverage"
                placeholderTextColor="#FFF"
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* SUBMIT BUTTON - Native extension of the screen to give submission support */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator color="#00592d" /> : <Text style={styles.submitBtnText}>Submit Donation</Text>}
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Shared Absolute OS Date/Time Picker */}
      {Platform.OS === 'android' && datePickerMode && (
        <DateTimePicker
          value={datePickerMode === 'date' ? date : time}
          mode={datePickerMode === 'date' ? 'date' : 'time'}
          minimumDate={datePickerMode === 'date' ? new Date() : undefined}
          display="default"
          onChange={(event, selectedDate) => {
            const currentMode = datePickerMode;
            setDatePickerMode(null);
            if (event.type === 'set' && selectedDate) {
              if (currentMode === 'date') setDate(selectedDate);
              else if (currentMode === 'time') setTime(selectedDate);
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
              <DateTimePicker value={tempDate} mode="date" display="spinner" minimumDate={new Date()} onChange={(_, d) => { if (d) setTempDate(d); }} style={{ width: '100%', alignSelf: 'center' }} textColor="#1a1a1a" />
            </View>
          </View>
        </View>
      </Modal>

      {/* iOS Time Modal */}
      <Modal visible={showIOSTime} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowIOSTime(false)}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>Select Time</Text>
              <TouchableOpacity onPress={() => { setTime(tempTime); setShowIOSTime(false); }}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
              <DateTimePicker value={tempTime} mode="time" display="spinner" onChange={(_, d) => { if (d) setTempTime(d); }} style={{ width: '100%', alignSelf: 'center' }} textColor="#1a1a1a" />
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
    zIndex: 10,
    elevation: 5,
  },
  logoImage: {
    width: 170,
    height: 58,
    marginBottom: 6,
  },
  iconBtn: {
    marginLeft: 10,
  },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 15 },

  titleSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 30,
    paddingBottom: 5,
    flexDirection: 'row',
  },
  heroMainIconImage: {
    width: 60,
    height: 60,
    marginRight: 10,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#00592d',
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
    fontSize: 12,
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

  submitButton: {
    backgroundColor: '#FFF',
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnText: {
    color: '#00592d',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5
  }
});
