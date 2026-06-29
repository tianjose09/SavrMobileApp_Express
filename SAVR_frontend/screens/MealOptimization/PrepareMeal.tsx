import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ApiService } from '../../services/api';
import { MealPrepService } from '../../services/mealPrepService';


const DESCRIPTORS = new Set([
  'canned', 'fresh', 'dried', 'frozen', 'raw', 'cooked', 'whole', 'sliced',
  'chopped', 'diced', 'minced', 'ground', 'peeled', 'smoked', 'salted',
  'unsalted', 'boiled', 'fried', 'roasted', 'baked', 'powdered', 'shredded',
  'grated', 'crushed', 'steamed', 'organic', 'plain', 'large', 'small',
  'medium', 'hot', 'cold', 'sweet', 'sour', 'spicy', 'thick', 'thin',
]);

const isMatch = (selectedName: string, ingToken: string): boolean => {
  if (ingToken.includes(selectedName)) return true;
  const words = selectedName.split(/\s+/).filter(w => w.length > 2 && !DESCRIPTORS.has(w));
  if (words.length === 0) return false;
  // Anchor on the rightmost meaningful noun so "brown rice" never matches "brown sugar"
  const mainNoun = words[words.length - 1];
  return ingToken.includes(mainNoun);
};

export default function PrepareMeal({ route, navigation }: any) {
  const meal = route.params?.meal || {};
  const selectedIngredients: any[] = route.params?.selectedIngredients || [];
  const mealPax: number = route.params?.mealPax || 0;
  const prepMealId: string = route.params?.prepMealId || '';
  const mealRequestId: number | undefined = route.params?.mealRequestId;

  // â”€â”€ Video player (looping chef video) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const player = useVideoPlayer(
    require('../../assets/images/chefcooking.mp4'),
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    }
  );

  // â”€â”€ Animated dots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [isDone, setIsDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount(d => (d % 3) + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // â”€â”€ Handle Done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleDone = async () => {
    setIsSubmitting(true);
    try {
      const deductions = selectedIngredients
        .filter((ing: any) => ing.id && parseFloat(ing.inputQty) > 0)
        .map((ing: any) => ({ id: ing.id, qty_used: parseFloat(ing.inputQty) }));

      if (deductions.length > 0) {
        await ApiService.deductInventory({ deductions, meal_name: meal.name, servings: mealPax });
      }

      // Mark the staff meal request as done so it disappears from the dashboard
      if (mealRequestId) {
        ApiService.updateMealRequestStatus(mealRequestId, 'Done')
          .catch(err => console.error('[handleDone] status update failed:', err));
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'IngrMealPlanning', params: { forceRefresh: Date.now() } }],
      });
      navigation.navigate('Summary');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update inventory. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // â”€â”€ Done screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isDone) {
    return (
      <>
        <SafeAreaView style={{ flex: 0, backgroundColor: '#156133' }} />
        <SafeAreaView style={styles.doneContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#156133" />
          <View style={styles.doneContent}>
            <View style={styles.doneCheckCircle}>
              <Ionicons name="checkmark" size={56} color="#FFF" />
            </View>
            <Text style={styles.doneTitle}>Meal Prepared! ðŸŽ‰</Text>
            <Text style={styles.doneSubtitle}>
              <Text style={{ fontWeight: '800' }}>{meal.name}</Text> has been marked as done.{'\n'}
              Ingredient quantities have been deducted from the inventory.
            </Text>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'IngrMealPlanning' }],
                });
                navigation.navigate('Summary');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="list" size={20} color="#156133" style={{ marginRight: 8 }} />
              <Text style={styles.doneBtnText}>View Meal Summary</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <SafeAreaView style={{ flex: 0, backgroundColor: '#156133' }} />
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#156133" />

        {/* â”€â”€ HEADER â”€â”€ */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Prepare Meal</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* â”€â”€ COOKING VIDEO â”€â”€ */}
          <View style={styles.cookingStage}>
            <VideoView
              player={player}
              style={styles.chefVideo}
              contentFit="contain"
              nativeControls={false}
            />
          </View>

          {/* â”€â”€ TITLE â”€â”€ */}
          <View style={styles.titleSection}>
            <Text style={styles.preparingText}>
              Preparing your food{'.'.repeat(dotCount)}
            </Text>
            <Text style={styles.mealNameText}>{meal.name}</Text>
            {mealPax > 0 && (
              <View style={styles.paxPill}>
                <Ionicons name="people" size={14} color="#156133" />
                <Text style={styles.paxPillText}>~{mealPax} servings</Text>
              </View>
            )}
          </View>

          {/* â”€â”€ INGREDIENTS BEING USED â”€â”€ */}
          <View style={styles.ingrSection}>
            <View style={styles.ingrHeader}>
              <MaterialCommunityIcons name="food-variant" size={20} color="#8A3E08" />
              <Text style={styles.ingrTitle}>Ingredients to be Used</Text>
            </View>
            <Text style={styles.ingrSubtitle}>
              These quantities will be deducted from your inventory upon completion
            </Text>

            {selectedIngredients.map((ing, idx) => (
              <View key={ing.id ?? idx} style={styles.ingrCard}>
                <View style={styles.ingrIconWrap}>
                  <MaterialCommunityIcons name="leaf" size={18} color="#156133" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ingrName}>{ing.name}</Text>
                  <Text style={styles.ingrAvail}>Available: {ing.maxQty} {ing.unit}</Text>
                </View>
                <View style={styles.ingrQtyBadge}>
                  <Text style={styles.ingrQtyText}>
                    {parseFloat(ing.inputQty) || 0} {ing.unit}
                  </Text>
                  <Text style={styles.ingrQtyLabel}>to use</Text>
                </View>
              </View>
            ))}
          </View>

          {/* â”€â”€ MEAL INFO â”€â”€ */}
          {meal.ingredients_used && (
            <View style={styles.recipeBox}>
              <Text style={styles.recipeTitle}>Full Recipe Ingredients</Text>
              <Text style={styles.recipeText}>
                {(meal.ingredients_used as string).split(',').map((ing: string, idx: number, arr: string[]) => {
                  const token = ing.trim();
                  const matched = selectedIngredients.some((si: any) =>
                    isMatch((si.name || '').toLowerCase(), token.toLowerCase())
                  );
                  return (
                    <Text
                      key={idx}
                      style={matched ? { fontWeight: '800', color: '#156133' } : undefined}
                    >
                      {token}{idx < arr.length - 1 ? ', ' : ''}
                    </Text>
                  );
                })}
              </Text>
            </View>
          )}

          {/* â”€â”€ DONE BUTTON â”€â”€ */}
          <TouchableOpacity
            style={[styles.doneButton, isSubmitting && { opacity: 0.7 }]}
            onPress={handleDone}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={26} color="#FFF" style={{ marginRight: 10 }} />
                <Text style={styles.doneButtonText}>Okay</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#156133',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.3,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 5,
    alignItems: 'center',
  },

  // â”€â”€ Cooking Stage â”€â”€
  cookingStage: {
    width: '100%',
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  chefVideo: {
    width: '100%',
    height: 280,
  },

  // â”€â”€ Title â”€â”€
  titleSection: {
    alignItems: 'center',
    marginBottom: 28,
    width: '100%',
  },
  preparingText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#156133',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  mealNameText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#db7a2f',
    textAlign: 'center',
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  paxPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaf6ef',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: '#b8dfc9',
  },
  paxPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#156133',
  },

  // â”€â”€ Ingredients â”€â”€
  ingrSection: {
    width: '100%',
    backgroundColor: '#fdf6ec',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e8c87a',
    padding: 18,
    marginBottom: 18,
  },
  ingrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  ingrTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#8A3E08',
  },
  ingrSubtitle: {
    fontSize: 12,
    color: '#7a6040',
    marginBottom: 14,
  },
  ingrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6d8b8',
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  ingrIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eef6f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingrName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#156133',
    marginBottom: 2,
  },
  ingrAvail: {
    fontSize: 11,
    color: '#7a6040',
    fontWeight: '500',
  },
  ingrQtyBadge: {
    backgroundColor: '#db7a2f',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  ingrQtyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  ingrQtyLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },

  // â”€â”€ Recipe Box â”€â”€
  recipeBox: {
    width: '100%',
    backgroundColor: '#ebf5ee',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#b8dfc9',
  },
  recipeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#156133',
    marginBottom: 8,
  },
  recipeText: {
    fontSize: 13,
    color: '#325741',
    lineHeight: 20,
  },

  // â”€â”€ Done Button â”€â”€
  doneButton: {
    width: '100%',
    backgroundColor: '#156133',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#156133',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  doneButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },

  // â”€â”€ Done Success Screen â”€â”€
  doneContainer: {
    flex: 1,
    backgroundColor: '#156133',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneContent: {
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  doneCheckCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  doneTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 14,
    textAlign: 'center',
  },
  doneSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  doneBtnText: {
    color: '#156133',
    fontWeight: '800',
    fontSize: 16,
  },
});
