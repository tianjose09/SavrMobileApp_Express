import React from 'react';
import { View, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StorageUtils, StorageKeys } from '../utils/storage';

// Import Screens
import LoadingPage from '../screens/LandingPage/LoadingPage';
import LandingPage from '../screens/LandingPage/LandingPage';
import Login from '../screens/Accounts/Login';
import Registration from '../screens/Accounts/Registration';
import DonorRegistration from '../screens/Accounts/DonorRegistration';
import BeneficiaryRegistration from '../screens/Accounts/BeneficiaryRegistration';
import PkRegistration from '../screens/PkRegistration';
import VerifyEmail from '../screens/Accounts/VerifyEmail';
import ForgotPassword from '../screens/Accounts/ForgotPassword';

// Drawer screens
import DonorDashboard from '../screens/Dashboards/DonorDashboard';
import OrgDashboard from '../screens/Dashboards/OrgDashboard';
import PkDashboard from '../screens/Dashboards/PkDashboard';
import ChooseDonation from '../screens/Donations/ChooseDonation';
import FinancialDonation from '../screens/Donations/FinancialDonation';
import FoodDonationDetails from '../screens/Donations/FoodDonationDetails';
import FoodDonationPickup from '../screens/Donations/FoodDonationPickup';
import AllUpcomingPickups from '../screens/Donations/AllUpcomingPickups';
import FoodDonationDelivery from '../screens/Donations/FoodDonationDelivery';
import ServiceDonation from '../screens/Donations/ServiceDonation';
import Activities from '../screens/Activities/Activities';
import PartnerKitchenRecentActivities from '../screens/Activities/PartnerKitchenRecentActivities';
import TrackMyRequest from '../screens/Requests/TrackMyRequest';
import AchievementBadges from '../screens/Activities/AchievementBadges';
import Notifications from '../screens/Activities/Notifications';
import CreateRequest from '../screens/Requests/CreateRequest';
import Profile from '../screens/Accounts/Profile';
import EditProfile from '../screens/Accounts/EditProfile';

// Custom Sidebar Component
import Sidebar from '../components/Sidebar';
import DashboardSwitcher from '../screens/Dashboards/DashboardSwitcher';
import FoodInventory from '../screens/FoodInventory/FoodInventory';
import AddFoodItem_Inventory from '../screens/FoodInventory/AddFoodItem_Inventory';
import IngrMealPlanning from '../screens/MealOptimization/IngrMealPlanning';
import MealOptimizationResults from '../screens/MealOptimization/MealOptimizationResults';
import PrepareMeal from '../screens/MealOptimization/PrepareMeal';
import MealPreparationSummary from '../screens/MealOptimization/MealPreparationSummary';
import RecipesList from '../screens/Recipes/RecipesList';
import AddRecipe from '../screens/Recipes/AddRecipe';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();
const DonateStack = createStackNavigator();

function DonateStackNavigator() {
  return (
    <DonateStack.Navigator screenOptions={{ headerShown: false }}>
      <DonateStack.Screen name="ChooseDonation" component={ChooseDonation} />
      <DonateStack.Screen name="FinancialDonation" component={FinancialDonation} />
      <DonateStack.Screen name="FoodDonationDetails" component={FoodDonationDetails} />
      <DonateStack.Screen name="FoodDonationPickup" component={FoodDonationPickup} />
      <DonateStack.Screen name="FoodDonationDelivery" component={FoodDonationDelivery} />
      <DonateStack.Screen name="ServiceDonation" component={ServiceDonation} />
    </DonateStack.Navigator>
  );
}

