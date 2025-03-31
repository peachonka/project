//settings.tsx
import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '@react-navigation/native';


export default function SettingsScreen() {
  const { colors } = useTheme();
  const {
    theme,
    soundEnabled,
    vibrationEnabled,
    toggleTheme,
    toggleSound,
    toggleVibration,
  } = useSettings();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 20,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: colors.text,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    settingText: {
      fontSize: 16,
      color: colors.text,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Настройки</Text>
        <Text style={styles.subtitle}>Настройте тему или звук</Text>
      </View>
      
      <View style={styles.content}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <MaterialIcons 
              name={theme === 'dark' ? 'nights-stay' : 'wb-sunny'} 
              size={24} 
              color={theme === 'dark' ? '#94a3b8' : '#1e293b'} 
            />
            <Text style={styles.settingText}>Тёмная тема</Text>
          </View>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: '#e2e8f0', true: '#7A27AB' }}
            thumbColor="#f8fafc"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <MaterialIcons 
              name={soundEnabled ? 'volume-up' : 'volume-off'} 
              size={24} 
              color={theme === 'dark' ? '#94a3b8' : '#1e293b'} 
            />
            <Text style={styles.settingText}>Звук</Text>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={toggleSound}
            trackColor={{ false: '#e2e8f0', true: '#7A27AB' }}
            thumbColor="#f8fafc"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <MaterialIcons 
              name={vibrationEnabled ? 'vibration' : 'notifications-off'} 
              size={24} 
              color={theme === 'dark' ? '#94a3b8' : '#1e293b'} 
            />
            <Text style={styles.settingText}>Вибрация</Text>
          </View>
          <Switch
            value={vibrationEnabled}
            onValueChange={toggleVibration}
            trackColor={{ false: '#e2e8f0', true: '#7A27AB' }}
            thumbColor="#f8fafc"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}