// ============================================
// Categories Store
// ============================================

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db, generateId, now } from '@/services/database';
import type { Category } from '@/types';
import { DEFAULT_CATEGORIES } from '@/types';

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([]);
  const loading = ref(false);

  const categoryNames = computed(() => categories.value.map((c) => c.name));
  const categoryMap = computed(() => {
    const map: Record<string, Category> = {};
    categories.value.forEach((c) => {
      map[c.name] = c;
    });
    return map;
  });

  async function initialize() {
    loading.value = true;
    try {
      const existing = await db.categories.count();
      if (existing === 0) {
        // Seed defaults
        const defaults: Category[] = DEFAULT_CATEGORIES.map((c) => ({
          ...c,
          id: generateId(),
          createdAt: now(),
        }));
        await db.categories.bulkAdd(defaults);
      }
      categories.value = await db.categories.toArray();
    } finally {
      loading.value = false;
    }
  }

  async function addCategory(name: string, icon: string, color: string) {
    const cat: Category = {
      id: generateId(),
      name,
      icon,
      color,
      isCustom: true,
      createdAt: now(),
    };
    await db.categories.add(cat);
    categories.value.push(cat);
  }

  async function updateCategory(id: string, updates: Partial<Category>) {
    await db.categories.update(id, updates);
    const idx = categories.value.findIndex((c) => c.id === id);
    if (idx !== -1) {
      categories.value[idx] = { ...categories.value[idx], ...updates };
    }
  }

  async function deleteCategory(id: string) {
    const cat = categories.value.find((c) => c.id === id);
    if (cat && !cat.isCustom) return; // Can't delete defaults

    await db.categories.delete(id);
    categories.value = categories.value.filter((c) => c.id !== id);
  }

  function getCategoryByName(name: string): Category | undefined {
    return categories.value.find((c) => c.name.toLowerCase() === name.toLowerCase());
  }

  return {
    categories,
    loading,
    categoryNames,
    categoryMap,
    initialize,
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoryByName,
  };
});
