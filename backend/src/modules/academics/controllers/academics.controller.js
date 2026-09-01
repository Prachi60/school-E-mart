const asyncHandler = require('../../../utils/asyncHandler');
const { success, created, paginated } = require('../../../common/response');
const { ROLES } = require('../../../constants/roles');
const eventsService = require('../services/events.service');
const phonebookService = require('../services/phonebook.service');
const kitsService = require('../services/kits.service');

// Only the roles that can actually manage kits get to see drafts. Everyone else
// (parents, teachers, vendors) must only ever be served published kits — a
// client-supplied `status` query param must not be able to override that, and
// neither should knowing/guessing a kit's id.
//
// The admin's kit sale window is a narrower rule: it governs what a parent may
// still BUY, so it applies to parents only. A teacher or a vendor reading a kit
// for reference shouldn't watch it disappear. `viewerUserId` rides along
// because a kit the parent already bought stays visible past its deadline.
const KIT_MANAGE_ROLES = [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN];
const kitViewOptions = (req) => ({
  requireActive: !KIT_MANAGE_ROLES.includes(req.auth?.role),
  applyPurchaseWindow: req.auth?.role === ROLES.PARENT,
  viewerUserId: req.auth?.userId || null,
});

const academicsController = {
  // Events
  createEvent: asyncHandler(async (req, res) => {
    const event = await eventsService.createEvent(req.params.schoolId, req.body);
    return created(res, { event }, 'Event created', req);
  }),

  listEvents: asyncHandler(async (req, res) => {
    const { data, pagination } = await eventsService.listEvents(req.params.schoolId, req.query);
    return paginated(res, { events: data }, pagination, 'Events fetched', req);
  }),

  getEvent: asyncHandler(async (req, res) => {
    const event = await eventsService.getEvent(req.params.schoolId, req.params.eventId);
    return success(res, { event }, 'Event fetched', undefined, req);
  }),

  updateEvent: asyncHandler(async (req, res) => {
    const event = await eventsService.updateEvent(req.params.schoolId, req.params.eventId, req.body);
    return success(res, { event }, 'Event updated', undefined, req);
  }),

  deleteEvent: asyncHandler(async (req, res) => {
    await eventsService.deleteEvent(req.params.schoolId, req.params.eventId, req.auth.userId);
    return success(res, null, 'Event deleted', undefined, req);
  }),

  // Phonebook
  listPhonebook: asyncHandler(async (req, res) => {
    const entries = await phonebookService.listEntries(req.params.schoolId, req.query);
    return success(res, { entries }, 'Phonebook fetched', undefined, req);
  }),

  // Parent-facing: relevant teachers (by child's class/section) + emergency numbers
  getPhonebookContacts: asyncHandler(async (req, res) => {
    const contacts = await phonebookService.getParentContacts(req.params.schoolId, {
      studentId: req.query.studentId,
    });
    return success(res, contacts, 'Phonebook contacts fetched', undefined, req);
  }),

  createPhonebookEntry: asyncHandler(async (req, res) => {
    const entry = await phonebookService.createEntry(req.params.schoolId, req.body);
    return created(res, { entry }, 'Phonebook entry created', req);
  }),

  updatePhonebookEntry: asyncHandler(async (req, res) => {
    const entry = await phonebookService.updateEntry(req.params.schoolId, req.params.entryId, req.body);
    return success(res, { entry }, 'Phonebook entry updated', undefined, req);
  }),

  deletePhonebookEntry: asyncHandler(async (req, res) => {
    await phonebookService.deleteEntry(req.params.schoolId, req.params.entryId, req.auth.userId);
    return success(res, null, 'Phonebook entry deleted', undefined, req);
  }),

  // Kits
  listKitCategories: asyncHandler(async (req, res) => {
    const categories = await kitsService.listCategories(req.params.schoolId);
    return success(res, categories, 'Kit categories fetched', undefined, req);
  }),

  createKitCategory: asyncHandler(async (req, res) => {
    const category = await kitsService.createCategory(req.params.schoolId, req.body.name);
    return created(res, { category }, 'Kit category created', req);
  }),

  deleteKitCategory: asyncHandler(async (req, res) => {
    await kitsService.deleteCategory(req.params.schoolId, req.params.categoryId);
    return success(res, null, 'Kit category deleted', undefined, req);
  }),

  createKit: asyncHandler(async (req, res) => {
    const kit = await kitsService.createKit(req.params.schoolId, req.body);
    return created(res, { kit }, 'Kit created', req);
  }),

  listKits: asyncHandler(async (req, res) => {
    const { data, pagination } = await kitsService.listKits(req.params.schoolId, req.query, kitViewOptions(req));
    return paginated(res, { kits: data }, pagination, 'Kits fetched', req);
  }),

  getKit: asyncHandler(async (req, res) => {
    const kit = await kitsService.getKit(req.params.schoolId, req.params.kitId, kitViewOptions(req));
    return success(res, { kit }, 'Kit fetched', undefined, req);
  }),

  updateKit: asyncHandler(async (req, res) => {
    const kit = await kitsService.updateKit(req.params.schoolId, req.params.kitId, req.body);
    return success(res, { kit }, 'Kit updated', undefined, req);
  }),

  deleteKit: asyncHandler(async (req, res) => {
    await kitsService.deleteKit(req.params.schoolId, req.params.kitId, req.auth.userId);
    return success(res, null, 'Kit deleted', undefined, req);
  }),

  getKitPurchases: asyncHandler(async (req, res) => {
    const report = await kitsService.getKitPurchaseReport(req.params.schoolId, req.params.kitId);
    return success(res, report, 'Kit purchase report fetched', undefined, req);
  }),

  // Parent-facing: "which of this school's kits have I already bought" —
  // powers the procurement-readiness progress bar on Home/My School/kit detail.
  getPurchasedKitIds: asyncHandler(async (req, res) => {
    const purchasedKitIds = await kitsService.listPurchasedKitIds(req.auth.userId, req.params.schoolId);
    return success(res, { purchasedKitIds }, 'Purchased kits fetched', undefined, req);
  }),
};

module.exports = academicsController;
