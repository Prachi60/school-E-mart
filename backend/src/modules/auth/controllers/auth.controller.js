const authService = require('../services/auth.service');
const otpService = require('../services/otp.service');
const passwordService = require('../services/password.service');
const emailVerificationService = require('../services/emailVerification.service');
const sessionService = require('../services/session.service');
const authorizationService = require('../services/authorization.service');
const { success } = require('../../../common/response');
const { toAuthResponseDto } = require('../dto/auth.dto');
const { messages } = require('../../../constants');
const env = require('../../../config/env');
const security = require('../../../config/security');
const { getRequestMeta } = require('../../../utils/request');
const asyncHandler = require('../../../utils/asyncHandler');

const setRefreshCookie = (res, refreshToken, expiresAt) => {
  res.cookie(env.REFRESH_COOKIE_NAME, refreshToken, {
    ...security.cookie,
    expires: expiresAt,
    maxAge: expiresAt.getTime() - Date.now(),
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(env.REFRESH_COOKIE_NAME, {
    ...security.cookie,
  });
};

const sendAuthResponse = (res, req, result, message) => {
  setRefreshCookie(res, result.refreshToken, result.expiresAt);
  return success(
    res,
    toAuthResponseDto({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    }),
    message,
    undefined,
    req
  );
};

const withRefreshCookieClear = (handler) =>
  asyncHandler(async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      clearRefreshCookie(res);
      throw error;
    }
  });

