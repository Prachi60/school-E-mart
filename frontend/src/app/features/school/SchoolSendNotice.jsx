import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Clock, History, Megaphone,
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignRight, Link2, Image as ImageIcon,
  Users, GraduationCap, Grid, Upload, FileText,
  X, Info, Send, Save, Check, Loader2, Paperclip, Trash2, Calendar, Camera
} from 'lucide-react';
import { createNotice, listClasses, uploadSchoolFile, listNotices, deleteNotice } from '../../../services/schoolApi';
import { mapAudienceToNoticePayload } from '../../../utils/mappers/parentMapper';
import { parseClassGrade } from '../../../utils/mappers/teacherMapper';
import { getErrorMessage } from '../../../utils/apiHelpers';
import { useSchoolId } from '../../../utils/schoolContext';
import useAuthStore from '../../../store/useAuthStore';

const SchoolSendNotice = () => {
  const navigate = useNavigate();
  const schoolId = useSchoolId();
  const authUser = useAuthStore((state) => state.user);
  const isTeacher = ['teacher', 'TEACHER'].includes(authUser?.role);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState(isTeacher ? 'assigned_all' : 'parents');
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const getInitialScheduledTime = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const [schedule, setSchedule] = useState('now');
  const [scheduledDateTime, setScheduledDateTime] = useState(getInitialScheduledTime());
  const [isSuccess, setIsSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [classesList, setClassesList] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  const [activeTab, setActiveTab] = useState('send'); // 'send' | 'sent_list'
  const [sentNotices, setSentNotices] = useState([]);
  const [loadingSent, setLoadingSent] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      try {
        const list = await listClasses(schoolId);
        setClassesList(list || []);
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    })();
  }, [schoolId]);

  const loadSentNotices = async () => {
    if (!schoolId) return;
    setLoadingSent(true);
    try {
      const res = await listNotices(schoolId, { limit: 100 });
      setSentNotices(res.data || []);
    } catch (err) {
      console.error('Failed to load sent notices:', err);
    } finally {
      setLoadingSent(false);
    }
  };

  useEffect(() => {
    if (schoolId) {
      loadSentNotices();
    }
  }, [schoolId]);

  useEffect(() => {
    if (isTeacher && audience !== 'assigned_all' && audience !== 'specific') {
      setAudience('assigned_all');
    }
  }, [isTeacher, audience]);

  const handleDeleteNotice = async (noticeId) => {
    if (!schoolId || !noticeId) return;
    if (!window.confirm('Are you sure you want to delete this notice?')) return;
    setDeletingId(noticeId);
    try {
      await deleteNotice(schoolId, noticeId);
      setSentNotices(prev => prev.filter(n => (n._id || n.id) !== noticeId));
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to delete notice'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(isTeacher ? '/school/teacher/dashboard' : '/school/admin');
    }
  };

  const handleRemoveAttachment = (id) => {
    setAttachments(attachments.filter(item => item.id !== id));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!schoolId) {
      setError('School context is missing.');
      return;
    }

    setUploadingFile(true);
    setError('');
    try {
      const uploaded = await uploadSchoolFile(schoolId, file, 'notice_attachment');
      const attachmentId = uploaded?._id || uploaded?.id;
      if (attachmentId) {
        setAttachments(prev => [
          ...prev,
          {
            id: attachmentId,
            name: file.name,
            size: `${Math.round(file.size / 1024)} KB`
          }
        ]);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to upload attachment file'));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSendNotice = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Please enter a title and notice content.');
      return;
    }
    if (audience === 'specific' && !selectedClass) {
      setError('Please select a targeted class.');
      return;
    }
    if (schedule === 'later') {
      if (!scheduledDateTime) {
        setError('Please select a date and time for the scheduled notice.');
        return;
      }
      const dateObj = new Date(scheduledDateTime);
      if (isNaN(dateObj.getTime()) || dateObj.getTime() <= Date.now()) {
        setError('Scheduled date and time must be in the future.');
        return;
      }
    }
    if (!schoolId) {
      setError('School context is missing. Please sign in again.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      let noticeAudience = 'parents';
      let noticeClasses = undefined;

      const formattedSections = selectedSection ? [selectedSection] : [];

      if (isTeacher) {
        if (audience === 'assigned_all') {
          noticeAudience = 'specific_classes';
          noticeClasses = classesList.map(c => ({
            classGrade: parseClassGrade(c.classGrade),
            sections: c.sections || []
          }));
        } else if (audience === 'specific' && selectedClass) {
          noticeAudience = 'specific_classes';
          noticeClasses = [{ classGrade: parseClassGrade(selectedClass), sections: formattedSections }];
        }
      } else {
        noticeAudience = mapAudienceToNoticePayload(audience);
        noticeClasses = audience === 'specific' && selectedClass
          ? [{ classGrade: parseClassGrade(selectedClass), sections: formattedSections }]
          : undefined;
      }

      await createNotice(schoolId, {
        title: title.trim(),
        content: content.trim(),
        targetAudience: noticeAudience,
        status: 'published',
        publishDate: schedule === 'now' ? new Date().toISOString() : new Date(scheduledDateTime).toISOString(),
        attachments: attachments.map(a => a.id),
        targetClasses: noticeClasses,
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        handleBack();
      }, 2000);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to send notice'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-48 font-outfit relative">
      {/* Top Banner Success Notification */}
      {isSuccess && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md animate-in fade-in zoom-in slide-in-from-top-2 duration-300">
          <div className="bg-emerald-500 text-white px-5 py-4 rounded-3xl shadow-xl flex items-center gap-3.5 border border-emerald-400/20">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Check size={18} className="text-white" />
            </div>
            <div>
              <span className="text-xs font-black block leading-none">Notice Sent Successfully!</span>
              <span className="text-[10px] text-emerald-100 font-bold block mt-1">Delivered to selected audience notice board.</span>
            </div>
          </div>
        </div>
      )}

      {/* Header Area */}
      <div className="bg-white border-b border-gray-150/70 sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={handleBack}
            className="w-10 h-10 rounded-full border border-gray-150 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all text-deep-purple"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black text-deep-purple flex items-center gap-1.5 leading-none">
              Notice Management
            </h1>
            <span className="text-[11px] text-gray-400 font-bold block mt-1">
              Create, send, and manage notices for your school.
            </span>
          </div>
        </div>
      </div>

      {/* Top Tab Bar: Create Notice vs Manage Sent Notices */}
      <div className="bg-white px-6 pt-3 pb-0 border-b border-gray-200/80 flex items-center gap-6 z-40 relative">
        <button
          type="button"
          onClick={() => setActiveTab('send')}
          className={`pb-3 text-xs font-black flex items-center gap-1.5 transition-all border-b-2 ${
            activeTab === 'send'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Send size={14} /> Send Notice
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('sent_list'); loadSentNotices(); }}
          className={`pb-3 text-xs font-black flex items-center gap-1.5 transition-all border-b-2 ${
            activeTab === 'sent_list'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Megaphone size={14} /> Manage Sent Notices
          {sentNotices.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[9.5px] bg-purple-100 text-primary font-black ml-1">
              {sentNotices.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'sent_list' ? (
        /* Sent Notices List View */
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-deep-purple uppercase tracking-wider">
              Sent Notices ({sentNotices.length})
            </h2>
            <button 
              type="button"
              onClick={loadSentNotices}
              className="text-[11px] font-black text-primary hover:underline flex items-center gap-1"
            >
              <Clock size={12} /> Refresh
            </button>
          </div>

          {loadingSent ? (
            <div className="bg-white border border-gray-200/80 rounded-[2rem] p-10 text-center shadow-sm">
              <Loader2 size={24} className="animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-500">Loading sent notices...</p>
            </div>
          ) : sentNotices.length === 0 ? (
            <div className="bg-white border border-gray-200/80 rounded-[2rem] p-10 text-center shadow-sm">
              <Megaphone size={36} className="text-gray-300 mx-auto mb-2" />
              <h4 className="text-xs font-black text-deep-purple">No Notices Sent Yet</h4>
              <p className="text-[10px] text-gray-400 font-bold mt-1 max-w-[220px] mx-auto">
                Notices created by you will be listed here. You can view sent counts and delete notices anytime.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {sentNotices.map((notice) => {
                const noticeId = notice._id || notice.id;
                const createdDate = notice.publishDate || notice.audit?.createdAt;
                const formattedDate = createdDate ? new Date(createdDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : '';

                let targetBadge = 'All Audiences';
                if (notice.targetClasses?.length) {
                  targetBadge = notice.targetClasses.map(c => c.classGrade).join(', ');
                } else if (notice.targetAudience === 'teachers') {
                  targetBadge = 'Teachers';
                } else if (notice.targetAudience === 'parents' || notice.targetAudience === 'all') {
                  targetBadge = 'Students & Parents';
                }

                const isScheduledFuture = notice.publishDate && new Date(notice.publishDate) > new Date();

                return (
                  <div key={noticeId} className="bg-white border border-gray-200/80 rounded-[1.8rem] p-4.5 shadow-sm hover:shadow-md transition-all space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-purple-50 text-primary border border-purple-100">
                            {targetBadge}
                          </span>
                          {isScheduledFuture ? (
                            <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Clock size={10} /> Scheduled ({formattedDate})
                            </span>
                          ) : (
                            <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              {notice.status === 'published' ? 'Published' : 'Draft'}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-black text-deep-purple leading-snug">{notice.title}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNotice(noticeId)}
                        disabled={deletingId === noticeId}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all shrink-0"
                        title="Delete Notice"
                      >
                        {deletingId === noticeId ? (
                          <Loader2 size={15} className="animate-spin text-red-500" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>

                    <p className="text-[11px] text-gray-600 font-semibold line-clamp-2 leading-relaxed">
                      {notice.content}
                    </p>

                    <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[9.5px] font-bold text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> {formattedDate}
                      </span>
                      <span className="text-gray-400">ID: {String(noticeId).slice(-6)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Form Content Area */
        <div className="px-6 py-5 space-y-5">
        
        {/* Step 1: Notice Details */}
        <div className="bg-white border border-gray-200/80 rounded-[2.2rem] p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary text-white text-[11px] font-black flex items-center justify-center shadow-sm">
              1
            </div>
            <h3 className="text-xs font-black text-deep-purple uppercase tracking-wider">
              Notice Details
            </h3>
          </div>

          {/* Title input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-black text-gray-500">
                Notice Title <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-gray-400 font-bold">
                {title.length}/100
              </span>
            </div>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder="Enter notice title"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-deep-purple focus:outline-none focus:border-primary/50 transition-colors placeholder:text-gray-300"
            />
          </div>

          {/* Content editor */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-500 block">
              Notice Content <span className="text-red-500">*</span>
            </label>
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your notice here..."
              rows={6}
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-deep-purple focus:outline-none focus:border-primary/50 transition-colors placeholder:text-gray-300 resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Step 2: Audience */}
        <div className="bg-white border border-gray-200/80 rounded-[2.2rem] p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary text-white text-[11px] font-black flex items-center justify-center shadow-sm">
              2
            </div>
            <h3 className="text-xs font-black text-deep-purple uppercase tracking-wider">
              Audience
            </h3>
          </div>
          <p className="text-[10px] text-gray-400 font-bold -mt-2">
            Select who should receive this notice
          </p>

          {/* Grid Selection of Audience Cards */}
          <div className="grid grid-cols-2 gap-3.5 pt-1.5">
            {isTeacher ? (
              <>
                {/* 1. All Assigned Classes (Students & Parents) */}
                <div 
                  onClick={() => setAudience('assigned_all')}
                  className={`p-4 rounded-3xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center relative ${audience === 'assigned_all' ? 'border-primary bg-purple-50/10' : 'border-gray-150 hover:border-gray-250 bg-white'}`}
                >
                  {audience === 'assigned_all' && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-white shadow-sm">
                      <Check size={10} />
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-primary mb-2.5 shadow-inner">
                    <Users size={16} />
                  </div>
                  <span className="text-[11px] font-black text-deep-purple block">All My Assigned Classes</span>
                  <span className="text-[8.5px] text-gray-400 font-bold block mt-0.5">Students & parents of your assigned classes</span>
                </div>

                {/* 2. Specific Class & Section */}
                <div 
                  onClick={() => setAudience('specific')}
                  className={`p-4 rounded-3xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center relative ${audience === 'specific' ? 'border-blue-500 bg-blue-50/5' : 'border-gray-150 hover:border-gray-250 bg-white'}`}
                >
                  {audience === 'specific' && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-sm">
                      <Check size={10} />
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-2.5 shadow-inner">
                    <Grid size={16} />
                  </div>
                  <span className="text-[11px] font-black text-deep-purple block">Specific Class & Section</span>
                  <span className="text-[8.5px] text-gray-400 font-bold block mt-0.5">Target a specific assigned class</span>
                </div>
              </>
            ) : (
              <>
                {/* Admin Option: All Parents & Students */}
                <div 
                  onClick={() => setAudience('parents')}
                  className={`p-4 rounded-3xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center relative ${audience === 'parents' ? 'border-primary bg-purple-50/10' : 'border-gray-150 hover:border-gray-250 bg-white'}`}
                >
                  {audience === 'parents' && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-white shadow-sm">
                      <Check size={10} />
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-primary mb-2.5 shadow-inner">
                    <Users size={16} />
                  </div>
                  <span className="text-[11px] font-black text-deep-purple block">All Parents & Students</span>
                  <span className="text-[8.5px] text-gray-400 font-bold block mt-0.5">Send to entire school</span>
                </div>

                {/* Admin Option: All Teachers */}
                <div 
                  onClick={() => setAudience('teachers')}
                  className={`p-4 rounded-3xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center relative ${audience === 'teachers' ? 'border-amber-500 bg-amber-50/5' : 'border-gray-150 hover:border-gray-250 bg-white'}`}
                >
                  {audience === 'teachers' && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-sm">
                      <Check size={10} />
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-2.5 shadow-inner">
                    <Users size={16} className="rotate-12" />
                  </div>
                  <span className="text-[11px] font-black text-deep-purple block">All Teachers</span>
                  <span className="text-[8.5px] text-gray-400 font-bold block mt-0.5">Send to all teacher accounts</span>
                </div>

                {/* Admin Option: Specific Class */}
                <div 
                  onClick={() => setAudience('specific')}
                  className={`p-4 rounded-3xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center relative ${audience === 'specific' ? 'border-blue-500 bg-blue-50/5' : 'border-gray-150 hover:border-gray-250 bg-white'}`}
                >
                  {audience === 'specific' && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-sm">
                      <Check size={10} />
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-2.5 shadow-inner">
                    <Grid size={16} />
                  </div>
                  <span className="text-[11px] font-black text-deep-purple block">Specific Class</span>
                  <span className="text-[8.5px] text-gray-400 font-bold block mt-0.5">Select a specific class</span>
                </div>
              </>
            )}
          </div>

          {/* Select Classes dropdown */}
          {audience === 'specific' && (
            <div className="space-y-3 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-gray-500">
                  Select Targeted Class <span className="text-red-500">*</span>
                </label>
                <select 
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setSelectedSection('');
                  }}
                  className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-deep-purple focus:outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer"
                >
                  <option value="">Select a class</option>
                  {classesList.map(c => (
                    <option key={c.classGrade} value={c.classGrade}>{c.classGrade}</option>
                  ))}
                </select>
              </div>

              {selectedClass && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="text-[11px] font-black text-gray-500">
                    Select Targeted Section <span className="text-gray-400 font-normal">(Optional - All Sections if blank)</span>
                  </label>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-deep-purple focus:outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">All Sections</option>
                    {((classesList.find(c => c.classGrade === selectedClass)?.sections) || []).map(sec => (
                      <option key={sec} value={sec}>Section {sec}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Attachments */}
        <div className="bg-white border border-gray-200/80 rounded-[2.2rem] p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary text-white text-[11px] font-black flex items-center justify-center shadow-sm">
              3
            </div>
            <h3 className="text-xs font-black text-deep-purple uppercase tracking-wider">
              Attachments <span className="text-[10px] text-gray-400 font-bold normal-case ml-1">(Optional)</span>
            </h3>
          </div>
          <p className="text-[10px] text-gray-400 font-bold -mt-2">
            Attach relevant PDF, Image, or document files to this notice
          </p>

          <div className="space-y-3 pt-1">
            {uploadingFile ? (
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-4 flex items-center justify-center gap-2 bg-gray-50/50 text-primary text-xs font-bold">
                <Loader2 size={16} className="animate-spin" />
                <span>Uploading file...</span>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 bg-gray-50/50">
                <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center text-primary">
                  <Upload size={16} />
                </div>
                <div className="text-center">
                  <span className="text-xs font-black text-deep-purple block">Upload a document</span>
                  <span className="text-[9.5px] text-gray-400 font-bold">PDF, PNG, JPG up to 10MB</span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  {/* capture="environment" opens the device's camera app
                      directly on mobile; desktop browsers that don't support it
                      fall back to the normal file picker. */}
                  <label className="px-3.5 py-2 rounded-xl border border-gray-200 hover:border-primary/40 cursor-pointer transition-colors bg-white text-[11px] font-black text-deep-purple flex items-center gap-1.5">
                    <Camera size={13} className="text-primary" />
                    <span>Take Photo</span>
                    <input type="file" accept=".png,.jpg,.jpeg,.gif,.webp" capture="environment" onChange={handleFileUpload} className="hidden" disabled={uploadingFile} />
                  </label>
                  <label className="px-3.5 py-2 rounded-xl border border-gray-200 hover:border-primary/40 cursor-pointer transition-colors bg-white text-[11px] font-black text-deep-purple flex items-center gap-1.5">
                    <Upload size={13} className="text-primary" />
                    <span>Choose File</span>
                    <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploadingFile} />
                  </label>
                </div>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="space-y-2 pt-1">
                {attachments.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-150 rounded-xl text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Paperclip size={14} className="text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-deep-purple truncate text-[11px]">{item.name}</p>
                        <p className="text-[9px] text-gray-400 font-semibold">{item.size}</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveAttachment(item.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Step 4: Schedule */}
        <div className="bg-white border border-gray-200/80 rounded-[2.2rem] p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary text-white text-[11px] font-black flex items-center justify-center shadow-sm">
              4
            </div>
            <h3 className="text-xs font-black text-deep-purple uppercase tracking-wider">
              Schedule <span className="text-[10px] text-gray-400 font-bold normal-case ml-1">(Optional)</span>
            </h3>
          </div>
          <p className="text-[10px] text-gray-400 font-bold -mt-2">
            Choose when to send this notice
          </p>

          <div className="space-y-4 pt-1">
            {/* Send Now */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input 
                type="radio"
                name="schedule"
                value="now"
                checked={schedule === 'now'}
                onChange={() => setSchedule('now')}
                className="mt-1 accent-primary"
              />
              <div>
                <span className="text-xs font-black text-deep-purple block leading-none">Send Now</span>
                <span className="text-[9px] text-gray-400 font-bold block mt-1">Notice will be sent immediately</span>
              </div>
            </label>

            {/* Schedule for Later */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="radio"
                  name="schedule"
                  value="later"
                  checked={schedule === 'later'}
                  onChange={() => setSchedule('later')}
                  className="mt-1 accent-primary"
                />
                <div>
                  <span className="text-xs font-black text-deep-purple block leading-none">Schedule for Later</span>
                  <span className="text-[9px] text-gray-400 font-bold block mt-1">Choose date and time to send</span>
                </div>
              </label>

              {schedule === 'later' && (
                <div className="ml-7 pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black text-gray-500 block mb-1.5">
                    Select Date & Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledDateTime}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-deep-purple focus:outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Sticky Bottom Actions Footer Bar (Only shown on Send Notice form tab) */}
      {activeTab === 'send' && (
        <div className="fixed bottom-[72px] left-0 right-0 bg-white border-t border-gray-150 p-4 flex flex-col gap-3 z-50 max-w-md mx-auto">
          {error && (
            <p className="text-[10px] font-bold text-red-500 text-center">{error}</p>
          )}
          <div className="flex">
            <button 
              type="button"
              onClick={handleSendNotice}
              disabled={saving}
              className="w-full py-3 bg-primary text-white rounded-2xl text-xs font-black shadow-lg shadow-purple-100 flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {saving ? 'Sending...' : 'Send Notice'}
            </button>
          </div>

          {/* Information Banner block */}
          <div className="bg-purple-50/40 rounded-2xl p-3 flex items-start gap-2.5">
            <Info size={14} className="text-primary mt-0.5 shrink-0" />
            <p className="text-[9px] text-gray-450 font-bold leading-normal">
              Once sent, the notice will be delivered via app notification and will be visible in the notice board for selected audience.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolSendNotice;
