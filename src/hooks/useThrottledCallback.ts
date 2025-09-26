/**
 * Throttled Callback Hook
 * 
 * Limits function execution to at most once per specified interval,
 * improving performance for frequently triggered events.
 */

import { useCallback, useRef, useEffect } from 'react';

export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  dependencies: React.DependencyList = []
): T {
  const callbackRef = useRef(callback);
  const lastExecutedRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args) => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecutedRef.current;

      if (timeSinceLastExecution >= delay) {
        // Execute immediately if enough time has passed
        lastExecutedRef.current = now;
        callbackRef.current(...args);
      } else {
        // Schedule execution for later
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
          lastExecutedRef.current = Date.now();
          callbackRef.current(...args);
        }, delay - timeSinceLastExecution);
      }
    }) as T,
    [delay, ...dependencies]
  );
}

export default useThrottledCallback;