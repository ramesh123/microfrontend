import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

interface IdStore {
  // Generate a new unique ID
  generateId: () => string;
  // Generate a prefixed ID (useful for specific types of IDs)
  generatePrefixedId: (prefix: string) => string;
  // Generate multiple IDs at once
  generateMultipleIds: (count: number) => string[];
}

/**
 * Store for managing dynamic ID generation
 * Uses UUID v4 by default for guaranteed uniqueness
 */
export const useIdStore = create<IdStore>(() => ({
  generateId: () => uuidv4(),
  
  generatePrefixedId: (prefix: string) => {
    return `${prefix}_${uuidv4()}`;
  },

  generateMultipleIds: (count: number) => {
    return Array.from({ length: count }, () => uuidv4());
  },
}));

/**
 * Hook to get the ID generation functions
 * @returns Object containing ID generation functions
 */
export const useIds = () => {
  const { generateId, generatePrefixedId, generateMultipleIds } = useIdStore();
  
  return {
    generateId,
    generatePrefixedId,
    generateMultipleIds,
  };
};
