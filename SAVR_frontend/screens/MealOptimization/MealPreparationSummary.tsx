import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, StatusBar, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { MealPrepService, PrepMealItem, PrepStatus } from '../../services/mealPrepService';
import { ApiService } from '../../services/api';

export default function MealPreparationSummary({ navigation }: any) {
  const [meals, setMeals] = useState<PrepMealItem[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      loadMeals();
    }, [])
  );

  const loadMeals = async () => {
    const data = await MealPrepService.getMeals();
    setMeals(data);
  };



  const handleStatusToggle = (meal: PrepMealItem) => {
    Alert.alert(
      'Update Status',
      `Change status for ${meal.mealName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Preparing',
          onPress: async () => {
            await MealPrepService.updateStatus(meal.id, 'Preparing');
            loadMeals();
          }
        },
        {
          text: 'Set Done',
          onPress: async () => {
            if (meal.status !== 'Done') {
              try {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const expiryDate = tomorrow.toISOString().split('T')[0];
                await ApiService.addInventory({
                  food_name: meal.mealName,
                  category: 'Prepared Meals',
                  quantity: meal.pax || 1,
                  unit: 'meal',
                  meal_type: 'Prepared Meals',
                  expiration_date: expiryDate,
                });
                await MealPrepService.updateStatus(meal.id, 'Done');
                Alert.alert('Success', 'Meal marked as done and added to prepared meals inventory!');
                loadMeals();
              } catch (e: any) {
                console.error(e);
                Alert.alert('Error', 'Failed to complete meal. Please try again.');
              }
            }
          }
        }
      ]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete Meals',
      `Are you sure you want to delete ${selectedIds.size} meal(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await MealPrepService.deleteMeals(Array.from(selectedIds));
            setIsSelectMode(false);
            setSelectedIds(new Set());
            loadMeals();
          }
        }
      ]
    );
  };

  const getStatusStyle = (status: PrepStatus) => {
    switch (status) {
      case 'Preparing': return styles.statusPreparing;
      case 'Done': return styles.statusDone;
      case 'Cancelled': return styles.statusCancelled;
      default: return styles.statusPreparing;
    }
  };

  const renderItem = ({ item }: { item: PrepMealItem }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <View style={styles.mealRow}>
        {isSelectMode && (
          <TouchableOpacity 
            style={styles.checkboxContainer}
            onPress={() => {
              const newSelected = new Set(selectedIds);
              if (isSelected) newSelected.delete(item.id);
              else newSelected.add(item.id);
              setSelectedIds(newSelected);
            }}
          >
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
            </View>
          </TouchableOpacity>
        )}
        <View style={styles.mealInfo}>
          <Text style={styles.mealName}>{item.mealName}</Text>
          <Text style={styles.ingredients} numberOfLines={1}>{item.ingredients}</Text>
        </View>
        <View style={styles.paxInfo}>
          <Text style={styles.paxText}>{item.pax} Pax</Text>
        </View>
        <TouchableOpacity 
          style={[styles.statusPill, getStatusStyle(item.status)]}
          onPress={() => !isSelectMode && handleStatusToggle(item)}
          disabled={isSelectMode}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAF9" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#156133" />
        </TouchableOpacity>
      </View>

      <View style={styles.titleSection}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.pageTitle}>List of Meals</Text>
            <Text style={styles.pageSubtitle}>Track your meal preparation status</Text>
          </View>
          <TouchableOpacity
            style={styles.selectBtn}
            onPress={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedIds(new Set());
            }}
          >
            <Text style={styles.selectBtnText}>{isSelectMode ? 'Cancel' : 'Select'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isSelectMode && (
        <View style={styles.selectionToolbar}>
          <TouchableOpacity onPress={() => {
            if (selectedIds.size === meals.length) {
              setSelectedIds(new Set());
            } else {
              setSelectedIds(new Set(meals.map(m => m.id)));
            }
          }}>
            <Text style={styles.toolbarText}>{selectedIds.size === meals.length ? 'Deselect All' : 'Select All'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteSelected}>
            <Text style={[styles.toolbarText, { color: '#E43E3E' }]}>Delete ({selectedIds.size})</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.listContainer}>
        {meals.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No meals being prepared right now.</Text>
          </View>
        ) : (
          <FlatList
            data={meals}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    marginBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginLeft: -8,
  },
  titleSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectBtn: {
    backgroundColor: '#eef6f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectBtnText: {
    color: '#156133',
    fontWeight: '700',
    fontSize: 14,
  },
  selectionToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  toolbarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#156133',
  },
  checkboxContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#156133',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkboxSelected: {
    backgroundColor: '#156133',
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#156133',
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#6c7c73',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 30,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e8eedf',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  listContent: {
    paddingVertical: 10,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  deleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  mealInfo: {
    flex: 1,
    paddingRight: 10,
  },
  mealName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#156133',
    marginBottom: 4,
  },
  ingredients: {
    fontSize: 13,
    color: '#84938a',
  },
  paxInfo: {
    marginRight: 16,
    alignItems: 'flex-end',
    width: 60,
  },
  paxText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000',
  },
  statusPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    minWidth: 100,
    alignItems: 'center',
  },
  statusText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  statusPreparing: {
    backgroundColor: '#eab308', // yellow
  },
  statusDone: {
    backgroundColor: '#156133', // green
  },
  statusCancelled: {
    backgroundColor: '#b91c1c', // red
    borderWidth: 2,
    borderColor: '#1d4ed8', // blue border to match their sample
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 20,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#84938a',
    fontSize: 15,
    fontWeight: '600',
  }
});
