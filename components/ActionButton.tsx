import { TouchableOpacity, Text, StyleSheet } from "react-native"

interface ActionButtonProps {
  onPress: () => void
  disabled?: boolean
  isWaiting?: boolean
  isPlaying?: boolean
}

export function ActionButton({ onPress, disabled = false, isWaiting = false, isPlaying = false }: ActionButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled, isPlaying && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || isPlaying}
    >
      <Text style={styles.buttonText}>{isWaiting ? "Остановить" : "Поехали"}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
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
    backgroundColor: "gray",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
})

