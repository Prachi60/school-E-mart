const mongoose = require('mongoose');
const User = require('../../src/database/models/User');
const Student = require('../../src/database/models/Student');
const TeacherProfile = require('../../src/database/models/TeacherProfile');
const School = require('../../src/database/models/School');
const AttendanceRecord = require('../../src/database/models/AttendanceRecord');
const Notice = require('../../src/database/models/Notice');
const schoolApprovalService = require('../../src/modules/admin/services/schoolApproval.service');
const { generateUserRefId } = require('../../src/modules/school/utils/refId');

describe('Admin School Activity & Platform Usage Tracking', () => {
  let school;
  let teacherUser;
  let teacherProfile;
  let student;

  beforeEach(async () => {
    const timestamp = Date.now();
    // 1. Create School
    school = await School.create({
      code: `SCH-${timestamp}`,
      name: 'St. Xavier High School',
      schoolRefNo: `REF-${timestamp}`,
      partnerStatus: 'active',
    });

    // 2. Create Teacher User & Profile
    teacherUser = await User.create({
      refId: generateUserRefId('TCH'),
      role: 'teacher',
      status: 'active',
      name: 'John Teacher',
      phone: `98${Math.floor(10000000 + Math.random() * 9000000)}`,
      email: `teacher${timestamp}@test.com`,
      lastLoginAt: new Date(), // Active today
    });

    teacherProfile = await TeacherProfile.create({
      userId: teacherUser._id,
      schoolId: school._id,
      approvalStatus: 'approved',
    });

    // 3. Create Student
    student = await Student.create({
      schoolId: school._id,
      schoolRefNo: `REF-${timestamp}`,
      studentId: `STU-${timestamp}`,
      classGrade: '5',
      section: 'A',
      status: 'active',
      name: 'Rohan Mehta',
    });

    // 4. Create Attendance Record for today
    await AttendanceRecord.create({
      schoolId: school._id,
      studentId: student._id,
      date: new Date(),
      status: 'present',
      recordedBy: teacherUser._id,
    });

    // 5. Create School Notice today
    await Notice.create({
      schoolId: school._id,
      title: 'Annual Sports Day Notice',
      content: 'Sports day will be held on Friday.',
      targetAudience: 'all',
      status: 'published',
      publishDate: new Date(),
    });
  });

  test('listSchools decorates schools with teacherStats, studentStats, and dailyUsage status', async () => {
    const response = await schoolApprovalService.listSchools({ limit: 10 });
    const targetSchool = response.data.find((s) => String(s._id) === String(school._id));

    expect(targetSchool).toBeDefined();
    expect(targetSchool.activityStats).toBeDefined();

    // Teacher stats
    expect(targetSchool.activityStats.teacherStats.total).toBe(1);
    expect(targetSchool.activityStats.teacherStats.active).toBe(1);
    expect(targetSchool.activityStats.teacherStats.activeToday).toBe(1);

    // Student stats
    expect(targetSchool.activityStats.studentStats.total).toBe(1);
    expect(targetSchool.activityStats.studentStats.attendanceToday).toBe(true);

    // Daily usage status
    expect(targetSchool.activityStats.dailyUsage.status).toBe('active_today');
    expect(targetSchool.activityStats.dailyUsage.label).toBe('Active Today');
    expect(targetSchool.activityStats.dailyUsage.attendanceMarkedToday).toBe(true);
    expect(targetSchool.activityStats.dailyUsage.noticeSentToday).toBe(true);
  });
});
