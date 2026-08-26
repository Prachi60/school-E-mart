const { Joi, schemas } = require('../../../common/validation');

const objectId = schemas.objectId;
const paginationQuery = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(10000).default(20),
  sort: Joi.string().trim().optional(),
  fields: Joi.string().trim().optional(),
  search: Joi.string().trim().max(120).optional(),
};

// School's vendor directory (used to invite vendors to an RFQ). `ids` lets the
// RFQ create/edit screen resolve a specific set of previously-invited vendors
// by id, independent of whatever page/search the browsing list is on.
const vendorDirectoryQuery = Joi.object({
  ...paginationQuery,
  ids: Joi.string().trim().max(4000).optional(),
});

const schoolIdParam = Joi.object({ schoolId: Joi.string().trim().required() });
const classGradeParam = schoolIdParam.keys({ classGrade: Joi.string().trim().required() });
const sectionParam = classGradeParam.keys({ section: Joi.string().trim().required() });

const createSchoolSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  logoUrl: Joi.string().trim().optional().allow('', null),
  phone: Joi.string().trim().optional().allow('', null),
  code: Joi.string().trim().max(32).optional().allow('', null),
  principalName: Joi.string().trim().max(80).optional().allow('', null),
  adminEmail: schemas.email.optional().allow('', null),
  schoolRefNo: Joi.string().trim().required(),
  address: Joi.object({
    line1: Joi.string().trim().optional().allow('', null),
    line2: Joi.string().trim().optional().allow('', null),
    city: Joi.string().trim().optional().allow('', null),
    state: Joi.string().trim().optional().allow('', null),
    country: Joi.string().trim().optional().allow('', null),
    pinCode: Joi.string().trim().optional().allow('', null),
  }).optional().allow(null),
  partnerStatus: Joi.string().valid('prospect', 'active', 'suspended').default('prospect'),
  // NOTE: commission is deliberately NOT settable here. Only the master admin
  // sets a school's commission (PATCH /admin/schools/:schoolId/commission), so a
  // school admin can never change their own rates.
  academicYearCurrent: Joi.string().trim().optional().allow('', null),
  gradesOffered: Joi.array().items(Joi.string().trim()).optional(),
  sectionsConfig: Joi.array()
    .items(
      Joi.object({
        class: Joi.string().trim().required(),
        sections: Joi.array().items(Joi.string().trim()).default([]),
      })
    )
    .optional(),
});

const updateSchoolSchema = createSchoolSchema
  .fork(['name', 'schoolRefNo'], (schema) => schema.optional())
  .keys({
    // Redefined without the create-time default: otherwise every partial
    // update would $set partnerStatus back to 'prospect'
    partnerStatus: Joi.string().valid('prospect', 'active', 'suspended').optional(),
  });

const createTeacherSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: schemas.email.required(),
  phone: schemas.indianMobile.required(),
  password: schemas.password.required(),
  employeeId: Joi.string().trim().optional().allow('', null),
  designation: Joi.string().trim().optional().allow('', null),
  department: Joi.string().trim().optional().allow('', null),
  qualification: Joi.string().trim().optional().allow('', null),
  experienceYears: Joi.number().min(0).optional().allow(null),
  joiningDate: Joi.date().optional().allow(null),
  subjectsTaught: Joi.array().items(Joi.string().trim()).optional(),
  classAssignments: Joi.array()
    .items(
      Joi.object({
        class: Joi.string().trim().required(),
        section: Joi.string().trim().required(),
      })
    )
    .optional(),
  autoApprove: Joi.boolean().default(true),
});

const updateTeacherSchema = Joi.object({
  avatarUrl: Joi.string().trim().allow('', null).optional(),
  designation: Joi.string().trim().optional(),
  department: Joi.string().trim().optional(),
  qualification: Joi.string().trim().optional(),
  experienceYears: Joi.number().min(0).optional(),
  subjectsTaught: Joi.array().items(Joi.string().trim()).optional(),
  classAssignments: Joi.array()
    .items(
      Joi.object({
        class: Joi.string().trim().required(),
        section: Joi.string().trim().required(),
      })
    )
    .optional(),
  showInPhonebook: Joi.boolean().optional(),
  user: Joi.object({
    name: Joi.string().trim().optional(),
    phone: schemas.indianMobile.optional(),
    email: schemas.email.optional(),
    avatarUrl: Joi.string().trim().allow('', null).optional(),
  }).optional(),
});

