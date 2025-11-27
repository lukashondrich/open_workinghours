# Mobile Calendar Integration Plan

## Phase 1: Share Core Logic
1. Copy `calendar-context`, reducer, types, and utilities into `mobile-app/src/lib/calendar/`.
2. Ensure the mobile app can import `CalendarProvider`/`useCalendar` without web-only dependencies.

## Phase 2: Build React Native UI
1. Create `CalendarScreen` components (Week view grid, headers, template panel) that mirror web behavior.
2. Hook up interactions (place shift, edit template/instance, review mode) using the shared reducer.

## Phase 3: Persistence & Validation
1. Persist templates/instances/tracking records with SQLite and hydrate state on load.
2. Run device tests to verify planning workflow end-to-end and document the new module.
