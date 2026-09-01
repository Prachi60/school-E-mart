const Notification = require('../../database/models/Notification');
const logger = require('../../common/logger');
const fcmService = require('./fcm.service');
const tokenService = require('./token.service');

const notificationService = {
  async createInAppRecord({ userId, title, body, type, channel = 'push', actionUrl, payload, campaignId }) {
    try {
      const [record] = await Notification.create([
        {
          userId,
          title,
          body,
          type,
          channel,
          actionUrl,
          payload,
          campaignId,
          status: 'pending',
          isRead: false,
        },
      ]);
      return record.toObject();
    } catch (err) {
      logger.error('createInAppRecord error', { message: err.message, stack: err.stack });
      throw err;
    }
  },

  async sendToUser(userId, { notification, data, type = 'system', channel = 'push', persist = true, campaignId }) {
    const title = notification?.title || data?.title || 'Notification';
    const body = notification?.body || data?.body || '';
    const actionUrl = data?.route || null;
    const resolvedCampaignId = campaignId || data?.campaignId || null;

    let record = null;
    if (persist) {
      record = await this.createInAppRecord({
        userId,
        title,
        body,
        type,
        channel,
        actionUrl,
        payload: { notification, data },
        campaignId: resolvedCampaignId,
      });
    }

    const tokens = await tokenService.getActiveTokensForUser(userId);
    if (!tokens.length) {
      if (record) {
        await Notification.findByIdAndUpdate(record._id, { $set: { status: 'sent', sentAt: new Date() } });
      }
      return { sent: false, reason: 'no_tokens', record };
    }

    try {
      const result = await fcmService.sendToTokens(tokens, { notification: { title, body, image: notification?.image }, data });
      if (record) {
        await Notification.findByIdAndUpdate(record._id, {
          $set: {
            status: result.successCount > 0 ? 'sent' : 'failed',
            sentAt: new Date(),
          },
        });
      }
      return { sent: result.successCount > 0, result, record };
    } catch (error) {
      logger.error('FCM send to user failed', { userId: String(userId), message: error.message });
      if (record) {
        await Notification.findByIdAndUpdate(record._id, { $set: { status: 'failed' } });
      }
      return { sent: false, error: error.message, record };
    }
  },

  async sendToUsers(userIds, payload) {
    const uniqueUserIds = [...new Set((userIds || []).map(String))];
    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => this.sendToUser(userId, payload))
    );
    return results;
  },

  async sendToTopic(topic, payload) {
    return fcmService.sendToTopic(topic, payload);
  },

  async listForUser(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const filter = { userId };
    if (unreadOnly) filter.isRead = false;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async markAsRead(userId, notificationId) {
    const updated = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    ).lean();
    return updated;
  },

  async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return { modifiedCount: result.modifiedCount };
  },

  async getUnreadCount(userId) {
    return Notification.countDocuments({ userId, isRead: false });
  },

  async remove(userId, notificationId) {
    const deleted = await Notification.findOneAndDelete({ _id: notificationId, userId }).lean();
    return deleted;
  },
};

module.exports = notificationService;
