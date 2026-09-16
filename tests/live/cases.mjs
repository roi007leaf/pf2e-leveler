export const smokeCases = [
  {
    name: 'environment-module-ready',
    area: 'engine',
    steps: [
      { session: 'gm', operation: 'environment', expect: { moduleActive: true, userIsGM: true } },
      {
        session: 'player',
        operation: 'environment',
        expect: { moduleActive: true, userIsGM: false },
      },
    ],
  },
  {
    name: 'fixture-actor-ownership',
    area: 'engine',
    fixture: true,
    steps: [
      { session: 'gm', operation: 'actor', expect: { actorType: 'character', ownedByRun: true } },
      { session: 'player', operation: 'actor', expect: { actorType: 'character', isOwner: true } },
    ],
  },
  {
    name: 'creation-entrypoint-rendered',
    area: 'engine',
    fixture: true,
    steps: [
      { session: 'gm', operation: 'creationButton', expect: { visible: true } },
      { session: 'player', operation: 'creationButton', expect: { visible: true } },
    ],
  },
];

export const creationCases = [
  {
    name: 'creation-ancestry-heritage',
    area: 'creation',
    fixture: true,
    steps: [
      {
        session: 'gm',
        operation: 'wizardCoreAudit',
        expect: { ancestrySelected: true, heritageSelected: true, everyCatalogNonempty: true },
      },
    ],
  },
  {
    name: 'creation-background-class',
    area: 'creation',
    fixture: true,
    steps: [
      {
        session: 'gm',
        operation: 'wizardCoreAudit',
        expect: { backgroundSelected: true, classSelected: true, everyCatalogNonempty: true },
      },
    ],
  },
  {
    name: 'creation-active-class-catalog',
    area: 'creation',
    fixture: true,
    steps: [
      {
        session: 'gm',
        operation: 'wizardClassCatalogAudit',
        expect: {
          catalogNonempty: true,
          allClassesSelected: true,
          uniqueClassSlugs: true,
          everyClassHasCoreSteps: true,
        },
      },
    ],
  },
  {
    name: 'creation-ancestry-heritage-catalog',
    area: 'creation',
    fixture: true,
    steps: [
      {
        session: 'gm',
        operation: 'wizardAncestryHeritageCatalogAudit',
        expect: {
          catalogNonempty: true,
          allAncestriesSelected: true,
          everyAncestryHasHeritage: true,
          allHeritageRelationshipsSelected: true,
        },
      },
    ],
  },
  {
    name: 'creation-background-catalog',
    area: 'creation',
    fixture: true,
    steps: [
      {
        session: 'gm',
        operation: 'wizardBackgroundCatalogAudit',
        expect: { catalogNonempty: true, allBackgroundsSelected: true },
      },
    ],
  },
  {
    name: 'creation-class-subclass-catalog',
    area: 'creation',
    fixture: true,
    steps: [
      {
        session: 'gm',
        operation: 'wizardClassSubclassCatalogAudit',
        expect: {
          catalogNonempty: true,
          allClassesSelected: true,
          everyTaggedClassHasSubclass: true,
          allSubclassesSelected: true,
          allSubclassChoicesSelected: true,
        },
      },
    ],
  },
  {
    name: 'creation-edit-existing',
    area: 'creation',
    fixture: true,
    steps: [{ session: 'gm', operation: 'wizardPersistenceAudit', expect: { persisted: true } }],
  },
  {
    name: 'creation-pending-choices',
    area: 'creation',
    fixture: true,
    steps: [
      {
        session: 'gm',
        operation: 'wizardPendingChoiceAudit',
        expect: { conditionalChoiceDetected: true, incompleteBeforeChoice: true },
      },
    ],
  },
  {
    name: 'creation-fighter-skill-choice-placement',
    area: 'creation',
    profiles: ['foundry14-pf2e', 'foundry14-pf2e-sf2e-anachronism'],
    fixture: true,
    steps: [
      {
        session: 'gm',
        operation: 'wizardFighterSkillChoiceAudit',
        expect: {
          shownInSkills: true,
          absentFromFeatChoices: true,
          selectedWithoutRedundantSourceLabel: true,
        },
      },
    ],
  },
  {
    name: 'creation-equipment-budget-remainder',
    area: 'creation',
    profiles: ['foundry14-pf2e', 'foundry14-pf2e-sf2e-anachronism'],
    fixture: true,
    steps: [
      {
        session: 'gm',
        operation: 'creationEquipmentBudgetRemainderAudit',
        expect: { equipmentCreated: true, exactRemainderAdded: true },
      },
    ],
  },
];

export const plannerCases = [
  {
    name: 'planner-active-class-catalog',
    area: 'planner',
    fixture: true,
    steps: [
      {
        session: 'gm',
        operation: 'plannerClassCatalogAudit',
        expect: {
          catalogNonempty: true,
          allClassesOpened: true,
          everyClassHasAllLevels: true,
          everyClassHasClassifiedLevels: true,
          everyClassRenderedCheckpoints: true,
        },
      },
    ],
  },
  {
    name: 'planner-levels-2-through-20',
    area: 'planner',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'plannerLevelsAudit',
        expect: { allLevelsRepresented: true, level20Visited: true, levelCount: 19 },
      },
    ],
  },
  {
    name: 'planner-validation',
    area: 'planner',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'plannerValidationAudit',
        expect: { everyLevelClassified: true, hasIncompleteLevel: true },
      },
    ],
  },
  {
    name: 'planner-import-export',
    area: 'planner',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'plannerImportExportAudit',
        expect: { exported: true, imported: true },
      },
    ],
  },
  {
    name: 'planner-clear-level',
    area: 'planner',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'plannerClearLevelAudit',
        expect: { populated: true, cleared: true },
      },
    ],
  },
  {
    name: 'planner-custom-choices',
    area: 'planner',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'plannerCustomChoicesAudit',
        expect: { opened: true, controlsVisible: true },
      },
    ],
  },
];

