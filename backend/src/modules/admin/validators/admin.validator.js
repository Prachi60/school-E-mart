const { Joi, schemas } = require('../../../common/validation');
const { ALL_ROLES } = require('../../../constants/roles');
const schoolFields = require('../../school/validators/schoolFields');

const objectId = schemas.objectId;

const paginationQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(10000).default(20),
  sort: Joi.string().trim().optional(),
  fields: Joi.string().trim().optional(),
  search: Joi.string().trim().max(120).optional(),
  q: Joi.string().trim().max(120).optional(),
  status: Joi.string().trim().optional(),
  role: Joi.string().valid(...ALL_ROLES).optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  approvalStatus: Joi.string().valid('pending', 'approved', 'suspended').optional(),
  partnerStatus: Joi.string().valid('prospect', 'active', 'suspended').optional(),
  orderStatus: Joi.string().trim().optional(),
  paymentStatus: Joi.string().trim().optional(),
  audience: Joi.string().valid('all', 'parent', 'school', 'vendor').optional(),
  category: Joi.string().trim().optional(),
  position: Joi.string().valid('home_top', 'home_middle', 'category_top', 'cart').optional(),
});

const analyticsQuery = paginationQuery.keys({
  limit: Joi.number().integer().min(1).max(50).default(10),
});

const userIdParam = Joi.object({ userId: objectId.required() });
const vendorIdParam = Joi.object({ vendorId: objectId.required() });
const schoolIdParam = Joi.object({ schoolId: objectId.required() });
const teacherIdParam = Joi.object({ teacherId: objectId.required() });
const pageIdParam = Joi.object({ pageId: objectId.required() });
const faqIdParam = Joi.object({ faqId: objectId.required() });
const bannerIdParam = Joi.object({ bannerId: objectId.required() });
const sectionIdParam = Joi.object({ sectionId: objectId.required() });
const courseIdParam = Joi.object({ courseId: objectId.required() });
const lessonIdParam = courseIdParam.keys({ lessonId: objectId.required() });

const lmsSubjectIdParam = Joi.object({ subjectId: objectId.required() });
const lmsSubjectSchema = Joi.object({
  label: Joi.string().trim().min(1).max(60).required(),
  displayOrder: Joi.number().integer().min(0).optional(),
});

const lmsGradeIdParam = Joi.object({ gradeId: objectId.required() });
const lmsGradeSchema = Joi.object({
  label: Joi.string().trim().min(1).max(60).required(),
  displayOrder: Joi.number().integer().min(0).optional(),
});
const settingsSectionParam = Joi.object({
  section: Joi.string()
    .valid('general', 'marketplace', 'orders', 'school', 'security', 'billing', 'contact', 'lms', 'kits')
    .required(),
});
const landingSlugParam = Joi.object({
  slug: Joi.string().trim().min(1).max(80).required(),
});
const recentQuery = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(10),
});

const actionNoteSchema = Joi.object({
  note: Joi.string().trim().max(500).optional(),
  reason: Joi.string().trim().max(500).optional(),
});

const assignRoleSchema = Joi.object({
  role: schemas.role.required(),
  roleScopes: Joi.array().items(Joi.string().trim()).default([]),
});

const updateRolesSchema = Joi.object({
  roleScopes: Joi.array().items(Joi.string().trim()).required(),
});

const deleteUserSchema = Joi.object({
  reason: Joi.string().trim().max(500).optional(),
});

// General profile edit for any user role from the superadmin panel.
const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).optional(),
  email: schemas.email.optional().allow('', null),
  phone: schemas.indianMobile.optional(),
}).min(1);

const teacherQuery = paginationQuery.keys({
  schoolId: objectId.optional(),
  approvalStatus: Joi.string().valid('pending', 'approved', 'rejected').optional(),
});

