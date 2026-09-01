const express = require('express');
const authController = require('../controllers/auth.controller');
const authValidators = require('../validators/auth.validator');
const { validateBody, validateParams, validateQuery } = require('../../../middlewares/validation');
const { protectedRoute, optionalAuthRoute } = require('../../../middlewares/auth/guards');
const { authLimiter, otpLimiter } = require('../../../middlewares/rateLimit');
const { ROLES } = require('../../../constants/roles');

const router = express.Router();

router.post(
  '/login',
  authLimiter,
  validateBody(authValidators.loginSchema),
  authController.login()
);

router.post(
  '/school/admin/login',
  authLimiter,
  validateBody(authValidators.schoolAdminLoginSchema),
  authController.login(ROLES.SCHOOL_ADMIN)
);

router.post(
  '/school/teacher/login',
  authLimiter,
  validateBody(authValidators.teacherLoginSchema),
  authController.login(ROLES.TEACHER)
);

router.post(
  '/vendor/login',
  authLimiter,
  validateBody(authValidators.vendorLoginSchema),
  authController.login(ROLES.VENDOR)
);

router.post(
  '/admin/login',
  authLimiter,
  validateBody(authValidators.superAdminLoginSchema),
  authController.login(ROLES.SUPER_ADMIN)
);

router.post(
  '/refresh',
  authLimiter,
  validateBody(authValidators.refreshSchema),
  authController.refresh
);

router.post(
  '/logout',
  ...protectedRoute(),
  validateBody(authValidators.logoutSchema),
  authController.logout
);

router.get('/me', ...protectedRoute(), authController.me);

router.post(
  '/parent/otp/request',
  otpLimiter,
  validateBody(authValidators.parentOtpRequestSchema),
  authController.requestParentOtp('login_parent')
);

router.post(
  '/parent/otp/verify',
  otpLimiter,
  validateBody(authValidators.parentOtpVerifySchema),
  authController.verifyParentOtp
);

// Optional auth: a brand-new parent has no token, while one finishing a profile on an
// account that was auto-created for them is already signed in. registerParent only
// adopts an existing account when the token proves it belongs to the caller.
router.post(
  '/parent/register',
  authLimiter,
  ...optionalAuthRoute(),
  validateBody(authValidators.parentRegisterSchema),
  authController.registerParent
);

// Guest checkout: OTP to a shopper who has no account yet. Uses the signup
// purpose so the OTP is sent even when no user exists; verify creates an
// unlinked customer (no school, no child) and logs them in.
router.post(
  '/customer/otp/request',
  otpLimiter,
  validateBody(authValidators.parentOtpRequestSchema),
  authController.requestParentOtp('signup_parent')
);

router.post(
  '/customer/otp/verify',
  otpLimiter,
  validateBody(authValidators.customerOtpVerifySchema),
  authController.verifyCustomerOtp
);

router.get(
  '/parent/school-lookup',
  authLimiter,
  validateQuery(authValidators.schoolLookupQuerySchema),
  authController.lookupSchoolForRegistration
);

router.post(
  '/school/teacher/register',
  authLimiter,
  validateBody(authValidators.teacherRegisterSchema),
  authController.registerTeacher
);

router.post(
  '/school/admin/register',
  authLimiter,
  validateBody(authValidators.schoolAdminRegisterSchema),
  authController.registerSchoolAdmin
);

router.post(
  '/parent/web/login',
  otpLimiter,
  validateBody(authValidators.parentWebLoginSchema),
  authController.parentWebLogin
);

router.post(
  '/parent/web/register/otp/request',
  otpLimiter,
  validateBody(authValidators.parentWebRegisterOtpSchema),
  authController.requestParentOtp('web_register')
);

router.post(
  '/parent/web/register/otp/verify',
  otpLimiter,
  validateBody(authValidators.parentWebRegisterVerifySchema),
  authController.verifyWebRegisterOtp
);

router.post(
  '/forgot-password',
  authLimiter,
  validateBody(authValidators.forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  authLimiter,
  validateBody(authValidators.resetPasswordSchema),
  authController.resetPassword
);

router.post(
  '/change-password',
  ...protectedRoute(),
  authLimiter,
  validateBody(authValidators.changePasswordSchema),
  authController.changePassword
);

router.post(
  '/email/verify/request',
  ...protectedRoute(),
  authLimiter,
  validateBody(authValidators.emailVerifyRequestSchema),
  authController.sendEmailVerification
);

router.post(
  '/email/verify',
  authLimiter,
  validateBody(authValidators.emailVerifySchema),
  authController.verifyEmail
);

router.get('/permissions', ...protectedRoute(), authController.getAuthorization);

router.get('/sessions', ...protectedRoute(), authController.listSessions);

router.delete(
  '/sessions/:sessionId',
  ...protectedRoute(),
  validateParams(authValidators.sessionIdParamSchema),
  authController.revokeSession
);

router.post('/sessions/revoke-others', ...protectedRoute(), authController.revokeOtherSessions);

module.exports = router;
