import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { scale, verticalScale } from '../utils/responsive';
import { HomeScreen } from '../screens/HomeScreen';
import { WardrobeScreen } from '../screens/WardrobeScreen';
import { StylistScreen } from '../screens/StylistScreen';
import { PlannerScreen } from '../screens/PlannerScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import ChatScreen from '../screens/ChatScreen';
import { AdminDashboardScreen } from '../screens/AdminDashboardScreen';

export type RootTabParamList = {
  Home: undefined;
  Wardrobe: undefined;
  Stylist: undefined;
  Coach: undefined;
  Planner: undefined;
  Profile: undefined;
  AdminDashboard: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export const AppTabs = () => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <NavigationContainer
      theme={{
        dark: isDark,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.tabBar,
          text: colors.textPrimary,
          border: 'transparent',
          notification: colors.accent,
        },
      }}
    >
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: scale(10),
            fontWeight: '500',
            letterSpacing: 0.6,
            marginTop: verticalScale(-2),
          },
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: verticalScale(56) + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: verticalScale(6),
            backgroundColor: colors.tabBar,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.tabBarBorder,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIcon: ({ color, focused }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'grid-outline';
            const size = focused ? scale(22) : scale(20);

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Wardrobe') {
              iconName = focused ? 'shirt' : 'shirt-outline';
            } else if (route.name === 'Stylist') {
              iconName = focused ? 'diamond' : 'diamond-outline';
            } else if (route.name === 'Coach') {
              iconName = focused ? 'chatbubble' : 'chatbubble-outline';
            } else if (route.name === 'Planner') {
              iconName = focused ? 'calendar' : 'calendar-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            }

            if (route.name === 'Stylist' && focused) {
              return (
                <View style={[styles.activeCenter, { backgroundColor: colors.primary }]}>
                  <Ionicons name={iconName} size={scale(18)} color={colors.textOnPrimary} />
                </View>
              );
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Wardrobe" component={WardrobeScreen} />
        <Tab.Screen
          name="Stylist"
          component={StylistScreen}
          options={{ tabBarLabel: 'Style' }}
        />
        <Tab.Screen name="Coach" component={ChatScreen} />
        <Tab.Screen name="Planner" component={PlannerScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
        <Tab.Screen
          name="AdminDashboard"
          component={AdminDashboardScreen}
          options={{ tabBarButton: () => null }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  activeCenter: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(-4),
  },
});
