import React, { createContext, useContext, useMemo, useState, useRef } from 'react';
import { Animated } from 'react-native';

// Base dimensions at scale 1.0
export const BASE_HOUR_HEIGHT = 48;
export const BASE_DAY_WIDTH = 120;

// Zoom constraints
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 1.5;
export const SNAP_THRESHOLD = 0.08; // Snap to preset if within 8%

// Zoom presets
export const ZOOM_PRESETS = {
  overview: 0.25,    // Full week visible
  compact: 0.5,      // 2x smaller
  normal: 1.0,       // Current default
  detailed: 1.25,    // Slightly larger
  accessible: 1.5,   // Maximum zoom
} as const;

export type ZoomPreset = keyof typeof ZOOM_PRESETS;

interface ZoomContextValue {
  // Animated value for smooth transitions
  scaleAnim: Animated.Value;

  // Current scale as JS number (for React rendering)
  currentScale: number;
  setCurrentScale: (scale: number) => void;

  // Previous scale for double-tap toggle
  previousScale: React.MutableRefObject<number>;

  // Computed dimensions (based on currentScale)
  hourHeight: number;
  dayWidth: number;
}

const ZoomContext = createContext<ZoomContextValue | null>(null);

export function ZoomProvider({ children }: { children: React.ReactNode }) {
  // Animated value for smooth transitions (not used in worklets)
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Previous scale for double-tap toggle (starts at 1.0 so first double-tap does nothing)
  const previousScale = useRef(1);

  // JS state for triggering React re-renders
  const [currentScale, setCurrentScale] = useState(1);

  // Computed dimensions
  const hourHeight = Math.round(BASE_HOUR_HEIGHT * currentScale);
  const dayWidth = Math.round(BASE_DAY_WIDTH * currentScale);

  const value = useMemo<ZoomContextValue>(() => ({
    scaleAnim,
    currentScale,
    setCurrentScale,
    previousScale,
    hourHeight,
    dayWidth,
  }), [scaleAnim, currentScale, hourHeight, dayWidth]);

  return (
    <ZoomContext.Provider value={value}>
      {children}
    </ZoomContext.Provider>
  );
}

export function useZoom(): ZoomContextValue {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoom must be used within a ZoomProvider');
  }
  return context;
}

// Utility to determine progressive disclosure level based on scale
export function getDisclosureLevel(scale: number): 'minimal' | 'compact' | 'normal' | 'detailed' {
  if (scale <= 0.3) return 'minimal';
  if (scale <= 0.6) return 'compact';
  if (scale <= 1.1) return 'normal';
  return 'detailed';
}

// Hour marker intervals based on zoom level
export function getHourMarkerInterval(scale: number): number {
  const level = getDisclosureLevel(scale);
  switch (level) {
    case 'minimal': return 4;  // Every 4 hours
    case 'compact': return 2;  // Every 2 hours
    case 'normal': return 1;   // Every hour
    case 'detailed': return 1; // Every hour (could add 30-min markers)
  }
}

// Layout constants for min zoom calculation
export const TIME_COLUMN_WIDTH = 60;
export const HEADER_HEIGHT = 50; // Day header row height

// Calculate dynamic minimum zoom to fit calendar in viewport
export function calculateMinZoom(viewportWidth: number, viewportHeight: number): number {
  // Calendar must fit both width and height
  const minZoomForWidth = (viewportWidth - TIME_COLUMN_WIDTH) / (7 * BASE_DAY_WIDTH);
  const minZoomForHeight = viewportHeight / (24 * BASE_HOUR_HEIGHT);
  // Use the smaller value to ensure both dimensions fit
  return Math.min(minZoomForWidth, minZoomForHeight);
}

// Helper to clamp scale with dynamic min zoom
export function clampScale(rawScale: number, minZoom: number = MIN_ZOOM): number {
  return Math.min(MAX_ZOOM, Math.max(minZoom, rawScale));
}

// Calculate new scroll positions for focal point zooming
// Keeps the content under the focal point stable during zoom
export interface FocalPointZoomParams {
  focalX: number;      // Focal point X relative to GestureDetector
  focalY: number;      // Focal point Y relative to GestureDetector
  scrollX: number;     // Current horizontal scroll offset
  scrollY: number;     // Current vertical scroll offset
  oldScale: number;    // Scale before zoom
  newScale: number;    // Scale after zoom
  headerHeight?: number; // Height of fixed header (not in vertical scroll)
}

export interface FocalPointZoomResult {
  newScrollX: number;
  newScrollY: number;
}

export function calculateFocalPointScroll({
  focalX,
  focalY,
  scrollX,
  scrollY,
  oldScale,
  newScale,
  headerHeight = HEADER_HEIGHT,
}: FocalPointZoomParams): FocalPointZoomResult {
  // Calculate content position under focal point (before zoom)
  const contentX = scrollX + focalX;
  const contentY = scrollY + (focalY - headerHeight);

  // Scale factor
  const scaleFactor = newScale / oldScale;

  // Calculate new scroll position to keep same content under focal point
  const newScrollX = Math.max(0, contentX * scaleFactor - focalX);
  const newScrollY = Math.max(0, contentY * scaleFactor - (focalY - headerHeight));

  return { newScrollX, newScrollY };
}

// Helper to snap to nearest preset
export function snapToPreset(scale: number): number | null {
  const presets = Object.values(ZOOM_PRESETS);
  const nearest = presets.reduce((prev, curr) =>
    Math.abs(curr - scale) < Math.abs(prev - scale) ? curr : prev
  );

  if (Math.abs(nearest - scale) < SNAP_THRESHOLD) {
    return nearest;
  }
  return null;
}