const teacherStatusSchema = Joi.object({
  approvalStatus: Joi.string().valid('approved', 'rejected', 'pending').required(),
  rejectionReason: Joi.string().trim().max(300).optional(),
});

const createClassSchema = Joi.object({
  classGrade: Joi.string().trim().required(),
  sections: Joi.array().items(Joi.string().trim()).default([]),
});

const updateClassSchema = Joi.object({
  newClassGrade: Joi.string().trim().optional(),
  sections: Joi.array().items(Joi.string().trim()).optional(),
});

const createSectionSchema = Joi.object({ section: Joi.string().trim().required() });
const updateSectionSchema = Joi.object({ newSection: Joi.string().trim().required() });
const assignStudentsSchema = Joi.object({
  studentIds: Joi.array().items(objectId).min(1).required(),
});

const createStudentSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  schoolRefNo: Joi.string().trim().optional(),
  rollNo: Joi.string().trim().optional(),
  classGrade: Joi.string().trim().required(),
  section: Joi.string().trim().required(),
  status: Joi.string().valid('active', 'inactive', 'alumni').default('active'),
  // A school enrollment record needs the child's DOB (age) and gender
  dob: Joi.date().max('now').required(),
  gender: Joi.string().valid('male', 'female', 'other', 'unspecified').required(),
  bloodGroup: Joi.string().trim().optional().allow('', null),
  motherName: Joi.string().trim().max(80).optional().allow('', null),
  address: Joi.string().trim().max(500).optional().allow('', null),
  admissionDate: Joi.date().optional(),
  previousSchool: Joi.string().trim().max(120).optional().allow('', null),
  avatarUrl: Joi.string().trim().allow('', null).optional(),
  parentUserId: objectId.optional(),
  parentProfileIds: Joi.array().items(objectId).optional(),
  // Parent contact is mandatory at enrollment: the parent's mobile becomes the
  // login account for this student (no separate parent registration flow)
  parentPhone: schemas.indianMobile.required(),
  parentName: Joi.string().trim().min(2).max(80).required(),
  parentEmail: schemas.email.optional().allow('', null),
  admissionNo: Joi.string().trim().optional(),
});

const updateStudentSchema = createStudentSchema.fork(
  ['name', 'classGrade', 'section', 'dob', 'gender', 'parentPhone', 'parentName'],
  (schema) => schema.optional()
);

const transferStudentSchema = Joi.object({
  classGrade: Joi.string().trim().required(),
  section: Joi.string().trim().required(),
});

const studentStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'alumni').required(),
});

const subjectSchema = Joi.object({
  code: Joi.string().trim().uppercase().required(),
  label: Joi.string().trim().required(),
  displayOrder: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
});

const assignSubjectSchema = Joi.object({
  classGrade: Joi.string().trim().required(),
  section: Joi.string().trim().required(),
  subjectCode: Joi.string().trim().required(),
  teacherProfileId: objectId.required(),
});

const attendanceStatus = Joi.string().valid(
  'present',
  'absent',
  'half_day',
  'late',
  'holiday',
  'leave'
);

// Attendance records what already happened, so a future date is always a mistake — but
// the bound cannot be the exact instant `now`. The client sends its own *local*
// calendar day, and any timezone ahead of UTC starts that day before UTC does: a
// teacher marking at 01:00 IST sends "today", which parses to 00:00 UTC today, still
// hours in the future by UTC reckoning, and `max('now')` rejected their own date. One
// day of slack covers every real offset (max +14) while still refusing a genuinely
// future date. Evaluated per request — a fixed date captured at module load would go
// stale in a long-running process.
const MAX_FUTURE_DATE_SKEW_MS = 24 * 60 * 60 * 1000;
const pastOrPresentDate = () =>
  Joi.date().custom((value, helpers) => {
    if (value.getTime() > Date.now() + MAX_FUTURE_DATE_SKEW_MS) {
      return helpers.message('Attendance date cannot be in the future');
    }
    return value;
  });

