import { getChoicesForLevel } from '../../classes/progression.js';
import { getLevelData } from '../../plan/plan-model.js';

const MANUAL_SPELL_FEATS = new Set([
  'advanced-qi-spells',
  'master-qi-spells',
  'grandmaster-qi-spells',
  'advanced-warden',
  'masterful-warden',
]);

export async function buildLevelContext(planner, classDef, options) {
  if (!planner.plan || !classDef) return {};

  const level = planner.selectedLevel;
  const levelData = getLevelData(planner.plan, level) ?? {};
  const choices = getChoicesForLevel(classDef, level, options);
  const choiceTypes = new Set(choices.map((choice) => choice.type));

  return {
    classFeatures: getClassFeaturesForLevel(planner, level),
    showBoosts: choiceTypes.has('abilityBoosts'),
    boostCount: choices.find((choice) => choice.type === 'abilityBoosts')?.count ?? 4,
    attributes: planner._buildAttributeContext(levelData, choices),
    intelligenceBenefit: planner._buildIntelligenceBenefitContext(level),
    intBonusSkillOptions: planner._buildIntBonusSkillContext(levelData, level),
    intBonusLanguageOptions: planner._buildIntBonusLanguageContext(levelData, level),
    intBonusSkillCount: levelData.intBonusSkills?.length ?? 0,
    intBonusLanguageCount: levelData.intBonusLanguages?.length ?? 0,
    showClassFeat: choiceTypes.has('classFeat'),
    classFeat: annotateFeat(extractFeat(levelData.classFeats)),
    showSkillFeat: choiceTypes.has('skillFeat'),
    skillFeat: annotateFeat(extractFeat(levelData.skillFeats)),
    showGeneralFeat: choiceTypes.has('generalFeat'),
    generalFeat: annotateFeat(extractFeat(levelData.generalFeats)),
    showAncestryFeat: choiceTypes.has('ancestryFeat'),
    ancestryFeat: annotateFeat(extractFeat(levelData.ancestryFeats)),
    showSkillIncrease: choiceTypes.has('skillIncrease'),
    availableSkills: planner._buildSkillContext(levelData, level),
    showArchetypeFeat: choiceTypes.has('archetypeFeat'),
    archetypeFeat: extractFeat(levelData.archetypeFeats),
    showMythicFeat: choiceTypes.has('mythicFeat'),
    mythicFeat: extractFeat(levelData.mythicFeats),
    showDualClassFeat: choiceTypes.has('dualClassFeat'),
    dualClassFeat: extractFeat(levelData.dualClassFeats),
    ...buildABPContext(level, options),
    ...(await planner._buildSpellContext(classDef, level)),
  };
}

export function buildABPContext(level, options) {
  if (!options.abp) return { showABP: false };

  const ABP_NEW_POTENCY = [3, 6, 9, 13, 15, 17, 20];
  const ABP_UPGRADE_TO_2 = [9, 13, 15, 17, 20];
  const ABP_UPGRADE_TO_3 = [17, 20];

  const hasNew = ABP_NEW_POTENCY.includes(level);
  const hasUpgrade2 = ABP_UPGRADE_TO_2.includes(level);
  const hasUpgrade3 = ABP_UPGRADE_TO_3.includes(level);

  if (!hasNew && !hasUpgrade2 && !hasUpgrade3) return { showABP: false };

  return {
    showABP: true,
    abpHasNew: hasNew,
    abpHasUpgrade2: hasUpgrade2,
    abpHasUpgrade3: hasUpgrade3,
  };
}

export function getClassFeaturesForLevel(planner, level) {
  const classItem = planner.actor.class;
  if (!classItem?.system?.items) return [];

  return Object.values(classItem.system.items)
    .filter((feature) => feature.level === level)
    .map((feature) => ({ name: feature.name, uuid: feature.uuid, img: feature.img }));
}

export function annotateFeat(feat) {
  if (!feat) return null;
  if (MANUAL_SPELL_FEATS.has(feat.slug)) {
    feat.manualSpellNote = true;
  }
  return feat;
}

export function extractFeat(feats) {
  if (!feats || feats.length === 0) return null;
  return feats[0];
}
