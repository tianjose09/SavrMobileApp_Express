import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../services/api';

interface Props {
  navigation: any;
  color?: string;
  size?: number;
  style?: object;
}

export default function NotificationBell({ navigation, color = '#4A4A4A', size = 26, style }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    ApiService.getCriticalNotifications()
      .then(res => setCount(res?.data?.notifications?.length || 0))
      .catch(() => {});
  }, []);

  return (
    <TouchableOpacity
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={[{ marginRight: 15 }, style]}
      onPress={() => navigation.navigate('Notifications')}
    >
      <Ionicons name="notifications-outline" size={size} color={color} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: 8,
    backgroundColor: '#E53935',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
});
