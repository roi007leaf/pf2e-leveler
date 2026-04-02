export function localize(key) {
  return game.i18n.localize(`PF2E_LEVELER.${key}`);
}

export function format(key, data = {}) {
  return game.i18n.format(`PF2E_LEVELER.${key}`, data);
}
