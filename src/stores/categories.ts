// ============================================
// Categories Store — Convex-backed
// ============================================

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { convex, api } from '@/services/convexClient';
import { now } from '@/services/database';
import type { Category } from '@/types';
import { DEFAULT_CATEGORIES } from '@/types';
import type { Id } from '../../convex/_generated/dataModel';

type ConvexCategory = Omit<Category, 'id'> & {
  _id: Id<'categories'>;
  _creationTime: number;
  userId: Id<'users'>;
};

function fromConvex(doc: ConvexCategory): Category {
  return {
    id: doc._id,
    name: doc.name,
    icon: doc.icon,
    color: doc.color,
    isCustom: doc.isCustom,
    createdAt: doc.createdAt,
  };
}

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
      const docs = await convex.query(api.categories.list);
      categories.value = (docs as ConvexCategory[]).map(fromConvex);

      // Seed defaults for new users
      if (categories.value.length === 0) {
        await convex.mutation(api.categories.bulkAdd, {
          categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, createdAt: now() })),
        });
        const seeded = await convex.query(api.categories.list);
        categories.value = (seeded as ConvexCategory[]).map(fromConvex);
      }
    } finally {
      loading.value = false;
    }
  }

  async function addCategory(name: string, icon: string, color: string) {
    const createdAt = now();
    const id = await convex.mutation(api.categories.add, {
      name,
      icon,
      color,
      isCustom: true,
      createdAt,
    });
    categories.value.push({ id: id as string, name, icon, color, isCustom: true, createdAt });
  }

  async function updateCategory(id: string, updates: Partial<Category>) {
    // Exclude local-only fields that are not part of the Convex mutation args
    const { id: _id, createdAt: _c, isCustom: _ic, userId: _u, ...mutableFields } = updates as Record<string, unknown>;
    await convex.mutation(api.categories.update, {
      id: id as unknown as Id<'categories'>,
      ...mutableFields,
    });
    const idx = categories.value.findIndex((c) => c.id === id);
    if (idx !== -1) {
      categories.value[idx] = { ...categories.value[idx], ...updates };
    }
  }

  async function deleteCategory(id: string) {
    const cat = categories.value.find((c) => c.id === id);
    if (cat && !cat.isCustom) return;
    await convex.mutation(api.categories.remove, { id: id as Id<'categories'> });
    categories.value = categories.value.filter((c) => c.id !== id);
  }

  // Migrate custom categories from local IndexedDB to Convex on first sign-in
  async function migrateFromLocal(localCategories: Category[]) {
    const customs = localCategories.filter((c) => c.isCustom);
    if (customs.length === 0) return;
    await convex.mutation(api.categories.bulkAdd, {
      categories: customs.map(({ id: _id, ...rest }) => rest),
    });
    await initialize();
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
    migrateFromLocal,
    getCategoryByName,
  };
});