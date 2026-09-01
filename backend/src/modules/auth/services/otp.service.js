const mongoose = require('mongoose');
const logger = require('../../../common/logger');
const env = require('../../../config/env');
const {
  UnauthorizedError,
  TooManyRequestsError,
  NotFoundError,
  BadRequestError,
} = require('../../../common/errors');
const { generateOtp, hashOtp, normalizePhone } = require('../../../utils');
const { messages, roles } = require('../../../constants');
const { getStateStore } = require('../../../common/stateStore');
const smsService = require('../../../common/sms');
const otpRepository = require('../repositories/otp.repository');
const userRepository = require('../repositories/user.repository');
const auditRepository = require('../repositories/audit.repository');
const { issueAuthenticatedSession } = require('./sessionIssue.service');

const { ROLES } = roles;

const OTP_PURPOSE_CONFIG = {
  login_parent: { length: 4, requiresUser: true, role: ROLES.PARENT },
  signup_parent: { length: 4, requiresUser: false, role: ROLES.PARENT },
  web_register: { length: 6, requiresUser: false, role: ROLES.PARENT },
  password_reset: { length: 6, requiresUser: true, role: null },
};

const COOLDOWN_KEY_PREFIX = 'auth:otp-cooldown:';
const cooldownTtlSeconds = () => Math.max(1, Math.ceil(env.OTP_RESEND_COOLDOWN_MS / 1000));

/**
 * The fixed passcode used while OTP_ENABLED=false, sized for the purpose being
 * verified — login takes 4 digits, web registration 6, and the request validators
 * enforce those lengths, so one shared string cannot serve both.
 *
 * The configured code is repeated and trimmed to length, so OTP_BYPASS_CODE=123456
 * gives 1234 for login and 123456 for registration, and OTP_BYPASS_CODE=0000 gives
 * 0000 and 000000. Callers never have to work this out: requestOtp returns the exact
 * code for the purpose and the client fills it in.
 */
const bypassCodeFor = (length) => {
  const digits = env.OTP_BYPASS_CODE;
  return digits.repeat(Math.ceil(length / digits.length)).slice(0, length);
};

const otpBypassActive = () => env.OTP_ENABLED === false;

