import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  getStoredUser,
  getToken,
  getCurrentUser,
  login as loginApi,
  signUp as signUpApi,
  logout as logoutApi,
} from '../services/authService';

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const [token, storedUser] = await Promise.all([getToken(), getStoredUser()]);
        if (token && storedUser) {
          // Use stored user immediately for fast UX
          setUser(storedUser);
          
          // Try to verify token in background (non-blocking)
          // Only clear session if we get a 401 (unauthorized), not network errors
          getCurrentUser()
            .then((currentUser) => {
              // Token is valid, update user if needed
              setUser(currentUser);
              AsyncStorage.setItem('auth_user', JSON.stringify(currentUser));
            })
            .catch((error: any) => {
              // Only clear session if it's a 401 (unauthorized/expired)
              // Network errors or backend down = keep session
              if (error?.status === 401) {
                console.log('Token expired (401), clearing session');
                logoutApi();
                setUser(null);
              } else {
                // Network error or backend down - keep using stored user
                console.log('Could not verify token (network error), using stored session');
                // Keep the stored user - don't clear session
              }
            });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await loginApi(email, password);
    setUser(response.user);
  };

  const signUp = async (email: string, password: string, name: string) => {
    const response = await signUpApi(email, password, name);
    setUser(response.user);
  };

  const logout = async () => {
    await logoutApi();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signUp,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