const updateTeacherSchema = Joi.object({
  user: Joi.object({
    name: Joi.string().trim().min(1).max(120).optional(),
    email: schemas.email.optional().allow('', null),
    phone: schemas.indianMobile.optional(),
  }).optional(),
  designation: Joi.string().trim().max(120).optional().allow('', null),
  department: Joi.string().trim().max(120).optional().allow('', null),
  qualification: Joi.string().trim().max(200).optional().allow('', null),
  experienceYears: Joi.number().min(0).max(60).optional(),
  subjectsTaught: Joi.array().items(Joi.string().trim().max(80)).optional(),
}).min(1);

const cmsPageSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  slug: Joi.string().trim().min(1).max(80).required(),
  content: Joi.string().required(),
  seo: Joi.object({
    metaTitle: Joi.string().trim().max(200).optional(),
    metaDescription: Joi.string().trim().max(500).optional(),
    keywords: Joi.array().items(Joi.string().trim()).optional(),
  }).optional(),
  status: Joi.string().valid('draft', 'published', 'archived').default('draft'),
});

const updateCmsPageSchema = cmsPageSchema.fork(['title', 'slug', 'content'], (s) => s.optional());

const faqSchema = Joi.object({
  question: Joi.string().trim().min(1).max(500).required(),
  answer: Joi.string().trim().min(1).required(),
  category: Joi.string().trim().min(1).max(80).required(),
  audience: Joi.string().valid('all', 'parent', 'school', 'vendor').default('all'),
  displayOrder: Joi.number().integer().min(0).default(0),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

const updateFaqSchema = faqSchema.fork(['question', 'answer', 'category'], (s) => s.optional());

const bannerSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  imageId: objectId.required(),
  linkUrl: Joi.string().trim().uri().optional(),
  targetAudience: Joi.string().valid('all', 'parent', 'school').default('all'),
  position: Joi.string().valid('home_top', 'home_middle', 'category_top', 'cart').required(),
  displayOrder: Joi.number().integer().min(0).default(0),
  validFrom: Joi.date().iso().required(),
  validUntil: Joi.date().iso().required(),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

const updateBannerSchema = bannerSchema.fork(['title', 'imageId', 'position', 'validFrom', 'validUntil'], (s) =>
  s.optional()
);

const reelIdParam = Joi.object({ reelId: objectId.required() });

const linkedProductSchema = Joi.object({
  title: Joi.string().trim().max(200).optional(),
  price: Joi.number().min(0).optional(),
  mrp: Joi.number().min(0).optional(),
  url: Joi.string().trim().max(500).optional(),
  imageId: objectId.optional(),
  imageUrl: Joi.string().trim().max(500).optional(),
  badge: Joi.string().trim().max(40).optional(),
});

const reelSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(2000).optional(),
  videoId: objectId.required(),
  thumbnailId: objectId.optional(),
  storeName: Joi.string().trim().max(160).optional(),
  category: Joi.string().trim().max(80).optional(),
  musicLabel: Joi.string().trim().max(200).optional(),
  linkedProduct: linkedProductSchema.optional(),
  status: Joi.string().valid('draft', 'published', 'archived').default('draft'),
  targetApp: Joi.string().valid('parent', 'school', 'both').default('both'),
});

const updateReelSchema = reelSchema.fork(['title', 'videoId'], (s) => s.optional());

const tutorialIdParam = Joi.object({ tutorialId: objectId.required() });

const tutorialSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(2000).allow('').optional(),
  videoId: objectId.required(),
  thumbnailId: objectId.optional(),
  durationSec: Joi.number().min(0).optional(),
  targetAudience: Joi.string().valid('all', 'parent', 'teacher', 'school').default('all'),
  order: Joi.number().integer().min(0).default(0),
  status: Joi.string().valid('draft', 'published', 'archived').default('draft'),
});

// A plain .fork(...).optional() still carries each field's .default(), so an
// admin patching just `targetAudience` would silently reset `status` back to
// 'draft' and `order` back to 0 on every omitted field. Drop the defaults
// entirely for the update schema so PATCH only ever touches what's sent.
const updateTutorialSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().trim().max(2000).allow('').optional(),
  videoId: objectId.optional(),
  thumbnailId: objectId.optional(),
  durationSec: Joi.number().min(0).optional(),
  targetAudience: Joi.string().valid('all', 'parent', 'teacher', 'school').optional(),
  order: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('draft', 'published', 'archived').optional(),
});

const sectionSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  type: Joi.string()
    .valid('product_carousel', 'category_grid', 'vendor_list', 'custom_banner')
    .required(),
  queryConfig: Joi.object().optional(),
  manualItemIds: Joi.array().items(objectId).optional(),
  targetAudience: Joi.string().valid('all', 'parent', 'school').default('all'),
  displayOrder: Joi.number().integer().min(0).default(0),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

const updateSectionSchema = sectionSchema.fork(['title', 'type'], (s) => s.optional());

const landingContentSchema = Joi.object({
  heroSection: Joi.object({
    title: Joi.string().trim().optional(),
    subtitle: Joi.string().trim().optional(),
    backgroundImageUrl: Joi.string().trim().optional(),
    ctaText: Joi.string().trim().optional(),
    ctaLink: Joi.string().trim().optional(),
  }).optional(),
  features: Joi.array()
    .items(
      Joi.object({
        icon: Joi.string().trim().optional(),
        title: Joi.string().trim().optional(),
        description: Joi.string().trim().optional(),
      })
    )
    .optional(),
  testimonials: Joi.array()
    .items(
      Joi.object({
        author: Joi.string().trim().optional(),
        role: Joi.string().trim().optional(),
        content: Joi.string().trim().optional(),
        avatarUrl: Joi.string().trim().optional(),
      })
    )
    .optional(),
  status: Joi.string().valid('draft', 'published').default('draft'),
});

const generalSettingsSchema = Joi.object({
  platformName: Joi.string().trim().min(1).max(120).optional(),
  logoMetadata: Joi.object().optional(),
  contact: Joi.object({
    email: schemas.email.optional(),
    phone: schemas.indianMobile.optional(),
    address: Joi.string().trim().max(500).optional(),
  }).optional(),
  timezone: Joi.string().trim().optional(),
  currency: Joi.string().trim().length(3).optional(),
  language: Joi.string().trim().optional(),
});

const marketplaceSettingsSchema = Joi.object({
  commissionPercent: Joi.number().min(0).max(100).optional(),
  // Platform's cut on retail product sales (and bulk school purchases).
  platformRetailPercent: Joi.number().min(0).max(100).optional(),
  // Platform's cut on kit sales (the school earns its own kit % on top).
  platformKitPercent: Joi.number().min(0).max(100).optional(),
  vendorAutoApproval: Joi.boolean().optional(),
  productApprovalRequired: Joi.boolean().optional(),
});

const ordersSettingsSchema = Joi.object({
  returnWindowDays: Joi.number().integer().min(0).max(90).optional(),
  cancellationWindowHours: Joi.number().integer().min(0).max(168).optional(),
  tax: Joi.object({
    enabled: Joi.boolean().optional(),
    defaultRatePercent: Joi.number().min(0).max(100).optional(),
  }).optional(),
  invoice: Joi.object({
    prefix: Joi.string().trim().max(20).optional(),
    showTaxBreakdown: Joi.boolean().optional(),
  }).optional(),
});

const schoolSettingsSchema = Joi.object({
  schoolApprovalRequired: Joi.boolean().optional(),
  teacherApprovalRequired: Joi.boolean().optional(),
});

const securitySettingsSchema = Joi.object({
  passwordPolicy: Joi.object({
    minLength: Joi.number().integer().min(6).max(128).optional(),
    requireNumber: Joi.boolean().optional(),
    requireSpecialChar: Joi.boolean().optional(),
  }).optional(),
  loginPolicy: Joi.object({
    maxAttempts: Joi.number().integer().min(1).max(20).optional(),
    lockoutMinutes: Joi.number().integer().min(1).max(1440).optional(),
  }).optional(),
  session: Joi.object({
    accessTokenExpiry: Joi.string().trim().optional(),
    refreshTokenExpiry: Joi.string().trim().optional(),
  }).optional(),
});

