import { useState, useEffect } from 'react';

/**
 * Hook personnalisé pour synchroniser l'état React avec localStorage.
 * 
 * @param {string} key La clé sous laquelle stocker dans localStorage
 * @param {any} initialValue La valeur initiale par défaut si rien n'est stocké
 * @returns {[any, Function, Function]} La valeur, le setter, et une fonction pour effacer la clé
 */
export function useLocalStorage(key, initialValue) {
  // Obtenir la valeur de localStorage (ou initialValue) pour l'état initial
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Erreur de lecture du localStorage pour la clé "${key}":`, error);
      return initialValue;
    }
  });

  // Fonction pour mettre à jour la valeur et la synchroniser avec localStorage
  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Erreur de sauvegarde dans le localStorage pour la clé "${key}":`, error);
    }
  };

  // Fonction pour effacer la donnée
  const removeValue = () => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Erreur lors de la suppression du localStorage pour la clé "${key}":`, error);
    }
  };

  return [storedValue, setValue, removeValue];
}
