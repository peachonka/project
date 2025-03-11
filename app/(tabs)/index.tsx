import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { Audio } from 'expo-av';
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
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

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
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
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
            if (selectedVariant && isWaiting) {
              const distance = Math.sqrt(
                Math.pow(selectedVariant.lat - newCoordinates.latitude, 2) +
                Math.pow(selectedVariant.lng - newCoordinates.longitude, 2)
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
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
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
              {isPlaying && (
                <Text style={[styles.selectedVariant, {color: '#7A27AB', marginTop: 10}]}>
                  ♫
                </Text>
              )}
            </View>
          )}
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
        style={styles.button} 
        onPress={() => {
          if (isPlaying) {
            stopBackgroundMusic();
          }
          setIsWaiting(!isWaiting);
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
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  }
});