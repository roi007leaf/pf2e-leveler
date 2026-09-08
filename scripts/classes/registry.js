import { resolveClassEdition } from './editions.js';

const classDefinitions = new Map();

export const ClassRegistry = {
  register(classDef) {
    if (!classDef.slug) throw new Error('Class definition must have a slug');
    classDefinitions.set(classDef.slug, classDef);
  },

  get(slug, actor = null, selectedClass = null) {
    return resolveClassEdition(classDefinitions.get(slug) ?? null, actor, selectedClass);
  },

  getAll() {
    return Array.from(classDefinitions.values());
  },

  getSlugs() {
    return Array.from(classDefinitions.keys());
  },

  has(slug) {
    return classDefinitions.has(slug);
  },

  clear() {
    classDefinitions.clear();
  },
};
