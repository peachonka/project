import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Fuse from 'fuse.js';
import Animated, {
  FadeInDown,
  FadeOutDown,
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import stationsData from '@/assets/stations.json';

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

interface StationLine {
  name: string;
  lineId: string;
}

const stations: StationLine[] = stationsData.lines.flatMap((line) => 
  line.stations.map(station => ({
    name: station.name,
    lineId: "(" + line.name + ")",
  }))
);

const fuse = new Fuse(stations, {
  includeScore: true,
  threshold: 0.4,
  keys: ['name'],
});

// Sample dataset of variants
// const variants = [
//   'Amazing', 'Brilliant', 'Captivating', 'Delightful', 'Elegant',
//   'Fascinating', 'Gorgeous', 'Harmonious', 'Incredible', 'Jubilant',
//   'Magnificent', 'Outstanding', 'Phenomenal', 'Remarkable', 'Spectacular',
//   'Stunning', 'Terrific', 'Unbelievable', 'Wonderful', 'Extraordinary'
// ];

// Configure Fuse.js for fuzzy search

export default function VariantScreen() {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<StationLine[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<StationLine | null>(null);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);

  const handleInputChange = useCallback((text: string) => {
    setInput(text);
    if (text.length > 0) {
      const results = fuse.search(text);
      setSuggestions(results.map(result => result.item));
    } else {
      setSuggestions([]);
    }
  }, []);

  const handleSelectVariant = useCallback((variant: StationLine) => {
    setSelectedVariant(variant);
    setInput('');
    setSuggestions([]);
  }, []);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        setCoordinates({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();
  }, []);

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
                  <Text style={styles.suggestionText}>{suggestion.lineId}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </BlurView>
        </Animated.View>
      )}

      {selectedVariant && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>Выберите станцию:</Text>
          <Text style={styles.selectedVariant}>{selectedVariant.name}</Text>
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
        <TouchableOpacity style={styles.button} onPress={() => console.log('Button pressed!')}>
          <Text style={styles.buttonText}>Поехали</Text>
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
    
    buttonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    }
});