export const applyCases = [
  {
    name: 'apply-single-level',
    area: 'apply',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'applySingleLevelAudit',
        expect: { applied: true, messageCount: 1, levelUpdated: true },
      },
    ],
  },
  {
    name: 'apply-multiple-levels',
    area: 'apply',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'applyMultipleLevelsAudit',
        expect: { applied: true, messageCount: 3 },
      },
    ],
  },
  {
    name: 'apply-cancel',
    area: 'apply',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'applyCancelAudit',
        expect: { cancelled: true, unchanged: true },
      },
    ],
  },
  {
    name: 'apply-chat-summary',
    area: 'apply',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'applyChatSummaryAudit',
        expect: { actorNamed: true, levelNamed: true, whispered: true },
      },
    ],
  },
  {
    name: 'apply-failure-atomicity',
    area: 'apply',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'applyFailureAtomicityAudit',
        expectedBrowserError: 'Injected live-test chat failure',
        expect: { failed: true, actorUnchanged: true, noMessage: true },
      },
    ],
  },
];

export const issueRegressionCases = [
  {
    name: 'issue-104-repertoire-spell-swap',
    area: 'issues',
    profiles: ['foundry14-pf2e', 'foundry14-pf2e-sf2e-anachronism'],
    steps: [
      {
        session: 'gm',
        operation: 'issue104RepertoireSwapAudit',
        expect: { sameRank: true, sameEntry: true, originalRemoved: true, replacementCreated: true },
      },
    ],
  },
  {
    name: 'issue-105-undead-advanced-bloodline',
    area: 'issues',
    profiles: ['foundry14-pf2e', 'foundry14-pf2e-sf2e-anachronism'],
    steps: [
      {
        session: 'gm',
        operation: 'issue105UndeadAdvancedBloodlineAudit',
        expect: { drainLifeApplied: true, greaterSpellAbsent: true },
      },
    ],
  },
  {
    name: 'issue-106-gradual-intelligence-partial',
    area: 'issues',
    profiles: ['foundry14-pf2e', 'foundry14-pf2e-sf2e-anachronism'],
    steps: [
      {
        session: 'gm',
        operation: 'issue106GradualIntelligenceAudit',
        expect: { noSkillPrompt: true, noLanguagePrompt: true },
      },
    ],
  },
];

export const variantCases = [
  {
    name: 'variant-free-archetype',
    area: 'variants',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'variantFreeArchetypeAudit',
        expect: { enabled: true, level2SlotVisible: true },
      },
    ],
  },
  {
    name: 'variant-ancestral-paragon',
    area: 'variants',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'variantAncestralParagonAudit',
        expect: { enabled: true, level3SlotVisible: true },
      },
    ],
  },
  {
    name: 'variant-mythic',
    area: 'variants',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'variantMythicAudit',
        expect: { enabled: true, level2SlotVisible: true },
      },
    ],
  },
  {
    name: 'variant-abp',
    area: 'variants',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'variantAbpAudit',
        expect: { enabled: true, level3SectionVisible: true },
      },
    ],
  },
  {
    name: 'variant-gradual-boosts',
    area: 'variants',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'variantGradualBoostsAudit',
        expect: { enabled: true, level2BoostVisible: true, boostCount: 1 },
      },
    ],
  },
  {
    name: 'variant-dual-class',
    area: 'variants',
    fixture: 'planner',
    steps: [
      {
        session: 'gm',
        operation: 'variantDualClassAudit',
        expect: { enabled: true, secondarySelected: true, level2SlotVisible: true },
      },
    ],
  },
];

export const spellPreparationCases = [
  {
    name: 'spellbook-entrypoint',
    area: 'spell-preparation',
    fixture: 'spellbook',
    steps: [
      {
        session: 'gm',
        operation: 'spellbookEntrypointAudit',
        expect: {
          preparationRendered: true,
          levelerButtonVisible: true,
          pickerOpened: true,
          exactRank: true,
          multiSelect: true,
        },
      },
    ],
  },
  {
    name: 'spellbook-filtering',
    area: 'spell-preparation',
    fixture: 'spellbook',
    steps: [
      {
        session: 'gm',
        operation: 'spellbookFilteringAudit',
        expect: {
          catalogNonempty: true,
          exactRankOnly: true,
          traditionCompatible: true,
          lockedFiltersVisible: true,
          searchNarrows: true,
        },
      },
    ],
  },
  {
    name: 'spellbook-duplicate-prevention',
    area: 'spell-preparation',
    fixture: 'spellbook',
    steps: [
      {
        session: 'gm',
        operation: 'spellbookDuplicatePreventionAudit',
        expect: {
          spellAdded: true,
          takenVisible: true,
          takenDisabled: true,
          duplicateBlocked: true,
        },
      },
    ],
  },
];

export const fullCases = [
  ...smokeCases,
  ...creationCases,
  ...plannerCases,
  ...applyCases,
  ...variantCases,
  ...spellPreparationCases,
  ...issueRegressionCases,
];
