import AsyncStorage from '@react-native-async-storage/async-storage';

declare const process: any;

// Development: Use local IP for testing
// Production: Use Railway URL
const DEFAULT_BASE_URL = __DEV__ 
  ? 'http://192.168.0.102:4000'  // Local development
  : 'https://fashion-app-production-6083.up.railway.app';  // Railway production

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_BASE_URL;

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  // Get auth token if available
  let authToken: string | null = null;
  try {
    authToken = await AsyncStorage.getItem('auth_token');
  } catch {
    // Ignore storage errors
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Add auth header if token exists
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle expired/invalid token - clear storage and let app handle re-auth
    if (response.status === 401) {
      try {
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('auth_user');
      } catch {
        // Ignore storage errors
      }
    }
    
    let message = `Request failed with status ${response.status}`;
    let errorBody: any = null;
    try {
      errorBody = await response.json();
      if (errorBody?.error) message = errorBody.error;
    } catch {
      // ignore JSON parse errors
    }
    const error = new Error(message);
    (error as any).status = response.status;
    (error as any).data = errorBody; // Preserve full error body for detailed error handling
    throw error;
  }

  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// Axios-like interface for convenience
export const apiClient = {
  get: async <T = any>(path: string): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path, { method: 'GET' });
    return { data };
  },
  post: async <T = any>(path: string, body?: any): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  },
  patch: async <T = any>(path: string, body?: any): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  },
  delete: async <T = any>(path: string): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path, { method: 'DELETE' });
    return { data };
  },
};

