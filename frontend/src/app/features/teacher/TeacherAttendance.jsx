import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Bell, Calendar, GraduationCap, Users, 
  CheckCircle2, AlertCircle, Clock, Search, RotateCcw, 
  Bookmark, Sliders, Save, Check, Loader2
} from 'lucide-react';
import { getDailyAttendance, markAttendance } from '../../../services/schoolApi';
import { getErrorMessage } from '../../../utils/apiHelpers';
import {
  mapAttendanceRow,
  mapUiStatusToApi,
  parseClassGrade,
  parseSection,
  UNMARKED,
} from '../../../utils/mappers/teacherMapper';
import { toLocalDateKey } from '../../../utils/date';
import { useTeacherSchoolId } from '../../../utils/teacherContext';
import { useTeacherClassOptions } from '../../../hooks/useTeacherClassOptions';

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
};

// Statuses the roster cannot set. They only arrive on records created elsewhere, and
// are shown as a read-only badge so re-saving the day does not rewrite them.
const READ_ONLY_LABELS = { Half: 'Half Day', H: 'Holiday' };

const TeacherAttendance = () => {
  const navigate = useNavigate();
  const schoolId = useTeacherSchoolId();
  const { classLabels, getSectionLabels } = useTeacherClassOptions(schoolId);
  const todayKey = toLocalDateKey();
  const [attendanceDate, setAttendanceDate] = useState(todayKey);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false);

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [remark, setRemark] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const classes = classLabels;
  const sections = getSectionLabels(selectedClass);

  useEffect(() => {
    if (classLabels.length > 0 && !selectedClass) {
      setSelectedClass(classLabels[0]);
      const labels = getSectionLabels(classLabels[0]);
      if (labels.length > 0) setSelectedSection(labels[0]);
    }
  }, [classLabels, getSectionLabels, selectedClass]);

  const loadAttendance = useCallback(async () => {
    if (!schoolId || !selectedClass || !selectedSection) {
      setLoading(false);
      setError('School context is missing. Please log in again.');
      setStudents([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const classGrade = parseClassGrade(selectedClass);
      const section = parseSection(selectedSection);
      const rows = await getDailyAttendance(schoolId, { date: attendanceDate, classGrade, section });
      setStudents((rows || []).map(mapAttendanceRow));
    } catch (err) {
      setStudents([]);
      setError(getErrorMessage(err, 'Unable to load attendance'));
    } finally {
      setLoading(false);
    }
  }, [schoolId, selectedClass, selectedSection, attendanceDate]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // 3. Dynamic Stats Calculation
  const totalCount = students.length;
  const presentCount = students.filter(s => s.status === 'P').length;
  const absentCount = students.filter(s => s.status === 'A').length;
  const leaveCount = students.filter(s => s.status === 'L').length;
  const lateCount = students.filter(s => s.status === 'Late').length;
  const unmarkedCount = students.filter(s => s.status === UNMARKED).length;

  // 4. Handlers
  const handleStatusChange = (id, newStatus) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
  };

  const handleMarkAllPresent = () => {
    // Only fills in students still awaiting a decision — it must not overwrite marks
    // the teacher already made, nor statuses this roster cannot set.
    setStudents(prev => prev.map(s => (s.status === UNMARKED ? { ...s, status: 'P' } : s)));
  };

  const handleReset = () => {
    loadAttendance();
    setSearchQuery('');
    setStatusFilter('all');
    setRemark('');
  };

  const handleSaveAttendance = async () => {
    if (!schoolId) {
      setError('School context is missing. Please log in again.');
      return;
    }
    if (students.length === 0) return;

    // Refuse to save a partly-marked roster rather than quietly omitting students:
    // an unsaved student is indistinguishable from one who was never marked.
    if (unmarkedCount > 0) {
      setError(
        `${unmarkedCount} ${unmarkedCount === 1 ? 'student is' : 'students are'} still unmarked. ` +
          'Mark everyone, or use "Mark All Present" to fill in the rest.'
      );
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { skipped } = await markAttendance(schoolId, {
        date: attendanceDate,
        classGrade: parseClassGrade(selectedClass),
        section: parseSection(selectedSection),
        records: students
          .filter((s) => s.mongoId && mapUiStatusToApi(s.status))
          .map((s) => ({
            studentId: s.mongoId,
            status: mapUiStatusToApi(s.status),
            // Left off entirely when the box is empty, so saving a day does not clear
            // remarks already recorded against these students. The field applies to
            // the whole class by design — it is labelled "Class Remark".
            ...(remark.trim() ? { remarks: remark.trim() } : {}),
          })),
      });

      // The server drops students who are not active in this class. Say so instead of
      // reporting a clean save.
      if (skipped.length > 0) {
        setError(
          `Saved, but ${skipped.length} ${skipped.length === 1 ? 'student was' : 'students were'} ` +
            'skipped because they are no longer active in this class. Please reload.'
        );
        return;
      }

      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        navigate('/school/teacher/dashboard');
      }, 2000);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save attendance'));
    } finally {
      setSaving(false);
    }
  };

  // Filter students based on search query AND active status card filter
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || String(s.roll) === searchQuery;
    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'P') return s.status === 'P';
    if (statusFilter === 'A') return s.status === 'A';
    if (statusFilter === 'L') return s.status === 'L' || s.status === 'Late';
    if (statusFilter === UNMARKED) return s.status === UNMARKED;
    return true;
  });

  return (
    <div className="flex flex-col bg-gray-50 min-h-screen select-none font-outfit animate-in fade-in duration-300 pb-28 relative">
      
      {/* Success Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-[100] bg-emerald-600 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-6 duration-300">
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
            <Check size={14} strokeWidth={3} />
          </div>
          <span className="text-xs font-black">Attendance Saved Successfully!</span>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="px-6 pt-7 pb-4 bg-white flex items-center justify-between border-b border-gray-100 relative z-30">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/school/teacher/dashboard')}
            className="w-10 h-10 bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex items-center justify-center text-deep-purple"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-deep-purple leading-none">Mark Attendance</h1>
              {attendanceDate === todayKey ? (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                  Today
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                  Past Date
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-500 font-bold text-[10px] mt-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 hover:border-primary/30 rounded-xl px-2.5 py-1 text-deep-purple transition-all">
                <Calendar size={13} className="text-primary shrink-0" />
                <input
                  type="date"
                  max={todayKey}
                  value={attendanceDate}
                  onChange={(e) => {
                    const selected = e.target.value;
                    if (!selected) return;
                    if (selected > todayKey) {
                      setError('Future dates cannot be selected for marking attendance.');
                      return;
                    }
                    setError('');
                    setAttendanceDate(selected);
                  }}
                  className="bg-transparent text-xs font-black text-deep-purple focus:outline-none cursor-pointer"
                />
              </div>
              <span className="text-[11px] font-bold text-gray-500 hidden sm:inline">
                {formatDisplayDate(attendanceDate)}
              </span>
              {attendanceDate !== todayKey && (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setAttendanceDate(todayKey);
                  }}
                  className="text-[10px] font-black text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg transition-all"
                  title="Switch to Today"
                >
                  Go to Today
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Past Date Banner */}
      {attendanceDate !== todayKey && (
        <div className="px-6 mt-3">
          <div className="px-4 py-2.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-amber-900">
                Marking past attendance for <span className="font-black">{formatDisplayDate(attendanceDate)}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setError('');
                setAttendanceDate(todayKey);
              }}
              className="text-[10px] font-black text-amber-900 underline hover:text-amber-700 shrink-0 ml-2"
            >
              Reset to Today
            </button>
          </div>
        </div>
      )}

      {/* 2. Class & Section Selectors */}
      <div className="px-6 mt-4 grid grid-cols-2 gap-4 relative z-30">
        {/* Class Dropdown */}
        <div className="relative">
          <button 
            onClick={() => { setIsClassDropdownOpen(!isClassDropdownOpen); setIsSectionDropdownOpen(false); }}
            className="w-full px-4 py-3.5 bg-white border border-gray-200 hover:border-primary/20 active:bg-gray-50 rounded-2xl text-left flex items-center justify-between shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 text-deep-purple font-bold text-xs">
              <GraduationCap size={16} className="text-primary" />
              <span>{selectedClass}</span>
            </div>
            <span className="text-gray-400 text-xs">▼</span>
          </button>

          {isClassDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsClassDropdownOpen(false)} />
              <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                {classes.map(cls => (
                  <button 
                    key={cls}
                    onClick={() => { setSelectedClass(cls); setIsClassDropdownOpen(false); }}
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
          <button 
            onClick={() => { setIsSectionDropdownOpen(!isSectionDropdownOpen); setIsClassDropdownOpen(false); }}
            className="w-full px-4 py-3.5 bg-white border border-gray-200 hover:border-primary/20 active:bg-gray-50 rounded-2xl text-left flex items-center justify-between shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 text-deep-purple font-bold text-xs">
              <Users size={16} className="text-primary" />
              <span>{selectedSection}</span>
            </div>
            <span className="text-gray-400 text-xs">▼</span>
          </button>

          {isSectionDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsSectionDropdownOpen(false)} />
              <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                {sections.map(sec => (
                  <button 
                    key={sec}
                    onClick={() => { setSelectedSection(sec); setIsSectionDropdownOpen(false); }}
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

      {/* 3. Stat Cards Grid (4 Clickable Filter Cards Row) */}
      <div className="px-6 mt-4 grid grid-cols-4 gap-2.5">
        {/* Total Card */}
        <button 
          onClick={() => setStatusFilter('all')}
          className={`bg-[#F6F4FD] rounded-2xl p-3 flex flex-col items-center justify-center text-center shadow-sm transition-all duration-200 outline-none border ${
            statusFilter === 'all' 
              ? 'border-[#6A47DE] ring-2 ring-[#6A47DE]/20 scale-105 font-black shadow-md shadow-purple-100' 
              : 'border-[#E9E4FC] opacity-70 hover:opacity-100 scale-95'
          }`}
        >
          <Users size={18} className="text-[#6A47DE]" />
          <span className="text-base font-black text-deep-purple mt-1.5 leading-none">{totalCount}</span>
          <span className="text-[9px] text-[#6A47DE] font-bold mt-1 uppercase tracking-tight">Total</span>
        </button>

        {/* Present Card */}
        <button 
          onClick={() => setStatusFilter('P')}
          className={`bg-[#EBFBF0] rounded-2xl p-3 flex flex-col items-center justify-center text-center shadow-sm transition-all duration-200 outline-none border ${
            statusFilter === 'P' 
              ? 'border-[#34A853] ring-2 ring-[#34A853]/20 scale-105 font-black shadow-md shadow-green-100' 
              : 'border-[#D5F7DD] opacity-70 hover:opacity-100 scale-95'
          }`}
        >
          <CheckCircle2 size={18} className="text-[#34A853]" />
          <span className="text-base font-black text-deep-purple mt-1.5 leading-none">{presentCount}</span>
          <span className="text-[9px] text-[#34A853] font-bold mt-1 uppercase tracking-tight">Present</span>
        </button>

        {/* Absent Card */}
        <button 
          onClick={() => setStatusFilter('A')}
          className={`bg-[#FCECEE] rounded-2xl p-3 flex flex-col items-center justify-center text-center shadow-sm transition-all duration-200 outline-none border ${
            statusFilter === 'A' 
              ? 'border-[#E04F5F] ring-2 ring-[#E04F5F]/20 scale-105 font-black shadow-md shadow-red-100' 
              : 'border-[#FAD2D8] opacity-70 hover:opacity-100 scale-95'
          }`}
        >
          <AlertCircle size={18} className="text-[#E04F5F]" />
          <span className="text-base font-black text-deep-purple mt-1.5 leading-none">{absentCount}</span>
          <span className="text-[9px] text-[#E04F5F] font-bold mt-1 uppercase tracking-tight">Absent</span>
        </button>

        {/* Leave Card */}
        <button 
          onClick={() => setStatusFilter('L')}
          className={`bg-[#FEF6EC] rounded-2xl p-3 flex flex-col items-center justify-center text-center shadow-sm transition-all duration-200 outline-none border ${
            statusFilter === 'L' 
              ? 'border-[#F2994A] ring-2 ring-[#F2994A]/20 scale-105 font-black shadow-md shadow-orange-100' 
              : 'border-[#FCE1C2] opacity-70 hover:opacity-100 scale-95'
          }`}
        >
          <Clock size={18} className="text-[#F2994A]" />
          <span className="text-base font-black text-deep-purple mt-1.5 leading-none">{leaveCount + lateCount}</span>
          {/* Groups leave and late, matching what this card filters to */}
          <span className="text-[9px] text-[#F2994A] font-bold mt-1 uppercase tracking-tight">Leave/Late</span>
        </button>
      </div>

      {/* Unmarked students still awaiting a decision */}
      {!loading && unmarkedCount > 0 && (
        <div className="px-6 mt-4">
          <button
            onClick={() => setStatusFilter(statusFilter === UNMARKED ? 'all' : UNMARKED)}
            className={`w-full px-4 py-3 rounded-2xl border flex items-center justify-center gap-2 transition-all ${
              statusFilter === UNMARKED
                ? 'bg-amber-100 border-amber-300'
                : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <AlertCircle size={14} className="text-amber-600" />
            <span className="text-[11px] font-black text-amber-700">
              {unmarkedCount} {unmarkedCount === 1 ? 'student' : 'students'} not marked yet
            </span>
          </button>
        </div>
      )}

      {/* Errors: save failures and partial saves both surface here */}
      {error && (
        <div className="px-6 mt-4">
          <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2">
            <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
            <span className="text-[11px] font-bold text-red-600 leading-relaxed">{error}</span>
          </div>
        </div>
      )}

      {/* 4. Action Buttons Grid */}
      <div className="px-6 mt-4 grid grid-cols-2 gap-4">
        <button 
          onClick={handleMarkAllPresent}
          className="bg-[#EBFBF0] border border-[#D5F7DD] hover:bg-[#D5F7DD]/50 active:scale-95 transition-all rounded-2xl py-3.5 px-4 flex items-center justify-center gap-2 shadow-sm text-center"
        >
          <CheckCircle2 size={16} className="text-[#34A853]" />
          <span className="text-xs font-black text-[#34A853] tracking-tight">Mark All Present</span>
        </button>

        <button 
          onClick={handleReset}
          className="bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all rounded-2xl py-3.5 px-4 flex items-center justify-center gap-2 shadow-sm text-center"
        >
          <RotateCcw size={16} className="text-primary" />
          <span className="text-xs font-black text-deep-purple tracking-tight">Reset</span>
        </button>
      </div>

      {/* 5. Search Bar */}
      <div className="px-6 mt-4">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by name or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 hover:border-primary/20 focus:border-primary/30 focus:outline-none rounded-2xl text-xs font-bold text-deep-purple placeholder-gray-400 shadow-sm transition-all"
          />
        </div>
      </div>

      {/* 6. Student Table Roster (Shown directly on the page background) */}
      <div className="mx-6 mt-4 relative z-10">
        {/* Table Header */}
        <div className="border-b border-gray-200/80 pb-3.5 px-2 grid grid-cols-12 text-[10px] font-black text-gray-400 uppercase tracking-wider">
          <span className="col-span-2">Roll No.</span>
          <span className="col-span-5">Student Name</span>
          <span className="col-span-5 text-right pr-6">Status</span>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-200/40 max-h-[380px] overflow-y-auto">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((stud) => (
              <div key={stud.id} className={`px-2 py-4 grid grid-cols-12 items-center transition-colors ${stud.status === UNMARKED ? 'bg-amber-50/40' : 'hover:bg-gray-200/10'}`}>
                {/* Roll No */}
                <span className="col-span-2 text-xs font-black text-gray-400">{stud.roll}</span>

                {/* Student Name */}
                <div className="col-span-5 flex items-center">
                  <span className="text-xs font-black text-deep-purple truncate">{stud.name}</span>
                </div>

                {READ_ONLY_LABELS[stud.status] ? (
                  <div className="col-span-5 flex items-center justify-end pr-6">
                    <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-[9px] font-black uppercase tracking-tight">
                      {READ_ONLY_LABELS[stud.status]}
                    </span>
                  </div>
                ) : (
                <div className="col-span-5 flex items-center justify-end gap-1.5">
                  {/* Present button */}
                  <button
                    onClick={() => handleStatusChange(stud.id, 'P')}
                    className={`w-7 h-7 rounded-lg text-[9px] font-black transition-all flex items-center justify-center ${
                      stud.status === 'P' 
                        ? 'bg-[#34A853] text-white shadow-md shadow-green-100' 
                        : 'bg-white border border-[#34A853]/35 text-[#34A853] hover:bg-[#34A853]/5'
                    }`}
                  >
                    P
                  </button>

                  {/* Absent button */}
                  <button
                    onClick={() => handleStatusChange(stud.id, 'A')}
                    className={`w-7 h-7 rounded-lg text-[9px] font-black transition-all flex items-center justify-center ${
                      stud.status === 'A' 
                        ? 'bg-[#E04F5F] text-white shadow-md shadow-red-100' 
                        : 'bg-white border border-[#E04F5F]/35 text-[#E04F5F] hover:bg-[#E04F5F]/5'
                    }`}
                  >
                    A
                  </button>

                  {/* Leave button */}
                  <button
                    onClick={() => handleStatusChange(stud.id, 'L')}
                    className={`w-7 h-7 rounded-lg text-[9px] font-black transition-all flex items-center justify-center ${
                      stud.status === 'L' 
                        ? 'bg-[#F2994A] text-white shadow-md shadow-orange-100' 
                        : 'bg-white border border-[#F2994A]/35 text-[#F2994A] hover:bg-[#F2994A]/5'
                    }`}
                  >
                    L
                  </button>

                  {/* Late button */}
                  <button
                    onClick={() => handleStatusChange(stud.id, 'Late')}
                    className={`w-11 h-7 rounded-lg text-[9px] font-black transition-all flex items-center justify-center ${
                      stud.status === 'Late'
                        ? 'bg-[#EA580C] text-white shadow-md shadow-orange-100'
                        : 'bg-white border border-[#EA580C]/35 text-[#EA580C] hover:bg-[#EA580C]/5'
                    }`}
                  >
                    Late
                  </button>
                </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-10 text-center flex flex-col items-center justify-center">
              <span className="text-xs font-bold text-gray-400">No students found matching search</span>
            </div>
          )}
        </div>
      </div>

      {/* 7. Class Remark (Optional) */}
      <div className="px-6 mt-5">
        <h3 className="text-xs font-black text-deep-purple tracking-tight mb-2">Class Remark <span className="text-gray-400 font-bold">(Optional)</span></h3>
        <div className="relative">
          <textarea 
            placeholder="Write a note or remark for today..."
            value={remark}
            onChange={(e) => setRemark(e.target.value.slice(0, 200))}
            className="w-full p-4 bg-white border border-gray-200 hover:border-primary/20 focus:border-primary/30 focus:outline-none rounded-[1.8rem] text-xs font-bold text-deep-purple placeholder-gray-400 shadow-sm transition-all h-24 resize-none"
          />
          <span className="absolute bottom-3 right-4 text-[9px] font-bold text-gray-400">
            {remark.length}/200
          </span>
        </div>
      </div>

      {/* 8. Save Attendance Primary Button */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 p-4 z-40">
        <button 
          onClick={handleSaveAttendance}
          disabled={saving || loading || students.length === 0}
          className="w-full py-4 bg-primary text-white hover:bg-deep-purple active:scale-98 transition-all rounded-[1.8rem] text-sm font-black shadow-lg shadow-purple-100 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={2.5} />}
          <span>{saving ? 'Saving...' : 'Save Attendance'}</span>
        </button>
      </div>

    </div>
  );
};

export default TeacherAttendance;
