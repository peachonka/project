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

// Constants
const SELECTED_STATION_KEY = 'selectedStation';
const IS_PLAYING_KEY = 'isPlayingAlarm';
const IS_WAITING_KEY = 'isWaitingAlarm';
const LOCATION_TASK_NAME = 'location-tracking';
const ALARM_DISTANCE_KM = 1.0;

// Types
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

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface ExtendedNotificationContentInput extends Notifications.NotificationContentInput {
  android?: {
    channelId: string;
    [key: string]: any;
  };
}

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

// Helper functions
function calculateDistance(coords1: LocationCoords, coords2: StationCoords): number {
  const lat1 = coords1.latitude;
  const lon1 = coords1.longitude;
  const lat2 = coords2.lat;
  const lon2 = coords2.lng;
  
  // Haversine formula for accurate distance calculation
  const R = 6371; // Radius of the earth in km
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

interface StationCoords {
  lat: number;
  lng: number;
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

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Define background location task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error } : { data?: LocationTaskData, error?: any }) => {
  if (error) {
    console.error('Error in background location task:', error);
    return;
  }
  
  if (data && data?.locations?.length > 0) {
    const location = data.locations[0];

    try {
      const [stationData, isPlayingStr, isWaitingStr] = await Promise.all([
        AsyncStorage.getItem(SELECTED_STATION_KEY),
        AsyncStorage.getItem(IS_PLAYING_KEY),
        AsyncStorage.getItem(IS_WAITING_KEY)
      ]);
      
      if (stationData && isWaitingStr === 'true') {
        const station = JSON.parse(stationData);
        const isPlaying = isPlayingStr === 'true';
        const distance = calculateDistance(location.coords, station);
        
        console.log(`Distance to ${station.name}: ${distance.toFixed(2)} km`);
        
        if (distance < ALARM_DISTANCE_KM && !isPlaying) {
          await AsyncStorage.setItem(IS_PLAYING_KEY, 'true');
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Вы приближаетесь к станции!",
              body: `До станции ${station.name} менее ${ALARM_DISTANCE_KM} км`,
              data: { station, action: 'alarm' },
              sound: true,
              android: {
                channelId: 'alarm',
                actions: [{ title: 'Остановить', pressAction: { id: 'stop' } }],
              },
            } as ExtendedNotificationContentInput, // Немедленное уведомление
            trigger: null,
          });
        }
      }
    } catch (e) {
      console.error('Error in background task:', e);
    }
  }
});

// Process stations data
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

// Initialize Fuse.js for search
const fuse = new Fuse(stations, {
  includeScore: true,
  threshold: 0.4,
  keys: ['name'],
});

