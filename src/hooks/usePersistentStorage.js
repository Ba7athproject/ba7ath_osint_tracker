import { useState, useEffect } from 'react';
import localforage from 'localforage';

/**
 * Hook personnalisé pour synchroniser l'état React avec IndexedDB via localforage.
 * Contrairement au localStorage, localforage est asynchrone.
 * 
 * @param {string} key La clé sous laquelle stocker la donnée.
 * @param {any} initialValue La valeur initiale par défaut.
 * @returns {[any, Function, boolean, Function]} [value, setter, isLoaded, removeFunction]
 */
export function usePersistentStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  // Charger la valeur initiale depuis IndexedDB au montage
  useEffect(() => {
    localforage.getItem(key)
      .then(value => {
        if (value !== null) {
          setStoredValue(value);
        }
        setIsLoaded(true);
      })
      .catch(err => {
        console.warn(`Erreur de lecture IndexedDB (${key}):`, err);
        setIsLoaded(true); // On marque comme prêt même si erreur pour débloquer l'UI
      });
  }, [key]);

  // Fonction pour mettre à jour la valeur
  const setValue = async (value) => {
    try {
      // Gérer les setters de type fonction (comme useState)
      const valueToStore = typeof value === 'function' ? value(storedValue) : value;
      
      setStoredValue(valueToStore);
      await localforage.setItem(key, valueToStore);
    } catch (error) {
      console.warn(`Erreur de sauvegarde IndexedDB (${key}):`, error);
    }
  };

  // Fonction pour effacer la donnée
  const removeValue = async () => {
    try {
      setStoredValue(initialValue);
      await localforage.removeItem(key);
    } catch (error) {
      console.warn(`Erreur de suppression IndexedDB (${key}):`, error);
    }
  };

  return [storedValue, setValue, isLoaded, removeValue];
}
