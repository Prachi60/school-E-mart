const Student = require('../../../database/models/Student');
const ChildProfile = require('../../../database/models/ChildProfile');
const ParentProfile = require('../../../database/models/ParentProfile');
const { BaseRepository } = require('../../../repositories');
const { executePaginatedQuery } = require('../../../repositories/query');

const notDeleted = { 'softDelete.isDeleted': { $ne: true } };

class StudentRepository extends BaseRepository {
  constructor() {
    super(Student);
  }

  /**
   * Every roster student at this school that belongs to one parent.
   *
   * A parent is linked to a child in two independent ways and both are load-bearing:
   * `ChildProfile.studentId` (what the school's own linking flow and self-registration
   * produce) and `Student.parentProfileIds` (what the admin student form writes). A
   * lookup that knows only one of them answers "you have no children" for accounts the
   * rest of the app can see perfectly well — the attendance history read only
   * ParentProfile, so parents got an empty page while the push notification about that
   * very record reached them, because notifications resolve both.
   *
   * Returns [] for a parent with no children here. That is an ordinary answer — a
   * shop-only account, or a child the school has not rostered yet — never an error, so
   * callers scope to an empty set instead of failing the whole request.
   */
  async findChildStudentIdsForParent(schoolId, userId) {
    if (!schoolId || !userId) return [];

    const [children, parentProfile] = await Promise.all([
      ChildProfile.find({ parentUserId: userId, ...notDeleted }).select('studentId').lean(),
      ParentProfile.findOne({ userId, ...notDeleted }).select('_id').lean(),
    ]);

    const linkedIds = children.map((child) => child.studentId).filter(Boolean);

    // Both arms are constrained to this school, so a child at another school can never
    // widen what this parent is allowed to read here.
    const [byChildProfile, byParentProfile] = await Promise.all([
      linkedIds.length
        ? Student.find(this.mergeFilter({ schoolId, _id: { $in: linkedIds } })).select('_id').lean()
        : [],
      parentProfile
        ? Student.find(this.mergeFilter({ schoolId, parentProfileIds: parentProfile._id }))
            .select('_id')
            .lean()
        : [],
    ]);

    const unique = new Map();
    [...byChildProfile, ...byParentProfile].forEach((student) => {
      unique.set(String(student._id), student._id);
    });
    return [...unique.values()];
  }

  paginateStudents(filter, queryString, options = {}) {
    const merged = { ...this.mergeFilter(filter) };
    if (queryString.search) {
      const term = String(queryString.search).trim();
      merged.$or = [
        { name: { $regex: term, $options: 'i' } },
        { schoolRefNo: { $regex: term, $options: 'i' } },
        { rollNo: { $regex: term, $options: 'i' } },
      ];
    }
    const { search, ...restQuery } = queryString;
    return executePaginatedQuery(Student, merged, restQuery, {
      defaultSort: 'name',
      ...options,
    });
  }

  countBySchool(schoolId) {
    return this.count({ schoolId });
  }

  findBySchoolRefNo(schoolId, schoolRefNo) {
    return this.findOne({ schoolId, schoolRefNo });
  }
}

module.exports = new StudentRepository();