function AnimatedTabIcon({
  routeName,
  focused,
  color,
}: {
  routeName: string;
  focused: boolean;
  color: string;
}) {
  const scaleAnim = React.useRef(new Animated.Value(focused ? 1 : 0.92)).current;
  const translateYAnim = React.useRef(new Animated.Value(focused ? -2 : 0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1 : 0.92,
        useNativeDriver: true,
        friction: 6,
        tension: 110,
      }),
      Animated.spring(translateYAnim, {
        toValue: focused ? -2 : 0,
        useNativeDriver: true,
        friction: 7,
        tension: 100,
      }),
    ]).start();
  }, [focused, scaleAnim, translateYAnim]);

  let iconComponent;

  if (routeName === 'Home') {
    iconComponent = (
      <Ionicons
        name="home"
        size={focused ? 30 : 27}
        color={focused ? '#FFF' : color}
      />
    );
  } else if (routeName === 'Donate') {
    iconComponent = (
      <Ionicons
        name={focused ? 'gift' : 'gift-outline'}
        size={focused ? 30 : 27}
        color={focused ? '#FFF' : color}
      />
    );
  } else if (routeName === 'Activities') {
    iconComponent = (
      <Ionicons
        name={focused ? 'heart' : 'heart-outline'}
        size={focused ? 30 : 27}
        color={focused ? '#FFF' : color}
      />
    );
  } else if (routeName === 'Badges') {
    iconComponent = (
      <Ionicons
        name={focused ? 'ribbon' : 'ribbon-outline'}
        size={focused ? 30 : 27}
        color={focused ? '#FFF' : color}
      />
    );
  } else if (routeName === 'Request') {
    iconComponent = (
      <MaterialCommunityIcons
        name="file-document-edit"
        size={focused ? 30 : 27}
        color={focused ? '#FFF' : color}
      />
    );
  } else if (routeName === 'Track') {
    iconComponent = (
      <Ionicons
        name={focused ? 'location' : 'location-outline'}
        size={focused ? 30 : 27}
        color={focused ? '#FFF' : color}
      />
    );
  } else if (routeName === 'Ingredients') {
    iconComponent = (
      <MaterialCommunityIcons
        name="food-variant"
        size={focused ? 33 : 30}
        color={focused ? '#FFF' : color}
      />
    );
  } else if (routeName === 'FoodInventory') {
    iconComponent = (
      <MaterialCommunityIcons
        name="package-variant-closed"
        size={focused ? 33 : 30}
        color={focused ? '#FFF' : color}
      />
    );
  } else if (routeName === 'Summary') {
    iconComponent = (
      <Ionicons
        name={focused ? 'list' : 'list-outline'}
        size={focused ? 30 : 27}
        color={focused ? '#FFF' : color}
      />
    );
  } else if (routeName === 'Recipes') {
    iconComponent = (
      <Ionicons
        name={focused ? 'restaurant' : 'restaurant-outline'}
        size={focused ? 30 : 27}
        color={focused ? '#FFF' : color}
      />
    );
  } else {
    iconComponent = <Ionicons name="alert-circle" size={27} color={color} />;
  }

  if (focused) {
    return (
      <Animated.View
        style={{
          marginTop: -42,
          backgroundColor: '#00592d',
          width: 66,
          height: 66,
          borderRadius: 33,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 5,
          borderColor: '#FFF',
          elevation: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
        }}
      >
        {iconComponent}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
      }}
    >
      {iconComponent}
    </Animated.View>
  );
}

const InventoryStack = createStackNavigator();

function InventoryStackNavigator() {
  return (
    <InventoryStack.Navigator screenOptions={{ headerShown: false }}>
      <InventoryStack.Screen name="FoodInventoryList" component={FoodInventory} />
      <InventoryStack.Screen name="AddFoodItem_Inventory" component={AddFoodItem_Inventory} />
    </InventoryStack.Navigator>
  );
}

const IngredientsStack = createStackNavigator();

function IngredientsStackNavigator() {
  return (
    <IngredientsStack.Navigator screenOptions={{ headerShown: false }}>
      <IngredientsStack.Screen name="IngrMealPlanning" component={IngrMealPlanning} />
      <IngredientsStack.Screen name="MealOptimizationResults" component={MealOptimizationResults} />
      <IngredientsStack.Screen name="PrepareMeal" component={PrepareMeal} />
      <IngredientsStack.Screen name="MealPreparationSummary" component={MealPreparationSummary} />
      <IngredientsStack.Screen name="AddFoodItem_Inventory" component={AddFoodItem_Inventory} />
    </IngredientsStack.Navigator>
  );
}

const RecipesStack = createStackNavigator();

