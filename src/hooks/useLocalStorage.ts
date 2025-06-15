
"use client";

import { useState, useEffect, Dispatch, SetStateAction, useCallback } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Effect to update localStorage when storedValue changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}" in useEffect:`, error);
      }
    }
  }, [key, storedValue]);

  // The setValue function returned by the hook.
  // It's a memoized version of setStoredValue from useState, ensuring it's stable.
  const setValue: Dispatch<SetStateAction<T>> = useCallback((value) => {
    setStoredValue(value);
  }, [setStoredValue]); // setStoredValue from useState is guaranteed to be stable.

  return [storedValue, setValue];
}

export default useLocalStorage;
