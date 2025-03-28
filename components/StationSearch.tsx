"use client"

import { useState, useCallback } from "react"
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Platform } from "react-native"
import { BlurView } from "expo-blur"
import Fuse from "fuse.js"
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated"
import type { Station } from "@/types/station"

interface StationSearchProps {
  stations: Station[]
  onSelectStation: (station: Station) => void
}

export function StationSearch({ stations, onSelectStation }: StationSearchProps) {
  const [input, setInput] = useState("")
  const [suggestions, setSuggestions] = useState<Station[]>([])

  const fuse = new Fuse(stations, {
    includeScore: true,
    threshold: 0.4,
    keys: ["name"],
  })

  const handleInputChange = useCallback((text: string) => {
    setInput(text)
    if (text.length > 0) {
      const results = fuse.search(text)
      setSuggestions(results.map((result) => result.item))
    } else {
      setSuggestions([])
    }
  }, [])

  const handleSelectVariant = useCallback(
    (station: Station) => {
      onSelectStation(station)
      setInput("")
      setSuggestions([])
    },
    [onSelectStation],
  )

  return (
    <>
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
                  <Text style={styles.suggestionText}>{suggestion.line.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </BlurView>
        </Animated.View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
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
})

