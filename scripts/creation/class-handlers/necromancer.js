import { getGrantedFeatChoiceValues } from '../creation-model.js';
import { CasterBaseHandler } from './caster-base.js';

const SPELL_PACK = 'Compendium.pf2e.spells-srd.Item';
const CLASS_FEATURE_PACK = 'Compendium.pf2e.classfeatures.Item';
const HARM_UUID = `${SPELL_PACK}.wdA52JJnsuQWeyqz`;
const CREATE_THRALL_UUID = `${SPELL_PACK}.1JaRoJvlf8EPvnnD`;
const THRALL_CHARGE_UUID = `${SPELL_PACK}.NWDTNTpfPEc821pu`;
const NECROTIC_BOMB_UUID = `${SPELL_PACK}.cg1l2AxBenLU6JFE`;

export const NECROMANCER_GRIM_FASCINATION_UUID = `${CLASS_FEATURE_PACK}.PGUiN4995rreH3aU`;

const GRAVE_SPELL_BY_FASCINATION = {
  blood: `${SPELL_PACK}.tFWa3ouvMC5Zz3P0`,
  gyn8ozz3txxiaklf: `${SPELL_PACK}.tFWa3ouvMC5Zz3P0`,
  bone: `${SPELL_PACK}.4JXxqBXigKECcpTm`,
  '4y2bt7bvuoeptaqs': `${SPELL_PACK}.4JXxqBXigKECcpTm`,
  flesh: `${SPELL_PACK}.4kQMFyRKj5Gv13zl`,
  njlkij2uy2nxvmb9: `${SPELL_PACK}.4kQMFyRKj5Gv13zl`,
  spirit: `${SPELL_PACK}.fgmxDC2PH2TEYGKG`,
  qle7hjereqk0nbyc: `${SPELL_PACK}.fgmxDC2PH2TEYGKG`,
};

export class NecromancerHandler extends CasterBaseHandler {
  getSpellbookCounts() {
    return { cantrips: 8, rank1: 5 };
  }

  getFocusPoolMinimum() {
    return 2;
  }

  async resolveGrantedSpells() {
    const harm = await resolveSpell(HARM_UUID, 'Necromancer Spellcasting');
    return {
      cantrips: [],
      rank1s: harm ? [harm] : [],
    };
  }

  async resolveFocusSpells(data) {
    const spellUuids = [CREATE_THRALL_UUID, THRALL_CHARGE_UUID, NECROTIC_BOMB_UUID];
    const selectedFascination = getGrantedFeatChoiceValues(
      data,
      NECROMANCER_GRIM_FASCINATION_UUID,
    ).grimFascination;
    const selectedKey = String(selectedFascination ?? '')
      .split('.')
      .at(-1)
      .trim()
      .toLowerCase();
    const graveSpellUuid = GRAVE_SPELL_BY_FASCINATION[selectedKey];
    if (graveSpellUuid) spellUuids.push(graveSpellUuid);

    const resolved = await Promise.all(
      spellUuids.map((uuid) => resolveSpell(uuid, 'Grave Spells')),
    );
    return resolved.filter(Boolean);
  }
}

async function resolveSpell(uuid, source) {
  const spell = await fromUuid(uuid).catch(() => null);
  if (!spell) return null;
  return {
    uuid: spell.uuid ?? uuid,
    name: spell.name,
    img: spell.img,
    source,
  };
}
