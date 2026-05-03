import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, ScrollView, Image, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

export default function FoodInventory({ route, navigation }: any) {
    const [searchQuery, setSearchQuery] = useState('');
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    const fetchInventory = async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
            const res = await ApiService.getInventory();
            if (res.data && res.data.success) {
                setInventoryItems(res.data.items || []);
            } else {
                setFetchError('Failed to load inventory. Please try again.');
                setInventoryItems([]);
            }
        } catch (e: any) {
            const msg = e?.response?.data?.message || 'Failed to load inventory. Please try again.';
            setFetchError(msg);
            setInventoryItems([]);
        } finally {
            setIsLoading(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchInventory();
        }, [])
    );

    const categories = [...new Set(inventoryItems.map((i: any) => i.category).filter(Boolean))].sort() as string[];
    const filteredItems = inventoryItems.filter(item => {
        const matchesSearch =
            (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = !selectedCategory || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

            {/* HEADER NAV */}
            <View style={styles.topHeaderWrap}>
                <View style={styles.topNav}>
                    <Image
                        source={require('../../assets/images/logo/logobrown.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                    <View style={styles.topRightIcons}>
                        <TouchableOpacity style={styles.iconBtn}>
                            <Ionicons name="notifications-outline" size={28} color="#544434" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation?.openDrawer?.()}>
                            <Ionicons name="menu-outline" size={36} color="#544434" />
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.topDivider} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* HERO */}
                <View style={styles.heroRow}>
                    <Image
                        source={require('../../assets/images/foodonationicon.png')}
                        style={styles.heroIcon}
                        resizeMode="contain"
                    />
                    <Text style={styles.heroTitle}>Food Inventory</Text>
                </View>

                {/* SEARCH AND ADD BUTTON */}
                <View style={styles.actionRow}>
                    <View style={styles.searchWrap}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search items..."
                            placeholderTextColor="#867A70"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        <Ionicons name="search" size={20} color="#111" style={styles.searchIcon} />
                    </View>

                    <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => navigation.navigate('AddFoodItem_Inventory')}>
                        <Text style={styles.addBtnText}>+ ADD FOOD</Text>
                    </TouchableOpacity>
                </View>

                {/* CATEGORY FILTER DROPDOWN */}
                <View style={{ width: '100%', marginBottom: 16 }}>
                    <TouchableOpacity
                        onPress={() => setShowCategoryDropdown(v => !v)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderWidth: 1.5,
                            borderColor: '#106037',
                            borderRadius: 12,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            backgroundColor: selectedCategory ? '#106037' : '#FFF',
                        }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: selectedCategory ? '#FFF' : '#106037' }}>
                            {selectedCategory ? selectedCategory : 'Filter by Category'}
                        </Text>
                        <Ionicons
                            name={showCategoryDropdown ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={selectedCategory ? '#FFF' : '#106037'}
                        />
                    </TouchableOpacity>

                    {showCategoryDropdown && (
                        <View style={{
                            borderWidth: 1.5,
                            borderColor: '#d2dfd8',
                            borderRadius: 12,
                            marginTop: 6,
                            backgroundColor: '#FFF',
                            overflow: 'hidden',
                        }}>
                            <TouchableOpacity
                                onPress={() => { setSelectedCategory(null); setShowCategoryDropdown(false); }}
                                style={{
                                    paddingHorizontal: 16,
                                    paddingVertical: 12,
                                    borderBottomWidth: 1,
                                    borderBottomColor: '#eee',
                                    backgroundColor: !selectedCategory ? '#eef6f0' : '#FFF',
                                }}
                            >
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#106037' }}>All Categories</Text>
                            </TouchableOpacity>
                            {categories.map((cat, idx) => (
                                <TouchableOpacity
                                    key={cat}
                                    onPress={() => { setSelectedCategory(cat); setShowCategoryDropdown(false); }}
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 12,
                                        borderBottomWidth: idx < categories.length - 1 ? 1 : 0,
                                        borderBottomColor: '#eee',
                                        backgroundColor: selectedCategory === cat ? '#eef6f0' : '#FFF',
                                    }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: selectedCategory === cat ? '#106037' : '#4f6157' }}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* TABLE COMPONENT */}
                <View style={styles.tableWrap}>
                    {/* TABLE HEADER */}
                    <View style={styles.tHead}>
                        <Text style={[styles.thText, { flex: 2.2 }]}>ITEM NAME</Text>
                        <Text style={[styles.thText, { flex: 1.5, textAlign: 'center' }]}>QTY.</Text>
                        <Text style={[styles.thText, { flex: 2.5, textAlign: 'center' }]}>EXPIRY DATE</Text>
                        <Text style={[styles.thText, { flex: 3.5, textAlign: 'center' }]}>CATEGORY</Text>
                    </View>

                    {/* TABLE ROWS */}
                    {isLoading ? (
                        <ActivityIndicator size="large" color="#106037" style={{ marginTop: 40 }} />
                    ) : fetchError ? (
                        <Text style={{ textAlign: 'center', marginTop: 30, color: '#D83232' }}>{fetchError}</Text>
                    ) : filteredItems.length === 0 ? (
                        <Text style={{ textAlign: 'center', marginTop: 30, color: '#888' }}>No items found.</Text>
                    ) : (
                        filteredItems.map((item, index) => {
                            const isRed = item.expiry === '2026-01-30';
                            return (
                                <View key={item.id} style={styles.tRow}>
                                    <Text style={[styles.tdText, { flex: 2.2 }]} numberOfLines={1}>{item.name}</Text>
                                    <Text style={[styles.tdBold, { flex: 1.5, textAlign: 'center' }]} numberOfLines={1}>{item.qty}</Text>
                                    <Text style={[styles.tdText, { flex: 2.5, textAlign: 'center' }, isRed && styles.textRed]} numberOfLines={1}>{item.expiry}</Text>
                                    <Text style={[styles.tdText, { flex: 3.5, textAlign: 'center' }]} numberOfLines={1}>{item.category}</Text>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* Empty space for bottom bar */}
                <View style={{ height: 120 }} />
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
    topHeaderWrap: {
        backgroundColor: '#FFFFFF',
    },
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 22,
        paddingBottom: 12,
    },
    logoImage: {
        width: 170,
        height: 58,
    },
    topRightIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBtn: {
        marginLeft: 18,
    },
    topDivider: {
        height: 1,
        backgroundColor: '#544434',
        opacity: 0.5,
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
        width: 65,
        height: 65,
        marginRight: 10,
        tintColor: '#106037',
    },
    heroTitle: {
        fontSize: 34,
        fontWeight: '800',
        color: '#0A552F',
        letterSpacing: -0.5,
    },

    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 35,
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
        fontSize: 13,
        color: '#333',
        height: '100%',
    },
    searchIcon: {
        marginLeft: 8,
    },
    addBtn: {
        backgroundColor: '#DCAB18',
        height: 40,
        paddingHorizontal: 20,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addBtnText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    tableWrap: {
        borderTopWidth: 1.5,
        borderTopColor: '#D9D3CC',
    },
    tHead: {
        flexDirection: 'row',
        paddingVertical: 18,
        borderBottomWidth: 1.5,
        borderBottomColor: '#D9D3CC',
    },
    thText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#106037',
        letterSpacing: 0.2,
    },

    tRow: {
        flexDirection: 'row',
        paddingVertical: 20,
        borderBottomWidth: 1.5,
        borderBottomColor: '#E9E4DF',
        alignItems: 'center',
    },
    tdText: {
        fontSize: 13,
        color: '#655A52',
        fontWeight: '500',
    },
    tdBold: {
        fontSize: 13,
        color: '#655A52',
        fontWeight: '800',
    },
    textRed: {
        color: '#D83232',
        fontWeight: '800',
    },

    bottomBar: {
        position: 'absolute',
        bottom: -10,
        width: '100%',
        height: 120,
        backgroundColor: '#1F5A37',
        borderTopLeftRadius: 45,
        borderTopRightRadius: 45,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 25,
        paddingHorizontal: 15,
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    navIconGhostWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    navItemInnerBox: {
        position: 'absolute',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.7)',
        borderRadius: 14,
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: '#1E583A',
    },
    navLabelLine: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    navItemActive: {
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeNavIconBg: {
        width: 60,
        height: 60,
        tintColor: '#FFF',
    }
});