const otpService = {
  /**
   * "Is there an account this OTP could belong to?" — for login and password reset
   * there must be, for the signup purposes there need not be.
   *
   * Shared with the bypass path on purpose: switching OTP off must not also switch
   * off the check that the number belongs to somebody, or an unregistered number
   * would be handed a session.
   */
  async assertUserExistsForPurpose(normalizedPhone, config, purpose, requestMeta = {}) {
    if (!config.requiresUser) return;

    const user = config.role
      ? await userRepository.findByPhoneAndRole(normalizedPhone, config.role)
      : await userRepository.findByPhone(normalizedPhone);
    if (user) return;

    await auditRepository.log({
      action: 'auth.otp.request.skipped',
      entityType: 'OtpRequest',
      entityId: new mongoose.Types.ObjectId(),
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      correlationId: requestMeta.requestId || null,
      after: { phone: normalizedPhone, purpose, reason: 'user_not_found' },
    });
    throw new NotFoundError(
      'Mobile number not registered. Please contact your school administration to add your student profile.',
      'ACCOUNT_NOT_FOUND'
    );
  },

  async requestOtp({ phone, purpose }, requestMeta = {}) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      throw new BadRequestError('Please enter a valid 10-digit mobile number', null, 'INVALID_PHONE_NUMBER');
    }
    const config = OTP_PURPOSE_CONFIG[purpose];
    if (!config) {
      throw new UnauthorizedError(messages.AUTH.OTP_INVALID, 'INVALID_OTP_PURPOSE');
    }

    // With OTP off there is nothing to send and nothing to rate limit — the code is
    // already known. The account checks below still run, so an unregistered number is
    // refused exactly as it would be normally; only the passcode step is skipped.
    if (otpBypassActive()) {
      await this.assertUserExistsForPurpose(normalizedPhone, config, purpose, requestMeta);
      const otp = bypassCodeFor(config.length);
      logger.warn(`[OTP BYPASS] OTP_ENABLED=false — no SMS sent to ${normalizedPhone} (${purpose}); code is ${otp}`);
      return {
        sent: true,
        expiresIn: Math.floor(env.OTP_EXPIRY_MS / 1000),
        // Consumed by the client to fill the field in. Only ever present while the
        // bypass is on; with OTP_ENABLED=true these two keys are absent entirely.
        otpBypassed: true,
        otp,
      };
    }

    const store = getStateStore();
    const cooldownKey = `${COOLDOWN_KEY_PREFIX}${normalizedPhone}:${purpose}`;

    if (await store.exists(cooldownKey)) {
      const lastSentRaw = await store.get(cooldownKey);
      const lastSentAt = Number(lastSentRaw || 0);
      const elapsed = Date.now() - lastSentAt;
      if (elapsed < env.OTP_RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((env.OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new TooManyRequestsError(
          `Please wait ${waitSeconds} seconds before requesting another OTP`,
          'OTP_RESEND_COOLDOWN'
        );
      }
    }

    const windowStart = new Date(Date.now() - env.OTP_WINDOW_MS);
    const recentCount = await otpRepository.countRecentByPhone(normalizedPhone, windowStart);
    if (recentCount >= env.OTP_MAX_PER_WINDOW) {
      throw new TooManyRequestsError(
        'Too many OTP requests. Please try again later.',
        'OTP_RATE_LIMIT'
      );
    }

    await this.assertUserExistsForPurpose(normalizedPhone, config, purpose, requestMeta);

    await otpRepository.invalidateActiveForPhone(normalizedPhone, purpose);

    const otp = generateOtp(config.length);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MS);

    logger.info(`🔑 [OTP GENERATED] Phone: ${normalizedPhone} (${purpose}) => OTP: ${otp}`);

    await otpRepository.create({
      phone: normalizedPhone,
      purpose,
      otpHash: hashOtp(otp, normalizedPhone, purpose),
      length: config.length,
      expiresAt,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    await smsService.sendOtp({ phone: normalizedPhone, otp, purpose });
    await store.set(cooldownKey, String(Date.now()), cooldownTtlSeconds());

    await auditRepository.log({
      action: 'auth.otp.requested',
      entityType: 'OtpRequest',
      entityId: new mongoose.Types.ObjectId(),
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      correlationId: requestMeta.requestId || null,
      after: { phone: normalizedPhone, purpose },
    });

    return {
      sent: true,
      expiresIn: Math.floor(env.OTP_EXPIRY_MS / 1000),
    };
  },

  async verifyOtp({ phone, otp, purpose }, requestMeta = {}, { issueSession = false } = {}) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      throw new BadRequestError('Please enter a valid 10-digit mobile number', null, 'INVALID_PHONE_NUMBER');
    }
    const config = OTP_PURPOSE_CONFIG[purpose];
    if (!config) {
      throw new UnauthorizedError(messages.AUTH.OTP_INVALID, 'INVALID_OTP_PURPOSE');
    }

    // Replaces a hard-coded backdoor on the single number 9300000001 / 1234, which
    // was live regardless of environment and let anyone hold a session on that real
    // account. The bypass is now a deliberate switch that is off by default.
    //
    // Accepted without a stored OtpRequest on purpose: with the bypass on, requestOtp
    // writes no record, and the code is fixed anyway. Everything downstream — the
    // account lookup, the per-purpose create-or-refuse rule, the audit entry — is the
    // ordinary path below, so the only step skipped is proving possession of the phone.
    if (otpBypassActive()) {
      const expected = bypassCodeFor(config.length);
      if (String(otp) !== expected) {
        throw new UnauthorizedError(messages.AUTH.OTP_INVALID, 'OTP_INVALID');
      }
      logger.warn(`[OTP BYPASS] accepted fixed code for ${normalizedPhone} (${purpose})`);
      return this.completeVerification(
        { normalizedPhone, purpose, issueSession, otpRecordId: null },
        requestMeta
      );
    }

    const otpRecord = await otpRepository.findLatestActive(normalizedPhone, purpose);

    if (!otpRecord) {
      throw new UnauthorizedError(messages.AUTH.OTP_INVALID, 'OTP_NOT_FOUND');
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      throw new TooManyRequestsError(messages.AUTH.OTP_MAX_ATTEMPTS, 'OTP_MAX_ATTEMPTS');
    }

    const expectedHash = hashOtp(String(otp), normalizedPhone, purpose);
    if (expectedHash !== otpRecord.otpHash) {
      await otpRepository.incrementAttempts(otpRecord._id);
      await auditRepository.log({
        action: 'auth.otp.verify.failed',
        entityType: 'OtpRequest',
        entityId: otpRecord._id,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
        correlationId: requestMeta.requestId || null,
        after: { phone: normalizedPhone, purpose },
      });
      throw new UnauthorizedError(messages.AUTH.OTP_INVALID, 'OTP_INVALID');
    }

    await otpRepository.markConsumed(otpRecord._id);

    return this.completeVerification(
      { normalizedPhone, purpose, issueSession, otpRecordId: otpRecord._id },
      requestMeta
    );
  },

  /**
   * Everything that happens once the code itself is accepted: audit, then either
   * report success or resolve/create the account and issue the session.
   *
   * Shared by the normal path and the bypass so the two can never drift on who is
   * allowed a session — the bypass skips proving possession of the phone and nothing
   * else.
   */
  async completeVerification({ normalizedPhone, purpose, issueSession, otpRecordId }, requestMeta = {}) {
    await auditRepository.log({
      action: 'auth.otp.verified',
      entityType: 'OtpRequest',
      entityId: otpRecordId || new mongoose.Types.ObjectId(),
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      correlationId: requestMeta.requestId || null,
      after: { phone: normalizedPhone, purpose, bypassed: !otpRecordId || undefined },
    });

    if (!issueSession) {
      return { verified: true, phone: normalizedPhone };
    }

    let user = await userRepository.findByPhoneAndRole(normalizedPhone, ROLES.PARENT);
    if (!user) {
      if (purpose === 'login_parent') {
        throw new NotFoundError(
          'Mobile number not registered. Please contact your school administration to add your account.',
          'ACCOUNT_NOT_FOUND'
        );
      }
      const User = require('../../../database/models/User');
      const ParentProfile = require('../../../database/models/ParentProfile');
      const { generateUserRefId } = require('../../school/utils/refId');

      user = await User.create({
        refId: generateUserRefId('P'),
        role: ROLES.PARENT,
        status: 'active',
        name: 'Parent User',
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
        tenantSchoolId: null,
      });

      await ParentProfile.create({
        userId: user._id,
        referralCode: `EMART${Math.floor(1000 + Math.random() * 9000)}`,
      });
    }

    await userRepository.markPhoneVerified(user._id);

    return issueAuthenticatedSession(user, requestMeta, 'auth.login.otp.success');
  },

  async loginParentWithOtp(payload, requestMeta) {
    return this.verifyOtp(
      { ...payload, purpose: payload.purpose || 'login_parent' },
      requestMeta,
      { issueSession: true }
    );
  },

  /**
   * Guest/unlinked customer login. Verifies the OTP and, if no account exists
   * for the phone yet, creates an unlinked customer — a parent-role user with
   * NO school and NO child. They browse and buy as pure e-commerce; the
   * commission engine gives them no school share. Used by the guest checkout.
   */
  async verifyCustomerOtp({ phone, otp, name }, requestMeta = {}) {
    const normalizedPhone = normalizePhone(phone);

    // Consume/verify the OTP first (no session yet).
    await this.verifyOtp(
      { phone: normalizedPhone, otp, purpose: 'signup_parent' },
      requestMeta,
      { issueSession: false }
    );

    const User = require('../../../database/models/User');
    const ParentProfile = require('../../../database/models/ParentProfile');
    const { generateUserRefId } = require('../../school/utils/refId');

    // A phone owned by a non-parent (teacher/vendor/admin) can't become a customer.
    const anyUser = await User.findOne({
      phone: normalizedPhone,
      'softDelete.isDeleted': { $ne: true },
    });
    if (anyUser && anyUser.role !== ROLES.PARENT) {
      throw new UnauthorizedError(
        'This phone number belongs to another account',
        'PHONE_NOT_CUSTOMER'
      );
    }

    let user = anyUser;
    if (!user) {
      user = await User.create({
        refId: generateUserRefId('C'),
        role: ROLES.PARENT,
        status: 'active',
        name: (name && name.trim()) || 'Customer',
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
        tenantSchoolId: null, // unlinked — no school
      });

      const generateReferralCode = async () => {
        for (let i = 0; i < 50; i += 1) {
          const code = `EMART${Math.floor(1000 + Math.random() * 9000)}`;
          // eslint-disable-next-line no-await-in-loop
          if (!(await ParentProfile.findOne({ referralCode: code }))) return code;
        }
        return `EMART${Date.now().toString().slice(-8)}`;
      };
      await ParentProfile.create({ userId: user._id, referralCode: await generateReferralCode() });
    } else if (name && name.trim() && (!user.name || user.name === 'Customer')) {
      // Backfill a name for a returning bare customer.
      user.name = name.trim();
      await user.save();
    }

    await userRepository.markPhoneVerified(user._id);
    return issueAuthenticatedSession(user, requestMeta, 'auth.login.otp.success');
  },
};

module.exports = otpService;
