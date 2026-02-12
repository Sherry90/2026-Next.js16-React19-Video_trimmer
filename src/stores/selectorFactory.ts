/**
 * Zustand selector factory utilities
 *
 * Reduces boilerplate by providing helper functions for common selector patterns
 */

import { useStore } from './useStore';
import { useShallow } from 'zustand/react/shallow';

// Extract the full store type (state + actions)
type Store = ReturnType<typeof useStore.getState>;

/**
 * Create a state selector with shallow equality check
 *
 * @param selector - Function that extracts state from the store
 * @returns Hook that returns the selected state
 *
 * @example
 * ```typescript
 * export const useTimelineState = createStateSelector((state) => ({
 *   inPoint: state.timeline.inPoint,
 *   outPoint: state.timeline.outPoint,
 * }));
 * ```
 */
export function createStateSelector<T>(selector: (state: Store) => T) {
  return () => useStore(useShallow(selector));
}

/**
 * Create a simple selector (no shallow comparison needed)
 *
 * @param selector - Function that extracts a single value from the store
 * @returns Hook that returns the selected value
 *
 * @example
 * ```typescript
 * export const usePhase = createSimpleSelector((state) => state.phase);
 * ```
 */
export function createSimpleSelector<T>(selector: (state: Store) => T) {
  return () => useStore(selector);
}
