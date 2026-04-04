import { BaseClassHandler } from './base.js';

export class ExemplarHandler extends BaseClassHandler {
  getExtraSteps() {
    return [
      { id: 'ikons', label: 'Ikons', visible: () => true },
    ];
  }

  isStepComplete(stepId, data) {
    if (stepId === 'ikons') return (data.ikons?.length ?? 0) === 3;
    return null;
  }

  async getStepContext(stepId, data, wizard) {
    if (stepId !== 'ikons') return null;

    const ikons = await wizard._loadExemplarIkons();
    const selectedUuids = new Set((data.ikons ?? []).map((entry) => entry.uuid));

    return {
      ikons: ikons.map((entry) => ({
        ...entry,
        selected: selectedUuids.has(entry.uuid),
      })),
      selectedIkons: data.ikons ?? [],
      selectedIkonsCount: (data.ikons ?? []).length,
      maxIkons: 3,
    };
  }
}