const markAttendanceSchema = Joi.object({
  date: pastOrPresentDate().required(),
  classGrade: Joi.string().trim().required(),
  section: Joi.string().trim().required(),
  records: Joi.array()
    .items(
      Joi.object({
        studentId: objectId.required(),
        status: attendanceStatus.required(),
        // Omitted leaves any existing remark alone; an explicit '' clears it.
        remarks: Joi.string().trim().max(300).allow('').optional(),
      })
    )
    .min(1)
    .unique('studentId')
    .required(),
});

const attendanceQuerySchema = Joi.object({
  ...paginationQuery,
  studentId: objectId.optional(),
  date: Joi.date().optional(),
  // An inclusive range, so a calendar can ask for exactly the months it displays
  // rather than taking the most recent N records and rendering older months blank.
  // `date` still wins when both are sent.
  from: Joi.date().optional(),
  // The ordering rule only applies when there is a `from` to compare against —
  // an unconditional Joi.ref makes a lone `to` fail on an unresolvable reference.
  to: Joi.date()
    .optional()
    .when('from', { is: Joi.exist(), then: Joi.date().min(Joi.ref('from')) }),
  status: attendanceStatus.optional(),
  classGrade: Joi.string().trim().optional(),
  section: Joi.string().trim().optional(),
});

const monthlyAttendanceQuerySchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).required(),
  month: Joi.number().integer().min(1).max(12).required(),
  classGrade: Joi.string().trim().optional(),
  section: Joi.string().trim().optional(),
});

const timetableSlotSchema = Joi.object({
  academicYear: Joi.string().trim().required(),
  classGrade: Joi.string().trim().required(),
  section: Joi.string().trim().required(),
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  periodNumber: Joi.number().integer().min(1).required(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  subjectCode: Joi.string().trim().required(),
  teacherProfileId: objectId.required(),
  room: Joi.string().trim().optional(),
});

const timetableQuerySchema = Joi.object({
  ...paginationQuery,
  academicYear: Joi.string().trim().optional(),
  classGrade: Joi.string().trim().optional(),
  section: Joi.string().trim().optional(),
  teacherProfileId: objectId.optional(),
  dayOfWeek: Joi.number().integer().min(0).max(6).optional(),
});

// Teacher ↔ class/section/subject assignment (managed on the school's
// Class & Teacher Assignments page)
const upsertAssignmentSchema = Joi.object({
  classGrade: Joi.string().trim().required(),
  section: Joi.string().trim().required(),
  subjects: Joi.array().items(Joi.string().trim().min(1).max(60)).default([]),
  isClassTeacher: Joi.boolean().default(false),
});

const removeAssignmentQuerySchema = Joi.object({
  classGrade: Joi.string().trim().required(),
  section: Joi.string().trim().required(),
});

const targetClassSchema = Joi.object({
  classGrade: Joi.string().trim().required(),
  sections: Joi.array().items(Joi.string().trim()).default([]),
});

const createNoticeSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  content: Joi.string().trim().min(2).max(20000).required(),
  targetAudience: Joi.string()
    .valid('all', 'parents', 'teachers', 'staff', 'specific_classes')
    .required(),
  targetClasses: Joi.array().items(targetClassSchema).optional(),
  attachments: Joi.array().items(objectId).optional(),
  publishDate: Joi.date().optional(),
  expiryDate: Joi.date().optional(),
  status: Joi.string().valid('draft', 'published', 'archived').optional(),
});

const updateNoticeSchema = createNoticeSchema.fork(
  ['title', 'content', 'targetAudience'],
  (schema) => schema.optional()
);

const noticeStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'published', 'archived').required(),
});

const noticeQuerySchema = Joi.object({
  ...paginationQuery,
  status: Joi.string().valid('draft', 'published', 'archived').optional(),
  targetAudience: Joi.string().valid('all', 'parents', 'teachers', 'staff', 'specific_classes').optional(),
  studentId: objectId.optional().allow('', null, 'undefined'),
}).unknown(true);

const createDiarySchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  content: Joi.string().trim().min(2).max(10000).required(),
  classGrade: Joi.string().trim().required(),
  section: Joi.string().trim().required(),
  studentId: objectId.optional(),
  attachments: Joi.array().items(objectId).optional(),
});

const updateDiarySchema = createDiarySchema.fork(
  ['title', 'content', 'classGrade', 'section'],
  (schema) => schema.optional()
);

