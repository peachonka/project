// SettingsContext.tsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type SettingsContextType = {
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  toggleTheme: () => void;
  toggleSound: () => void;
  toggleVibration: () => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  // Загрузка настроек при старте
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedTheme, sound, vibration] = await Promise.all([
          AsyncStorage.getItem('app_theme'),
          AsyncStorage.getItem('app_sound'),
          AsyncStorage.getItem('app_vibration'),
        ]);

        if (savedTheme === 'dark' || savedTheme === 'light') {
          setTheme(savedTheme);
        } else {
          // Использовать системную тему, если нет сохранённой
          setTheme(Appearance.getColorScheme() || 'light');
        }

        setSoundEnabled(sound !== 'false');
        setVibrationEnabled(vibration !== 'false');
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    await AsyncStorage.setItem('app_theme', newTheme);
  };

  const toggleSound = async () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    await AsyncStorage.setItem('app_sound', String(newValue));
  };

  const toggleVibration = async () => {
    const newValue = !vibrationEnabled;
    setVibrationEnabled(newValue);
    await AsyncStorage.setItem('app_vibration', String(newValue));
  };

  return (
    <SettingsContext.Provider
      value={{
        theme,
        soundEnabled,
        vibrationEnabled,
        toggleTheme,
        toggleSound,
        toggleVibration,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};