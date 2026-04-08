import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiRequest } from './apiClient';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Android channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Fashion Fit',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('outfit', {
      name: 'Outfit Suggestions',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Daily Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // Uses app.json projectId when set; fine for Expo Go testing
    });
    const token = tokenData.data;

    // Save token to backend
    await saveTokenToBackend(userId, token);

    return token;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

export async function saveTokenToBackend(userId: string, token: string): Promise<void> {
  try {
    await apiRequest('/notifications/register-token', {
      method: 'POST',
      body: JSON.stringify({ userId, token, platform: Platform.OS }),
    });
  } catch (error) {
    console.error('Failed to save push token to backend:', error);
  }
}

export async function updateNotificationPreference(userId: string, enabled: boolean): Promise<void> {
  await apiRequest('/notifications/preferences', {
    method: 'POST',
    body: JSON.stringify({ userId, enabled }),
  });
}

export async function getNotificationPreference(userId: string): Promise<boolean> {
  try {
    const res = await apiRequest<{ enabled: boolean }>(`/notifications/preferences?userId=${userId}`);
    return res.enabled;
  } catch {
    return true; // Default to enabled
  }
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  delaySeconds = 0,
  channelId = 'default',
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { channelId },
    },
    trigger: delaySeconds > 0
      ? { seconds: delaySeconds, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL }
      : null,
  });
}

export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
) {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export function removeNotificationSubscription(
  subscription: Notifications.EventSubscription,
) {
  Notifications.removeNotificationSubscription(subscription);
}
