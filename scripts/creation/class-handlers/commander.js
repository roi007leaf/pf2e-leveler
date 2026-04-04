import { BaseClassHandler } from './base.js';

export class CommanderHandler extends BaseClassHandler {
  getExtraSteps() {
    return [
      { id: 'tactics', label: 'Tactics', visible: () => true },
    ];
  }

  isStepComplete(stepId, data) {
    if (stepId === 'tactics') return (data.tactics?.length ?? 0) === 5;
    return null;
  }

  async getStepContext(stepId, data, wizard) {
    if (stepId !== 'tactics') return null;

    const tactics = await wizard._loadCommanderTactics();
    const selectedUuids = new Set((data.tactics ?? []).map((entry) => entry.uuid));

    return {
      tactics: tactics.map((entry) => ({
        ...entry,
        selected: selectedUuids.has(entry.uuid),
      })),
      selectedTactics: data.tactics ?? [],
      selectedTacticsCount: (data.tactics ?? []).length,
      maxTactics: 5,
    };
  }
}