const billingSettingsSchema = Joi.object({
  platformFeePaise: Joi.number().integer().min(0).optional(),
  freeDeliveryThresholdPaise: Joi.number().integer().min(0).optional(),
  fixedDeliveryChargePaise: Joi.number().integer().min(0).optional(),
  schoolDeliveryFreeDays: Joi.number().integer().min(0).optional(),
  schoolDeliveryChargePaise: Joi.number().integer().min(0).optional(),
});

const contactSettingsSchema = Joi.object({
  phone: Joi.string().trim().allow('', null).optional(),
  email: Joi.string().trim().allow('', null).optional(),
  address: Joi.string().trim().allow('', null).optional(),
  workingHours: Joi.string().trim().allow('', null).optional(),
  whatsapp: Joi.string().trim().allow('', null).optional(),
  bulkPhone: Joi.string().trim().allow('', null).optional(),
  bulkEmail: Joi.string().trim().allow('', null).optional(),
});

const lmsSettingsSchema = Joi.object({
  maxVideoSizeMB: Joi.number().integer().min(10).max(5000).optional(),
});

// How long a kit stays purchasable to parents after it is published. Bounded at
// one day so the admin can't configure a window that closes kits the moment a
// school publishes them.
const kitsSettingsSchema = Joi.object({
  purchaseWindowEnabled: Joi.boolean().optional(),
  purchaseWindowDays: Joi.number().integer().min(1).max(365).optional(),
});

const settingsBodyBySection = {
  general: generalSettingsSchema,
  marketplace: marketplaceSettingsSchema,
  orders: ordersSettingsSchema,
  school: schoolSettingsSchema,
  security: securitySettingsSchema,
  billing: billingSettingsSchema,
  contact: contactSettingsSchema,
  lms: lmsSettingsSchema,
  kits: kitsSettingsSchema,
};

const payoutIdParam = Joi.object({ payoutId: objectId.required() });

const approvePayoutSchema = Joi.object({
  transactionReference: Joi.string().trim().max(120).optional(),
});

const rejectPayoutSchema = Joi.object({
  reason: Joi.string().trim().max(500).required(),
});

const walletQuery = paginationQuery.keys({
  vendorId: Joi.alternatives().try(objectId, Joi.string().valid('All', 'all', '')).optional(),
  transactionType: Joi.string()
    .valid('order_credit', 'commission_deduction', 'payout_debit', 'adjustment', 'refund_debit', 'All', 'all', '')
    .optional(),
});

const walletAdjustmentSchema = Joi.object({
  vendorId: objectId.required(),
  amountPaise: Joi.number().integer().min(1).required(),
  direction: Joi.string().valid('credit', 'debit').required(),
  remarks: Joi.string().trim().max(500).optional().allow('', null),
});

const userWalletAdjustmentSchema = Joi.object({
  amountPaise: Joi.number().integer().min(1).required(),
  direction: Joi.string().valid('credit', 'debit').required(),
  remarks: Joi.string().trim().max(500).optional().allow('', null),
});

const notificationCampaignSchema = Joi.object({
  title: Joi.string().trim().min(2).max(120).required(),
  messageBody: Joi.string().trim().min(2).max(1000).required(),
  imageUrl: Joi.string().uri().optional().allow('', null),
  actionUrl: Joi.string().trim().max(300).optional().allow('', null),
  targetAudience: Joi.string()
    .valid('all_parents', 'all_vendors', 'all_schools', 'specific_users', 'custom_segment')
    .required(),
  segmentRules: Joi.object({
    userIds: Joi.array().items(objectId).optional(),
    roles: Joi.array().items(Joi.string().valid('parent', 'school', 'teacher', 'vendor')).optional(),
  }).optional(),
  scheduledAt: Joi.date().iso().optional().allow(null),
});

const adminProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(60).required(),
  lastName: Joi.string().trim().min(1).max(60).required(),
  mobile: Joi.string().trim().pattern(/^[6-9]\d{9}$/).required(),
});