function RecipesStackNavigator() {
  return (
    <RecipesStack.Navigator screenOptions={{ headerShown: false }}>
      <RecipesStack.Screen name="RecipesList" component={RecipesList} />
      <RecipesStack.Screen name="AddRecipe" component={AddRecipe} />
    </RecipesStack.Navigator>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const [role, setRole] = React.useState<string>('donor');

  React.useEffect(() => {
    const fetchRole = async () => {
      let userRole = await StorageUtils.getItem(StorageKeys.USER_ROLE);
      if (!userRole) {
        const userInfoRaw = await StorageUtils.getItem(StorageKeys.USER_INFO);
        if (userInfoRaw) {
          try {
            const parsed = JSON.parse(userInfoRaw);
            userRole = parsed?.role || parsed?.user_type || 'donor';
          } catch (e) { }
        }
      }
      setRole(userRole?.toLowerCase() || 'donor');
    };
    fetchRole();
  }, []);

  const isBeneficiary = role === 'beneficiary';
  const isPartnerKitchen = role === 'partner_kitchen';

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#FFF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
        tabBarStyle: {
          backgroundColor: Platform.OS === 'android' ? '#FFFFFF' : '#00592d',
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          height: 70 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? 20 : insets.bottom + 8,
          paddingTop: 10,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
        tabBarBackground: () => (
          <View
            style={{
              backgroundColor: '#00592d',
              height: Platform.OS === 'android' ? 70 : 70 + insets.bottom,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
            }}
          />
        ),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: 'bold',
          marginBottom: Platform.OS === 'ios' ? -8 : -2,
        },
        tabBarIcon: ({ focused, color }) => (
          <AnimatedTabIcon
            routeName={route.name}
            focused={focused}
            color={color}
          />
        ),
      })}
    >
      {isPartnerKitchen ? (
        <>
          <Tab.Screen name="Home" component={DashboardSwitcher} options={{ tabBarLabel: 'Home' }} />
          <Tab.Screen name="FoodInventory" component={InventoryStackNavigator} options={{ tabBarLabel: 'Inventory' }} />
          <Tab.Screen name="Recipes" component={RecipesStackNavigator} options={{ tabBarLabel: 'Recipes' }} />
          <Tab.Screen name="Ingredients" component={IngredientsStackNavigator} options={{ tabBarLabel: 'Ingr. & Scale' }} />
          <Tab.Screen name="Summary" component={MealPreparationSummary} options={{ tabBarLabel: 'Summary' }} />
        </>
      ) : isBeneficiary ? (
        <>
          <Tab.Screen name="Home" component={DashboardSwitcher} options={{ tabBarLabel: 'Home' }} />
          <Tab.Screen name="Request" component={CreateRequest} options={{ tabBarLabel: 'Request' }} />
          <Tab.Screen name="Track" component={TrackMyRequest} />
        </>
      ) : (
        <>
          <Tab.Screen name="Home" component={DashboardSwitcher} options={{ tabBarLabel: 'Home' }} />
          <Tab.Screen name="Donate" component={DonateStackNavigator} />
          <Tab.Screen name="Activities" component={Activities} />
          <Tab.Screen name="Badges" component={AchievementBadges} options={{ title: 'Badges' }} />
        </>
      )}

      <Tab.Screen
        name="Profile"
        component={Profile}
        options={{ tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="PartnerKitchenRecentActivities"
        component={PartnerKitchenRecentActivities}
        options={{ tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="EditProfile"
        component={EditProfile}
        options={{ tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="AchievementBadges"
        component={AchievementBadges}
        options={{ tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="Notifications"
        component={Notifications}
        options={{ tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="AllUpcomingPickups"
        component={AllUpcomingPickups}
        options={{ tabBarItemStyle: { display: 'none' } }}
      />
    </Tab.Navigator>
  );
}

function MainDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <Sidebar {...props} />}
      screenOptions={{
        headerShown: false,
        drawerPosition: 'right',
        drawerType: 'front',
        drawerStyle: { width: 220, backgroundColor: 'transparent', marginTop: 100 }
      }}
    >
      <Drawer.Screen name="HomeTabs" component={MainTabs} />
      <Drawer.Screen name="DonorDashboard" component={DonorDashboard} />
      <Drawer.Screen name="OrgDashboard" component={OrgDashboard} />
      <Drawer.Screen name="PkDashboard" component={PkDashboard} />
    </Drawer.Navigator>
  );
}

const linking = {
  prefixes: ['savrmobile://', 'exp+savrmobile://'],
  config: {
    screens: {
      MainDrawer: {
        path: '',
        screens: {
          HomeTabs: {
            path: '',
            screens: {
              Home: '',
            },
          },
        },
      },
    },
  },
};

export default function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="LoadingPage"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="LoadingPage" component={LoadingPage} />
        <Stack.Screen name="LandingPage" component={LandingPage} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Registration" component={Registration} />
        <Stack.Screen name="DonorRegistration" component={DonorRegistration} />
        <Stack.Screen
          name="BeneficiaryRegistration"
          component={BeneficiaryRegistration}
        />
        <Stack.Screen name="PkRegistration" component={PkRegistration} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
        <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
        <Stack.Screen name="MainDrawer" component={MainDrawer} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}