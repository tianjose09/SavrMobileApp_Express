import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';
import NotificationBell from '../../components/NotificationBell';

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
      const q = searchQuery.toLowerCase();
      return (
        (recipe.name && recipe.name.toLowerCase().includes(q)) ||
        (recipe.comment_desc && recipe.comment_desc.toLowerCase().includes(q)) ||
        (recipe.ingredients && recipe.ingredients.some((ing: any) =>
          ing.ingredient_name.toLowerCase().includes(q)
        ))
      );
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      <SafeAreaView style={{ backgroundColor: '#FFFFFF' }} edges={['top']}>
        {/* TOP BAR */}
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
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* HERO */}
        <View style={styles.heroRow}>
          <MaterialCommunityIcons name="chef-hat" size={36} color="#156133" style={{ marginRight: 10 }} />
          <Text style={styles.heroTitle}>Recipes</Text>
        </View>

        {/* SEARCH + ADD */}
        <View style={styles.actionRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes or ingredients..."
              placeholderTextColor="#AAAAAA"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#BBBBBB" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.82}
            onPress={() => navigation.navigate('AddRecipe')}
          >
            <Ionicons name="add" size={18} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.addBtnText}>Add Recipe</Text>
          </TouchableOpacity>
        </View>

        {/* COUNT LABEL */}
        {!isLoading && !fetchError && filteredRecipes.length > 0 && (
          <Text style={styles.countLabel}>
            {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}
            {searchQuery ? ' found' : ''}
          </Text>
        )}

        {/* CONTENT */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#156133" style={{ marginTop: 60 }} />
        ) : fetchError ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={52} color="#DDBBBB" />
            <Text style={styles.emptyText}>{fetchError}</Text>
          </View>
        ) : filteredRecipes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={56} color="#D9D0C8" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No recipes match your search.' : 'No recipes yet.'}
            </Text>
            {!searchQuery && (
              <Text style={styles.emptySubText}>
                Tap "Add Recipe" to save your first kitchen recipe.
              </Text>
            )}
          </View>
        ) : (
          filteredRecipes.map((recipe) => (
            <View key={recipe.id} style={styles.recipeCard}>

              {/* IMAGE + X OVERLAY */}
              {recipe.image_url ? (
                <View style={styles.imageWrapper}>
                  <Image source={{ uri: recipe.image_url }} style={styles.recipeImage} />
                  <TouchableOpacity
                    onPress={() => handleDeleteRecipe(recipe.id, recipe.name)}
                    activeOpacity={0.75}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="close" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleDeleteRecipe(recipe.id, recipe.name)}
                  activeOpacity={0.75}
                  style={styles.deleteBtnNoImage}
                >
                  <Ionicons name="close" size={16} color="#8E8E93" />
                </TouchableOpacity>
              )}

              {/* CARD BODY */}
              <View style={styles.cardBody}>

                {/* NAME + TAGS */}
                <Text style={styles.recipeName} numberOfLines={1}>{recipe.name}</Text>
                {recipe.tags && recipe.tags.length > 0 && (
                  <View style={styles.tagRow}>
                    {recipe.tags.map((tag: string, idx: number) => (
                      <View key={idx} style={styles.tagBadge}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* DESCRIPTION */}
                {recipe.comment_desc ? (
                  <Text style={styles.recipeDesc} numberOfLines={2}>
                    {recipe.comment_desc}
                  </Text>
                ) : null}

                {/* DIVIDER */}
                <View style={styles.divider} />

                {/* INGREDIENTS */}
                <View style={styles.ingHeader}>
                  <Text style={styles.ingTitle}>Ingredients per serving</Text>
                </View>
                <View style={styles.ingGrid}>
                  {recipe.ingredients && recipe.ingredients.map((ing: any, idx: number) => (
                    <View key={idx} style={styles.ingRow}>
                      <View style={styles.ingDot} />
                      <Text style={styles.ingText}>
                        <Text style={styles.ingQty}>{parseFloat(ing.qty_per_serving)}</Text>
                        {' '}{ing.unit}{'  '}{ing.ingredient_name}
                        {ing.is_optional && <Text style={styles.optional}> · optional</Text>}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6', // off-white tint matching Add Recipe screen
  },
  topHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoImage: {
    width: 160,
    height: 50,
  },
  iconBtn: {
    marginLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 18,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#156133',
    letterSpacing: -0.5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5E0DA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    height: '100%',
    paddingVertical: 0,
  },
  addBtn: {
    backgroundColor: '#cfab17',
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#cfab17',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  countLabel: {
    fontSize: 12,
    color: '#AAAAAA',
    fontWeight: '600',
    marginBottom: 14,
    marginLeft: 2,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 70,
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 14,
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubText: {
    marginTop: 6,
    fontSize: 13,
    color: '#BBBBBB',
    textAlign: 'center',
    lineHeight: 19,
  },
 
  /* â”€â”€ CARD â”€â”€ */
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2EAE5', // elegant soft green/grey border for visual definition
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  imageWrapper: {
    width: '100%',
    height: 190,
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0EDE8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  deleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnNoImage: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cardBody: {
    padding: 16,
  },
  recipeName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  tagBadge: {
    backgroundColor: '#EEF6EF',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#156133',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  recipeDesc: {
    fontSize: 13.5,
    color: '#777',
    lineHeight: 20,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0EDE8',
    marginVertical: 12,
  },
  ingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#156133',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ingGrid: {
    gap: 5,
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#156133',
    marginTop: 6,
    marginRight: 10,
    flexShrink: 0,
  },
  ingText: {
    fontSize: 13.5,
    color: '#555',
    lineHeight: 20,
    flex: 1,
  },
  ingQty: {
    fontWeight: '700',
    color: '#222',
  },
  optional: {
    fontStyle: 'italic',
    color: '#AAAAAA',
    fontSize: 12,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 30,
    color: '#D83232',
  },
});
