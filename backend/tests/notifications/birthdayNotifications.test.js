const mongoose = require('mongoose');
const User = require('../../src/database/models/User');
const Student = require('../../src/database/models/Student');
const ChildProfile = require('../../src/database/models/ChildProfile');
const ParentProfile = require('../../src/database/models/ParentProfile');
const TeacherProfile = require('../../src/database/models/TeacherProfile');
const School = require('../../src/database/models/School');
const Notification = require('../../src/database/models/Notification');
const { triggerService } = require('../../src/services/notification');
const { generateUserRefId } = require('../../src/modules/school/utils/refId');

describe('Student Birthday Notifications', () => {
  let school;
  let parentUser;
  let classTeacherUser;
  let nonClassTeacherUser;
  let schoolAdminUser;
  let student;

  beforeEach(async () => {
    // 1. Create School
    school = await School.create({
      code: `SCH-${Date.now()}`,
      name: 'Delhi Public School',
      schoolRefNo: `REF-${Date.now()}`,
    });

    // 2. Create Parent User & Parent Profile
    parentUser = await User.create({
      refId: generateUserRefId('P'),
      role: 'parent',
      status: 'active',
      name: 'Rajesh Sharma',
      phone: `98${Math.floor(10000000 + Math.random() * 9000000)}`,
      email: `parent${Date.now()}@test.com`,
    });

    const parentProfile = await ParentProfile.create({
      userId: parentUser._id,
      referralCode: `EMART${Math.floor(1000 + Math.random() * 9000)}`,
    });

    // 3. Create Class Teacher User & Teacher Profile (isClassTeacher: true)
    classTeacherUser = await User.create({
      refId: generateUserRefId('TCH'),
      role: 'teacher',
      status: 'active',
      name: 'Mrs. Ananya Verma',
      phone: `97${Math.floor(10000000 + Math.random() * 9000000)}`,
      email: `teacher${Date.now()}@test.com`,
    });

    await TeacherProfile.create({
      userId: classTeacherUser._id,
      schoolId: school._id,
      approvalStatus: 'approved',
      classAssignments: [{ class: '5', section: 'A', isClassTeacher: true }],
    });

    // 4. Create Non-Class Teacher User (isClassTeacher: false)
    nonClassTeacherUser = await User.create({
      refId: generateUserRefId('TCH'),
      role: 'teacher',
      status: 'active',
      name: 'Mr. Subject Teacher',
      phone: `96${Math.floor(10000000 + Math.random() * 9000000)}`,
      email: `subjectteacher${Date.now()}@test.com`,
    });

    await TeacherProfile.create({
      userId: nonClassTeacherUser._id,
      schoolId: school._id,
      approvalStatus: 'approved',
      classAssignments: [{ class: '5', section: 'A', isClassTeacher: false }],
    });

    // 5. Create School Admin User
    schoolAdminUser = await User.create({
      refId: generateUserRefId('ADM'),
      role: 'school',
      status: 'active',
      name: 'School Principal',
      phone: `95${Math.floor(10000000 + Math.random() * 9000000)}`,
      email: `schooladmin${Date.now()}@test.com`,
      tenantSchoolId: school._id,
    });

    // 6. Create Student with DOB = today (10 years ago today)
    const today = new Date();
    const dobToday = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());

    student = await Student.create({
      schoolId: school._id,
      name: 'Aarav Sharma',
      schoolRefNo: `STU-${Date.now()}`,
      classGrade: '5',
      section: 'A',
      dob: dobToday,
      parentProfileIds: [parentProfile._id],
    });

    await ChildProfile.create({
      parentUserId: parentUser._id,
      studentId: student._id,
      name: 'Aarav Sharma',
      schoolId: school._id,
      grade: '5',
      dob: dobToday,
    });
  });

  test('notifies Parent, Class Teacher, and School Admin on student birthday', async () => {
    // Execute birthday notifications trigger for today
    await triggerService.checkAndNotifyStudentBirthdays(new Date());

    // 1. Verify Parent received in-app birthday notification
    const parentNotifs = await Notification.find({ userId: parentUser._id }).lean();
    expect(parentNotifs.length).toBeGreaterThanOrEqual(1);
    expect(parentNotifs[0].title).toContain('Happy Birthday Aarav Sharma');
    expect(parentNotifs[0].payload.data.type).toBe('birthday');

    // 2. Verify Class Teacher received birthday notification
    const teacherNotifs = await Notification.find({ userId: classTeacherUser._id }).lean();
    expect(teacherNotifs.length).toBeGreaterThanOrEqual(1);
    expect(teacherNotifs[0].title).toContain('Birthday Alert: Aarav Sharma');
    expect(teacherNotifs[0].payload.data.type).toBe('birthday');

    // 3. Verify Non-Class Teacher did NOT receive birthday notification
    const nonClassTeacherNotifs = await Notification.find({ userId: nonClassTeacherUser._id }).lean();
    expect(nonClassTeacherNotifs).toHaveLength(0);

    // 4. Verify School Admin received birthday notification
    const schoolNotifs = await Notification.find({ userId: schoolAdminUser._id }).lean();
    expect(schoolNotifs.length).toBeGreaterThanOrEqual(1);
    expect(schoolNotifs[0].title).toContain('Student Birthday Alert: Aarav Sharma');
    expect(schoolNotifs[0].payload.data.type).toBe('birthday');
  });

  test('prevents duplicate birthday notifications on the same day', async () => {
    // Run initial trigger
    await triggerService.checkAndNotifyStudentBirthdays(new Date());

    const initialParentNotifCount = await Notification.countDocuments({ userId: parentUser._id });
    expect(initialParentNotifCount).toBe(1);

    // Run trigger second time on the same date
    await triggerService.checkAndNotifyStudentBirthdays(new Date());

    const secondParentNotifCount = await Notification.countDocuments({ userId: parentUser._id });
    expect(secondParentNotifCount).toBe(1);
  });
});
