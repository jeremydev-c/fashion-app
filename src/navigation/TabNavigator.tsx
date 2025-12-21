import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
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
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.card,
          text: colors.textPrimary,
          border: colors.borderSubtle,
          notification: colors.accent,
        },
      }}
    >
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#020617',
            borderTopColor: 'rgba(148, 163, 184, 0.25)',
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIcon: ({ color, size, focused }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'grid-outline';

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Wardrobe') {
              iconName = focused ? 'shirt' : 'shirt-outline';
            } else if (route.name === 'Stylist') {
              iconName = focused ? 'color-wand' : 'color-wand-outline';
            } else if (route.name === 'Coach') {
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
            } else if (route.name === 'Planner') {
              iconName = focused ? 'calendar' : 'calendar-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Wardrobe" component={WardrobeScreen} />
        <Tab.Screen name="Stylist" component={StylistScreen} />
        <Tab.Screen name="Coach" component={ChatScreen} />
        <Tab.Screen name="Planner" component={PlannerScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
        <Tab.Screen 
          name="AdminDashboard" 
          component={AdminDashboardScreen}
          options={{ tabBarButton: () => null }} // Hide from tab bar
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};


