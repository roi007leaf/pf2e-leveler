import { BaseClassHandler } from './base.js';

export class ThaumaturgeHandler extends BaseClassHandler {
  getExtraSteps() {
    return [
      { id: 'implement', label: 'Implement', visible: () => true },
    ];
  }

  isStepComplete(stepId, data) {
    if (stepId === 'implement') return !!data.implement;
    return null;
  }

  async getStepContext(stepId, data, wizard) {
    if (stepId !== 'implement') return null;

    const items = await wizard._loadThaumaturgeImplements(data.class);
    return { items: items.filter((item) => item.uuid !== data.implement?.uuid) };
  }
}
