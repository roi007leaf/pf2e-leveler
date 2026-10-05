/** Refill the pool PF2e derives from spells and class rules. */
export async function refillFocusPool(actor) {
  const focus = actor.system?.resources?.focus;
  const max = focus?.max ?? 0;
  const value = focus?.value ?? 0;
  if (value < max) {
    await actor.update({ 'system.resources.focus.value': max });
  }
}
