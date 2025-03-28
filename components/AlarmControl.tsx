import { View, Text, StyleSheet, TouchableOpacity } from "react-native"

interface AlarmControlProps {
  isPlaying: boolean
  onStopAlarm: () => void
}

export function AlarmControl({ isPlaying, onStopAlarm }: AlarmControlProps) {
  if (!isPlaying) return null

  return (
    <View style={styles.container}>
      <Text style={styles.alarmText}>Будильник активен!</Text>
      <TouchableOpacity style={styles.stopButton} onPress={onStopAlarm}>
        <Text style={styles.buttonText}>Остановить</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    margin: 20,
    padding: 20,
    backgroundColor: "#ffebee",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ef5350",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 5,
    alignItems: "center",
  },
  alarmText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#d32f2f",
    marginBottom: 12,
  },
  stopButton: {
    backgroundColor: "#d32f2f",
    padding: 12,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
})

