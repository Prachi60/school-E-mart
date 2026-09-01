import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ChevronDown, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Paperclip, 
  Eye, 
  ArrowRight,
  ClipboardList,
  Loader2
} from 'lucide-react';
import AppHeader from '../../components/AppHeader';
import ParentHomeworkDetails from './ParentHomeworkDetails';
import LoginRequired from '../../components/LoginRequired';
import { fetchParentHomework } from '../../../services/parentApi';
import { fetchSubmissionAttachment } from '../../../services/lmsApi';
import { getErrorMessage } from '../../../utils/apiHelpers';
import { buildHomeworkStats, mapAssignmentForParentHomework } from '../../../utils/mappers/parentMapper';
import { useChildInfo } from '../../../utils/parentContext';

const GUEST_CHILD_INFO = {
  name: 'Guest',
  school: 'Explore Schools',
  grade: 'Select Grade',
  phone: '',
};

const ParentHomework = () => {
  const [activeTab, setActiveTab] = useState('Pending');
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState(null);
  const [homeworkItems, setHomeworkItems] = useState([]);
  const [homeworkStats, setHomeworkStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // False once the server tells us the child has no roster record at this school yet.
  // Homework is still readable; only handing work in needs the school to link them.
  const [canSubmit, setCanSubmit] = useState(true);
  // The class the server actually built the feed for. An empty list is usually just
  // "no homework set yet" — naming the class is what tells the parent that, instead of
  // leaving a blank page that reads as a broken app.
  const [feedClass, setFeedClass] = useState(null);

  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortOrder, setSortOrder] = useState('Newest');

  // The shared reactive identity, not a one-shot localStorage read. The stored blob
  // routinely lacks schoolId/studentId (or holds the 'explore-schools' placeholder)
  // right after login, and reading it once into state meant this page bailed out
  // before it ever called the API — an empty homework list with no error shown. The
  // hook backfills those from the authenticated user and re-renders when they arrive.
  const activeChildInfo = useChildInfo();
  const childInfo = activeChildInfo || GUEST_CHILD_INFO;
  // Pulled out as plain values so the loader below depends on the identity itself
  // rather than on the object holding it.
  const schoolId =
    childInfo.schoolId && childInfo.schoolId !== 'explore-schools' ? childInfo.schoolId : null;
  const studentId = childInfo.studentId || null;
  const grade = childInfo.grade || null;

  // Banner images are fetched as blob URLs (submitted/homework attachments are never
  // served statically). Tracked here so every reload — and unmount — revokes the
  // previous batch instead of leaking them.
  const bannerUrlsRef = React.useRef([]);

  const loadHomework = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      setHomeworkItems([]);
      setHomeworkStats(buildHomeworkStats([]));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { homework: rows, canSubmit: allowed, student } = await fetchParentHomework(
        schoolId,
        grade,
        studentId
      );
      setCanSubmit(allowed);
      setFeedClass(student || null);
      const nextBannerUrls = [];
      const mapped = await Promise.all(
        rows.map(async ({ assignment, course, submission }) => {
          const item = mapAssignmentForParentHomework(assignment, course, submission);
          if (item.thumbnailAttachmentId) {
            try {
              const url = await fetchSubmissionAttachment(schoolId, item.thumbnailAttachmentId);
              nextBannerUrls.push(url);
              item.image = url;
            } catch {
              item.image = null;
            }
          }
          return item;
        })
      );
      bannerUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      bannerUrlsRef.current = nextBannerUrls;
      setHomeworkItems(mapped);
      setHomeworkStats(buildHomeworkStats(mapped));
    } catch (err) {
      setHomeworkItems([]);
      setHomeworkStats(buildHomeworkStats([]));
      setError(getErrorMessage(err, 'Unable to load homework'));
    } finally {
      setLoading(false);
    }
  }, [schoolId, studentId, grade]);

  useEffect(() => {
    loadHomework();
  }, [loadHomework]);

  // Revoke on unmount too, not just on the next reload.
  useEffect(() => () => {
    bannerUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const filteredHomework = useMemo(() => {
    let items = [...homeworkItems];
    if (activeTab !== 'All') {
      items = items.filter((item) => item.tabType === activeTab);
    }

    // assignedDate/dueDate are formatted for display ("10 Aug 2026") and must never be
    // sorted as strings — lexicographic order puts "10 Aug" before "2 Aug". Sort on the
    // raw timestamps the mapper carries alongside them instead.
    items.sort((a, b) => {
      if (sortOrder === 'Oldest') {
        return (a.assignedDateSort || 0) - (b.assignedDateSort || 0);
      }
      if (sortOrder === 'Due Date') {
        return (a.dueDateSort || 0) - (b.dueDateSort || 0);
      }
      return (b.assignedDateSort || 0) - (a.assignedDateSort || 0);
    });

    return items;
  }, [homeworkItems, activeTab, sortOrder]);

  // "Class 5 A" / "Class 5" — whatever the server could resolve, for the empty state.
  const classLabel = useMemo(() => {
    const parts = [feedClass?.classGrade, feedClass?.section].filter(Boolean);
    return parts.length ? parts.join(' ') : null;
  }, [feedClass]);

  const handleScroll = (e) => {
    setScrolled(e.target.scrollTop > 10);
  };

  // A signed-in parent whose `childInfo` was never written to this device still has an
  // identity through the auth store, and must not be shown the login wall. useChildInfo
  // returns null only when there is neither stored info nor an authenticated user.
  const isGuest = !activeChildInfo;

  if (isGuest) {
    return (
      <div className="max-w-md mx-auto h-[100dvh] relative overflow-hidden flex flex-col font-outfit w-full bg-white">
        <AppHeader
          scrolled={scrolled}
          onMenuClick={() => setIsMenuOpen(true)}
          childInfo={null}
          transparentAtTop={false}
        />
        <div className="flex flex-col h-full bg-gray-50/50 pb-40 overflow-y-auto overflow-x-hidden w-full font-outfit">
          <div className="h-[140px] shrink-0"></div>
          <LoginRequired 
            title="Homework Protected"
            message="Please login to view your child's pending assignments, homework details, and submission portal."
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Side Menu Drawer Placeholder to keep standard nav functional */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-white shadow-2xl z-50 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5B3FD6]/10 flex items-center justify-center text-[#5B3FD6] font-bold">
              SM
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-800">School Mart</h4>
              <p className="text-[10px] text-gray-400 font-bold">Parent Portal</p>
            </div>
          </div>
          <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs font-black">Close</button>
        </div>
        <div className="p-4 flex flex-col gap-2">
          <button onClick={() => window.location.href='/user/home'} className="w-full text-left px-4 py-3 text-sm font-black text-gray-600 rounded-xl hover:bg-gray-50 flex items-center gap-3">
            <span>🏠</span> Home Dashboard
          </button>
          <button onClick={() => window.location.href='/user/attendance'} className="w-full text-left px-4 py-3 text-sm font-black text-gray-600 rounded-xl hover:bg-gray-50 flex items-center gap-3">
            <span>📅</span> Attendance Tracker
          </button>
          <button onClick={() => { setActiveTab('Pending'); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-black text-[#5B3FD6] rounded-xl bg-[#5B3FD6]/5 flex items-center gap-3">
            <span>📝</span> Class Homework
          </button>
        </div>
      </div>
      {isMenuOpen && (
        <div onClick={() => setIsMenuOpen(false)} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 animate-fade-in" />
      )}

      {/* Main Base Page Frame */}
      <div className="max-w-md mx-auto h-[100dvh] relative overflow-hidden flex flex-col font-outfit w-full bg-white">
        <AppHeader
          scrolled={scrolled}
          onMenuClick={() => setIsMenuOpen(true)}
          childInfo={childInfo}
          transparentAtTop={false}
        />
        
        <div
          onScroll={handleScroll}
          className="flex flex-col h-full bg-gray-50/50 pb-40 overflow-y-auto overflow-x-hidden w-full font-outfit"
        >
          {/* Sticky AppHeader Spacer */}
          <div className="h-[140px] shrink-0"></div>

          {/* 1. Horizontal Navigation Tabs */}
          <div className="px-6 mt-4">
            <div className="bg-white border border-gray-100/50 rounded-2xl p-1.5 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
              {['All', 'Pending', 'Submitted', 'Completed'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-center py-2.5 text-xs font-black rounded-xl transition-all duration-300 ${
                    activeTab === tab
                      ? 'bg-[#5B3FD6]/10 text-[#5B3FD6]'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Homework Summary Micro-Cards Bar (Explicit Flexbox Row Alignment) */}
          <div className="px-6 mt-4">
            <div className="flex flex-row items-center gap-2 w-full">
              {/* Pending Stat */}
              <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center shadow-[0_2px_8px_rgba(0,0,0,0.01)] min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#FFF6ED] flex items-center justify-center text-[#F2994A] mb-1">
                  <FileText size={15} />
                </div>
                <span className="text-[10px] font-black text-gray-400">Pending</span>
                <span className="text-sm font-black text-gray-800 mt-0.5">
                  {homeworkStats ? homeworkStats.pending : '--'}
                </span>
              </div>

              {/* Submitted Stat */}
              <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center shadow-[0_2px_8px_rgba(0,0,0,0.01)] min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#F9F5FF] flex items-center justify-center text-[#7F56D9] mb-1">
                  <BookOpen size={15} />
                </div>
                <span className="text-[10px] font-black text-gray-400">Submitted</span>
                <span className="text-sm font-black text-gray-800 mt-0.5">
                  {homeworkStats ? homeworkStats.submitted : '--'}
                </span>
              </div>

              {/* Completed Stat */}
              <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center shadow-[0_2px_8px_rgba(0,0,0,0.01)] min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#EBFBF0] flex items-center justify-center text-[#34A853] mb-1">
                  <CheckCircle2 size={15} />
                </div>
                <span className="text-[10px] font-black text-gray-400">Completed</span>
                <span className="text-sm font-black text-gray-800 mt-0.5">
                  {homeworkStats ? homeworkStats.completed : '--'}
                </span>
              </div>

              {/* Overdue Stat */}
              <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center shadow-[0_2px_8px_rgba(0,0,0,0.01)] min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#FEF3F2] flex items-center justify-center text-[#D93025] mb-1">
                  <AlertCircle size={15} />
                </div>
                <span className="text-[10px] font-black text-gray-400">Overdue</span>
                <span className="text-sm font-black text-gray-800 mt-0.5">
                  {homeworkStats ? homeworkStats.overdue : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Section Title with Sort Selector */}
          <div className="px-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-gray-800">
                {activeTab === 'All' ? 'All Homework' : `${activeTab} Homework`}
              </h2>
              <div className="relative">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="text-xs font-black text-gray-500 hover:text-gray-700 flex items-center gap-1 active:scale-95 transition-transform"
                >
                  Sort: {sortOrder} <ChevronDown size={12} className="text-gray-400" />
                </button>
                {showSortDropdown && (
                  <div className="absolute right-0 mt-1.5 w-32 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-2 animate-fade-in text-[11px] font-black text-gray-600">
                    {['Newest', 'Oldest', 'Due Date'].map((order) => (
                      <button
                        key={order}
                        onClick={() => {
                          setSortOrder(order);
                          setShowSortDropdown(false);
                        }}
                        className="w-full text-left px-5 py-2.5 hover:bg-[#5B3FD6]/5 hover:text-[#5B3FD6] transition-colors"
                      >
                        {order}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Homework Lists */}
          <div className="px-6 flex flex-col gap-4">
            {error && (
              <div className="px-4 py-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-600 flex items-center justify-between gap-3">
                <span className="min-w-0">{error}</span>
                <button
                  onClick={loadHomework}
                  className="shrink-0 px-3 py-1.5 bg-white border border-rose-200 rounded-xl text-[10px] font-black text-rose-600 active:scale-95 transition-transform"
                >
                  Retry
                </button>
              </div>
            )}

            {/* The child is at this school but the office has not added them to the
                student register yet: the class's homework is readable, submitting is
                not. Saying so beats a submit button that fails with a 403. */}
            {!error && !canSubmit && (
              <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl text-[11px] font-bold text-amber-700">
                Your child is not linked to the school's student records yet, so homework
                can be viewed but not submitted. Ask the school office to add them.
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-xs font-bold">
                <Loader2 size={16} className="animate-spin" />
                Loading homework...
              </div>
            ) : filteredHomework.length > 0 ? (
              filteredHomework.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:shadow-md transition-all duration-300"
                >
                  {/* Body Content Row */}
                  <div className="p-4 flex gap-4">
                    {/* Thumbnail Image / Subject Icon Wrapper */}
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-purple-50/60 border border-purple-100/60 shrink-0 flex items-center justify-center">
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.subject} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-2">
                          <BookOpen size={24} className="text-[#5B3FD6] mb-1" />
                          <span className="text-[9px] font-black text-[#5B3FD6] truncate max-w-[80px]">{item.subject}</span>
                        </div>
                      )}
                      {item.isHighPriority && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/40 backdrop-blur-md rounded-md text-[8px] font-black text-white uppercase tracking-wider">
                          High Priority
                        </span>
                      )}
                    </div>

                    {/* Meta Fields Content Block */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-[14px] font-black text-gray-800 truncate">{item.subject}</h4>
                        <span className={`px-2 py-0.5 border rounded-lg text-[9px] font-black leading-none shrink-0 ${item.statusColor}`}>
                          {item.status}
                        </span>
                      </div>
                      
                      <p className="text-[11px] font-bold text-gray-500 leading-snug mt-1.5 line-clamp-2">
                        {item.description}
                      </p>

                      {/* Structure-First Metadata Rows */}
                      <div className="mt-3 flex flex-col gap-1 text-[9.5px] font-black text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 flex items-center justify-center">📅</span>
                          <span>Assigned: <span className="text-gray-500 font-semibold">{item.assignedDate}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 flex items-center justify-center">⏰</span>
                          <span>Due: <span className="text-gray-500 font-semibold">{item.dueDate}</span> <span className="text-[#F2994A] font-extrabold">({item.daysRemaining})</span></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 flex items-center justify-center">👤</span>
                          <span>Teacher: <span className="text-gray-500 font-semibold">{item.teacher}</span></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-[11px] font-black text-gray-500">
                    <div className="flex items-center gap-1 hover:text-gray-700 cursor-pointer">
                      <Paperclip size={12} className="text-gray-400" />
                      <span>{item.attachmentsCount} Attachment</span>
                    </div>
                    <button 
                      onClick={() => setSelectedHomework(item)}
                      className="flex items-center gap-1 text-[#5B3FD6] hover:text-[#4a32b0] transition-colors cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white border border-gray-100 rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-[0_2px_8px_rgba(0,0,0,0.01)] py-14">
                <ClipboardList size={36} className="text-gray-300 mb-2" />
                <h4 className="text-[13px] font-black text-gray-700">
                  {!schoolId ? 'No School Selected' : `No ${activeTab} Homework`}
                </h4>
                <p className="text-[11px] font-semibold text-gray-400 mt-1 max-w-[240px] mx-auto leading-relaxed">
                  {/* An empty list used to mean any of these things. Guessing wrong is
                      what made "the homework isn't showing" impossible to self-diagnose,
                      so name the class the feed was actually built for. */}
                  {!schoolId
                    ? 'Pick your school to see the homework your teachers set.'
                    : activeTab === 'All'
                      ? classLabel
                        ? `No homework has been set for ${classLabel} yet. It will appear here as soon as a teacher publishes it.`
                        : 'Published assignments from your school will appear here.'
                      : 'Switch tabs or check back when teachers assign new homework.'}
                </p>
                {!schoolId && (
                  <button
                    onClick={() => { window.location.href = '/user/my-school'; }}
                    className="mt-4 px-5 py-2.5 bg-[#5B3FD6] text-white rounded-2xl text-[11px] font-black active:scale-95 transition-transform"
                  >
                    Choose School
                  </button>
                )}
              </div>
            )}
          </div>


        </div>
        {selectedHomework && (
          <ParentHomeworkDetails
            homework={selectedHomework}
            childInfo={childInfo}
            canSubmit={canSubmit}
            onClose={() => setSelectedHomework(null)}
            onSubmitted={loadHomework}
          />
        )}
      </div>
    </>
  );
};

export default ParentHomework;
