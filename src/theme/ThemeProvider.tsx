import React, { ReactNode, createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, ThemeColors } from './colors';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'app_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  isDark: true,
  colors: darkColors,
  setMode: () => {},
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);
export const useThemeColors = () => useContext(ThemeContext).colors;

type Props = { children: ReactNode };

export const ThemeProvider: React.FC<Props> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'light');
  }, [mode, setMode]);

  const isDark = mode === 'system' ? systemScheme !== 'light' : mode === 'dark';
  const themeColors = isDark ? darkColors : lightColors;

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors: themeColors, setMode, toggle }}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: themeColors.background }}>
        <SafeAreaProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {children}
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeContext.Provider>
  );
};
