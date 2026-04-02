const classDefinitions = new Map();

export const ClassRegistry = {
  register(classDef) {
    if (!classDef.slug) throw new Error('Class definition must have a slug');
    classDefinitions.set(classDef.slug, classDef);
  },

  get(slug) {
    return classDefinitions.get(slug) ?? null;
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
