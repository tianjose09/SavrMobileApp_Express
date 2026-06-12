import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DropdownItem {
  label: string;
  value: string;
}

interface CustomDropdownProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
  items: DropdownItem[];
  placeholder?: string;
  style?: any;
  placeholderTextColor?: string;
  disableSort?: boolean;
}

export default function CustomDropdown({
  selectedValue,
  onValueChange,
  items,
  placeholder = "Select...",
  style,
  placeholderTextColor,
  disableSort = false
}: CustomDropdownProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const sortedItems = disableSort
    ? (items || [])
    : [...(items || [])].sort((a, b) => a.label.localeCompare(b.label));
  const selectedItem = (items || []).find(i => i.value === selectedValue);

  const getPlaceholderColor = () => {
    if (placeholderTextColor) return placeholderTextColor;
    if (style?.color) {
      const c = String(style.color).toLowerCase().trim();
      if (c === '#fff' || c === '#ffffff' || c === 'white' || c.startsWith('rgba(255')) {
        return 'rgba(255, 255, 255, 0.65)';
      }
      return 'rgba(0, 0, 0, 0.35)';
    }
    return 'rgba(255, 255, 255, 0.45)';
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.text,
            !selectedValue && styles.placeholderText,
            { flex: 1, paddingRight: 5 },
            style?.color ? { color: selectedValue ? style.color : getPlaceholderColor() } : null,
            style?.fontSize ? { fontSize: style.fontSize } : null,
            style?.fontWeight ? { fontWeight: style.fontWeight } : null,
          ]}
          numberOfLines={1}
        >
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={style?.color || "#FFF"} />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.dropdownBox}>
            <FlatList
              data={sortedItems}
              keyExtractor={(item, index) => `${item.value}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={(e) => {
                    (e as any)?.stopPropagation?.();
                    onValueChange(item.value);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[styles.itemText, selectedValue === item.value && styles.selectedItemText]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  text: {
    color: '#FFF',
    fontSize: 11.5,
    paddingBottom: 2,
    textAlign: 'left',
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.45)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownBox: {
    width: '65%',
    maxHeight: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  itemText: {
    fontSize: 14,
    color: '#333333',
  },
  selectedItemText: {
    fontWeight: '700',
    color: '#00592d',
  }
});
