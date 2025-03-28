import { View, Text, StyleSheet } from "react-native"
import type { Station } from "@/types/station"
import { calculateDistance } from "@/utils/location"

interface StationInfoProps {
  station: Station
  coordinates: { latitude: number; longitude: number } | null
  isForAlarm?: boolean
}

export function StationInfo({ station, coordinates, isForAlarm = false }: StationInfoProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {isForAlarm ? "Будильник зазвонит при приближении к станции:" : "Выбранная станция:"}
      </Text>
      <Text style={styles.stationName}>{station.name}</Text>
      {coordinates && !isForAlarm && (
        <View style={styles.coordinatesContainer}>
          <Text style={styles.label}>Расстояние до выбранной станции:</Text>
          <Text style={styles.stationName}>{calculateDistance(coordinates, station).toFixed(3)} км</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
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
  label: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 8,
  },
  stationName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
  },
  coordinatesContainer: {
    backgroundColor: "rgba(255, 255, 255)",
    padding: 10,
    borderRadius: 5,
    marginTop: 20,
  },
})

