import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Clock, Bookmark, Edit2,
  Tag, Flag, FileText, Paperclip, Info, BookOpen,
  Trash2, Plus, Save, File, Check, Loader2, Award, Lock, Image, Camera
} from 'lucide-react';
import { createAssignment, updateAssignment, fetchSubmissionAttachment } from '../../../services/lmsApi';
import { getErrorMessage } from '../../../utils/apiHelpers';
import { parseClassGrade, parseSection } from '../../../utils/mappers/teacherMapper';
import { ensureCourse } from '../../../utils/teacherApiHelpers';
import { useAuthUser, useTeacherSchoolId } from '../../../utils/teacherContext';
import { useTeacherClassOptions } from '../../../hooks/useTeacherClassOptions';
import { filesToCompressedDataUrls, validateSubmissionFiles } from '../../../utils/fileUpload';

// <input type="date"> wants "yyyy-mm-dd"; assignment dates come back as full ISO strings.
const toDateInputValue = (value) => {
  if (!value) return '';
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : str;
};

const TeacherHomework = () => {
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const location = useLocation();
  const schoolId = useTeacherSchoolId();
  const authUser = useAuthUser();
  const {
    classLabels,
    getSections,
    getSubjects,
    loading: optionsLoading,
  } = useTeacherClassOptions(schoolId);
  const fileInputRef = React.useRef(null);
  const cameraFileInputRef = React.useRef(null);

  // Editing an existing homework arrives with its data via navigation state
  // (set by the Manage Homework list) — there is no other way to reach this
  // route, so a missing payload means a direct/refreshed visit we can't serve.
  const editingHomework = location.state?.homework || null;
  const isEdit = Boolean(assignmentId);
  const editDataMissing = isEdit && !editingHomework;

  const [selectedClass, setSelectedClass] = useState(() => editingHomework?.classGrade || '');
  const [selectedSection, setSelectedSection] = useState(() => editingHomework?.section || '');
  const [subject, setSubject] = useState(() => editingHomework?.subject || '');
  const [title, setTitle] = useState(() => editingHomework?.title || '');

  // Only the subjects this teacher was actually assigned for the selected
  // class + section — not the school's full subject catalog. Fixed once a
  // homework already exists; changing subject means a different course.
  const subjectsList = getSubjects(selectedClass, selectedSection);

  useEffect(() => {
    if (isEdit) return;
    if (subjectsList.length > 0) {
      setSubject((prev) => (prev && subjectsList.includes(prev) ? prev : subjectsList[0]));
    } else {
      setSubject('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, selectedClass, selectedSection, subjectsList.join('|')]);

  const [dateAssigned, setDateAssigned] = useState(() => toDateInputValue(editingHomework?.assignedDate));
  const [dueDate, setDueDate] = useState(() => toDateInputValue(editingHomework?.dueDate));

  const [homeworkType, setHomeworkType] = useState(() => editingHomework?.homeworkType || 'Written');
  const [priority, setPriority] = useState(() => editingHomework?.priority || 'High');
  // The score the teacher grades out of. Previously fixed at 100, which made it
  // impossible to set homework marked out of anything else.
  const [maxScore, setMaxScore] = useState(() => String(editingHomework?.maxScore ?? '100'));

  const [description, setDescription] = useState(() => editingHomework?.description || '');
  const [instructions, setInstructions] = useState(() => editingHomework?.instructions || '');

  const [textbook, setTextbook] = useState(() => editingHomework?.reference?.textbook || '');
  const [chapter, setChapter] = useState(() => editingHomework?.reference?.chapter || '');

  // Attachments Mock State (Starts empty)
  const [attachments, setAttachments] = useState([]);

  // Homework Banner Image State & Ref
  const bannerInputRef = React.useRef(null);
  const cameraBannerInputRef = React.useRef(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [loadingBanner, setLoadingBanner] = useState(false);
  // The banner already on this homework (edit mode only) — kept separate from
  // `bannerFile` so we know whether a save with no new file means "leave it alone" or
  // "the parent explicitly cleared it".
  const existingBannerId = editingHomework?.bannerAttachmentId || null;
  const [bannerRemoved, setBannerRemoved] = useState(false);

  // Preload the current banner for preview when editing. Fetched through the same
  // authorized endpoint the parent view uses, since submission/homework attachments
  // are never served statically.
  useEffect(() => {
    if (!isEdit || !existingBannerId || !schoolId || bannerFile || bannerRemoved) return undefined;

    let cancelled = false;
    let objectUrl = null;
    setLoadingBanner(true);
    (async () => {
      try {
        const url = await fetchSubmissionAttachment(schoolId, existingBannerId);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setBannerPreview(url);
      } catch {
        if (!cancelled) setBannerPreview('');
      } finally {
        if (!cancelled) setLoadingBanner(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isEdit, existingBannerId, schoolId, bannerFile, bannerRemoved]);

  const [showToast, setShowToast] = useState(false);
  const [savedAsDraft, setSavedAsDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const classes = classLabels;
  const sections = getSections(selectedClass);
  const subjects = subjectsList;
  const homeworkTypes = ['Written', 'Reading', 'Project', 'Online Quiz'];
  const priorities = ['High', 'Medium', 'Low'];

  // 2. Dropdown Toggles
  const [isClassOpen, setIsClassOpen] = useState(false);
  const [isSectionOpen, setIsSectionOpen] = useState(false);
  const [isSubjectOpen, setIsSubjectOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);

  // Handlers
  const handleDeleteAttachment = (id) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const handleBannerSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Banner must be an image file (JPG, PNG, WEBP, etc.)');
      return;
    }
    setError('');
    setBannerFile(file);
    setBannerRemoved(false);
    const reader = new FileReader();
    reader.onload = () => setBannerPreview(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveBanner = () => {
    setBannerFile(null);
    setBannerPreview('');
    // In edit mode, removing a banner that was already saved must tell the server to
    // clear it — leaving both flags false would just make the preload effect fetch it
    // right back.
    if (isEdit && existingBannerId) setBannerRemoved(true);
  };

  useEffect(() => {
    if (isEdit) return;
    if (classLabels.length > 0 && !selectedClass) {
      setSelectedClass(classLabels[0]);
      const secs = getSections(classLabels[0]);
      if (secs.length > 0) setSelectedSection(secs[0]);
    }
  }, [isEdit, classLabels, getSections, selectedClass]);

  const handleAddAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleAttachmentSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validationError = validateSubmissionFiles([
      ...attachments.map((att) => att.file),
      ...files,
    ]);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    const newAttachments = files.map((file, idx) => ({
      id: Date.now() + idx,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      file,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const handleAddHomework = async (e, desiredStatus = 'published') => {
    if (e?.preventDefault) e.preventDefault();
    if (editDataMissing) return;
    if (!title.trim()) {
      setError('Please enter a homework title');
      return;
    }
    if (!schoolId) {
      setError('School context is missing. Please log in again.');
      return;
    }
    // Distinguish "no class at all" from "class but no subject": they need different
    // things from the school admin, and the old shared message named neither.
    if (!selectedClass) {
      setError(
        'You are not assigned to any class yet. Ask your school admin to assign you a class and section.'
      );
      return;
    }
    if (!subject) {
      setError(
        `You aren't assigned any subject for ${selectedClass}${selectedSection ? ` / ${selectedSection}` : ''}. Ask your school admin to add one.`
      );
      return;
    }

    const parsedMaxScore = Number(maxScore);
    if (!Number.isFinite(parsedMaxScore) || parsedMaxScore <= 0) {
      setError('Enter the marks this homework is out of');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const reference = {
        ...(textbook.trim() ? { textbook: textbook.trim() } : {}),
        ...(chapter.trim() ? { chapter: chapter.trim() } : {}),
      };

      // The banner is uploaded and validated on its own — it must never share the
      // attachments' 5-file cap, and a stray non-image file here can't silently end up
      // filed as a reference attachment (or vice versa).
      const bannerFileEncoded = bannerFile ? (await filesToCompressedDataUrls([bannerFile]))[0] : undefined;

      if (isEdit) {
        // Class, section and subject pin down which course the homework
        // belongs to — those are fixed at creation, so only the rest changes.
        await updateAssignment(schoolId, assignmentId, {
          title: title.trim(),
          description: description.trim() || undefined,
          instructions: instructions.trim() || undefined,
          dueDate: dueDate || undefined,
          assignedDate: dateAssigned || undefined,
          homeworkType,
          priority,
          ...(Object.keys(reference).length ? { reference } : {}),
          maxScore: parsedMaxScore,
          ...(bannerFileEncoded ? { bannerFile: bannerFileEncoded } : {}),
          ...(!bannerFileEncoded && bannerRemoved ? { removeBanner: true } : {}),
        });

        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
          navigate('/school/teacher/homework/manage');
        }, 1500);
        return;
      }

      const classGrade = parseClassGrade(selectedClass);
      const section = parseSection(selectedSection);
      const attachmentFiles = attachments.map((att) => att.file).filter(Boolean);
      const files = await filesToCompressedDataUrls(attachmentFiles);

      await createAssignment(schoolId, {
        title: title.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        dueDate: dueDate || undefined,
        assignedDate: dateAssigned || undefined,
        classGrade,
        section,
        subject,
        homeworkType,
        priority,
        ...(Object.keys(reference).length ? { reference } : {}),
        maxScore: parsedMaxScore,
        status: desiredStatus,
        files,
        ...(bannerFileEncoded ? { bannerFile: bannerFileEncoded } : {}),
      });

      setSavedAsDraft(desiredStatus === 'draft');
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        navigate(desiredStatus === 'draft' ? '/school/teacher/homework/manage' : '/school/teacher/dashboard');
      }, 2000);
    } catch (err) {
      setError(getErrorMessage(err, isEdit ? 'Unable to update homework' : 'Unable to add homework'));
    } finally {
      setSaving(false);
    }
  };

  // Helper: Format nice day left subtext
  const getDaysLeft = () => {
    if (!dateAssigned || !dueDate) return '';
    const d1 = new Date(dateAssigned);
    const d2 = new Date(dueDate);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `( ${diffDays} DAYS LEFT )`;
  };

  if (editDataMissing) {
    return (
      <div className="flex flex-col items-center justify-center bg-gray-50 min-h-screen select-none font-outfit px-6 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center">
          <BookOpen size={24} className="text-primary" />
        </div>
        <p className="text-xs font-bold text-gray-500 max-w-xs">
          Open this homework from Manage Homework to edit it.
        </p>
        <button
          onClick={() => navigate('/school/teacher/homework/manage')}
          className="px-6 py-3 bg-primary text-white rounded-2xl text-xs font-black shadow-lg shadow-purple-100"
        >
          Go to Manage Homework
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-gray-50 min-h-screen select-none font-outfit animate-in fade-in duration-300 pb-28 relative">

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-[100] bg-emerald-600 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-6 duration-300">
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
            <Check size={14} strokeWidth={3} />
          </div>
          <span className="text-xs font-black">
            {isEdit ? 'Homework Updated Successfully!' : savedAsDraft ? 'Saved as Draft!' : 'Homework Published Successfully!'}
          </span>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="px-6 pt-7 pb-4 bg-white flex items-center border-b border-gray-100 relative z-30">
        <button
          onClick={() => navigate(isEdit ? '/school/teacher/homework/manage' : '/school/teacher/dashboard')}
          className="w-10 h-10 bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex items-center justify-center text-deep-purple mr-4"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <h1 className="text-lg font-black text-deep-purple leading-none">{isEdit ? 'Edit Homework' : 'Add Homework'}</h1>
      </div>

      <form onSubmit={handleAddHomework} className="space-y-4 px-6 mt-4 relative z-20">
        {error && (
          <div className="px-4 py-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-600">
            {error}
          </div>
        )}

        {/* A teacher with no class assignment gets an empty Class dropdown and a form
            that refuses to save, with nothing saying why — so it reads as a broken app
            and never gets reported to the school. On the live data this silently took a
            whole school off the air: its only teacher had no assignment, so not one
            piece of homework was ever published and every parent there saw an empty
            page. Name the cause and who fixes it. */}
        {!isEdit && !optionsLoading && classLabels.length === 0 && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl text-[11px] font-bold text-amber-700">
            You are not assigned to any class yet, so homework cannot be created. Ask your
            school admin to assign you a class and section under Class &amp; Teacher
            Assignments.
          </div>
        )}

        {/* 2. Class & Section Dropdown Selectors */}
        <div className="grid grid-cols-2 gap-4">
          {/* Class Dropdown */}
          <div className="relative">
            <label className="text-[10px] font-bold text-gray-400 block mb-1">Class</label>
            <button
              type="button"
              disabled={isEdit}
              onClick={() => { setIsClassOpen(!isClassOpen); setIsSectionOpen(false); }}
              className={`w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-left flex items-center justify-between shadow-sm transition-all ${isEdit ? 'opacity-60' : 'hover:border-primary/20 active:bg-gray-50'}`}
            >
              <span className={`text-xs font-black ${selectedClass ? 'text-deep-purple' : 'text-gray-400'}`}>
                {selectedClass || (optionsLoading ? 'Loading…' : 'No class assigned')}
              </span>
              {isEdit ? <Lock size={12} className="text-gray-400" /> : <span className="text-gray-400 text-xs">▼</span>}
            </button>
            {isClassOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsClassOpen(false)} />
                <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {classes.length === 0 && (
                    <p className="px-4 py-2.5 text-[11px] font-bold text-gray-400">
                      No classes assigned to you yet.
                    </p>
                  )}
                  {classes.map(cls => (
                    <button 
                      key={cls}
                      type="button"
                      onClick={() => { setSelectedClass(cls); setIsClassOpen(false); }}
                      className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-all ${selectedClass === cls ? 'text-primary bg-primary/5 font-black' : 'text-deep-purple hover:bg-gray-50'}`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Section Dropdown */}
          <div className="relative">
            <label className="text-[10px] font-bold text-gray-400 block mb-1">Section</label>
            <button
              type="button"
              disabled={isEdit}
              onClick={() => { setIsSectionOpen(!isSectionOpen); setIsClassOpen(false); }}
              className={`w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-left flex items-center justify-between shadow-sm transition-all ${isEdit ? 'opacity-60' : 'hover:border-primary/20 active:bg-gray-50'}`}
            >
              <span className="text-xs font-black text-deep-purple">{selectedSection}</span>
              {isEdit ? <Lock size={12} className="text-gray-400" /> : <span className="text-gray-400 text-xs">▼</span>}
            </button>
            {isSectionOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsSectionOpen(false)} />
                <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {sections.map(sec => (
                    <button 
                      key={sec}
                      type="button"
                      onClick={() => { setSelectedSection(sec); setIsSectionOpen(false); }}
                      className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-all ${selectedSection === sec ? 'text-primary bg-primary/5 font-black' : 'text-deep-purple hover:bg-gray-50'}`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 3. Subject Selector */}
        <div className="relative">
          <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <Bookmark size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-bold text-gray-400 block leading-none">Subject *</span>
              <button
                type="button"
                disabled={isEdit}
                onClick={() => setIsSubjectOpen(!isSubjectOpen)}
                className="w-full text-left text-xs font-black text-deep-purple mt-1 flex items-center justify-between"
              >
                <span>{subject || 'No subject assigned'}</span>
                {isEdit ? <Lock size={12} className="text-gray-400 mr-1" /> : <span className="text-gray-400 text-xs mr-1">▼</span>}
              </button>
            </div>
          </div>
          {isEdit && (
            <span className="text-[9px] font-bold text-gray-400 block mt-1.5 pl-1">
              Class, section &amp; subject can&apos;t be changed after creation — delete and re-add if needed.
            </span>
          )}
          {!isEdit && isSubjectOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsSubjectOpen(false)} />
              <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                {subjects.length === 0 && (
                  <span className="block px-4 py-2.5 text-[10px] font-bold text-gray-400">
                    You aren't assigned any subject for this class &amp; section.
                  </span>
                )}
                {subjects.map(sub => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => { setSubject(sub); setIsSubjectOpen(false); }}
                    className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-all ${subject === sub ? 'text-primary bg-primary/5 font-black' : 'text-deep-purple hover:bg-gray-50'}`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 4. Homework Title */}
        <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <Edit2 size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-bold text-gray-400 block leading-none mb-1">Homework Title *</span>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full text-xs font-black text-deep-purple focus:outline-none placeholder-gray-400"
              placeholder="e.g. Fractions Worksheet"
            />
          </div>
        </div>

        {/* 5. Assigned Date & Due Date Fields */}
        <div className="grid grid-cols-2 gap-4">
          {/* Assigned Date */}
          <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-2.5 shadow-sm relative">
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <Calendar size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-bold text-gray-400 block leading-none">Date Assigned *</span>
              <input 
                type="date"
                value={dateAssigned}
                onChange={(e) => setDateAssigned(e.target.value)}
                required
                className="w-full text-[10px] font-black text-deep-purple mt-1 focus:outline-none bg-transparent"
              />
            </div>
          </div>

          {/* Due Date */}
          <div className="bg-white border border-gray-200 rounded-2xl p-3 flex flex-col justify-between shadow-sm relative">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <Clock size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold text-gray-400 block leading-none">Due Date *</span>
                <input 
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="w-full text-[10px] font-black text-deep-purple mt-1 focus:outline-none bg-transparent"
                />
              </div>
            </div>
            {dateAssigned && dueDate && (
              <span className="text-[8px] font-black text-amber-500 uppercase tracking-wider block mt-1.5 pl-0.5">
                {getDaysLeft()}
              </span>
            )}
          </div>
        </div>

        {/* 5b. Marks this homework is graded out of */}
        <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-2.5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <Award size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-bold text-gray-400 block leading-none">Total Marks *</span>
            <input
              type="number"
              min={1}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              required
              className="w-full text-xs font-black text-deep-purple mt-1 focus:outline-none bg-transparent"
              placeholder="e.g. 20"
            />
          </div>
        </div>

        {/* 6. Type and Priority Selectors */}
        <div className="grid grid-cols-2 gap-4">
          {/* Homework Type Dropdown */}
          <div className="relative">
            <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-2.5 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <Tag size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold text-gray-400 block leading-none">Homework Type *</span>
                <button 
                  type="button"
                  onClick={() => { setIsTypeOpen(!isTypeOpen); setIsPriorityOpen(false); }}
                  className="w-full text-left text-[11px] font-black text-deep-purple mt-1 flex items-center justify-between"
                >
                  <span className="truncate">{homeworkType}</span>
                  <span className="text-gray-400 text-[10px] ml-1">▼</span>
                </button>
              </div>
            </div>
            {isTypeOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsTypeOpen(false)} />
                <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {homeworkTypes.map(type => (
                    <button 
                      key={type}
                      type="button"
                      onClick={() => { setHomeworkType(type); setIsTypeOpen(false); }}
                      className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-all ${homeworkType === type ? 'text-primary bg-primary/5 font-black' : 'text-deep-purple hover:bg-gray-50'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Priority Dropdown */}
          <div className="relative">
            <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-2.5 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <Flag size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold text-gray-400 block leading-none">Priority *</span>
                <button 
                  type="button"
                  onClick={() => { setIsPriorityOpen(!isPriorityOpen); setIsTypeOpen(false); }}
                  className="w-full text-left text-[11px] font-black text-deep-purple mt-1 flex items-center justify-between"
                >
                  <span className="truncate">{priority}</span>
                  <span className="text-gray-400 text-[10px] ml-1">▼</span>
                </button>
              </div>
            </div>
            {isPriorityOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsPriorityOpen(false)} />
                <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {priorities.map(prio => (
                    <button 
                      key={prio}
                      type="button"
                      onClick={() => { setPriority(prio); setIsPriorityOpen(false); }}
                      className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-all ${priority === prio ? 'text-primary bg-primary/5 font-black' : 'text-deep-purple hover:bg-gray-50'}`}
                    >
                      {prio}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 6b. Homework Banner Image Upload */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <Image size={18} className="text-primary" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 block leading-none">Homework Banner Image</span>
              <span className="text-[8px] text-gray-400 mt-1 block">Upload a banner image to display on student/parent portal</span>
            </div>
          </div>

          <input
            ref={bannerInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={handleBannerSelect}
          />
          {/* capture="environment" opens the device's camera app directly on
              mobile; desktop browsers that don't support it fall back to the
              normal file picker, same as the input above. */}
          <input
            ref={cameraBannerInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            capture="environment"
            className="hidden"
            onChange={handleBannerSelect}
          />

          {loadingBanner ? (
            <div className="w-full h-40 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : bannerPreview ? (
            <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-gray-200 group">
              <img src={bannerPreview} alt="Homework Banner Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => cameraBannerInputRef.current?.click()}
                className="absolute top-2.5 right-11 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-primary transition-colors shadow-md"
                title="Take a new photo"
              >
                <Camera size={14} />
              </button>
              <button
                type="button"
                onClick={handleRemoveBanner}
                className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                title="Remove Banner"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => cameraBannerInputRef.current?.click()}
                className="py-6 border-2 border-dashed border-purple-200 hover:border-primary active:scale-[0.99] transition-all rounded-2xl flex flex-col items-center justify-center gap-2 text-xs font-bold text-primary bg-purple-50/50 hover:bg-purple-50"
              >
                <Camera size={22} className="text-primary/70" />
                <span className="font-black text-xs">Take Photo</span>
              </button>
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="py-6 border-2 border-dashed border-purple-200 hover:border-primary active:scale-[0.99] transition-all rounded-2xl flex flex-col items-center justify-center gap-2 text-xs font-bold text-primary bg-purple-50/50 hover:bg-purple-50"
              >
                <Image size={22} className="text-primary/70" />
                <span className="font-black text-xs">Choose File</span>
              </button>
            </div>
          )}
        </div>

        {/* 7. Homework Description */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-primary" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 block leading-none">Homework Description *</span>
              <span className="text-[8px] text-gray-400 mt-1 block">Describe the homework details</span>
            </div>
          </div>
          
          <div className="relative">
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              required
              className="w-full p-4 bg-gray-50/50 border border-gray-150 focus:border-primary/20 focus:outline-none rounded-2xl text-xs font-bold text-deep-purple placeholder-gray-400 h-28 resize-none transition-all"
              placeholder="Enter comprehensive homework description..."
            />
            <span className="absolute bottom-3.5 right-4 text-[9px] font-bold text-gray-400">
              {description.length}/500
            </span>
          </div>
        </div>

        {/* 8. Attachments */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <Paperclip size={18} className="text-primary" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 block leading-none">Attachments</span>
              <span className="text-[8px] text-gray-400 mt-1 block">Upload helpful references or PDFs</span>
            </div>
          </div>

          {isEdit ? (
            <p className="text-[10px] font-bold text-gray-400">
              {editingHomework?.attachmentsCount > 0
                ? `${editingHomework.attachmentsCount} attachment(s) on this homework. Attachments can't be changed after creation.`
                : "No attachments on this homework. Attachments can't be added after creation."}
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between bg-red-50/60 border border-red-100 rounded-xl px-3 py-2 flex-1 min-w-[160px] max-w-[220px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <File size={16} className="text-red-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-deep-purple truncate">{att.name}</p>
                          <p className="text-[8px] text-gray-400 font-bold leading-none mt-0.5">{att.size}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="text-red-400 hover:text-red-600 active:scale-90 transition-all p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx"
                className="hidden"
                onChange={handleAttachmentSelected}
              />
              {/* capture="environment" opens the device's camera app directly on
                  mobile; desktop browsers that don't support it fall back to the
                  normal file picker, same as the input above. Camera capture is
                  image-only, unlike the file picker which also accepts PDFs/docs. */}
              <input
                ref={cameraFileInputRef}
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp"
                capture="environment"
                className="hidden"
                onChange={handleAttachmentSelected}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cameraFileInputRef.current?.click()}
                  className="py-2 px-3 border border-dashed border-primary/45 hover:border-primary active:scale-95 transition-all rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black text-primary bg-primary/5 shadow-sm"
                >
                  <Camera size={14} strokeWidth={2.5} />
                  <span>Take Photo</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="py-2 px-3 border border-dashed border-primary/45 hover:border-primary active:scale-95 transition-all rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black text-primary bg-primary/5 shadow-sm"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Add More</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 9. Instructions for Students */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <Info size={18} className="text-primary" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 block leading-none">Instructions for Students</span>
              <span className="text-[8px] text-gray-400 mt-1 block">Helpful guidance points</span>
            </div>
          </div>
          
          <div className="relative">
            <textarea 
              value={instructions}
              onChange={(e) => setInstructions(e.target.value.slice(0, 500))}
              className="w-full p-4 bg-gray-50/50 border border-gray-150 focus:border-primary/20 focus:outline-none rounded-2xl text-xs font-bold text-deep-purple placeholder-gray-400 h-28 resize-none transition-all"
              placeholder="e.g. • Show all working steps..."
            />
            <span className="absolute bottom-3.5 right-4 text-[9px] font-bold text-gray-400">
              {instructions.length}/500
            </span>
          </div>
        </div>

        {/* 10. Reference (Optional) */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-primary" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 block leading-none">Reference (Optional)</span>
              <span className="text-[8px] text-gray-400 mt-1 block">Textbook or chapter names</span>
            </div>
          </div>
          
          <div className="space-y-2.5 pt-1">
            <div>
              <label className="text-[9px] font-bold text-gray-400 block mb-1">Textbook</label>
              <input 
                type="text" 
                value={textbook}
                onChange={(e) => setTextbook(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/50 border border-gray-150 focus:border-primary/20 focus:outline-none rounded-xl text-xs font-bold text-deep-purple"
                placeholder="e.g. Mathematics - Grade 5"
              />
            </div>
            
            <div>
              <label className="text-[9px] font-bold text-gray-400 block mb-1">Chapter (Optional)</label>
              <input 
                type="text" 
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/50 border border-gray-150 focus:border-primary/20 focus:outline-none rounded-xl text-xs font-bold text-deep-purple"
                placeholder="e.g. Fractions and Decimals"
              />
            </div>
          </div>
        </div>

      </form>

      {/* 11. Primary Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 p-4 z-40 flex gap-3">
        {!isEdit && (
          <button
            type="button"
            onClick={(e) => handleAddHomework(e, 'draft')}
            disabled={saving}
            className="flex-1 py-4 border border-gray-200 text-deep-purple hover:bg-gray-50 active:scale-98 transition-all rounded-[1.8rem] text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <span>Save as Draft</span>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => handleAddHomework(e, 'published')}
          disabled={saving}
          className="flex-1 py-4 bg-primary text-white hover:bg-deep-purple active:scale-98 transition-all rounded-[1.8rem] text-sm font-black shadow-lg shadow-purple-100 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={2.5} />}
          <span>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Publish Homework'}</span>
        </button>
      </div>

    </div>
  );
};

export default TeacherHomework;
