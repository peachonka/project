import * as Notifications from "expo-notifications"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Constants
export const ALARM_NOTIFICATION_ID = "alarm-notification"
export const IS_PLAYING_KEY = "isPlayingAlarm"

// Function to play alarm sound via notification
export const playAlarmNotification = async (stationName: string) => {
  try {
    // Cancel any existing alarm notifications first
    await Notifications.dismissAllNotificationsAsync()

    // Schedule a new notification with alarm sound and actions
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Вы приближаетесь к станции!",
        body: `До станции ${stationName} менее 1 км`,
        data: { action: "alarm" },
        sound: "alert.mp3", // Custom sound file
        autoDismiss: false, // Don't auto dismiss
        sticky: true, // Make the notification persistent
      },
      trigger: null, // Show immediately
      identifier: ALARM_NOTIFICATION_ID,
    })

    console.log("Alarm notification scheduled with ID:", notificationId)
    return notificationId
  } catch (error) {
    console.error("Failed to schedule alarm notification:", error)
    return null
  }
}

// Stop alarm function that can be called from both the app and notification handler
export const stopAlarm = async () => {
  try {
    // Update AsyncStorage
    await AsyncStorage.setItem(IS_PLAYING_KEY, "false")

    // Dismiss the notification
    await Notifications.dismissNotificationAsync(ALARM_NOTIFICATION_ID)

    console.log("Alarm stopped successfully")
    return true
  } catch (error) {
    console.error("Failed to stop alarm:", error)
    return false
  }
}

// Configure notification handling
export const setupNotifications = async () => {
  // Set notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })

  // Configure notification action buttons
  await Notifications.setNotificationCategoryAsync("alarm", [
    {
      identifier: "stop",
      buttonTitle: "Остановить",
      options: {
        isDestructive: true,
      },
    },
  ])

  // Request permissions
  const { status } = await Notifications.requestPermissionsAsync()
  return status === "granted"
}

