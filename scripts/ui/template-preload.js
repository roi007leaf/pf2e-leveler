import { MODULE_ID } from '../constants.js';

let templatePreloadPromise = null;

export async function ensureLevelerTemplatesLoaded() {
  if (templatePreloadPromise) return templatePreloadPromise;

  const partials = {
    featSlot: `modules/${MODULE_ID}/templates/partials/feat-slot.hbs`,
    boostSelector: `modules/${MODULE_ID}/templates/partials/boost-selector.hbs`,
    skillSelector: `modules/${MODULE_ID}/templates/partials/skill-selector.hbs`,
    prerequisiteTag: `modules/${MODULE_ID}/templates/partials/prerequisite-tag.hbs`,
    levelSidebarItem: `modules/${MODULE_ID}/templates/partials/level-sidebar-item.hbs`,
    levelDetail: `modules/${MODULE_ID}/templates/partials/level-detail.hbs`,
    alchemistPanel: `modules/${MODULE_ID}/templates/partials/alchemist-panel.hbs`,
    animistPanel: `modules/${MODULE_ID}/templates/partials/animist-panel.hbs`,
  };

  templatePreloadPromise = foundry.applications.handlebars.loadTemplates(partials);
  return templatePreloadPromise;
}

export function resetLevelerTemplatePreloadForTests() {
  templatePreloadPromise = null;
}