const authController = {
  login: (expectedRole = null) =>
    asyncHandler(async (req, res) => {
      const result = await authService.loginWithPassword(
        {
          email: req.body.email,
          password: req.body.password,
          expectedRole: expectedRole || req.body.role || null,
        },
        getRequestMeta(req)
      );
      return sendAuthResponse(res, req, result, messages.AUTH.LOGIN_SUCCESS);
    }),

  refresh: withRefreshCookieClear(async (req, res) => {
    const refreshToken =
      req.cookies?.[env.REFRESH_COOKIE_NAME] || req.body?.refreshToken || null;
    const result = await authService.refreshSession(refreshToken, getRequestMeta(req));
    return sendAuthResponse(res, req, result, messages.AUTH.TOKEN_REFRESHED);
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout({
      userId: req.auth.userId,
      jti: req.auth.jti,
      sessionId: req.auth.sessionId,
      revokeAll: req.body.revokeAll,
    });
    clearRefreshCookie(res);
    return success(res, null, messages.AUTH.LOGOUT_SUCCESS, undefined, req);
  }),

  me: asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(req.auth.userId);
    return success(res, { user }, undefined, undefined, req);
  }),

  requestParentOtp: (purpose = 'login_parent') =>
    asyncHandler(async (req, res) => {
      const phone = req.body.phone || req.body.mobile;
      const result = await otpService.requestOtp({ phone, purpose }, getRequestMeta(req));
      return success(res, result, messages.AUTH.OTP_SENT, undefined, req);
    }),

  verifyParentOtp: asyncHandler(async (req, res) => {
    const result = await otpService.loginParentWithOtp(
      {
        phone: req.body.phone || req.body.mobile,
        otp: req.body.otp,
        purpose: 'login_parent',
      },
      getRequestMeta(req)
    );
    return sendAuthResponse(res, req, result, messages.AUTH.OTP_VERIFIED);
  }),

  // Guest checkout: verifies the OTP and creates an unlinked customer account
  // (parent role, no school, no child) if one doesn't exist yet, then logs in.
  verifyCustomerOtp: asyncHandler(async (req, res) => {
    const result = await otpService.verifyCustomerOtp(
      {
        phone: req.body.phone || req.body.mobile,
        otp: req.body.otp,
        name: req.body.name,
      },
      getRequestMeta(req)
    );
    return sendAuthResponse(res, req, result, messages.AUTH.OTP_VERIFIED);
  }),

  parentWebLogin: asyncHandler(async (req, res) => {
    const result = await otpService.loginParentWithOtp(
      { phone: req.body.mobile, otp: req.body.otp, purpose: 'login_parent' },
      getRequestMeta(req)
    );
    return sendAuthResponse(res, req, result, messages.AUTH.LOGIN_SUCCESS);
  }),

  verifyWebRegisterOtp: asyncHandler(async (req, res) => {
    const result = await otpService.verifyOtp(
      {
        phone: req.body.phone || req.body.mobile,
        otp: req.body.otp,
        purpose: 'web_register',
      },
      getRequestMeta(req),
      { issueSession: false }
    );
    return success(res, result, messages.AUTH.OTP_VERIFIED, undefined, req);
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const result = await passwordService.forgotPassword(
      { email: req.body.email },
      getRequestMeta(req)
    );
    return success(res, null, result.message, undefined, req);
  }),

  resetPassword: asyncHandler(async (req, res) => {
    const result = await passwordService.resetPassword(
      { token: req.body.token, newPassword: req.body.newPassword },
      getRequestMeta(req)
    );
    return success(res, null, result.message, undefined, req);
  }),

  changePassword: asyncHandler(async (req, res) => {
    const result = await passwordService.changePassword(
      {
        userId: req.auth.userId,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
        sessionId: req.auth.sessionId,
      },
      getRequestMeta(req)
    );
    return success(res, null, result.message, undefined, req);
  }),

  sendEmailVerification: asyncHandler(async (req, res) => {
    const result = await emailVerificationService.sendVerificationEmail(
      req.auth.userId,
      getRequestMeta(req)
    );
    return success(res, null, result.message, undefined, req);
  }),

  verifyEmail: asyncHandler(async (req, res) => {
    const result = await emailVerificationService.verifyEmail(
      { token: req.body.token },
      getRequestMeta(req)
    );
    return success(
      res,
      { alreadyVerified: result.alreadyVerified },
      result.message,
      undefined,
      req
    );
  }),

  listSessions: asyncHandler(async (req, res) => {
    const sessions = await sessionService.listActiveSessions(req.auth.userId, req.auth.jti);
    return success(res, { sessions }, undefined, undefined, req);
  }),

  revokeSession: asyncHandler(async (req, res) => {
    const result = await sessionService.revokeSession({
      userId: req.auth.userId,
      sessionId: req.params.sessionId,
      currentSessionId: req.auth.sessionId,
      currentJti: req.auth.jti,
      requestMeta: getRequestMeta(req),
    });

    if (result.revokedCurrent) {
      clearRefreshCookie(res);
    }

    return success(res, result, messages.AUTH.SESSION_REVOKED_SUCCESS, undefined, req);
  }),

  revokeOtherSessions: asyncHandler(async (req, res) => {
    const result = await sessionService.revokeOtherSessions({
      userId: req.auth.userId,
      currentSessionId: req.auth.sessionId,
      requestMeta: getRequestMeta(req),
    });
    return success(res, result, messages.AUTH.SESSIONS_REVOKED_SUCCESS, undefined, req);
  }),

  getAuthorization: asyncHandler(async (req, res) => {
    const authorization = await authorizationService.getAuthorizationSnapshot(req.auth.userId);
    return success(res, { authorization }, undefined, undefined, req);
  }),

  registerParent: asyncHandler(async (req, res) => {
    const { normalizePhone } = require('../../../utils');
    const { BadRequestError } = require('../../../common/errors');
    const User = require('../../../database/models/User');
    const ParentProfile = require('../../../database/models/ParentProfile');
    const ChildProfile = require('../../../database/models/ChildProfile');
    const School = require('../../../database/models/School');
    const { issueAuthenticatedSession } = require('../services/sessionIssue.service');
    const { generateUserRefId } = require('../../school/utils/refId');

    const normalizedPhone = normalizePhone(req.body.phone);

    const existingUser = await User.findOne({ phone: normalizedPhone, 'softDelete.isDeleted': { $ne: true } });

    /**
     * A parent account can exist while its profile was never finished.
     *
     * Accounts created by the OTP login before it learned to refuse unknown numbers
     * have no school and no child on them, so every parent screen — homework above all
     * — renders empty. The app's own remedy ("Choose School" -> profile setup) lands
     * here, and a flat PHONE_EXISTS made that a closed loop: they are already signed
     * in, so "please log in instead" is advice they cannot act on. On the live database
     * 27 of 193 parent accounts were stuck in exactly this state.
     *
     * So finish the profile instead of refusing — but only for the authenticated owner
     * of that very account. Without the identity check this endpoint, which needs no
     * credentials, would hand out a session for any phone number that is typed into it.
     */
    const isOwnAccount =
      existingUser &&
      req.auth?.userId &&
      String(req.auth.userId) === String(existingUser._id) &&
      existingUser.role === 'parent';

    if (existingUser && !isOwnAccount) {
      throw new BadRequestError('Phone number already registered', null, 'PHONE_EXISTS');
    }

    // Already has a child on file: this is a re-submission, not an unfinished profile.
    // Adding a second child is a different flow, so don't silently duplicate one here.
    if (isOwnAccount) {
      const alreadyHasChild = await ChildProfile.exists({
        parentUserId: existingUser._id,
        'softDelete.isDeleted': { $ne: true },
      });
      if (alreadyHasChild) {
        throw new BadRequestError(
          'Your profile is already set up',
          null,
          'PROFILE_ALREADY_SET_UP'
        );
      }
    }

    let school = null;
    if (req.body.schoolRefNo) {
      const normalizedRef = req.body.schoolRefNo.trim().toUpperCase();
      school = await School.findOne({
        $or: [{ schoolRefNo: normalizedRef }, { code: normalizedRef }],
        'softDelete.isDeleted': { $ne: true },
      });
      if (!school) {
        throw new BadRequestError('Invalid school reference number', null, 'INVALID_SCHOOL_REF');
      }
    }

    const generateUniqueReferralCode = async () => {
      while (true) {
        const code = `EMART${Math.floor(1000 + Math.random() * 9000)}`;
        const exists = await ParentProfile.findOne({ referralCode: code });
        if (!exists) return code;
      }
    };

    let user;
    if (isOwnAccount) {
      // Finish the account that is already signed in. Its placeholder name ("Parent
      // User", written by the old OTP login) is replaced, but a name the parent chose
      // themselves is left alone.
      const updates = { phoneVerifiedAt: existingUser.phoneVerifiedAt || new Date() };
      if (school?._id) updates.tenantSchoolId = school._id;
      if (!existingUser.name || existingUser.name === 'Parent User' || existingUser.name === 'Customer') {
        updates.name = `${req.body.studentName} Parent`;
      }
      await User.updateOne({ _id: existingUser._id }, { $set: updates });
      user = await User.findById(existingUser._id);
    } else {
      const refId = generateUserRefId('P');
      user = await User.create({
        refId,
        role: 'parent',
        status: 'active',
        name: `${req.body.studentName} Parent`,
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
        tenantSchoolId: school?._id || null,
      });
    }

    // Guest-checkout and OTP-created accounts may already carry a ParentProfile; a
    // second one would collide on the unique userId index.
    const existingProfile = await ParentProfile.findOne({
      userId: user._id,
      'softDelete.isDeleted': { $ne: true },
    });
    if (!existingProfile) {
      const referralCode = await generateUniqueReferralCode();
      await ParentProfile.create({
        userId: user._id,
        referralCode,
      });
    }

    await ChildProfile.create({
      parentUserId: user._id,
      name: req.body.studentName,
      schoolId: school?._id || null,
      schoolRefNo: school?.schoolRefNo || req.body.schoolRefNo || null,
      grade: req.body.grade,
    });

    const sessionResponse = await issueAuthenticatedSession(user, getRequestMeta(req), 'auth.register.parent.success');
    return sendAuthResponse(res, req, sessionResponse, 'Parent registration successful');
  }),

  registerTeacher: asyncHandler(async (req, res) => {
    const { BadRequestError } = require('../../../common/errors');
    throw new BadRequestError('Self-registration is disabled. Accounts can only be created by school administrators.', null, 'REGISTRATION_DISABLED');
  }),

  lookupSchoolForRegistration: asyncHandler(async (req, res) => {
    const { BadRequestError } = require('../../../common/errors');
    const School = require('../../../database/models/School');
    const classService = require('../../school/services/class.service');

    const normalizedRef = req.query.ref.trim().toUpperCase();
    const school = await School.findOne({
      $or: [{ schoolRefNo: normalizedRef }, { code: normalizedRef }],
      'softDelete.isDeleted': { $ne: true },
    }).select('_id name schoolRefNo code gradesOffered');

    if (!school) {
      throw new BadRequestError('Invalid school reference number', null, 'INVALID_SCHOOL_REF');
    }

    const classes = await classService.listClasses(school._id);
    const classGrades = [
      ...new Set(classes.map((item) => item.classGrade).filter(Boolean)),
    ];

    return success(
      res,
      {
        school: {
          id: school._id,
          name: school.name,
          schoolRefNo: school.schoolRefNo,
          code: school.code,
        },
        classes: classGrades.map((classGrade) => ({ classGrade })),
      },
      undefined,
      undefined,
      req
    );
  }),

  registerSchoolAdmin: asyncHandler(async (req, res) => {
    const schoolAdminRegistrationService = require('../../school/services/schoolAdminRegistration.service');

    const { user, school, schoolRefNo } = await schoolAdminRegistrationService.register(req.body);

    // Deliberately no session. A self-registered school starts as a 'prospect'
    // and cannot sign in until an admin approves it — issuing tokens here would
    // hand out access the very next login is going to refuse, which reads as the
    // account breaking rather than as a review step.
    return success(
      res,
      {
        schoolRefNo,
        status: 'pending_approval',
        school: { id: school._id, name: school.name, code: school.code },
        user: { name: user.name, email: user.email, schoolRefNo },
      },
      'Registration received. Your school is pending approval.',
      undefined,
      req
    );
  }),
};

module.exports = authController;
