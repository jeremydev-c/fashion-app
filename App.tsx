import React, { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppTabs } from './src/navigation/TabNavigator';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { apiRequest } from './src/services/apiClient';
import { AIMisuseWarning, hasAcknowledgedWarning } from './src/components/AIMisuseWarning';
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  removeNotificationSubscription,
} from './src/services/notificationService';

const queryClient = new QueryClient();

// Main app content with auth logic
const AppContent: React.FC = () => {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [booting, setBooting] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showAIMisuseWarning, setShowAIMisuseWarning] = useState(false);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    // Allow all loading animations to complete
    const timer = setTimeout(() => setBooting(false), 5500);
    return () => clearTimeout(timer);
  }, []);

  // Register push token when user logs in
  useEffect(() => {
    if (!isAuthenticated || !user?._id) return;

    registerForPushNotifications(user._id).catch(() => {});

    // Listen for notifications received while app is in foreground
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification.request.content.title);
    });

    // Listen for user tapping a notification
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as any;
      console.log('Notification tapped, data:', data);
      // Future: navigate to a specific screen based on data.screen
    });

    return () => {
      if (notificationListener.current) removeNotificationSubscription(notificationListener.current);
      if (responseListener.current) removeNotificationSubscription(responseListener.current);
    };
  }, [isAuthenticated, user?._id]);

  useEffect(() => {
    // Check if onboarding is needed (only if authenticated)
    const checkOnboarding = async () => {
      if (!isAuthenticated || !user) {
        setCheckingOnboarding(false);
        return;
      }

      try {
        // First check local storage for faster UX (user-specific key)
        const localOnboarded = await AsyncStorage.getItem(`onboarding_completed_${user._id}`);
        if (localOnboarded === 'true') {
          setShowOnboarding(false);
          setCheckingOnboarding(false);
          return;
        }

        // Check server preferences
        const response = await apiRequest<any>(`/stylist/preferences?userId=${user._id}`);
        if (!response.preferences?.onboardingCompleted) {
          setShowOnboarding(true);
        } else {
          // Server says completed, save locally for faster checks
          await AsyncStorage.setItem(`onboarding_completed_${user._id}`, 'true');
          setShowOnboarding(false);
        }
      } catch (error) {
        // If error, show onboarding to be safe
        console.log('Onboarding check failed, showing onboarding');
        setShowOnboarding(true);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    if (!booting && !authLoading) {
      checkOnboarding();
    }
  }, [booting, authLoading, isAuthenticated, user]);

  const handleOnboardingComplete = async (data: {
    styles: string[];
    colors: string[];
    occasions: string[];
    avoidColors: string[];
    bodyType: string;
    ageRange: string;
  }) => {
    if (!user) return;

    try {
      // Save to server
      await apiRequest('/stylist/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          userId: user._id,
          ...data,
        }),
      });

      // Save locally for faster future checks (user-specific)
      await AsyncStorage.setItem(`onboarding_completed_${user._id}`, 'true');
    } catch (error) {
      console.error('Failed to save onboarding:', error);
    }

    setShowOnboarding(false);
    
    // Check if user has seen AI misuse warning
    const acknowledged = await hasAcknowledgedWarning();
    if (!acknowledged) {
      setShowAIMisuseWarning(true);
    }
  };

  // Show loading screen during boot or auth check
  if (booting || authLoading) {
    return <LoadingScreen />;
  }

  // Show auth screen if not logged in
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // Show onboarding if needed
  if (checkingOnboarding) {
    return <LoadingScreen />;
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  // Main app
  return (
    <>
      <AppTabs />
      <AIMisuseWarning
        visible={showAIMisuseWarning}
        onAcknowledge={() => setShowAIMisuseWarning(false)}
      />
    </>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
