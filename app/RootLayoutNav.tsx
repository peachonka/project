// app/RootLayoutNav.tsx
import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { ThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useTheme } from '@react-navigation/native';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

export default function RootLayoutNav() {
  const router = useRouter();
  const { theme } = useSettings();
  const { colors } = useTheme();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.frameworkReady?.();
    }
  }, []);

  const navigateTo = (route: string) => {
    if (route === '/') {
      router.replace('/');
    } else {
      router.push(route as any);
    }
  };

  const styles = StyleSheet.create({
    navbar: {
      position: 'absolute',
      backgroundColor: colors.background,
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingVertical: 4,
      borderTopWidth: 0.5,
      borderTopColor: colors.border,
    },
    navButton: {
      alignItems: 'center',
      padding: 8,
    },
    navText: {
      color: '#7A27AB',
      fontSize: 12,
      marginTop: 4,
      fontWeight: '500',
    },
  });

  return (
    <>
    <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="+not-found" />
      </Stack>
      
      {/* Навбар с иконками */}
      <View style={styles.navbar}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => navigateTo('/')}
        >
          <MaterialIcons name="home" size={24} color="#7A27AB" />
          <Text style={styles.navText}>Главная</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => navigateTo('/settings')}
        >
          <MaterialIcons name="settings" size={24} color="#7A27AB" />
          <Text style={styles.navText}>Настройки</Text>
        </TouchableOpacity>
      </View>
      
      <StatusBar style="auto" />
      </>
  );
}