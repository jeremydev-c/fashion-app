import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './apiClient';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export type User = {
  _id: string;
  email: string;
  name: string;
  username?: string;
  avatar?: string;
  onboardingCompleted: boolean;
  createdAt: string;
};

export type AuthResponse = {
  message: string;
  user: User;
  token: string;
};

// Sign up
export async function signUp(email: string, password: string, name: string): Promise<AuthResponse> {
  const response = await apiRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });

  // Store token and user
  await AsyncStorage.setItem(TOKEN_KEY, response.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));

  return response;
}

// Login
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  // Store token and user
  await AsyncStorage.setItem(TOKEN_KEY, response.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));

  return response;
}

// Logout
export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
  await AsyncStorage.removeItem('onboarding_completed');
}

// Get stored token
export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

// Get stored user
export async function getStoredUser(): Promise<User | null> {
  const userJson = await AsyncStorage.getItem(USER_KEY);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

// Check if logged in
export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

// Get current user from API
export async function getCurrentUser(): Promise<User> {
  const response = await apiRequest('/auth/me');
  return response.user;
}

// Update user
export async function updateUser(data: { 
  name?: string; 
  username?: string; 
  avatar?: string; 
  profilePictureBase64?: string;
}): Promise<User> {
  const response = await apiRequest('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  // Update stored user
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));

  return response.user;
}

