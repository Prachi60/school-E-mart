const mongoose = require('mongoose');
const authController = require('../../src/modules/auth/controllers/auth.controller');
const User = require('../../src/database/models/User');
const School = require('../../src/database/models/School');
const ParentProfile = require('../../src/database/models/ParentProfile');
const ChildProfile = require('../../src/database/models/ChildProfile');

jest.mock('../../src/modules/auth/services/sessionIssue.service', () => ({
  issueAuthenticatedSession: jest.fn(async (user) => ({
    user,
    accessToken: 'test-access',
    refreshToken: 'test-refresh',
    expiresAt: new Date(Date.now() + 60000),
    expiresIn: 60,
  })),
}));

/**
 * Parent accounts can exist with no school and no child on them: the OTP login used to
 * create one for any number that asked for a code. Every parent screen is then empty —
 * the homework page above all — and the app's own remedy leads to profile setup, which
 * used to refuse them with PHONE_EXISTS because the number was, of course, already
 * theirs. 27 of 193 live parent accounts were sitting in that loop.
 */
describe('registerParent finishing an unfinished account', () => {
  let school;
  const PHONE = '9876500011';

  const run = async ({ auth = undefined, body = {} } = {}) => {
    const req = {
      body: { phone: PHONE, studentName: 'Asha', grade: 'KG2', schoolRefNo: school.schoolRefNo, ...body },
      auth,
      headers: {},
      ip: '127.0.0.1',
    };
    let payload = null;
    const res = {
      cookie: () => res,
      status: () => res,
      json: (b) => { payload = b; return res; },
    };
    await authController.registerParent(req, res, (err) => { if (err) throw err; });
    return payload;
  };

  const expectRejection = async (args, code) => {
    await expect(run(args)).rejects.toMatchObject({ code });
  };

  beforeEach(async () => {
    school = await School.create({ code: 'ADP-1', name: 'Adopt School', schoolRefNo: 'ADP-REF-1' });
  });

  const makeOrphan = () =>
    User.create({
      refId: 'SEM-P-ORPH01',
      role: 'parent',
      status: 'active',
      name: 'Parent User', // the placeholder the old OTP login wrote
      phone: PHONE,
      tenantSchoolId: null,
    });

  test('a signed-in parent with no child gets their profile completed, not a refusal', async () => {
    const orphan = await makeOrphan();

    const body = await run({ auth: { userId: String(orphan._id) } });
    expect(body.success).toBe(true);

    const after = await User.findById(orphan._id).lean();
    expect(String(after.tenantSchoolId)).toBe(String(school._id));
    // The placeholder name is replaced; the account itself is reused, not duplicated.
    expect(after.name).toBe('Asha Parent');
    expect(await User.countDocuments({ phone: PHONE })).toBe(1);

    const child = await ChildProfile.findOne({ parentUserId: orphan._id }).lean();
    expect(child).toMatchObject({ name: 'Asha', grade: 'KG2' });
    expect(String(child.schoolId)).toBe(String(school._id));
    expect(await ParentProfile.countDocuments({ userId: orphan._id })).toBe(1);
  });

  test('a name the parent chose themselves is not overwritten', async () => {
    const orphan = await User.create({
      refId: 'SEM-P-ORPH02', role: 'parent', status: 'active',
      name: 'Varsha Sathe', phone: PHONE, tenantSchoolId: null,
    });
    await run({ auth: { userId: String(orphan._id) } });
    expect((await User.findById(orphan._id).lean()).name).toBe('Varsha Sathe');
  });

  test('an existing ParentProfile is reused rather than duplicated', async () => {
    const orphan = await makeOrphan();
    await ParentProfile.create({ userId: orphan._id, referralCode: 'EMART7777' });

    await run({ auth: { userId: String(orphan._id) } });

    const profiles = await ParentProfile.find({ userId: orphan._id }).lean();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].referralCode).toBe('EMART7777');
  });

  test('no token means no adoption — the number is still treated as taken', async () => {
    await makeOrphan();
    await expectRejection({}, 'PHONE_EXISTS');
  });

  test('someone else\'s token cannot claim the number', async () => {
    await makeOrphan();
    await expectRejection({ auth: { userId: String(new mongoose.Types.ObjectId()) } }, 'PHONE_EXISTS');
  });

  test('a teacher who owns the number is never adopted, even with their own token', async () => {
    const teacher = await User.create({
      refId: 'SEM-TCH-AD01', role: 'teacher', status: 'active',
      name: 'Teacher', phone: PHONE, tenantSchoolId: school._id,
    });
    await expectRejection({ auth: { userId: String(teacher._id) } }, 'PHONE_EXISTS');
    expect(await ChildProfile.countDocuments({ parentUserId: teacher._id })).toBe(0);
  });

  test('a parent who already has a child is not given a duplicate', async () => {
    const orphan = await makeOrphan();
    await ChildProfile.create({ parentUserId: orphan._id, name: 'Asha', grade: 'KG2', schoolId: school._id });

    await expectRejection({ auth: { userId: String(orphan._id) } }, 'PROFILE_ALREADY_SET_UP');
    expect(await ChildProfile.countDocuments({ parentUserId: orphan._id })).toBe(1);
  });

  test('a genuinely new number still registers as before', async () => {
    const body = await run({ body: { phone: '9876500022' } });
    expect(body.success).toBe(true);
    const user = await User.findOne({ phone: '9876500022' }).lean();
    expect(user.role).toBe('parent');
    expect(await ChildProfile.countDocuments({ parentUserId: user._id })).toBe(1);
    expect(await ParentProfile.countDocuments({ userId: user._id })).toBe(1);
  });
});
