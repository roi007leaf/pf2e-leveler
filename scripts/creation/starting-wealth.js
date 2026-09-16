import { CHARACTER_WEALTH, MODULE_ID, WEALTH_MODES } from '../constants.js';

export function getEquipmentTotalCp(equipment = []) {
  let totalCp = 0;
  for (const entry of equipment) {
    if (!entry?.price) continue;
    const quantity = Number(entry.quantity ?? 1) || 1;
    const pricePer = Number(entry.pricePer ?? 1) || 1;
    const unitCp = (Number(entry.price.gp) || 0) * 100 + (Number(entry.price.sp) || 0) * 10 + (Number(entry.price.cp) || 0);
    totalCp += Math.ceil((quantity / pricePer) * unitCp);
  }
  return totalCp;
}

export function getStartingEquipmentBudgetCp(actor) {
  const mode = game.settings.get(MODULE_ID, 'startingWealthMode') ?? WEALTH_MODES.DISABLED;
  const level = Number(actor?.system?.details?.level?.value ?? 1) || 1;
  const wealth = CHARACTER_WEALTH[level];

  if (mode === WEALTH_MODES.LUMP_SUM && wealth) return wealth.lumpSumGp * 100;
  if (mode === WEALTH_MODES.ITEMS_AND_CURRENCY && wealth) return wealth.currencyGp * 100;
  if (mode === WEALTH_MODES.CUSTOM) {
    const gold = Number(game.settings.get(MODULE_ID, 'startingEquipmentGoldLimit')) || 0;
    return Math.max(0, Math.round(gold * 100));
  }
  return 0;
}

export function coinsFromCp(totalCp) {
  let remainder = Math.max(0, Math.trunc(Number(totalCp) || 0));
  const gp = Math.floor(remainder / 100);
  remainder %= 100;
  const sp = Math.floor(remainder / 10);
  const cp = remainder % 10;
  return Object.fromEntries(Object.entries({ gp, sp, cp }).filter(([, quantity]) => quantity > 0));
}
