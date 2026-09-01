const mongoose = require('mongoose');
const User = require('../../src/database/models/User');
const ParentProfile = require('../../src/database/models/ParentProfile');

jest.mock('../../src/common/sms', () => ({ sendOtp: jest.fn(async () => ({ success: true })) }));
jest.mock('../../src/modules/auth/services/sessionIssue.service', () => ({
  issueAuthenticatedSession: jest.fn(async (user) => ({ user, accessToken: 'tok' })),
}));

// The real env object is frozen, so swap in an unfrozen copy the tests can toggle.
jest.mock('../../src/config/env', () => ({ ...jest.requireActual('../../src/config/env') }));

const smsService = require('../../src/common/sms');
const env = require('../../src/config/env');
const otpService = require('../../src/modules/auth/services/otp.service');

/**
 * OTP_ENABLED=false must switch off *only* proof of phone possession. Everything else
 * that decides who gets a session — the account must exist for a login, an unknown
 * number is still refused — has to keep working, or the switch becomes "issue a
 * session to any number typed in".
 */
describe('OTP_ENABLED switch', () => {
  // The resend cooldown lives in a process-wide store keyed by phone number, so a
  // shared number would make the second request in this file trip it. Each test gets
  // its own.
  let PHONE;
  let seq = 0;
  beforeEach(() => { seq += 1; PHONE = `98123456${String(seq).padStart(2, '0')}`; });
  // The service reads env.OTP_ENABLED on every call, so this takes effect immediately.
  const setEnabled = (value) => { env.OTP_ENABLED = value; };

  const makeParent = async () => {
    const user = await User.create({
      refId: `SEM-P-OTP${String(seq).padStart(3, '0')}`, role: 'parent', status: 'active',
      name: 'Parent', phone: PHONE, tenantSchoolId: null,
    });
    await ParentProfile.create({ userId: user._id, referralCode: `EMART3${String(seq).padStart(3, '0')}` });
    return user;
  };

  afterEach(() => { jest.restoreAllMocks(); smsService.sendOtp.mockClear(); });

  describe('bypass on (OTP_ENABLED=false)', () => {
    beforeEach(() => setEnabled(false));

    test('requestOtp sends no SMS and hands back the code to fill in', async () => {
      await makeParent();
      const result = await otpService.requestOtp({ phone: PHONE, purpose: 'login_parent' });

      expect(smsService.sendOtp).not.toHaveBeenCalled();
      expect(result).toMatchObject({ sent: true, otpBypassed: true, otp: '1234' });
    });

    test('the code is sized to the purpose', async () => {
      const result = await otpService.requestOtp({ phone: PHONE, purpose: 'web_register' });
      expect(result.otp).toBe('123456'); // 6-digit purpose
    });

    test('no OtpRequest row is written', async () => {
      await makeParent();
      await otpService.requestOtp({ phone: PHONE, purpose: 'login_parent' });
      const OtpRequest = mongoose.model('OtpRequest');
      expect(await OtpRequest.countDocuments({ phone: PHONE })).toBe(0);
    });

    test('the fixed code logs the parent in without any request having been made', async () => {
      const user = await makeParent();
      const result = await otpService.verifyOtp(
        { phone: PHONE, otp: '1234', purpose: 'login_parent' }, {}, { issueSession: true }
      );
      expect(String(result.user._id)).toBe(String(user._id));
    });

    test('a wrong code is still refused', async () => {
      await makeParent();
      await expect(
        otpService.verifyOtp({ phone: PHONE, otp: '9999', purpose: 'login_parent' }, {}, { issueSession: true })
      ).rejects.toMatchObject({ code: 'OTP_INVALID' });
    });

    test('an unregistered number is still refused a login — bypass is not "skip every check"', async () => {
      await expect(
        otpService.requestOtp({ phone: '9899999901', purpose: 'login_parent' })
      ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });

      await expect(
        otpService.verifyOtp({ phone: '9899999901', otp: '1234', purpose: 'login_parent' }, {}, { issueSession: true })
      ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    });

    test('the old hard-coded 9300000001 / 1234 backdoor is gone', async () => {
      // It used to log in — and create — that account regardless of configuration.
      await expect(
        otpService.verifyOtp({ phone: '9300000001', otp: '1234', purpose: 'login_parent' }, {}, { issueSession: true })
      ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
      expect(await User.countDocuments({ phone: '9300000001' })).toBe(0);
    });
  });

  describe('bypass off (OTP_ENABLED=true)', () => {
    beforeEach(() => setEnabled(true));

    test('an SMS is sent and no code is leaked to the caller', async () => {
      await makeParent();
      const result = await otpService.requestOtp({ phone: PHONE, purpose: 'login_parent' });

      expect(smsService.sendOtp).toHaveBeenCalledTimes(1);
      expect(result.otp).toBeUndefined();
      expect(result.otpBypassed).toBeUndefined();
    });

    test('the bypass code does not work', async () => {
      await makeParent();
      await otpService.requestOtp({ phone: PHONE, purpose: 'login_parent' });
      await expect(
        otpService.verifyOtp({ phone: PHONE, otp: '1234', purpose: 'login_parent' }, {}, { issueSession: true })
      ).rejects.toMatchObject({ code: 'OTP_INVALID' });
    });

    test('the real emitted code does work', async () => {
      const user = await makeParent();
      await otpService.requestOtp({ phone: PHONE, purpose: 'login_parent' });
      const sent = smsService.sendOtp.mock.calls[0][0].otp;

      const result = await otpService.verifyOtp(
        { phone: PHONE, otp: sent, purpose: 'login_parent' }, {}, { issueSession: true }
      );
      expect(String(result.user._id)).toBe(String(user._id));
    });

    test('the old hard-coded backdoor is gone here too', async () => {
      await expect(
        otpService.verifyOtp({ phone: '9300000001', otp: '1234', purpose: 'login_parent' }, {}, { issueSession: true })
      ).rejects.toMatchObject({ code: 'OTP_NOT_FOUND' });
    });
  });
});
