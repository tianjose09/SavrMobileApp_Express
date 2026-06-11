import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setAlertListener, AlertConfig, AlertButton } from '../utils/globalAlert';

const { width } = Dimensions.get('window');

export default function GlobalAlertModal() {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [scaleAnim] = useState(new Animated.Value(0.9));

  useEffect(() => {
    setAlertListener((newConfig) => {
      if (newConfig) {
        setConfig(newConfig);
        setVisible(true);
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }).start();
      } else {
        setVisible(false);
        scaleAnim.setValue(0.9);
      }
    });

    return () => {
      setAlertListener(null);
    };
  }, []);

  if (!visible || !config) return null;

  const { title, message, buttons, options } = config;

  const handleButtonPress = (btn: AlertButton) => {
    setVisible(false);
    if (btn.onPress) {
      btn.onPress();
    }
  };

  const handleBackdropPress = () => {
    if (options?.cancelable !== false) {
      setVisible(false);
      if (options?.onDismiss) {
        options.onDismiss();
      }
    }
  };

  // Determine icon type based on Title
  const getIconConfig = () => {
    const tLower = title.toLowerCase();
    if (tLower.includes('success') || tLower.includes('confirm') || tLower.includes('created') || tLower.includes('sent') || tLower.includes('saved')) {
      return { name: 'checkmark-circle-outline' as const, color: '#267A41' };
    }
    if (tLower.includes('error') || tLower.includes('fail') || tLower.includes('invalid') || tLower.includes('locked') || tLower.includes('missing')) {
      return { name: 'alert-circle-outline' as const, color: '#C0392B' };
    }
    if (tLower.includes('cancel') || tLower.includes('sure') || tLower.includes('delete') || tLower.includes('remove')) {
      return { name: 'help-circle-outline' as const, color: '#D35400' };
    }
    return { name: 'information-circle-outline' as const, color: '#00592d' };
  };

  const iconCfg = getIconConfig();

  // If no buttons, default to a single "OK" button
  const renderedButtons = buttons && buttons.length > 0
    ? buttons
    : [{ text: 'OK', onPress: () => {} }];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleBackdropPress}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* Top colored accent line */}
          <View style={[styles.accentLine, { backgroundColor: iconCfg.color }]} />

          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name={iconCfg.name} size={44} color={iconCfg.color} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Buttons */}
          <View style={[
            styles.buttonContainer,
            renderedButtons.length > 2 ? styles.buttonContainerVertical : styles.buttonContainerHorizontal
          ]}>
            {renderedButtons.map((btn, idx) => {
              const isCancel = btn.style === 'cancel' || btn.text?.toLowerCase() === 'cancel' || btn.text?.toLowerCase() === 'no';
              const isDestructive = btn.style === 'destructive' || btn.text?.toLowerCase().includes('delete') || btn.text?.toLowerCase().includes('cancel this');
              
              let btnBg = '#00592d';
              let textColor = '#FFFFFF';
              let borderColor = 'transparent';
              let borderWidth = 0;

              if (isCancel) {
                btnBg = '#FFFFFF';
                textColor = '#777777';
                borderColor = '#E0E0E0';
                borderWidth = 1.5;
              } else if (isDestructive) {
                btnBg = '#C0392B';
              } else {
                // If it's a primary button, let's use the matching icon accent color
                btnBg = iconCfg.color;
              }

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.button,
                    { backgroundColor: btnBg, borderColor, borderWidth },
                    renderedButtons.length > 2 ? styles.buttonVertical : styles.buttonHorizontal
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleButtonPress(btn)}
                >
                  <Text style={[styles.buttonText, { color: textColor }]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: width * 0.84,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
    overflow: 'hidden',
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  iconContainer: {
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14.5,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  buttonContainer: {
    width: '100%',
    justifyContent: 'center',
  },
  buttonContainerHorizontal: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonContainerVertical: {
    flexDirection: 'column',
    gap: 8,
  },
  button: {
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  buttonHorizontal: {
    flex: 1,
  },
  buttonVertical: {
    width: '100%',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