// Main component
export default function VariantScreen() {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Station[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Station | null>(null);
  const [selectedForAlarm, setSelectedForAlarm] = useState<Station | null>(null);
  const [coordinates, setCoordinates] = useState<LocationCoords | null>(null);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Загрузка начального состояния
  useEffect(() => {
    const loadState = async () => {
      try {
        const [stationData, isPlayingStr, isWaitingStr] = await Promise.all([
          AsyncStorage.getItem(SELECTED_STATION_KEY),
          AsyncStorage.getItem(IS_PLAYING_KEY),
          AsyncStorage.getItem(IS_WAITING_KEY)
        ]);
        
        if (stationData) {
          const station = JSON.parse(stationData);
          setSelectedVariant(station);
          setSelectedForAlarm(station);
        }
        setIsPlaying(isPlayingStr === 'true');
        setIsWaiting(isWaitingStr === 'true');
      } catch (e) {
        console.error('Failed to load state:', e);
      }
    };
    
    loadState();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('alarm', {
        name: 'Alarm notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'alert.mp3', // Ваш звуковой файл
        enableVibrate: true
      });
    }
  }, []);

  // Request notification permissions
  useEffect(() => {
    const requestNotificationPermission = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permission not granted!');
      }
    };
    requestNotificationPermission();
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background' && isWaiting) {
        // Pre-load the sound in background
        if (!soundRef.current) {
          try {
            const { sound } = await Audio.Sound.createAsync(
              require('@/assets/alert.mp3'),
              { shouldPlay: false, isLooping: false },
            );
            soundRef.current = sound;
          } catch (error) {
            console.error('Error pre-loading sound:', error);
          }
        }
      }
    });
  
    return () => {
      subscription.remove();
    };
  }, [isWaiting]);

  // Handle notification responses (when user taps on notification)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data || {};
      const actionId = response.actionIdentifier; // Идентификатор действия
  
      if (actionId === 'stop' || data.action === 'stop') {
        // Остановить звук и сбросить состояние
        await stopBackgroundMusic();
        await AsyncStorage.setItem(IS_PLAYING_KEY, 'false');
        await AsyncStorage.setItem(IS_WAITING_KEY, 'false');
        setIsPlaying(false);
        setIsWaiting(false);
        
      } else if (data.action === 'alarm') {
        // Запустить звук
        await playBackgroundMusic();
        await AsyncStorage.setItem(IS_WAITING_KEY, 'true');
        await AsyncStorage.setItem(IS_PLAYING_KEY, 'true');
        setIsPlaying(true);
      }
    });
  
    return () => {
      subscription.remove();
    };
  }, []);

  // Handle notifications received while app is in foreground
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data || {};
      
      if (data.action === 'alarm') {
        playBackgroundMusic();
      } else if (data.action === 'stop') {
        stopBackgroundMusic();
      }
    });
  
    return () => {
      subscription.remove();
    };
  }, []);

  // Handle input changes for station search
  const handleInputChange = useCallback((text: string) => {
    setInput(text);
    if (text.length > 0) {
      const results = fuse.search(text);
      setSuggestions(results.map(result => result.item));
    } else {
      setSuggestions([]);
    }
  }, []);

  // Handle station selection
  const handleSelectVariant = useCallback((variant: Station) => {
    setSelectedVariant(variant);
    setInput('');
    setSuggestions([]);
  }, []);

  // Play background music function
  const playBackgroundMusic = async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          return; // Sound is already playing
        }
      }
  
      // Configure audio mode
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
  
      // Load and play sound
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/alert.mp3'),
        { shouldPlay: true, isLooping: true }
      );
  
      soundRef.current = sound;
      setIsPlaying(true);
  
      // Handle playback status updates
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && 'didJustFinish' in status && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const stopBackgroundMusic = async () => {
    if (soundRef.current) {
      try {
        // Check if the sound is loaded before attempting to stop it
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync(); // Unload the sound after stopping
          soundRef.current = null; // Reset the reference
          setIsPlaying(false);
        }
      } catch (error) {
        console.error('Error stopping sound:', error);
      }
    }
  };

  // Set up location tracking
  useEffect(() => {
    (async () => {
      // Request location permissions
      if (Platform.OS === 'android') {
        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
        if (foregroundStatus !== 'granted') return;
        
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.warn('Background location permission not granted!');
        }
      }
      
      // Get current location
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        // Start background location tracking if waiting for alarm
        if (Platform.OS === 'android' && isWaiting) {
          try {
            const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
              .catch(() => false);
              
            if (!isTracking) {
              await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,
                distanceInterval: 10,
                foregroundService: {
                  notificationTitle: "Метробудильник активен",
                  notificationBody: "Отслеживание местоположения...",
                  notificationColor: "#7A27AB",
                },
              });
              console.log("Background location tracking started");
            }
          } catch (error) {
            console.log("Starting location tracking for the first time");
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
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
        }
        
        // Get initial location
        try {
          let location = await Location.getCurrentPositionAsync({});
          setCoordinates({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } catch (error) {
          console.error('Error getting current position:', error);
        }

        // Watch position changes
        try {
          const subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 1000,
              distanceInterval: 10,
            },
            (newLocation) => {
              const newCoordinates = {
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
              };
              setCoordinates(newCoordinates);

              // Check distance to selected station
              if (selectedForAlarm && isWaiting) {
                const distance = calculateDistance(newCoordinates, selectedForAlarm);

                if (distance < ALARM_DISTANCE_KM && !isPlaying) {
                  playBackgroundMusic();
                } else if (distance >= ALARM_DISTANCE_KM && isPlaying) {
                  stopBackgroundMusic();
                }
              }
            }
          );
          setLocationSubscription(subscription);
        } catch (error) {
          console.error('Error watching position:', error);
        }
      }
    })();

    // Cleanup
    return () => {
      // Stop location tracking
      if (Platform.OS === 'android') {
        (async () => {
          try {
            const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
              .catch(() => false);
            if (isTracking) {
              await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            }
          } catch (error) {
            console.log('Error checking location tracking status:', error);
          }
        })();
      }
      
      // Remove location subscription
      if (locationSubscription) {
        locationSubscription.remove();
      }
      
      // Unload sound
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
  }, [selectedVariant, isWaiting, isPlaying, selectedForAlarm]);

  // Handle start/stop button press
  const handleStartStop = async () => {
    if (!selectedVariant) {
      ToastAndroid.show('Необходимо выбрать станцию', ToastAndroid.SHORT);
      return;
    }

    const newWaitingState = !isWaiting;
    setIsWaiting(newWaitingState);
    await AsyncStorage.setItem(IS_WAITING_KEY, String(newWaitingState));

    if (newWaitingState) {
      setSelectedForAlarm(selectedVariant);
      await saveSelectedStation(selectedVariant);
      
      if (Platform.OS === 'android') {
        try {
          await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
            foregroundService: {
              notificationTitle: "Метробудильник активен",
              notificationBody: "Отслеживание местоположения...",
              notificationColor: "#7A27AB",
            },
          });
        } catch (error) {
          console.error("Error starting location tracking:", error);
        }
      }
    } else {
      await stopBackgroundMusic();
      await AsyncStorage.setItem(IS_PLAYING_KEY, 'false');
      setSelectedForAlarm(null);
      await AsyncStorage.removeItem(SELECTED_STATION_KEY);
      
      if (Platform.OS === 'android') {
        try {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        } catch (error) {
          console.error("Error stopping location tracking:", error);
        }
      }
    }
  };

  // Отслеживание местоположения (с небольшими оптимизациями)
  useEffect(() => {
    let isMounted = true;
    let sub: Location.LocationSubscription | null = null;

    const setupLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      if (Platform.OS === 'android') {
        await Location.requestBackgroundPermissionsAsync();
      }

      try {
        const location = await Location.getCurrentPositionAsync({});
        if (isMounted) setCoordinates(location.coords);
        
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 10,
          },
          (newLocation) => {
            if (isMounted) {
              setCoordinates(newLocation.coords);
              if (selectedForAlarm && isWaiting) {
                const distance = calculateDistance(newLocation.coords, selectedForAlarm);
                if (distance < ALARM_DISTANCE_KM && !isPlaying) {
                  playBackgroundMusic();
                } else if (distance >= ALARM_DISTANCE_KM && isPlaying) {
                  stopBackgroundMusic();
                }
              }
            }
          }
        );
        if (isMounted) setLocationSubscription(sub);
      } catch (error) {
        console.error('Location error:', error);
      }
    };

    setupLocation();

    return () => {
      isMounted = false;
      if (sub) sub.remove();
    };
  }, [selectedForAlarm, isWaiting, isPlaying]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.error);
      }
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (Platform.OS === 'android') {
        Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(console.error);
      }
    };
  }, [locationSubscription]);

  // Render UI
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
                  <Text style={styles.suggestionTextLine}>{suggestion.line.name}</Text>
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
              <Text style={styles.selectedVariant}>
                {calculateDistance(coordinates, selectedVariant).toFixed(3)} км
              </Text>
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
      
      <TouchableOpacity 
        style={selectedVariant ? styles.button : styles.buttonDisabled} 
        onPress={handleStartStop}
      >
        <Text style={styles.buttonText}>
          {isWaiting ? 'Остановить' : 'Поехали'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Styles
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
  suggestionTextLine: {
    fontSize: 12,
    color: 'grey',
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
  coordinatesContainer: {
    marginTop: 10,
    padding: 0,
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
  buttonDisabled: {
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