const { BadRequestError } = require('../../../common/errors');
const settingsRepository = require('../repositories/settings.repository');
const { SETTINGS_AUDIT_ENTITY_ID } = require('../repositories/settings.repository');
const auditRepository = require('../../auth/repositories/audit.repository');
const { runAtomic } = require('../../orders/utils/atomic');
const { invalidateKitPurchaseWindowCache } = require('../../academics/utils/kitPurchaseWindow.util');

const VALID_SECTIONS = ['general', 'marketplace', 'orders', 'school', 'security', 'billing', 'contact', 'lms', 'kits'];

const DEFAULT_CONTACT_SETTINGS = {
  phone: '+91 98765 43210',
  email: 'support@schoolemart.com',
  address: '123 Education Hub, Sector 62, Noida, Uttar Pradesh 201301',
  workingHours: 'Mon - Sat: 9:00 AM - 7:00 PM',
  whatsapp: '+91 98765 43210',
  bulkPhone: '+91 99999 88888',
  bulkEmail: 'schools@schoolemart.com',
};

const DEFAULT_LMS_SETTINGS = {
  maxVideoSizeMB: 500,
};

// How long a published kit stays on sale to parents. Off by default, so an
// untouched install behaves exactly as it did before the window existed.
const DEFAULT_KITS_SETTINGS = {
  purchaseWindowEnabled: false,
  purchaseWindowDays: 7,
};

const settingsService = {
  async getAllSettings() {
    const [platform, billing] = await Promise.all([
      settingsRepository.getPlatformSettings(),
      settingsRepository.getBillingConfig(),
    ]);
    return { platform, billing };
  },

  async getSection(section) {
    if (!VALID_SECTIONS.includes(section)) {
      throw new BadRequestError('Invalid settings section', null, 'INVALID_SETTINGS_SECTION');
    }
    if (section === 'billing') {
      return settingsRepository.getBillingConfig();
    }
    const settings = await settingsRepository.getPlatformSettings();
    if (section === 'contact') {
      const contact = settings.contact || {};
      return {
        phone: contact.phone !== undefined ? contact.phone : DEFAULT_CONTACT_SETTINGS.phone,
        email: contact.email !== undefined ? contact.email : DEFAULT_CONTACT_SETTINGS.email,
        address: contact.address !== undefined ? contact.address : DEFAULT_CONTACT_SETTINGS.address,
        workingHours: contact.workingHours !== undefined ? contact.workingHours : DEFAULT_CONTACT_SETTINGS.workingHours,
        whatsapp: contact.whatsapp !== undefined ? contact.whatsapp : DEFAULT_CONTACT_SETTINGS.whatsapp,
        bulkPhone: contact.bulkPhone !== undefined ? contact.bulkPhone : DEFAULT_CONTACT_SETTINGS.bulkPhone,
        bulkEmail: contact.bulkEmail !== undefined ? contact.bulkEmail : DEFAULT_CONTACT_SETTINGS.bulkEmail,
      };
    }
    if (section === 'lms') {
      return { ...DEFAULT_LMS_SETTINGS, ...(settings.lms || {}) };
    }
    if (section === 'kits') {
      return { ...DEFAULT_KITS_SETTINGS, ...(settings.kits || {}) };
    }
    return settings[section] || {};
  },

  async updateSection(section, payload, actor = {}) {
    if (!VALID_SECTIONS.includes(section)) {
      throw new BadRequestError('Invalid settings section', null, 'INVALID_SETTINGS_SECTION');
    }

    return runAtomic(async (session) => {
      let updated;
      if (section === 'billing') {
        updated = await settingsRepository.updateBillingConfig(payload, actor.userId);
      } else {
        updated = await settingsRepository.updatePlatformSettings(section, payload, actor.userId);
      }

      // Kit visibility is read on a short-lived cache in front of this
      // collection; drop it so the admin sees their own change take effect
      // immediately rather than up to a TTL later.
      if (section === 'kits') invalidateKitPurchaseWindowCache();

      await auditRepository.log({
        actorUserId: actor.userId,
        actorRole: actor.role,
        action: 'settings.updated',
        entityType: 'PlatformSettings',
        entityId: SETTINGS_AUDIT_ENTITY_ID,
        after: { section, payload },
      });

      return section === 'billing' ? updated : updated[section];
    });
  },
};

module.exports = settingsService;
