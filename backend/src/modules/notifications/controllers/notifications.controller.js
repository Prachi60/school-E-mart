const asyncHandler = require('../../../utils/asyncHandler');
const { success, created, paginated } = require('../../../common/response');
const { NotFoundError } = require('../../../common/errors');
const { tokenService, notificationService } = require('../../../services/notification');

const notificationsController = {
  registerToken: asyncHandler(async (req, res) => {
    const record = await tokenService.registerToken({
      userId: req.auth.userId,
      token: req.body.token,
      platform: req.body.platform,
      userAgent: req.headers['user-agent'],
    });
    return created(res, { token: record }, 'FCM token registered', req);
  }),

  unregisterToken: asyncHandler(async (req, res) => {
    await tokenService.unregisterToken({
      userId: req.auth.userId,
      token: req.body.token,
    });
    return success(res, null, 'FCM token removed', undefined, req);
  }),

  listNotifications: asyncHandler(async (req, res) => {
    const result = await notificationService.listForUser(req.auth.userId, req.query);
    return paginated(res, result.items, result.pagination, 'Notifications fetched', req);
  }),

  getUnreadCount: asyncHandler(async (req, res) => {
    const count = await notificationService.getUnreadCount(req.auth.userId);
    return success(res, { count }, 'Unread count fetched', undefined, req);
  }),

  markAsRead: asyncHandler(async (req, res) => {
    const notification = await notificationService.markAsRead(
      req.auth.userId,
      req.params.notificationId
    );
    if (!notification) throw new NotFoundError('Notification not found', 'NOTIFICATION_NOT_FOUND');
    return success(res, { notification }, 'Notification marked as read', undefined, req);
  }),

  markAllAsRead: asyncHandler(async (req, res) => {
    const result = await notificationService.markAllAsRead(req.auth.userId);
    return success(res, result, 'All notifications marked as read', undefined, req);
  }),

  remove: asyncHandler(async (req, res) => {
    const deleted = await notificationService.remove(req.auth.userId, req.params.notificationId);
    if (!deleted) throw new NotFoundError('Notification not found', 'NOTIFICATION_NOT_FOUND');
    return success(res, null, 'Notification deleted', undefined, req);
  }),

  triggerBirthdays: asyncHandler(async (req, res) => {
    const { triggerService } = require('../../../services/notification');
    const targetDate = req.body?.date ? new Date(req.body.date) : new Date();
    await triggerService.checkAndNotifyStudentBirthdays(targetDate);
    return success(res, { triggeredAt: targetDate }, 'Birthday notifications processed', undefined, req);
  }),
};

module.exports = notificationsController;
