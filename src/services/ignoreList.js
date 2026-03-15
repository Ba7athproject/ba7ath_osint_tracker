import localforage from 'localforage';

const IGNORE_LIST_KEY = 'ba7ath_ignore_list';

/**
 * Charge la liste des entités ignorées depuis IndexedDB.
 * Retourne un Set pour des recherches rapides (O(1)).
 * @returns {Promise<Set<string>>}
 */
export async function loadIgnoreList() {
  try {
    const list = await localforage.getItem(IGNORE_LIST_KEY);
    return new Set(Array.isArray(list) ? list : []);
  } catch (error) {
    console.warn('[Ignore List] ⚠️ Erreur de lecture de la liste d\'ignorés.', error);
    return new Set();
  }
}

/**
 * Ajoute une nouvelle entité à la liste des entités ignorées.
 * Conserve toutes les entrées en minuscules.
 * @param {string} entityName 
 * @returns {Promise<Set<string>>}
 */
export async function addToIgnoreList(entityName) {
  if (!entityName) return await loadIgnoreList();
  
  try {
    const listArray = await localforage.getItem(IGNORE_LIST_KEY) || [];
    const normalized = entityName.trim().toLowerCase();
    
    if (!listArray.includes(normalized)) {
      listArray.push(normalized);
      await localforage.setItem(IGNORE_LIST_KEY, listArray);
      console.log(`[Ignore List] 🚫 Ajouté à la liste rouge : "${entityName}"`);
    }
    
    return new Set(listArray);
  } catch (error) {
    console.error('[Ignore List] ❌ Erreur lors de l\'ajout.', error);
    return await loadIgnoreList();
  }
}

/**
 * Retire une entité de la liste rouge.
 * @param {string} entityName 
 * @returns {Promise<Set<string>>}
 */
export async function removeFromIgnoreList(entityName) {
  if (!entityName) return await loadIgnoreList();

  try {
    let listArray = await localforage.getItem(IGNORE_LIST_KEY) || [];
    const normalized = entityName.trim().toLowerCase();
    
    const initialLength = listArray.length;
    listArray = listArray.filter(name => name !== normalized);
    
    if (listArray.length !== initialLength) {
      await localforage.setItem(IGNORE_LIST_KEY, listArray);
      console.log(`[Ignore List] ♻️ Retiré de la liste rouge : "${entityName}"`);
    }
    
    return new Set(listArray);
  } catch (error) {
    console.error('[Ignore List] ❌ Erreur lors du retrait.', error);
    return await loadIgnoreList();
  }
}

/**
 * Purge complète de la liste rouge.
 */
export async function clearIgnoreList() {
  try {
    await localforage.removeItem(IGNORE_LIST_KEY);
    console.log('[Ignore List] 🧹 Liste rouge purgée.');
  } catch (error) {
    console.error('[Ignore List] ❌ Erreur lors de la purge.', error);
  }
}

/**
 * Écrase complètement la liste rouge par une nouvelle table de mots.
 * @param {Array<string>} newListArray 
 * @returns {Promise<Set<string>>}
 */
export async function overwriteIgnoreList(newListArray) {
  try {
    const listArray = Array.isArray(newListArray) ? newListArray : [];
    const normalizedList = listArray.map(name => name.trim().toLowerCase());
    
    // Suppression des doublons via Set
    const finalSet = new Set(normalizedList);
    const finalArray = Array.from(finalSet);
    
    await localforage.setItem(IGNORE_LIST_KEY, finalArray);
    console.log(`[Ignore List] 📥 Liste rouge importée avec ${finalArray.length} entités.`);
    
    return finalSet;
  } catch (error) {
    console.error('[Ignore List] ❌ Erreur lors de l\'import/écrasement.', error);
    return await loadIgnoreList();
  }
}
