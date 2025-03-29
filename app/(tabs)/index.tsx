"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ToastAndroid, ScrollView, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { BlurView } from "expo-blur"
import Fuse from "fuse.js"
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated"
import * as Location from "expo-location"
import { Audio } from "expo-av"
import * as Notifications from "expo-notifications"
import stationsData from "@/assets/stations.json"
import * as TaskManager from "expo-task-manager"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Constants
const SELECTED_STATION_KEY = "selectedStation"
const IS_PLAYING_KEY = "isPlayingAlarm"
const IS_WAITING_KEY = "isWaitingAlarm"
const LOCATION_TASK_NAME = "location-tracking"
const ALARM_DISTANCE_KM = 1.0

// Types
interface Station {
  id: string
  name: string
  lat: number
  lng: number
  order: number
  line: {
    id: string
    hex_color: string
    name: string
  }
}

interface LocationCoords {
  latitude: number
  longitude: number
}

interface ExtendedNotificationContentInput extends Notifications.NotificationContentInput {
  android?: {
    channelId: string
    [key: string]: any
  }
}

// Helper functions
function calculateDistance(coords1: LocationCoords, coords2: Station): number {
  const R = 6371 // Earth radius in km
  const dLat = ((coords2.lat - coords1.latitude) * Math.PI) / 180
  const dLon = ((coords2.lng - coords1.longitude) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coords1.latitude * Math.PI) / 180) *
      Math.cos((coords2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const saveSelectedStation = async (station: Station) => {
  try {
    await AsyncStorage.setItem(SELECTED_STATION_KEY, JSON.stringify(station))
    await AsyncStorage.setItem(IS_PLAYING_KEY, "false")
  } catch (e) {
    console.error("Failed to save station:", e)
  }
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

// Define background location task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: { data?: any; error?: any }) => {
  if (error) {
    console.error("Background location error:", error)
    return
  }

  if (data?.locations?.length > 0) {
    const location = data.locations[0]
    try {
      const [stationData, isPlayingStr, isWaitingStr] = await Promise.all([
        AsyncStorage.getItem(SELECTED_STATION_KEY),
        AsyncStorage.getItem(IS_PLAYING_KEY),
        AsyncStorage.getItem(IS_WAITING_KEY),
      ])

      if (stationData && isWaitingStr === "true") {
        const station = JSON.parse(stationData)
        const distance = calculateDistance(location.coords, station)

        if (distance < ALARM_DISTANCE_KM && isPlayingStr !== "true") {
          await AsyncStorage.setItem(IS_PLAYING_KEY, "true")

          // Создаем уведомление с кнопкой "Остановить" в правильном формате для Android
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Вы приближаетесь к станции!",
              body: `До станции ${station.name} менее ${ALARM_DISTANCE_KM} км`,
              data: {
                action: "alarm",
                stationName: station.name,
              },
              sound: true,
              android: {
                channelId: "alarm",
                // Правильный формат для кнопок в Android уведомлениях
                actions: [
                  {
                    title: "Остановить",
                    identifier: "stop",
                  },
                ],
                color: "#7A27AB",
                sticky: true, // Делаем уведомление постоянным
                autoCancel: false, // Не закрывать автоматически
              },
            } as ExtendedNotificationContentInput,
            trigger: null,
          })
        }
      }
    } catch (e) {
      console.error("Background task error:", e)
    }
  }
})

// Process stations data
const stations: Station[] = stationsData.lines.flatMap((line) =>
  line.stations.map((station) => ({
    ...station,
    line: {
      id: line.id,
      hex_color: line.hex_color,
      name: line.name,
    },
  })),
)

const fuse = new Fuse(stations, {
  includeScore: true,
  threshold: 0.4,
  keys: ["name"],
})

