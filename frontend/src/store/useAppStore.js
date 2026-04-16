import { create } from 'zustand';

export const useAppStore = create((set) => ({
  activeCategory: 'all',
  setActiveCategory: (category) => set({ activeCategory: category }),
  
  activeStrategy: 'valiente',
  setActiveStrategy: (strategy) => set({ activeStrategy: strategy }),

  searchTerm: '',
  setSearchTerm: (term) => set({ searchTerm: term }),

  zoomedImage: null,
  setZoomedImage: (url) => set({ zoomedImage: url }),
}));
