import React, { useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ToastType = 'success' | 'food' | 'service' | 'info';

interface ToastBannerProps {
  visible: boolean;
  title: string;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
}

function getConfig(type: ToastType) {
  switch (type) {
    case 'food':
      return { bg: '#D35400', icon: 'restaurant', accent: '#F39C12' };
    case 'service':
      return { bg: '#00592d', icon: 'people', accent: '#A9DFBF' };
    case 'info':
      return { bg: '#2C3E50', icon: 'information-circle', accent: '#85929E' };
    default: // success / financial
      return { bg: '#00592d', icon: 'checkmark-circle', accent: '#A9DFBF' };
  }
}

export default function ToastBanner({
  visible,
  title,
  message,
  type = 'success',
  duration = 4000,
  onHide,
}: ToastBannerProps) {
  const translateY = useRef(new Animated.Value(-160)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slideOut = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, { toValue: -160, duration: 320, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.92, duration: 300, useNativeDriver: true }),
    ]).start(() => onHide?.());
  };

  useEffect(() => {
    if (visible) {
      // Reset before animating in
      translateY.setValue(-160);
      opacity.setValue(0);
      scale.setValue(0.92);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 7,
          tension: 55,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 55,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(slideOut, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  const cfg = getConfig(type);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          backgroundColor: cfg.bg,
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    >
      {/* Accent bar */}
      <View style={[styles.accentBar, { backgroundColor: cfg.accent }]} />

      <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
        <Ionicons name={cfg.icon as any} size={26} color="#FFF" />
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.toastTitle}>{title}</Text>
        <Text style={styles.toastMessage} numberOfLines={2}>
          {message}
        </Text>
      </View>

      <TouchableOpacity
        onPress={slideOut}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.closeBtn}
      >
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.75)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 44,
    left: 14,
    right: 14,
    zIndex: 9999,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 12,
    overflow: 'hidden',
  },

  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginLeft: 8,
    flexShrink: 0,
  },

  textBlock: {
    flex: 1,
  },

  toastTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
    letterSpacing: -0.2,
  },

  toastMessage: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12.5,
    lineHeight: 17,
  },

  closeBtn: {
    marginLeft: 8,
    padding: 4,
    flexShrink: 0,
  },
});