export default function VariantScreen() {
  const [input, setInput] = useState("")
  const [suggestions, setSuggestions] = useState<Station[]>([])
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [coordinates, setCoordinates] = useState<LocationCoords | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const soundRef = useRef<Audio.Sound | null>(null)
  const locationSubscription = useRef<Location.LocationSubscription | null>(null)

  // Load initial state
  useEffect(() => {
    const loadState = async () => {
      try {
        const [stationData, isPlayingStr, isWaitingStr] = await Promise.all([
          AsyncStorage.getItem(SELECTED_STATION_KEY),
          AsyncStorage.getItem(IS_PLAYING_KEY),
          AsyncStorage.getItem(IS_WAITING_KEY),
        ])

        if (stationData) {
          setSelectedStation(JSON.parse(stationData))
        }
        setIsPlaying(isPlayingStr === "true")
        setIsWaiting(isWaitingStr === "true")
      } catch (e) {
        console.error("Failed to load state:", e)
      }
    }

    loadState()
  }, [])

  // Notification setup
  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("alarm", {
        name: "Alarm notifications",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: "alert.mp3",
        enableVibrate: true,
      })
    }

    const requestNotificationPermission = async () => {
      await Notifications.requestPermissionsAsync()
    }
    requestNotificationPermission()
  }, [])

  // Location tracking
  useEffect(() => {
    let isMounted = true

    const setupLocationTracking = async () => {
      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") return

      if (Platform.OS === "android") {
        await Location.requestBackgroundPermissionsAsync()
      }

      // Get current position
      try {
        const location = await Location.getCurrentPositionAsync({})
        if (isMounted) setCoordinates(location.coords)
      } catch (error) {
        console.error("Location error:", error)
      }

      // Start background tracking if needed
      if (Platform.OS === "android" && isWaiting) {
        try {
          const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)
          if (!isTaskRegistered) {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 10,
              foregroundService: {
                notificationTitle: "Метробудильник активен",
                notificationBody: "Отслеживание местоположения...",
                notificationColor: "#7A27AB",
              },
            })
          }
        } catch (error) {
          console.error("Background tracking error:", error)
        }
      }

      // Watch position changes
      try {
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 10,
          },
          (newLocation) => {
            if (isMounted) {
              setCoordinates(newLocation.coords)
              if (selectedStation && isWaiting) {
                const distance = calculateDistance(newLocation.coords, selectedStation)
                if (distance < ALARM_DISTANCE_KM && !isPlaying) {
                  playBackgroundMusic()
                } else if (distance >= ALARM_DISTANCE_KM && isPlaying) {
                  stopBackgroundMusic()
                }
              }
            }
          },
        )
      } catch (error) {
        console.error("Watch position error:", error)
      }
    }

    setupLocationTracking()

    return () => {
      isMounted = false
      if (locationSubscription.current) {
        locationSubscription.current.remove()
      }
    }
  }, [selectedStation, isWaiting, isPlaying])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.error)
      }
      if (locationSubscription.current) {
        locationSubscription.current.remove()
      }
      if (Platform.OS === "android") {
        Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(console.error)
      }
    }
  }, [])

  const handleInputChange = useCallback((text: string) => {
    setInput(text)
    setSuggestions(text.length > 0 ? fuse.search(text).map((result) => result.item) : [])
  }, [])

  const handleSelectVariant = useCallback((station: Station) => {
    setSelectedStation(station)
    setInput("")
    setSuggestions([])
  }, [])

  const playBackgroundMusic = async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync()
        if (status.isLoaded && status.isPlaying) return
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      })

      const { sound } = await Audio.Sound.createAsync(require("@/assets/alert.mp3"), {
        shouldPlay: true,
        isLooping: true,
      })

      soundRef.current = sound
      setIsPlaying(true)
      await AsyncStorage.setItem(IS_PLAYING_KEY, "true")

      // Создаем уведомление с кнопкой "Остановить" при воспроизведении звука
      if (selectedStation) {
        await Notifications.dismissAllNotificationsAsync() // Удаляем предыдущие уведомления
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Будильник!",
            body: `Нажмите, чтобы остановить`,
            data: { action: "alarm" },
            android: {
              channelId: "alarm",
              actions: [
                {
                  title: "Остановить",
                  identifier: "stop",
                },
              ],
              color: "#7A27AB",
              sticky: true,
              autoCancel: false,
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
          } as ExtendedNotificationContentInput,
          trigger: null,
        })
      }
    } catch (error) {
      console.error("Sound error:", error)
    }
  }

  const stopBackgroundMusic = async () => {
    console.log("Attempting to stop sound...") // Добавим лог для отладки
    if (soundRef.current) {
      try {
        console.log("Sound exists, stopping...")
        await soundRef.current.stopAsync()
        console.log("Sound stopped, unloading...")
        await soundRef.current.unloadAsync()
        soundRef.current = null
        setIsPlaying(false)
        await AsyncStorage.setItem(IS_PLAYING_KEY, "false")
        console.log("Sound fully stopped and unloaded")
      } catch (error) {
        console.error("Error stopping sound:", error)
      }
    } else {
      console.log("No sound instance to stop")
    }
  }

  const handleStartStop = async () => {
    if (!selectedStation) {
      ToastAndroid.show("Выберите станцию", ToastAndroid.SHORT)
      return
    }

    const newWaitingState = !isWaiting
    setIsWaiting(newWaitingState)
    await AsyncStorage.setItem(IS_WAITING_KEY, String(newWaitingState))

    if (newWaitingState) {
      await saveSelectedStation(selectedStation)

      if (Platform.OS === "android") {
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
          })
        } catch (error) {
          console.error("Start tracking error:", error)
        }
      }
    } else {
      // Удаляем все уведомления при остановке
      await Notifications.dismissAllNotificationsAsync()
      await stopBackgroundMusic()
      await AsyncStorage.setItem(IS_PLAYING_KEY, "false")

      if (Platform.OS === "android") {
        try {
          const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)
          if (isTaskRegistered) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
          }
        } catch (error) {
          console.error("Stop tracking error:", error)
        }
      }
    }
  }

  // Обработчик уведомлений
  useEffect(() => {
    // Обработчик для уведомлений, полученных когда приложение открыто
    const notificationReceivedSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
      if (notification.request.content.data?.action === "alarm") {
        await playBackgroundMusic()
      }
    })

    // Обработчик для действий с уведомлениями (нажатие на кнопку или само уведомление)
    const responseReceivedSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      console.log("Notification response received:", response.actionIdentifier)

      // Проверяем, была ли нажата кнопка "Остановить" или просто уведомление
      if (
        response.actionIdentifier === "stop" ||
        response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        console.log("Stop action triggered")

        // Останавливаем звук
        await stopBackgroundMusic()

        // Обновляем состояние
        setIsPlaying(false)
        setIsWaiting(false)
        await AsyncStorage.setItem(IS_PLAYING_KEY, "false")
        await AsyncStorage.setItem(IS_WAITING_KEY, "false")

        // Удаляем все уведомления
        await Notifications.dismissAllNotificationsAsync()

        // Останавливаем отслеживание местоположения
        if (Platform.OS === "android") {
          try {
            const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)
            if (isTaskRegistered) {
              await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
              console.log("Location tracking stopped")
            }
          } catch (error) {
            console.error("Error stopping location:", error)
          }
        }
      }
    })

    return () => {
      notificationReceivedSubscription.remove()
      responseReceivedSubscription.remove()
    }
  }, [])

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
        <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={styles.suggestionsContainer}>
          <BlurView intensity={50} style={styles.blurContainer}>
            <ScrollView style={styles.suggestionsList}>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectVariant(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion.name}</Text>
                  <Text style={styles.suggestionTextLine}>{suggestion.line.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </BlurView>
        </Animated.View>
      )}

      {selectedStation && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>Выбранная станция:</Text>
          <Text style={styles.selectedVariant}>{selectedStation.name}</Text>
          {coordinates && (
            <View style={styles.coordinatesContainer}>
              <Text style={styles.selectedLabel}>Расстояние:</Text>
              <Text style={styles.selectedVariant}>
                {calculateDistance(coordinates, selectedStation).toFixed(3)} км
              </Text>
            </View>
          )}
        </View>
      )}

      {isWaiting && selectedStation && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>Будильник зазвонит при приближении к:</Text>
          <Text style={styles.selectedVariant}>{selectedStation.name}</Text>
        </View>
      )}

      <TouchableOpacity
        style={selectedStation ? styles.button : styles.buttonDisabled}
        onPress={handleStartStop}
        disabled={!selectedStation}
      >
        <Text style={styles.buttonText}>{isWaiting ? "Остановить" : "Поехали"}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 10,
  },
  inputContainer: {
    margin: 20,
    borderColor: "#BFBFBF",
    borderRadius: 10,
    borderWidth: 1,
  },
  input: {
    backgroundColor: "#fff",
    padding: Platform.OS === "ios" ? 16 : 12,
    borderRadius: 12,
    fontSize: 16,
    color: "#1e293b",
    elevation: 5,
  },
  suggestionsContainer: {
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    overflow: "hidden",
    maxHeight: 300,
  },
  blurContainer: {
    overflow: "hidden",
    backgroundColor: Platform.OS === "web" ? "rgba(255, 255, 255, 0.9)" : undefined,
  },
  suggestionsList: {
    backgroundColor: Platform.OS === "web" ? "rgba(255, 255, 255, 0.9)" : undefined,
  },
  suggestionItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  suggestionText: {
    fontSize: 16,
    color: "#1e293b",
    marginRight: 10,
  },
  suggestionTextLine: {
    fontSize: 12,
    color: "grey",
    marginRight: 10,
  },
  selectedContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
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
    color: "#64748b",
    marginBottom: 8,
  },
  selectedVariant: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
  },
  coordinatesContainer: {
    marginTop: 10,
    padding: 0,
  },
  button: {
    position: "absolute",
    bottom: 0,
    width: "90%",
    alignSelf: "center",
    backgroundColor: "#7A27AB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    margin: 20,
  },
  buttonDisabled: {
    position: "absolute",
    bottom: 0,
    width: "90%",
    alignSelf: "center",
    backgroundColor: "gray",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    margin: 20,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
})

