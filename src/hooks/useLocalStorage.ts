
"use client";

import { useState, useEffect, Dispatch, SetStateAction } from 'react';

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

  // The actual setter function that will be returned
  const setValue: Dispatch<SetStateAction<T>> = (value) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Create a new reference if it's an object/array to help React detect changes
      let valueForReactState: T = valueToStore;
      if (typeof valueToStore === 'object' && valueToStore !== null) {
        valueForReactState = Array.isArray(valueToStore) 
          ? [...valueToStore] as unknown as T  // Shallow copy for array
          : { ...valueToStore };              // Shallow copy for object
      }
      
      setStoredValue(valueForReactState); // Update React state

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore)); // Update localStorage with the original intended value
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  useEffect(() => {
    // This effect is to ensure that if localStorage is updated by another tab/window,
    // or if the initialValue changes drastically, we could try to sync.
    // However, for this specific problem, the direct write in setValue is more relevant.
    // The original useEffect for writing to localStorage when storedValue changes via setStoredValue is implicitly handled by setValue now.
    // For robustness, if storedValue changes from outside (which is not typical for this hook's usage),
    // we might want to write it, but it could cause loops if not careful.
    // The current setup (write on setValue) is generally safer.
    // Let's keep the original write logic in useEffect as a fallback/sync, but it's secondary to the write in setValue.
    if (typeof window !== 'undefined') {
        try {
          // Compare stringified versions to avoid infinite loops if object references are different but content is same
          const currentLocalStorageItem = window.localStorage.getItem(key);
          const newStoredValueString = JSON.stringify(storedValue);
          if (currentLocalStorageItem !== newStoredValueString) {
            window.localStorage.setItem(key, newStoredValueString);
          }
        } catch (error) {
             console.warn(`Error synchronizing localStorage key "${key}" in useEffect:`, error);
        }
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

export default useLocalStorage;
