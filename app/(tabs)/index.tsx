import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ToastAndroid,
  ScrollView,
  Platform,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Fuse from 'fuse.js';
import Animated, {
  FadeInDown,
  FadeOutDown,
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import stationsData from '@/assets/stations.json';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants for AsyncStorage keys
const SELECTED_STATION_KEY = 'selectedStation';
const IS_PLAYING_KEY = 'isPlayingAlarm';
const LOCATION_TASK_NAME = 'location-tracking';

// Define interfaces for the coordinate types
interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface StationCoords {
  lat: number;
  lng: number;
}

// Update the function with proper type annotations
function calculateDistance(coords1: LocationCoords, coords2: StationCoords): number {
  const lat1 = coords1.latitude;
  const lon1 = coords1.longitude;
  const lat2 = coords2.lat;
  const lon2 = coords2.lng;
  
  // Rest of the function remains the same
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c;
  
  return distance;
}

const saveSelectedStation = async (station: Station) => {
  if (station) {
    try {
      await AsyncStorage.setItem(SELECTED_STATION_KEY, JSON.stringify(station));
      await AsyncStorage.setItem(IS_PLAYING_KEY, 'false');
      console.log('Saved station to AsyncStorage:', station.name);
    } catch (e) {
      console.error('Failed to save station to AsyncStorage:', e);
    }
  }
};
interface LocationTaskData {
  locations: Array<{
    coords: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number | null;
      heading: number | null;
      speed: number | null;
    };
    timestamp: number;
  }>;
}

// Update the TaskManager.defineTask function
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: { data?: LocationTaskData, error?: any }) => {
  if (error) {
    console.error('Error in background location task:', error);
    return;
  }
  
  if (data && data.locations && data.locations.length > 0) {
    const location = data.locations[0];

    try {
      // Get the selected station from AsyncStorage
      const stationData = await AsyncStorage.getItem(SELECTED_STATION_KEY);
      const isPlayingStr = await AsyncStorage.getItem(IS_PLAYING_KEY);
      const isPlaying = isPlayingStr === 'true';
      
      if (stationData) {
        const station = JSON.parse(stationData);
        
        // Calculate distance between current location and selected station
        const distance = calculateDistance(location.coords, station);
        console.log(`Background task: Distance to ${station.name} is ${distance.toFixed(2)} km`);
        
        // If within 1km and not already playing alarm
        if (distance < 1 && !isPlaying) {
          // Set playing flag in AsyncStorage
          await AsyncStorage.setItem(IS_PLAYING_KEY, 'true');
          
          // Try to play sound via notification with custom sound
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Вы приближаетесь к станции!",
              body: `До станции ${station.name} менее 1 км`,
              data: { station, action: 'alarm' },
              sound: 'alert.mp3', // Make sure this file is in the correct location
            },
            trigger: null,
          });
          
          // Also try to play sound directly as a backup
          try {
            const { sound } = await Audio.Sound.createAsync(
              { uri: 'asset:/alert.mp3' },
              { shouldPlay: true, isLooping: true }
            );
            
            // We can't store this reference in the task, but we can play it
            await sound.playAsync();
          } catch (audioError) {
            console.error('Failed to play audio in background task:', audioError);
          }
        } 
        // If more than 1km away and alarm is playing, stop it
        else if (distance >= 1 && isPlaying) {
          await AsyncStorage.setItem(IS_PLAYING_KEY, 'false');
          
          // Send a notification to inform the user
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Будильник остановлен",
              body: `Вы удалились от станции ${station.name}`,
              data: { action: 'stop' },
            },
            trigger: null,
          });
        }
      }
    } catch (e) {
      console.error('Error in background task:', e);
    }
  }
});

// Настройка обработки уведомлений
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  line: {
    id: string;
    hex_color: string;
    name: string;
  };
}

const stations: Station[] = stationsData.lines.flatMap((line) =>
  line.stations.map(station => ({
    id: station.id,
    name: station.name,
    lat: station.lat,
    lng: station.lng,
    order: station.order,
    line: {
      id: line.id,
      hex_color: line.hex_color,
      name: line.name,
    },
  }))
);

