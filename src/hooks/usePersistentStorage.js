import { useState, useEffect, useCallback, useRef } from 'react';
import localforage from 'localforage';

/**
 * Hook personnalisé pour synchroniser l'état React avec IndexedDB via localforage.
 * 
 * @param {string} key La clé sous laquelle stocker la donnée.
 * @param {any} initialValue La valeur initiale par défaut.
 * @returns {[any, Function, boolean, Function]} [value, setter, isLoaded, removeFunction]
 */
export function usePersistentStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const isMounted = useRef(false);

  // Charger la valeur initiale depuis IndexedDB au montage
  useEffect(() => {
    isMounted.current = true;
    localforage.getItem(key)
      .then(value => {
        if (value !== null && isMounted.current) {
          if (typeof initialValue === 'object' && initialValue !== null && typeof value === 'object') {
            setStoredValue({ ...initialValue, ...value });
          } else {
            setStoredValue(value);
          }
        }
        setIsLoaded(true);
      })
      .catch(err => {
        console.warn(`Erreur de lecture IndexedDB (${key}):`, err);
        if (isMounted.current) setIsLoaded(true);
      });
    
    return () => { isMounted.current = false; };
  }, [key]);

  // Effet de bord pour la persistance
  useEffect(() => {
    if (isLoaded) {
      localforage.setItem(key, storedValue).catch(err => {
        console.warn(`Erreur de sauvegarde IndexedDB (${key}):`, err);
      });
    }
  }, [key, storedValue, isLoaded]);

  // Fonction pour mettre à jour la valeur (pure)
  const setValue = useCallback((value) => {
    setStoredValue(prev => {
      return typeof value === 'function' ? value(prev) : value;
    });
  }, []);

  // Fonction pour effacer la donnée
  const removeValue = useCallback(async () => {
    setStoredValue(initialValue);
    await localforage.removeItem(key);
  }, [key, initialValue]);

  return [storedValue, setValue, isLoaded, removeValue];
}
