import { BaseClassHandler } from './base.js';

export class KineticistHandler extends BaseClassHandler {
  getExtraSteps() {
    return [
      {
        id: 'kineticGate',
        label: 'Kinetic Gate',
        visible: (data) => !!data.subclass,
      },
    ];
  }

  isStepComplete(stepId, data) {
    if (stepId !== 'kineticGate') return null;
    if (!data.subclass) return false;
    if (!data.kineticGateMode) return false;

    const impulses = data.kineticImpulses ?? [];
    if (data.kineticGateMode === 'single-gate') {
      return impulses.length === 2;
    }

    if (data.kineticGateMode === 'dual-gate') {
      if (!data.secondElement) return false;
      if (impulses.length !== 2) return false;
      const firstElement = data.subclass.slug?.replace(/-gate$/, '');
      const secondElement = data.secondElement.slug?.replace(/-gate$/, '');
      const elements = new Set(impulses.map((entry) => entry.element));
      return elements.has(firstElement) && elements.has(secondElement);
    }

    return false;
  }

  async getStepContext(stepId, data, wizard) {
    if (stepId !== 'kineticGate') return null;

    const elementOptions = (await wizard._loadSubclasses()).filter((item) => item.uuid !== data.subclass?.uuid);
    const impulseOptions = await wizard._loadKineticImpulses(data);
    const selectedImpulseUuids = new Set((data.kineticImpulses ?? []).map((entry) => entry.uuid));

    return {
      gateModes: [
        { value: 'single-gate', label: 'Single Gate', selected: data.kineticGateMode === 'single-gate' },
        { value: 'dual-gate', label: 'Dual Gate', selected: data.kineticGateMode === 'dual-gate' },
      ],
      secondElementOptions: elementOptions,
      impulseOptions: impulseOptions.map((entry) => ({
        ...entry,
        selected: selectedImpulseUuids.has(entry.uuid),
      })),
      selectedImpulses: data.kineticImpulses ?? [],
      selectedImpulseCount: (data.kineticImpulses ?? []).length,
      maxImpulses: 2,
      impulsesFull: (data.kineticImpulses ?? []).length >= 2,
      requiresSecondElement: data.kineticGateMode === 'dual-gate',
    };
  }
}