const fuse = new Fuse(stations, {
  includeScore: true,
  threshold: 0.4,
  keys: ['name'],
});

export default function VariantScreen() {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Station[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Station | null>(null);
  const [selectedForAlarm, setSelectedForAlarm] = useState<Station | null>(null);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Запрос разрешения на уведомления
  useEffect(() => {
    const requestNotificationPermission = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Разрешение на уведомления не предоставлено!');
      }
    };
    requestNotificationPermission();
  }, []);

  // Отправка уведомления при выходе в фоновый режим
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background' && isWaiting) {
        
        // Pre-load the sound in background
        if (!soundRef.current) {
          const { sound } = await Audio.Sound.createAsync(
            require('@/assets/alert.mp3'),
            { shouldPlay: false, isLooping: true }
          );
          soundRef.current = sound;
        }
      }
    });
  
    return () => {
      subscription.remove();
    };
  }, [isWaiting, selectedForAlarm]);

  // Обработка нажатия на уведомление
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const { action } = response.notification.request.content.data;
      if (action === 'stop') {
        stopBackgroundMusic();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleInputChange = useCallback((text: string) => {
    setInput(text);
    if (text.length > 0) {
      const results = fuse.search(text);
      setSuggestions(results.map(result => result.item));
    } else {
      setSuggestions([]);
    }
  }, []);

  const handleSelectVariant = useCallback((variant: Station) => {
    setSelectedVariant(variant);
    setInput('');
    setSuggestions([]);
  }, []);

  // Функция для воспроизведения музыки
  const playBackgroundMusic = async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          return;
        }
      }

      // Настраиваем аудио режим
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Загружаем и воспроизводим звук
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/alert.mp3'), // Убедитесь, что путь к файлу правильный
        { shouldPlay: true, isLooping: true }
      );

      soundRef.current = sound;
      setIsPlaying(true);

      // Обработчик окончания воспроизведения
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && 'didJustFinish' in status && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error('Ошибка воспроизведения звука:', error);
    }
  };

  // Функция для остановки музыки
  const stopBackgroundMusic = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);    }
  };

  useEffect(() => {
    (async () => {
      // Request background location permissions
      if (Platform.OS === 'android') {
        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
        if (foregroundStatus !== 'granted') return;
        
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.warn('Background location permission not granted!');
        }
      }
      
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        // Start a foreground service on Android
        if (Platform.OS === 'android' && isWaiting) {
          await Location.startLocationUpdatesAsync('location-tracking', {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
            foregroundService: {
              notificationTitle: "Метробудильник активен",
              notificationBody: "Отслеживание местоположения...",
              notificationColor: "#7A27AB",
            },
          });
        }
        // Получаем текущее местоположение
        let location = await Location.getCurrentPositionAsync({});
        setCoordinates({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // Начинаем отслеживать изменения местоположения
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000, // Обновление каждую секунду
            distanceInterval: 10, // Обновление при перемещении на 10 метров
          },
          (newLocation) => {
            const newCoordinates = {
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
            };
            setCoordinates(newCoordinates);

            // Проверка расстояния до выбранной станции
            if (selectedForAlarm && isWaiting) {
              const distance = Math.sqrt(
                Math.pow(selectedForAlarm.lat - newCoordinates.latitude, 2) +
                Math.pow(selectedForAlarm.lng - newCoordinates.longitude, 2)
              ) * 111.3; // Переводим в километры

              if (distance < 1 && !isPlaying) {
                playBackgroundMusic();
              } else if (distance >= 1 && isPlaying) {
                stopBackgroundMusic();
              }
            }
          }
        );
        setLocationSubscription(subscription);
      }
    })();

    // Очистка подписки и звука при размонтировании компонента
    return () => {
      // For location tracking task
      if (Platform.OS === 'android') {
        // Use a self-invoking function to handle the Promise
        (async () => {
          try {
            const isTracking = await Location.hasStartedLocationUpdatesAsync('location-tracking');
            if (isTracking) {
              await Location.stopLocationUpdatesAsync('location-tracking');
            }
          } catch (error) {
            console.log('Error checking location tracking status:', error);
          }
        })();
      }
      
      // For location subscription
      if (locationSubscription) {
        locationSubscription.remove();
      }
      
      // For sound
      if (soundRef.current) {
        (async () => {
          try {
            if (soundRef.current) await soundRef.current.unloadAsync();
          } catch (error) {
            console.log('Error unloading sound:', error);
          }
        })();
      }
    };
  }, [selectedVariant, isWaiting, isPlaying]); // Зависимость от selectedVariant, isWaiting и isPlaying

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={handleInputChange}
          placeholder="Начните вводить название станции..."
          placeholderTextColor="#94a3b8"
        />
      </View>

      {suggestions.length > 0 && (
        <Animated.View
          entering={FadeInDown}
          exiting={FadeOutDown}
          style={styles.suggestionsContainer}>
          <BlurView intensity={50} style={styles.blurContainer}>
            <ScrollView style={styles.suggestionsList}>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectVariant(suggestion)}>
                  <Text style={styles.suggestionText}>{suggestion.name}</Text>
                  <Text style={styles.suggestionText}>{suggestion.line.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </BlurView>
        </Animated.View>
      )}

      {selectedVariant && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>Выбранная станция:</Text>
          <Text style={styles.selectedVariant}>{selectedVariant.name}</Text>
          {coordinates && (
            <View style={styles.coordinatesContainer}>
              <Text style={styles.selectedLabel}>Расстояние до выбранной станции:</Text>
              <Text style={styles.selectedVariant}>{(((selectedVariant.lat - coordinates.latitude) ** 2 + (selectedVariant.lng - coordinates.longitude) ** 2) ** 0.5 * 111.3).toFixed(3)} км</Text>
            </View>
          )}
        </View>
      )}
      {isWaiting && selectedForAlarm && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>Будильник зазвонит при приближении к станции:</Text>
          <Text style={styles.selectedVariant}>{selectedForAlarm.name}</Text>
        </View>
      )}
      {coordinates && (
        <View style={styles.coordinatesContainer}>
          <Text style={styles.coordinatesText}>
            Latitude: {coordinates.latitude.toFixed(6)}
          </Text>
          <Text style={styles.coordinatesText}>
            Longitude: {coordinates.longitude.toFixed(6)}
          </Text>
        </View>
      )}
      <TouchableOpacity 
        style={selectedVariant ? styles.button : styles.buttonDisabled} 
        onPress={() => {
          if (isPlaying) {
            stopBackgroundMusic();
          }
          if (selectedVariant) {
            setSelectedForAlarm(selectedVariant); // Обновляем selectedForAlarm
            setIsWaiting(!isWaiting); // Затем включаем отслеживание
          } else {
            ToastAndroid.show('Необходимо выбрать станцию', ToastAndroid.SHORT);
          }
        }}
      >
        <Text style={styles.buttonText}>
          {isWaiting ? 'Остановить' : 'Поехали'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 10,
  },
  inputContainer: {
    margin: 20,
    borderColor: '#BFBFBF',
    borderRadius: 10,
    borderWidth: 1,
  },
  input: {
    backgroundColor: '#fff',
    padding: Platform.OS === 'ios' ? 16 : 12,
    borderRadius: 12,
    fontSize: 16,
    color: '#1e293b',
    elevation: 5,
  },
  suggestionsContainer: {
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: 300,
  },
  blurContainer: {
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.9)' : undefined,
  },
  suggestionsList: {
    backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.9)' : undefined,
  },
  suggestionItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  suggestionText: {
    fontSize: 16,
    color: '#1e293b',
    marginRight: 10
  },
  selectedContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  selectedVariant: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
  },
  map: {
    width: "100%",
    height: "100%",
  },
  coordinatesContainer: {
    backgroundColor: 'rgba(255, 255, 255)',
    padding: 10,
    borderRadius: 5,
    margin: 20,
  },
  coordinatesText: {
    fontSize: 16,
    color: 'black',
  },
  button: {
    position: 'absolute',
    bottom: 0,
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#7A27AB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    margin: 20,
  },
  buttonDisabled:{
    position: 'absolute',
    bottom: 0,
    width: '90%',
    alignSelf: 'center',
    backgroundColor: 'gray',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    margin: 20,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  }
});