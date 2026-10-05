import { CasterBaseHandler } from './caster-base.js';

export class RangerHandler extends CasterBaseHandler {
  needsSpellSelection() { return false; }

  needsNonCasterSpellStep() { return false; }

  getFocusSpellcastingConfig(data) {
    return {
      tradition: data.subclass?.slug === 'vindicator' ? 'divine' : 'primal',
      ability: 'wis',
    };
  }

  async applyExtras(actor, data) {
    await this._applyFocusSpells(actor, data);
  }
}
