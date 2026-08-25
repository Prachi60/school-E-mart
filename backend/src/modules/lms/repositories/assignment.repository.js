const LmsAssignment = require('../../../database/models/LmsAssignment');
const LmsAssignmentSubmission = require('../../../database/models/LmsAssignmentSubmission');
const { BaseRepository } = require('../../../repositories');
const { executePaginatedQuery } = require('../../../repositories/query');

// The teacher and the parent both need the actual files, not the attachment ids.
const ATTACHMENT_FIELDS = 'storageKey mime sizeBytes purpose';

class AssignmentRepository extends BaseRepository {
  constructor() {
    super(LmsAssignment);
  }

  paginateAssignments(filter, queryString, options = {}) {
    return executePaginatedQuery(LmsAssignment, this.mergeFilter(filter), queryString, {
      defaultSort: '-dueDate',
      populate: [
        { path: 'attachments', select: ATTACHMENT_FIELDS },
        { path: 'bannerAttachmentId', select: ATTACHMENT_FIELDS },
      ],
      ...options,
    });
  }

  findOnePopulated(filter) {
    return LmsAssignment.findOne(this.mergeFilter(filter))
      .populate('attachments', ATTACHMENT_FIELDS)
      .populate('bannerAttachmentId', ATTACHMENT_FIELDS)
      .lean();
  }

  findManyPopulated(filter, { sort = null, limit = 0 } = {}) {
    const query = LmsAssignment.find(this.mergeFilter(filter))
      .populate('attachments', ATTACHMENT_FIELDS)
      .populate('bannerAttachmentId', ATTACHMENT_FIELDS);
    if (sort) query.sort(sort);
    if (limit) query.limit(limit);
    return query.lean();
  }

  /**
   * The class-grade strings a school has actually filed homework under.
   *
   * classGrade is free text ("5", "Class 5", "PLAY GROUP"), so the only way to narrow
   * the feed query on it — rather than reading the whole school's homework and
   * discarding most of it in memory — is to see which spellings exist and match on the
   * normalized form. The set is tiny: one entry per class the school teaches.
   */
  distinctClassGrades(filter) {
    return LmsAssignment.distinct('classGrade', this.mergeFilter(filter));
  }

  /**
   * The section strings a school has actually filed homework under.
   *
   * Same reasoning as distinctClassGrades: section is free text ("A", "a",
   * "Section A"), so the only way to narrow a query on it is to match the normalized
   * form against the spellings that exist. One entry per section the school teaches.
   */
  distinctSections(filter) {
    return LmsAssignment.distinct('section', this.mergeFilter(filter));
  }
}

class AssignmentSubmissionRepository extends BaseRepository {
  constructor() {
    super(LmsAssignmentSubmission, { useSoftDelete: false });
  }

  findByAssignmentAndStudent(assignmentId, studentId, { populate = false } = {}) {
    if (!populate) return this.findOne({ assignmentId, studentId });
    return LmsAssignmentSubmission.findOne({ assignmentId, studentId })
      .populate('attachments', ATTACHMENT_FIELDS)
      .lean();
  }

  findAllPopulated(filter) {
    return LmsAssignmentSubmission.find(filter)
      .populate('attachments', ATTACHMENT_FIELDS)
      .lean();
  }

  paginateSubmissions(filter, queryString, options = {}) {
    return executePaginatedQuery(LmsAssignmentSubmission, filter, queryString, {
      defaultSort: '-submittedAt',
      populate: { path: 'attachments', select: ATTACHMENT_FIELDS },
      ...options,
    });
  }
}

module.exports = {
  assignmentRepository: new AssignmentRepository(),
  assignmentSubmissionRepository: new AssignmentSubmissionRepository(),
};
