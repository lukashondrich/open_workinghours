import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onMyLocation: () => void;
}

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onMyLocation,
}: MapControlsProps) {
  return (
    <View style={styles.container}>
      {/* Zoom In */}
      <TouchableOpacity style={styles.button} onPress={onZoomIn}>
        <Text style={styles.buttonText}>+</Text>
      </TouchableOpacity>

      {/* Zoom Out */}
      <TouchableOpacity style={styles.button} onPress={onZoomOut}>
        <Text style={styles.buttonText}>−</Text>
      </TouchableOpacity>

      {/* My Location */}
      <TouchableOpacity style={styles.button} onPress={onMyLocation}>
        <Text style={styles.buttonText}>📍</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    top: 100,
    gap: 8,
  },
  button: {
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
});
