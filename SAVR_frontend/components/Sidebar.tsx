import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageUtils, StorageKeys } from '../utils/storage';
import { LogoutHelper } from '../utils/logout';

export default function Sidebar(props: any) {
  const [displayName, setDisplayName] = useState('User');
  const [role, setRole] = useState('donor');

  useEffect(() => {
    const loadInfo = async () => {
      const name = await StorageUtils.getItem(StorageKeys.DISPLAY_NAME) || 'User';
      const userRole = await StorageUtils.getItem(StorageKeys.USER_ROLE) || 'donor';
      setDisplayName(name);
      setRole(userRole);
    };
    loadInfo();
  }, [props]);

  const navigateTo = (screen: string) => {
    props.navigation.navigate('HomeTabs', { screen });
  };

  const dashboardRoute = () => {
    return 'Home';
  };

  return (
    <View style={styles.container}>
      {/* Arrow Hump */}
      <View style={styles.arrowHumpWrapper}>
        <View style={styles.arrowHump} />
      </View>

      <View style={styles.menuBox}>
        {/* Header Profile Info */}
        <View style={styles.profileBox}>
          <Text style={styles.nameText} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.roleText}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
        </View>

        <View style={styles.divider} />

        {/* Links */}
        <TouchableOpacity style={styles.navItem} onPress={() => navigateTo(dashboardRoute())}>
          <View style={styles.iconWrap}><Ionicons name="home-outline" size={20} color="#1B5B39" /></View>
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Profile')}>
          <View style={styles.iconWrap}><Ionicons name="person-outline" size={20} color="#1B5B39" /></View>
          <Text style={styles.navText}>Profile Management</Text>
        </TouchableOpacity>

        {(role === 'donor' || role === 'organization') && (
          <>
            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Activities')}>
              <View style={styles.iconWrap}><Ionicons name="receipt-outline" size={20} color="#1B5B39" /></View>
              <Text style={styles.navText}>Activity History</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('AchievementBadges')}>
              <View style={styles.iconWrap}><Ionicons name="ribbon-outline" size={20} color="#1B5B39" /></View>
              <Text style={styles.navText}>My Achievements</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Dynamic Action */}
        {(role === 'donor' || role === 'organization') && (
          <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Donate')}>
            <View style={styles.iconWrap}><Ionicons name="gift-outline" size={20} color="#1B5B39" /></View>
            <Text style={styles.navText}>{role === 'donor' ? 'Donate Now' : 'Request Resources'}</Text>
          </TouchableOpacity>
        )}

        {/* Beneficiary Links */}
        {role === 'beneficiary' && (
          <>
            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Request')}>
              <View style={styles.iconWrap}><Ionicons name="document-text-outline" size={20} color="#1B5B39" /></View>
              <Text style={styles.navText}>Create Request</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Track')}>
              <View style={styles.iconWrap}><Ionicons name="location-outline" size={20} color="#1B5B39" /></View>
              <Text style={styles.navText}>Track My Request</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Partner Kitchen Links */}
        {role === 'partner_kitchen' && (
          <>
            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Ingredients')}>
              <View style={styles.iconWrap}><Ionicons name="fast-food-outline" size={20} color="#1B5B39" /></View>
              <Text style={styles.navText}>Ingredients and Meal Scaling</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('FoodInventory')}>
              <View style={styles.iconWrap}><Ionicons name="cube-outline" size={20} color="#1B5B39" /></View>
              <Text style={styles.navText}>Inventory</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Logout */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            Alert.alert(
              'Log Out',
              'Are you sure you want to log out of your account?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Log Out',
                  style: 'destructive',
                  onPress: () => LogoutHelper.logout(props.navigation.getParent() || props.navigation)
                }
              ]
            );
          }}>
          <View style={styles.iconWrap}><Ionicons name="log-out-outline" size={20} color="#d32f2f" /></View>
          <Text style={[styles.navText, { color: '#d32f2f' }]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginRight: 10,
    alignItems: 'flex-end',
  },
  arrowHumpWrapper: {
    width: '100%',
    alignItems: 'flex-end',
    paddingRight: 20, // aligns under the hamburger
  },
  arrowHump: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFF',
  },
  menuBox: {
    backgroundColor: '#FFF',
    width: '100%',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  profileBox: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: 15,
  },
  nameText: {
    color: '#333',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  roleText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginHorizontal: 10,
    marginBottom: 5,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderRadius: 8,
  },
  iconWrap: {
    width: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
    marginLeft: 5,
  },
});
