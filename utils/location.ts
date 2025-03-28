import * as Location from "expo-location";

// Define interfaces for the coordinate types
export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface StationCoords {
  lat: number;
  lng: number;
}

// Define our own LocationTaskData interface since it's not exported from expo-location
export interface LocationTaskData {
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

// Calculate distance between two coordinates
export function calculateDistance(coords1: LocationCoords, coords2: StationCoords): number {
  const lat1 = coords1.latitude;
  const lon1 = coords1.longitude;
  const lat2 = coords2.lat;
  const lon2 = coords2.lng;

  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}
