import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, ScrollView, Image, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';
import NotificationBell from '../../components/NotificationBell';
import Swipeable from 'react-native-gesture-handler/Swipeable';

export default function RecipesList({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchRecipes = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await ApiService.getRecipes();
      if (res.data && res.data.success) {
        setRecipes(res.data.data || []);
      } else {
        setFetchError('Failed to load recipes. Please try again.');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to load recipes. Please try again.';
      setFetchError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchRecipes();
    }, [])
  );

  const handleDeleteRecipe = (recipeId: string, recipeName: string) => {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${recipeName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteRecipe(recipeId);
              setRecipes(prev => prev.filter(r => r.id !== recipeId));
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message || 'Failed to delete recipe.');
            }
          },
        },
      ]
    );
  };

  const filteredRecipes = recipes
    .filter(recipe => {
      const matchesSearch =
        (recipe.name && recipe.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (recipe.comment_desc && recipe.comment_desc.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (recipe.ingredients && recipe.ingredients.some((ing: any) =>
          ing.ingredient_name.toLowerCase().includes(searchQuery.toLowerCase())
        ));
      return matchesSearch;
    })
    .sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      {/* TOP BAR HEADER */}
      <View style={styles.topHeader}>
        <Image
          source={require('../../assets/images/logo/logobrown.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <NotificationBell navigation={navigation} color="#544434" size={28} style={{ marginRight: 5 }} />
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation?.openDrawer?.()}>
            <Ionicons name="menu-outline" size={32} color="#544434" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* HERO */}
        <View style={styles.heroRow}>
          <MaterialCommunityIcons name="chef-hat" size={42} color="#156133" style={styles.heroIcon} />
          <Text style={styles.heroTitle}>Recipes</Text>
        </View>

        {/* SEARCH AND ADD BUTTON */}
        <View style={styles.actionRow}>
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes or ingredients..."
              placeholderTextColor="#555555"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Ionicons name="search" size={20} color="#111" style={styles.searchIcon} />
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AddRecipe')}
          >
            <Text style={styles.addBtnText}>+ ADD RECIPE</Text>
          </TouchableOpacity>
        </View>

        {/* Swipe hint label */}
        {filteredRecipes.length > 0 && (
          <View style={styles.swipeHintRow}>
            <Ionicons name="arrow-back" size={12} color="#AAAAAA" />
            <Text style={styles.swipeHintText}>Swipe left on a card to delete</Text>
          </View>
        )}

        {/* RECIPES CONTAINER */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#106037" style={{ marginTop: 40 }} />
        ) : fetchError ? (
          <Text style={styles.errorText}>{fetchError}</Text>
        ) : filteredRecipes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={60} color="#CCCCCC" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No recipes match your search.' : 'No recipes added yet.'}
            </Text>
            <Text style={styles.emptySubText}>Click "+ ADD RECIPE" to add your kitchen's custom recipes.</Text>
          </View>
        ) : (
          filteredRecipes.map((recipe) => {
            const renderRightActions = () => (
              <TouchableOpacity
                style={styles.swipeDeleteAction}
                onPress={() => handleDeleteRecipe(recipe.id, recipe.name)}
                activeOpacity={0.85}
              >
                <Ionicons name="trash" size={24} color="#FFF" />
                <Text style={styles.swipeDeleteText}>Delete</Text>
              </TouchableOpacity>
            );

            return (
              <Swipeable
                key={recipe.id}
                renderRightActions={renderRightActions}
                overshootRight={false}
                friction={2}
              >
                <View style={styles.recipeCard}>
                  {recipe.image_url ? (
                    <Image source={{ uri: recipe.image_url }} style={styles.recipeCardImage} />
                  ) : null}
                  <View style={styles.recipeCardContent}>
                    <View style={styles.recipeHeader}>
                      <Text style={styles.recipeName}>{recipe.name}</Text>
                      <View style={styles.tagContainer}>
                        {recipe.tags && recipe.tags.map((tag: string, idx: number) => (
                          <View key={idx} style={styles.tagBadge}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {recipe.comment_desc ? (
                      <Text style={styles.recipeDesc}>
                        {recipe.comment_desc}
                      </Text>
                    ) : null}

                    <View style={styles.divider} />

                    <Text style={styles.ingredientsTitle}>Ingredients (Per Serving):</Text>
                    <View style={styles.ingredientsGrid}>
                      {recipe.ingredients && recipe.ingredients.map((ing: any, idx: number) => (
                        <View key={idx} style={styles.ingredientRow}>
                          <Ionicons name="ellipse" size={6} color="#156133" style={{ marginRight: 8, marginTop: 6 }} />
                          <Text style={styles.ingredientText}>
                            <Text style={{ fontWeight: '700' }}>{parseFloat(ing.qty_per_serving)}</Text> {ing.unit} {ing.ingredient_name}
                            {ing.is_optional && <Text style={styles.optionalLabel}> (Optional)</Text>}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </Swipeable>
            );
          })
        )}

        {/* Empty space for tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
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
    marginLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 25,
  },
  heroIcon: {
    marginRight: 10,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#156133',
    letterSpacing: -0.5,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchWrap: {
    flex: 1,
    height: 40,
    borderWidth: 1.2,
    borderColor: '#786F67',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginRight: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    height: '100%',
    paddingVertical: 0,
    marginVertical: 0,
  },
  searchIcon: {
    marginLeft: 8,
  },
  addBtn: {
    backgroundColor: '#cfab17',
    height: 40,
    paddingHorizontal: 15,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  swipeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 12,
    gap: 4,
  },
  swipeHintText: {
    fontSize: 11,
    color: '#AAAAAA',
    fontStyle: 'italic',
  },
  swipeDeleteAction: {
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginBottom: 20,
    marginLeft: 8,
  },
  swipeDeleteText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 30,
    color: '#D83232',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: '#888888',
    fontWeight: '600',
  },
  emptySubText: {
    marginTop: 6,
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E9E4DF',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  recipeCardContent: {
    padding: 18,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  recipeName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#156133',
    flex: 1,
    marginRight: 10,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tagBadge: {
    backgroundColor: '#eef6f0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#156133',
  },
  recipeDesc: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#E9E4DF',
    marginVertical: 12,
  },
  ingredientsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#544434',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  ingredientsGrid: {
    paddingLeft: 4,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  ingredientText: {
    fontSize: 13.5,
    color: '#655A52',
    lineHeight: 18,
  },
  optionalLabel: {
    fontStyle: 'italic',
    color: '#888888',
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#156133',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  recipeCardImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
});
