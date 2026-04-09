const PREFIX = 'PF2e Leveler |';

export function debug(...args) {
  console.debug(PREFIX, ...args);
}

export function info(...args) {
  console.info(PREFIX, ...args);
}

export function warn(...args) {
  console.warn(PREFIX, ...args);
}

export function error(...args) {
  console.error(PREFIX, ...args);
}

export function notify(message, type = 'info') {
  ui.notifications[type](message);
}

export function notifyLocalized(key, data = {}, type = 'info') {
  const message = game.i18n.format(`PF2E_LEVELER.${key}`, data);
  ui.notifications[type](message);
}
