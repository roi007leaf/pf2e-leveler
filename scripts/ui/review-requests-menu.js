import { MODULE_ID } from '../constants.js';
import { getReviewRequests, setReviewRequestStatus, REVIEW_REQUEST_STATUS } from '../access/review-requests.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ReviewRequestsMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-review-requests`,
    classes: ['pf2e-leveler', 'pf2e-leveler-compendium-app'],
    position: { width: 720, height: 640 },
    window: { resizable: true },
  };

  static PARTS = {
    panel: {
      template: `modules/${MODULE_ID}/templates/review-requests-menu.hbs`,
    },
  };

  get title() {
    return game.i18n.localize('PF2E_LEVELER.REVIEW_REQUEST.PANEL_TITLE');
  }

  async _prepareContext() {
    const raw = getReviewRequests();

    const requests = raw
      .map((req) => ({
        id: req.id,
        status: req.status,
        itemUuid: req.itemUuid,
        itemName: req.itemName,
        actorName: req.actorName,
        requesterName: req.requesterName,
        note: req.note,
        isPending: req.status === REVIEW_REQUEST_STATUS.PENDING,
        isResolved: req.status === REVIEW_REQUEST_STATUS.RESOLVED,
        isDismissed: req.status === REVIEW_REQUEST_STATUS.DISMISSED,
        dateLabel: req.ts ? new Date(req.ts).toLocaleString() : '',
      }))
      .sort((a, b) => {
        if (a.isPending && !b.isPending) return -1;
        if (!a.isPending && b.isPending) return 1;
        const tsA = raw.find((r) => r.id === a.id)?.ts ?? 0;
        const tsB = raw.find((r) => r.id === b.id)?.ts ?? 0;
        return tsB - tsA;
      });

    return {
      requests,
      hasRequests: requests.length > 0,
      emptyLabel: game.i18n.localize('PF2E_LEVELER.REVIEW_REQUEST.EMPTY'),
      intro: game.i18n.localize('PF2E_LEVELER.REVIEW_REQUEST.INTRO'),
    };
  }

  _onRender() {
    const root = this.element;
    if (!root) return;

    root.querySelectorAll('[data-action="resolve-request"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await setReviewRequestStatus(btn.dataset.id, REVIEW_REQUEST_STATUS.RESOLVED);
        this.render(false);
      });
    });

    root.querySelectorAll('[data-action="dismiss-request"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await setReviewRequestStatus(btn.dataset.id, REVIEW_REQUEST_STATUS.DISMISSED);
        this.render(false);
      });
    });

    root.querySelectorAll('[data-action="reopen-request"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await setReviewRequestStatus(btn.dataset.id, REVIEW_REQUEST_STATUS.PENDING);
        this.render(false);
      });
    });

    root.querySelectorAll('[data-action="open-item"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = await fromUuid(btn.dataset.uuid).catch(() => null);
        item?.sheet?.render(true);
      });
    });
  }
}

export function openReviewRequestsMenu() {
  return new ReviewRequestsMenu().render(true);
}
