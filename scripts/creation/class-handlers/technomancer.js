import { CasterBaseHandler } from './caster-base.js';

// Spell database: 10 cantrips + five 1st-rank spells, plus the programming language's 1st-rank spell.
export class TechnomancerHandler extends CasterBaseHandler {
  getSpellbookCounts() {
    return { cantrips: 10, rank1: 6 };
  }
}