// Vendor field rules are shared with the vendor-facing routes so the two surfaces
// cannot drift apart — they write the same VendorProfile.
const vendorFields = require('../../vendor/validators/vendorFields');

const createVendorSchema = Joi.object({
  name: vendorFields.identityFields.name.required(),
  storeName: vendorFields.identityFields.storeName.required(),
  phone: schemas.indianMobile.required(),
  email: schemas.email.required(),
  password: schemas.password.required(),
  commissionPercent: Joi.number().min(0).max(100).default(10),
  serviceRadiusKm: vendorFields.identityFields.serviceRadiusKm.default(10),
  categories: vendorFields.identityFields.categories.optional(),
  address: vendorFields.addressSchema.optional(),
  ...vendorFields.geoFields,
  autoApprove: Joi.boolean().default(true),
});

// Shares schoolFields with public signup so the two entry points cannot drift.
const createSchoolSchema = Joi.object({
  schoolName: schoolFields.identityFields.schoolName.required(),
  fullName: schoolFields.identityFields.fullName.required(),
  principalName: schoolFields.identityFields.principalName.optional(),
  email: schoolFields.contactFields.email.required(),
  mobile: schoolFields.contactFields.mobile.required(),
  password: schemas.password.required(),
  ...schoolFields.profileFields,
});

const updateVendorSchema = Joi.object({
  name: vendorFields.identityFields.name.optional(),
  storeName: vendorFields.identityFields.storeName.optional(),
  phone: schemas.indianMobile.optional(),
  email: schemas.email.optional(),
  // Only an admin may set the marketplace's commission.
  commissionPercent: Joi.number().min(0).max(100).optional(),
  serviceRadiusKm: vendorFields.identityFields.serviceRadiusKm.optional(),
  categories: vendorFields.identityFields.categories.optional(),
  address: vendorFields.addressSchema.optional(),
  ...vendorFields.geoFields,
  ...vendorFields.taxFields,
  bank: vendorFields.bankSchema.optional(),
}).min(1);

// Master-admin-only: a school's commission rates. kitPercent applies to the
// school's kits; retailPercent to retail buys by its linked users.
const schoolCommissionSchema = Joi.object({
  kitPercent: Joi.number().min(0).max(100).required(),
  retailPercent: Joi.number().min(0).max(100).required(),
});

const updatePayoutStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'processing', 'completed', 'rejected', 'failed').required(),
  transactionReference: Joi.string().trim().allow('', null).optional(),
  rejectionReason: Joi.string().trim().allow('', null).optional(),
});

module.exports = {
  paginationQuery,
  analyticsQuery,
  createVendorSchema,
  updateVendorSchema,
  createSchoolSchema,
  schoolCommissionSchema,
  userIdParam,
  vendorIdParam,
  schoolIdParam,
  teacherIdParam,
  teacherQuery,
  updateTeacherSchema,
  updateUserSchema,
  pageIdParam,
  faqIdParam,
  bannerIdParam,
  reelIdParam,
  sectionIdParam,
  courseIdParam,
  lessonIdParam,
  lmsSubjectIdParam,
  lmsSubjectSchema,
  lmsGradeIdParam,
  lmsGradeSchema,
  settingsSectionParam,
  landingSlugParam,
  recentQuery,
  actionNoteSchema,
  assignRoleSchema,
  updateRolesSchema,
  deleteUserSchema,
  cmsPageSchema,
  updateCmsPageSchema,
  faqSchema,
  updateFaqSchema,
  bannerSchema,
  updateBannerSchema,
  reelSchema,
  updateReelSchema,
  tutorialIdParam,
  tutorialSchema,
  updateTutorialSchema,
  sectionSchema,
  updateSectionSchema,
  landingContentSchema,
  settingsBodyBySection,
  payoutIdParam,
  approvePayoutSchema,
  rejectPayoutSchema,
  updatePayoutStatusSchema,
  walletQuery,
  walletAdjustmentSchema,
  userWalletAdjustmentSchema,
  notificationCampaignSchema,
  adminProfileSchema,
};
