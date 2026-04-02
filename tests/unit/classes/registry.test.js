import { ClassRegistry } from '../../../scripts/classes/registry.js';

describe('ClassRegistry', () => {
  beforeEach(() => {
    ClassRegistry.clear();
  });

  test('registers and retrieves a class definition', () => {
    const classDef = { slug: 'fighter', hp: 10 };
    ClassRegistry.register(classDef);
    expect(ClassRegistry.get('fighter')).toBe(classDef);
  });

  test('returns null for unknown class', () => {
    expect(ClassRegistry.get('nonexistent')).toBeNull();
  });

  test('throws if class definition has no slug', () => {
    expect(() => ClassRegistry.register({ hp: 10 })).toThrow('must have a slug');
  });

  test('getAll returns all registered classes', () => {
    ClassRegistry.register({ slug: 'fighter' });
    ClassRegistry.register({ slug: 'wizard' });
    expect(ClassRegistry.getAll()).toHaveLength(2);
  });

  test('getSlugs returns all registered slugs', () => {
    ClassRegistry.register({ slug: 'fighter' });
    ClassRegistry.register({ slug: 'wizard' });
    expect(ClassRegistry.getSlugs()).toEqual(['fighter', 'wizard']);
  });

  test('has returns true for registered class', () => {
    ClassRegistry.register({ slug: 'fighter' });
    expect(ClassRegistry.has('fighter')).toBe(true);
    expect(ClassRegistry.has('wizard')).toBe(false);
  });

  test('clear removes all classes', () => {
    ClassRegistry.register({ slug: 'fighter' });
    ClassRegistry.clear();
    expect(ClassRegistry.getAll()).toHaveLength(0);
  });

  test('overwrites existing registration with same slug', () => {
    ClassRegistry.register({ slug: 'fighter', hp: 10 });
    ClassRegistry.register({ slug: 'fighter', hp: 12 });
    expect(ClassRegistry.get('fighter').hp).toBe(12);
  });
});
