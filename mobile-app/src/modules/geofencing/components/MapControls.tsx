import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onMyLocation: () => void;
  bottomOffset?: number;
}

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onMyLocation,
  bottomOffset = 340,
}: MapControlsProps) {
  const handleZoomIn = () => {
    console.log('[MapControls] Zoom In pressed!');
    onZoomIn();
  };

  const handleZoomOut = () => {
    console.log('[MapControls] Zoom Out pressed!');
    onZoomOut();
  };

  const handleMyLocation = () => {
    console.log('[MapControls] My Location pressed!');
    onMyLocation();
  };

  return (
    <View style={[styles.container, { bottom: bottomOffset }]}>
      {/* Zoom In */}
      <TouchableOpacity style={styles.button} onPress={handleZoomIn}>
        <Text style={styles.buttonText}>+</Text>
      </TouchableOpacity>

      {/* Zoom Out */}
      <TouchableOpacity style={styles.button} onPress={handleZoomOut}>
        <Text style={styles.buttonText}>−</Text>
      </TouchableOpacity>

      {/* My Location */}
      <TouchableOpacity style={styles.button} onPress={handleMyLocation}>
        <Text style={styles.buttonText}>📍</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    gap: 8,
    zIndex: 100,
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
