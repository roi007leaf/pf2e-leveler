import { SORCERER } from '../../../scripts/classes/sorcerer.js';
import { SUMMONER } from '../../../scripts/classes/summoner.js';
import { getRequiredSignatureSpellRanks } from '../../../scripts/utils/signature-spells.js';

describe('signature spell requirements', () => {
  test('requires every accessible rank at feature unlock and only newly unlocked ranks later', () => {
    expect(getRequiredSignatureSpellRanks(SORCERER, 3)).toEqual([1, 2]);
    expect(getRequiredSignatureSpellRanks(SORCERER, 5)).toEqual([3]);
    expect(getRequiredSignatureSpellRanks(SORCERER, 6)).toEqual([]);
  });

  test('does not request manual choices for legacy Unlimited Signature Spells', () => {
    expect(getRequiredSignatureSpellRanks(SUMMONER, 3)).toEqual([]);
  });
});