const diaryQuerySchema = Joi.object({
  ...paginationQuery,
  classGrade: Joi.string().trim().optional(),
  section: Joi.string().trim().optional(),
  studentId: objectId.optional(),
});

const studentIdQuerySchema = Joi.object({
  studentId: objectId.optional().allow('', null, 'undefined'),
}).unknown(true);

const schoolBankSchema = Joi.object({
  accountName: Joi.string().trim().max(120).allow('', null).optional(),
  bankName: Joi.string().trim().max(120).allow('', null).optional(),
  branch: Joi.string().trim().max(120).allow('', null).optional(),
  accountNumber: Joi.string().trim().allow('', null).optional()
    .custom((val, helper) => {
      if (!val || !String(val).trim()) return undefined;
      const clean = String(val).replace(/\s+/g, '');
      if (!/^\d{8,20}$/.test(clean)) {
        return helper.message('Account number must be 8-20 digits');
      }
      return clean;
    }),
  ifsc: Joi.string().trim().uppercase().allow('', null).optional()
    .custom((val, helper) => {
      if (!val || !String(val).trim()) return undefined;
      const clean = String(val).trim().toUpperCase().replace(/\s+/g, '');
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean)) {
        return helper.message('IFSC must be 11 characters (e.g. HDFC0001234)');
      }
      return clean;
    }),
}).min(1);

const schoolPayoutSchema = Joi.object({
  amountPaise: Joi.number().integer().min(100).required(),
});

module.exports = {
  paginationQuery: Joi.object(paginationQuery),
  vendorDirectoryQuery,
  schoolBankSchema,
  schoolPayoutSchema,
  schoolIdParam,
  classGradeParam,
  sectionParam,
  createSchoolSchema,
  updateSchoolSchema,
  createTeacherSchema,
  updateTeacherSchema,
  teacherStatusSchema,
  createClassSchema,
  updateClassSchema,
  createSectionSchema,
  updateSectionSchema,
  assignStudentsSchema,
  createStudentSchema,
  updateStudentSchema,
  transferStudentSchema,
  studentStatusSchema,
  subjectSchema,
  assignSubjectSchema,
  markAttendanceSchema,
  attendanceQuerySchema,
  monthlyAttendanceQuerySchema,
  timetableSlotSchema,
  timetableQuerySchema,
  upsertAssignmentSchema,
  removeAssignmentQuerySchema,
  updateSubjectSchema: subjectSchema.fork(['code'], (schema) => schema.optional()),
  updateAttendanceSchema: Joi.object({
    status: attendanceStatus.optional(),
    remarks: Joi.string().trim().max(300).optional().allow('', null),
  }).min(1),
  teacherIdParam: schoolIdParam.keys({ teacherId: Joi.string().trim().required() }),
  studentIdParam: schoolIdParam.keys({ studentId: Joi.string().trim().required() }),
  subjectCodeParam: schoolIdParam.keys({ code: Joi.string().trim().required() }),
  slotIdParam: schoolIdParam.keys({ slotId: Joi.string().trim().required() }),
  attendanceIdParam: schoolIdParam.keys({ attendanceId: Joi.string().trim().required() }),
  noticeIdParam: schoolIdParam.keys({ noticeId: Joi.string().trim().required() }),
  diaryIdParam: schoolIdParam.keys({ entryId: Joi.string().trim().required() }),
  createNoticeSchema,
  updateNoticeSchema,
  noticeStatusSchema,
  noticeQuerySchema,
  createDiarySchema,
  updateDiarySchema,
  diaryQuerySchema,
  studentIdQuerySchema,
  studentQuerySchema: Joi.object({
    ...paginationQuery,
    classGrade: Joi.string().trim().optional(),
    section: Joi.string().trim().optional(),
    status: Joi.string().trim().optional(),
  }).unknown(true),
  updateParentSchema: Joi.object({
    name: Joi.string().trim().min(2).max(80).optional(),
    email: schemas.email.optional().allow('', null),
    phone: schemas.indianMobile.optional(),
  }),
  parentIdParam: schoolIdParam.keys({ parentId: objectId.required() }),
  resendParentWelcomeSchema: Joi.object({
    parentIds: Joi.array().items(objectId).min(1).max(200).required(),
  }),
};
