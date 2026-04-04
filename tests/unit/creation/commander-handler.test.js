import { CommanderHandler } from '../../../scripts/creation/class-handlers/commander.js';

describe('CommanderHandler', () => {
  it('requires five starting tactics', () => {
    const handler = new CommanderHandler();

    expect(handler.isStepComplete('tactics', { tactics: [] })).toBe(false);
    expect(handler.isStepComplete('tactics', {
      tactics: [{ uuid: 'a' }, { uuid: 'b' }, { uuid: 'c' }, { uuid: 'd' }],
    })).toBe(false);
    expect(handler.isStepComplete('tactics', {
      tactics: [{ uuid: 'a' }, { uuid: 'b' }, { uuid: 'c' }, { uuid: 'd' }, { uuid: 'e' }],
    })).toBe(true);
  });

  it('exposes tactic count in the step context', async () => {
    const handler = new CommanderHandler();
    const context = await handler.getStepContext('tactics', {
      tactics: [{ uuid: 'a' }, { uuid: 'b' }],
    }, {
      _loadCommanderTactics: jest.fn(async () => []),
    });

    expect(context.selectedTacticsCount).toBe(2);
    expect(context.maxTactics).toBe(5);
  });
});
