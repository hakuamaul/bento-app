// Mock AsyncStorage for testing
const store: Record<string, string> = {};

export default {
  getItem: async (key: string) => {
    return store[key] || null;
  },
  setItem: async (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: async (key: string) => {
    delete store[key];
  },
  clear: async () => {
    Object.keys(store).forEach(key => delete store[key]);
  },
  getAllKeys: async () => {
    return Object.keys(store);
  },
  multiGet: async (keys: string[]) => {
    return keys.map(key => [key, store[key] || null]);
  },
  multiSet: async (keyValuePairs: Array<[string, string]>) => {
    keyValuePairs.forEach(([key, value]) => {
      store[key] = value;
    });
  },
  multiRemove: async (keys: string[]) => {
    keys.forEach(key => delete store[key]);
  },
};
