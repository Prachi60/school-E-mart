/**
 * READ-ONLY. For every teacher, reproduce exactly what their "Add Homework" form
 * would offer: the class list the API returns for THEM (listClasses with their userId,
 * the way school.controller does it), then the frontend's own getSubjects() logic.
 * A teacher whose subject list is empty is blocked by the form and can publish nothing.
 */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');
const notDeleted = { 'softDelete.isDeleted': { $ne: true } };

// verbatim from frontend/src/utils/mappers/teacherMapper.js + useTeacherClassOptions.js
const parseClassGrade = (v) => String(v || '').replace(/^class\s*/i, '').trim();
const feGetSections = (rawClasses, selectedClass) => {
  const m = rawClasses.find((c) => parseClassGrade(c.classGrade) === selectedClass);
  return (m && m.sections && m.sections.length ? m.sections : []).map((s) =>
    String(s).replace(/^section\s*/i, '').trim().toUpperCase());
};
const feGetSubjects = (rawClasses, selectedClass, selectedSection) => {
  const m = rawClasses.find((c) => parseClassGrade(c.classGrade) === selectedClass);
  if (!m || !selectedSection) return [];
  const raw = Object.keys(m.subjectsBySection || {}).find(
    (s) => String(s).replace(/^section\s*/i, '').trim().toUpperCase() === selectedSection);
  return raw ? m.subjectsBySection[raw] || [] : [];
};

(async () => {
  await connectLive();
  require('../../src/database/modelRegistry');
  const School = mongoose.model('School');
  const User = mongoose.model('User');
  const TeacherProfile = mongoose.model('TeacherProfile');
  const Student = mongoose.model('Student');
  const classService = require('../../src/modules/school/services/class.service');

  const schools = new Map((await School.find(notDeleted).select('_id name').lean()).map((s) => [String(s._id), s.name]));

  for (const tp of await TeacherProfile.find(notDeleted).lean()) {
    const u = await User.findById(tp.userId).select('name email').lean();
    const classes = await classService.listClasses(tp.schoolId, { userId: tp.userId });
    console.log(`\n${u && u.name} <${u && u.email}> @ ${schools.get(String(tp.schoolId))}`);
    if (!classes.length) {
      console.log('   FORM: class dropdown is EMPTY -> cannot create homework for anyone');
      continue;
    }
    for (const c of classes) {
      const label = parseClassGrade(c.classGrade);
      const sections = feGetSections(classes, label);
      if (!sections.length) { console.log(`   ${label}: no sections -> blocked`); continue; }
      for (const sec of sections) {
        const subs = feGetSubjects(classes, label, sec);
        const roster = await Student.countDocuments({ schoolId: tp.schoolId, classGrade: c.classGrade, status: 'active', ...notDeleted });
        const verdict = subs.length ? 'CAN PUBLISH' : '*** BLOCKED: subject dropdown empty ***';
        console.log(`   ${label}/${sec}: subjects=${JSON.stringify(subs)}  rosterStudents=${roster}  -> ${verdict}`);
      }
    }
  }
  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); await mongoose.disconnect(); process.exit(1); });
