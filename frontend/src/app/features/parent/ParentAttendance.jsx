import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Check, 
  AlertCircle, 
  Clock, 
  Calendar as CalendarIcon, 
  FileText, 
  Lightbulb,
  ShieldCheck,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../../components/AppHeader';
import LoginRequired from '../../components/LoginRequired';
import { getAttendanceHistory } from '../../../services/parentApi';
import { useChildInfo } from '../../../utils/parentContext';

const formatSelectedDate = (date) => {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${weekdays[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const getUTCDateString = (dateObjOrStr) => {
  const date = new Date(dateObjOrStr);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getLocalDateString = (year, month, day) => {
  const y = year;
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const ParentAttendance = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Calendar');
  
  // Make the calendar load the actual current local date and month
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Backend Integration State Hook for Overview Stats:
  const [overviewStats, setOverviewStats] = useState(null);

  // Dropdown Filter States
  const [showSummaryDropdown, setShowSummaryDropdown] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState('This Month');
  const [showTrendDropdown, setShowTrendDropdown] = useState(false);
  const [trendFilter, setTrendFilter] = useState('Last 6 Months');

  // The shared reactive identity, not a one-shot localStorage read. The stored blob
  // routinely lacks studentId/schoolId right after login; frozen in state, the effect
  // below bailed out before it ever called the API and — because `loading` stays false
  // and nothing errors — the parent was left looking at an empty attendance history
  // for every past day, permanently, with no way to retry short of a reinstall. The
  // hook backfills those from the authenticated user and re-renders when they arrive.
  // Same fix as ParentHomework; this was the last screen still reading it once.
  const childInfo = useChildInfo();

  useEffect(() => {
    const fetchHistory = async () => {
      const studentId = childInfo?.studentId;
      const schoolId = childInfo?.schoolId;
      // Only the school is needed: for a parent the server resolves which children are
      // theirs and `studentId` merely narrows that. Requiring one here meant a parent
      // whose stored identity had no studentId — routine right after login, and the
      // page never re-read it — saw a permanently empty attendance history, while the
      // homework page (which never required it) worked fine for the same account.
      if (!schoolId || schoolId === 'explore-schools') return;

      setLoading(true);
      setError('');
      try {
        const { data: fetchedRecords } = await getAttendanceHistory(schoolId, {
          studentId,
          limit: 100,
        });
        setRecords(fetchedRecords);
      } catch (err) {
        console.error('Failed to fetch attendance history:', err);
        setError('Failed to load attendance logs.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [childInfo?.schoolId, childInfo?.studentId]);

  useEffect(() => {
    if (records.length === 0) {
      setOverviewStats({
        overallPercentage: 0,
        presentPercent: 0,
        absentPercent: 0,
        latePercent: 0,
        leavePercent: 0,
        holidayPercent: 0,
        presentDays: 0,
        totalDays: 0,
        absentDays: 0,
        lateDays: 0,
        leaveDays: 0,
        holidayDays: 0,
      });
      return;
    }

    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let leaveDays = 0;
    let holidayDays = 0;

    records.forEach(r => {
      // 'late' and 'half_day' are real statuses. Lateness used to be inferred from
      // remarks text, which the teacher's roster never actually writes.
      if (r.status === 'present') {
        presentDays++;
      } else if (r.status === 'late' || r.status === 'half_day') {
        lateDays++;
      } else if (r.status === 'absent') {
        absentDays++;
      } else if (r.status === 'leave') {
        leaveDays++;
      } else if (r.status === 'holiday') {
        holidayDays++;
      }
    });

    const totalDays = presentDays + absentDays + lateDays + leaveDays; // active school/working days
    const overallCount = records.length; // total records (including holidays)

    const overallPercentage = totalDays > 0 ? Math.round(((presentDays + lateDays) / totalDays) * 100) : 0;
    const presentPercent = overallCount > 0 ? Math.round((presentDays / overallCount) * 100) : 0;
    const absentPercent = overallCount > 0 ? Math.round((absentDays / overallCount) * 100) : 0;
    const latePercent = overallCount > 0 ? Math.round((lateDays / overallCount) * 100) : 0;
    const leavePercent = overallCount > 0 ? Math.round((leaveDays / overallCount) * 100) : 0;
    const holidayPercent = overallCount > 0 ? Math.round((holidayDays / overallCount) * 100) : 0;

    setOverviewStats({
      overallPercentage,
      presentPercent,
      absentPercent,
      latePercent,
      leavePercent,
      holidayPercent,
      presentDays,
      totalDays,
      absentDays,
      lateDays,
      leaveDays,
      holidayDays,
    });
  }, [records]);

  // Create a recordMap for quick lookup
  const recordMap = {};
  records.forEach(r => {
    const dateKey = getUTCDateString(r.date);
    recordMap[dateKey] = r;
  });

  const getAttendanceStatus = (year, month, day) => {
    const dateKey = getLocalDateString(year, month, day);
    const record = recordMap[dateKey];
    if (record) {
      // The calendar has no half-day swatch; it reads closest to 'late'.
      if (record.status === 'half_day') return 'late';
      return record.status; // 'present', 'absent', 'late', 'leave', 'holiday'
    }

    const dateObj = new Date(year, month, day);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0) return 'sunday';
    return 'none';
  };

  const handleScroll = (e) => {
    setScrolled(e.target.scrollTop > 50);
  };

  const handlePrevMonth = () => {
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  // Days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // First day of current month weekday (0 = Sunday, 1 = Monday, etc.)
  const startWeekday = new Date(year, month, 1).getDay();
  // Days in previous month
  const prevDaysInMonth = new Date(year, month, 0).getDate();

  const calendarDays = [];

  // 1. Previous Month Overflow days (Grayed out)
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevDaysInMonth - i;
    calendarDays.push({
      day: d.toString(),
      isCurrentMonth: false,
      date: new Date(year, month - 1, d)
    });
  }

  // 2. Current Month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    calendarDays.push({
      day: d.toString(),
      isCurrentMonth: true,
      date: date,
      status: getAttendanceStatus(year, month, d)
    });
  }

  // 3. Next Month Overflow days to complete a 6-row (42 cells) grid
  const remainingCells = 42 - calendarDays.length;
  for (let d = 1; d <= remainingCells; d++) {
    calendarDays.push({
      day: d.toString(),
      isCurrentMonth: false,
      date: new Date(year, month + 1, d)
    });
  }

  // Helper to retrieve details for currently selected day
  const getSelectedDayDetails = () => {
    const selYear = selectedDate.getFullYear();
    const selMonth = selectedDate.getMonth();
    const selDay = selectedDate.getDate();
    const dateKey = getLocalDateString(selYear, selMonth, selDay);
    const record = recordMap[dateKey];
    const remarks = record ? record.remarks : '';

    const status = getAttendanceStatus(selYear, selMonth, selDay);
    const dateTitle = formatSelectedDate(selectedDate);

    switch (status) {
      case 'present':
        return {
          dateTitle,
          statusLabel: 'Present',
          statusColor: 'text-[#34A853]',
          statusBg: 'bg-[#EBFBF0]',
          icon: <Check size={14} strokeWidth={3.5} className="text-white" />,
          iconWrapperBg: 'bg-[#34A853]',
          timeText: 'Marked at 09:15 AM',
          noteText: remarks || 'No remarks for this date.'
        };
      case 'absent':
        return {
          dateTitle,
          statusLabel: 'Absent',
          statusColor: 'text-[#D93025]',
          statusBg: 'bg-[#FEF3F2]',
          icon: <AlertCircle size={15} className="text-white" />,
          iconWrapperBg: 'bg-[#D93025]',
          timeText: 'Not Marked / Absent',
          noteText: remarks || 'Unexcused absence. Please submit leave application.'
        };
      case 'late':
        return {
          dateTitle,
          statusLabel: 'Late',
          statusColor: 'text-[#F2994A]',
          statusBg: 'bg-[#FFF6ED]',
          icon: <Clock size={14} className="text-white" />,
          iconWrapperBg: 'bg-[#F2994A]',
          timeText: 'Marked Late at 09:45 AM',
          noteText: remarks || 'Delayed by 15 minutes.'
        };
      case 'leave':
        return {
          dateTitle,
          statusLabel: 'Leave',
          statusColor: 'text-[#7F56D9]',
          statusBg: 'bg-[#F9F5FF]',
          icon: <FileText size={14} className="text-white" />,
          iconWrapperBg: 'bg-[#7F56D9]',
          timeText: 'Approved Leave',
          noteText: remarks || 'Medical leave approved by Principal.'
        };
      case 'holiday':
        return {
          dateTitle,
          statusLabel: 'Holiday',
          statusColor: 'text-[#7F56D9]',
          statusBg: 'bg-[#F9F5FF]',
          icon: <CalendarIcon size={14} className="text-white" />,
          iconWrapperBg: 'bg-[#7F56D9]',
          timeText: 'School Closed',
          noteText: remarks || 'Gazetted public holiday / School event day.'
        };
      case 'sunday':
        return {
          dateTitle,
          statusLabel: 'Weekend',
          statusColor: 'text-gray-400',
          statusBg: 'bg-gray-50',
          icon: <CalendarIcon size={14} className="text-white" />,
          iconWrapperBg: 'bg-gray-400',
          timeText: 'School Closed',
          noteText: 'Sunday - Weekly off.'
        };
      default:
        return {
          dateTitle,
          statusLabel: 'N/A',
          statusColor: 'text-gray-400',
          statusBg: 'bg-gray-50',
          icon: <AlertCircle size={14} className="text-white" />,
          iconWrapperBg: 'bg-gray-400',
          timeText: 'No Records',
          noteText: 'No records available.'
        };
    }
  };

  const details = getSelectedDayDetails();
  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // A signed-in parent whose `childInfo` was never written to this device still has an
  // identity through the auth store, and must not be shown the login wall. useChildInfo
  // returns null only when there is neither stored info nor an authenticated user.
  const isGuest = !childInfo;

  if (isGuest) {
    return (
      <>
        <AppHeader
          scrolled={scrolled}
          onMenuClick={() => setIsMenuOpen(true)}
          childInfo={null}
          transparentAtTop={false}
        />
        <div className="flex flex-col h-full bg-white pb-32 font-outfit overflow-y-auto">
          <div className="h-[140px] shrink-0"></div>
          <LoginRequired 
            title="Attendance Protected"
            message="Please login to view your child's daily class attendance logs and performance summary."
          />
        </div>
      </>
    );
  }

  return (
    <>
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

        {/* Calendar Nav Tabs */}
        <div className="px-6 mt-4">
          <div className="bg-white border border-gray-100/50 rounded-2xl p-1.5 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
            {['Calendar', 'Overview'].map((tab) => (
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

        {activeTab === 'Calendar' ? (
          <>
            {/* Attendance Calendar Card */}
            <div className="px-6 mt-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                {/* Calendar Card Header with Expanded Margin Bottom (mb-8) */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3.5">
                    <button 
                      onClick={handlePrevMonth}
                      className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors active:scale-90"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <h3 className="text-[14px] font-black text-gray-800">{monthsList[month]} {year}</h3>
                    <button 
                      onClick={handleNextMonth}
                      className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors active:scale-90"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  
                  <button className="px-2.5 py-1.5 bg-gray-50 border border-gray-100 text-[11px] font-black text-gray-600 rounded-xl flex items-center gap-1 hover:bg-gray-100 transition-colors">
                    Month <ChevronDown size={12} className="text-gray-400" />
                  </button>
                </div>

                {/* Weekdays Labels with Expanded Margin Bottom */}
                <div className="grid grid-cols-7 text-center text-[10px] font-black text-gray-400 mb-5 uppercase tracking-wider">
                  <div>Sun</div>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                </div>

                {/* Calendar Grid with Expanded Spacing (gap-y-5.5) */}
                <div className="grid grid-cols-7 gap-y-5.5 text-center mt-2.5">
                  {calendarDays.map((cell, idx) => {
                    const isSelected = selectedDate.getDate() === cell.date.getDate() &&
                                       selectedDate.getMonth() === cell.date.getMonth() &&
                                       selectedDate.getFullYear() === cell.date.getFullYear() &&
                                       cell.isCurrentMonth;
                    
                    let cellClass = "";
                    let dotClass = "";
                    
                    if (!cell.isCurrentMonth) {
                      cellClass = "text-gray-300 pointer-events-none";
                    } else {
                      switch (cell.status) {
                        case 'present':
                          cellClass = "text-[#34A853] bg-[#EBFBF0] hover:bg-[#D1F7DB]";
                          dotClass = "bg-[#34A853]";
                          break;
                        case 'absent':
                          cellClass = "text-[#D93025] bg-[#FEF3F2] hover:bg-[#FDD5D2]";
                          dotClass = "bg-[#D93025]";
                          break;
                        case 'late':
                          cellClass = "text-[#F2994A] bg-[#FFF6ED] hover:bg-[#FFE7CC]";
                          dotClass = "bg-[#F2994A]";
                          break;
                        case 'leave':
                          cellClass = "text-[#7F56D9] bg-[#F9F5FF] hover:bg-[#EAE0FF]";
                          dotClass = "bg-[#7F56D9]";
                          break;
                        case 'holiday':
                          cellClass = "text-[#7F56D9] bg-[#F9F5FF] border border-[#7F56D9]/15 hover:bg-[#EAE0FF]";
                          dotClass = "bg-[#7F56D9]";
                          break;
                        case 'sunday':
                          cellClass = "text-gray-400 bg-gray-50/50 hover:bg-gray-100/50";
                          break;
                        default:
                          cellClass = "text-gray-700 bg-transparent hover:bg-gray-50";
                      }
                    }

                    return (
                      <div 
                        key={idx}
                        onClick={() => cell.isCurrentMonth && setSelectedDate(cell.date)}
                        className={`w-9 h-9 mx-auto rounded-full flex flex-col items-center justify-center text-[12px] font-black transition-all duration-200 cursor-pointer relative ${cellClass} ${
                          isSelected ? 'ring-2 ring-[#5B3FD6] ring-offset-2 scale-105 shadow-sm font-black' : ''
                        }`}
                      >
                        {cell.status === 'holiday' ? 'H' : cell.day}
                        {/* Status Little Dot */}
                        {dotClass && <span className={`absolute bottom-1 w-1 h-1 rounded-full ${dotClass}`}></span>}
                      </div>
                    );
                  })}
                </div>

                {/* Calendar Legend Indicators */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5 mt-6 border-t border-gray-50 pt-4 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#34A853]"></span> Present
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D93025]"></span> Absent
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F2994A]"></span> Late
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#7F56D9]"></span> Leave
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-4 rounded-full bg-[#F9F5FF] border border-[#7F56D9]/15 flex items-center justify-center text-[9px] font-black text-[#7F56D9]">H</span> Holiday
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Date Details Section */}
            <div className="px-6 mt-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                <h4 className="text-[13px] font-black text-gray-800 mb-4">Selected Date Details</h4>

                <div className="flex flex-col gap-4">
                  {/* Row 1: Date */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F6F3FF] border border-[#5B3FD6]/10 flex items-center justify-center text-[#5B3FD6] shrink-0">
                      <CalendarIcon size={16} />
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-[#3B248C]">{details.dateTitle}</p>
                    </div>
                  </div>

                  {/* Row 2: Status */}
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${details.iconWrapperBg} flex items-center justify-center shrink-0 shadow-sm`}>
                      {details.icon}
                    </div>
                    <div>
                      <p className={`text-[13px] font-black ${details.statusColor}`}>{details.statusLabel}</p>
                      <p className="text-[10px] font-medium text-gray-400 mt-0.5">{details.timeText}</p>
                    </div>
                  </div>

                  {/* Row 3: Remarks Note */}
                  <div className="bg-gray-50 border border-gray-100/50 rounded-xl p-3.5 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[#7F56D9] shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
                      <FileText size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider leading-none">Note</p>
                      <p className="text-[11px] font-semibold text-gray-600 mt-1">{details.noteText}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Alert Banner: Good to know */}
            <div className="px-6 mt-4">
              <div className="bg-[#F9F5FF] border border-[#7F56D9]/10 rounded-2xl p-4 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-[#7F56D9]/10 flex items-center justify-center text-[#7F56D9] shrink-0">
                  <Lightbulb size={18} />
                </div>
                <div className="min-w-0">
                  <h5 className="text-[12px] font-black text-[#7F56D9]">Good to know</h5>
                  <p className="text-[11px] font-bold text-gray-500 leading-normal mt-1">
                    Regular attendance helps your child perform better and stay ahead in class.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 1. Attendance Summary Card (Slightly Bigger with Interactive Dropdowns) */}
            <div className="px-6 mt-4 animate-fade-in">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[15px] font-black text-gray-800">Attendance Summary</h3>
                  <div className="relative">
                    <button 
                      onClick={() => {
                        setShowSummaryDropdown(!showSummaryDropdown);
                        setShowTrendDropdown(false);
                      }}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-100 text-[11px] font-black text-gray-600 rounded-xl flex items-center gap-1.5 hover:bg-gray-100 transition-colors active:scale-95"
                    >
                      {summaryFilter} <ChevronDown size={11} className="text-gray-400" />
                    </button>
                    {showSummaryDropdown && (
                      <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-100/80 rounded-2xl shadow-xl z-20 py-1.5 animate-fade-in text-[11px] font-black text-gray-600 backdrop-blur-md">
                        {['This Month', 'Last Month', 'Last 3 Months', 'This Term'].map((option) => (
                          <button
                            key={option}
                            onClick={() => {
                              setSummaryFilter(option);
                              setShowSummaryDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-[#5B3FD6]/5 hover:text-[#5B3FD6] transition-colors"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  {/* Left: SVG Donut Chart (Slightly Bigger: w-32 h-32) */}
                  <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="54"
                        stroke="#F5F5F7"
                        strokeWidth="10"
                        fill="transparent"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="54"
                        stroke="url(#overviewGradient)"
                        strokeWidth="10"
                        fill="transparent"
                        strokeDasharray="339"
                        strokeDashoffset={overviewStats ? 339 - (339 * overviewStats.overallPercentage) / 100 : 339}
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out"
                      />
                      <defs>
                        <linearGradient id="overviewGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#34A853" />
                          <stop offset="50%" stopColor="#F2994A" />
                          <stop offset="100%" stopColor="#7F56D9" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-xl font-black text-gray-800 leading-none">
                        {overviewStats ? `${overviewStats.overallPercentage}%` : '--%'}
                      </span>
                      <span className="text-[9px] font-black text-gray-400 mt-1.5 uppercase leading-none tracking-tight">
                        Overall
                      </span>
                      <span className="text-[9px] font-black text-gray-400 uppercase leading-none tracking-tight">
                        Attendance
                      </span>
                    </div>
                  </div>

                  {/* Right: Legend (Slightly Bigger) */}
                  <div className="flex-1 flex flex-col gap-3">
                    {[
                      { label: 'Present', color: 'bg-[#34A853]', val: overviewStats ? `${overviewStats.presentPercent}%` : '-- %' },
                      { label: 'Absent', color: 'bg-[#D93025]', val: overviewStats ? `${overviewStats.absentPercent}%` : '-- %' },
                      { label: 'Late', color: 'bg-[#F2994A]', val: overviewStats ? `${overviewStats.latePercent}%` : '-- %' },
                      { label: 'Leave', color: 'bg-[#7F56D9]', val: overviewStats ? `${overviewStats.leavePercent}%` : '-- %' },
                      { label: 'Holiday', color: 'bg-[#7F56D9]/40', val: overviewStats ? `${overviewStats.holidayPercent}%` : '-- %' }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[12px] font-bold text-gray-500">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-3 h-3 rounded-full ${item.color}`}></span>
                          <span className="font-semibold text-gray-600">{item.label}</span>
                        </div>
                        <span className="font-black text-gray-700">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Monthly Trend Card (Slightly Bigger with Stacked Bars and Filters) */}
            <div className="px-6 mt-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[15px] font-black text-gray-800">Monthly Trend</h3>
                  <div className="relative">
                    <button 
                      onClick={() => {
                        setShowTrendDropdown(!showTrendDropdown);
                        setShowSummaryDropdown(false);
                      }}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-100 text-[11px] font-black text-gray-600 rounded-xl flex items-center gap-1.5 hover:bg-gray-100 transition-colors active:scale-95"
                    >
                      {trendFilter} <ChevronDown size={11} className="text-gray-400" />
                    </button>
                    {showTrendDropdown && (
                      <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-100/80 rounded-2xl shadow-xl z-20 py-1.5 animate-fade-in text-[11px] font-black text-gray-600 backdrop-blur-md">
                        {['Last 6 Months', 'Last 12 Months', 'This Year'].map((option) => (
                          <button
                            key={option}
                            onClick={() => {
                              setTrendFilter(option);
                              setShowTrendDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-[#5B3FD6]/5 hover:text-[#5B3FD6] transition-colors"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Trend Bars Layout (Taller & Thicker Bars: h-36, w-4) */}
                <div className="flex gap-4 items-end justify-between px-2 mb-6">
                  {/* Y-Axis Grid labels */}
                  <div className="flex flex-col justify-between h-36 text-[10px] font-black text-gray-400 pr-2 border-r border-gray-50">
                    <span>100%</span>
                    <span>50%</span>
                    <span>0%</span>
                  </div>

                  {/* 6 Months Stacked Bars */}
                  {[
                    { label: 'Dec', pres: 'h-[65%]', late: 'h-[15%]', abs: 'h-[10%]', leav: 'h-[10%]' },
                    { label: 'Jan', pres: 'h-[60%]', late: 'h-[18%]', abs: 'h-[12%]', leav: 'h-[10%]' },
                    { label: 'Feb', pres: 'h-[72%]', late: 'h-[12%]', abs: 'h-[8%]', leav: 'h-[8%]' },
                    { label: 'Mar', pres: 'h-[70%]', late: 'h-[14%]', abs: 'h-[10%]', leav: 'h-[6%]' },
                    { label: 'Apr', pres: 'h-[68%]', late: 'h-[16%]', abs: 'h-[10%]', leav: 'h-[6%]' },
                    { label: 'May', pres: 'h-[65%]', late: 'h-[15%]', abs: 'h-[10%]', leav: 'h-[10%]' }
                  ].map((item, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2.5">
                      <div className="w-4 bg-gray-50/50 border border-gray-100/50 rounded-full h-36 flex flex-col justify-end overflow-hidden">
                        {/* Present */}
                        <span className={`w-full bg-[#34A853] ${item.pres} rounded-t-sm`}></span>
                        {/* Late */}
                        <span className={`w-full bg-[#F2994A] ${item.late}`}></span>
                        {/* Absent */}
                        <span className={`w-full bg-[#D93025] ${item.abs}`}></span>
                        {/* Leave */}
                        <span className={`w-full bg-[#7F56D9] ${item.leav} rounded-b-sm`}></span>
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">{item.label}</span>
                    </div>
                  ))}
                </div>

                {/* 5 Small Inline Cards (Slightly Bigger with gap-2) */}
                <div className="grid grid-cols-5 gap-2 mt-3">
                  {[
                    { label: 'Present', val: overviewStats ? `${overviewStats.presentPercent}%` : '--%', iconColor: 'text-[#34A853]', bg: 'bg-[#EBFBF0]', border: 'border-[#34A853]/10' },
                    { label: 'Absent', val: overviewStats ? `${overviewStats.absentPercent}%` : '--%', iconColor: 'text-[#D93025]', bg: 'bg-[#FEF3F2]', border: 'border-[#D93025]/10' },
                    { label: 'Late', val: overviewStats ? `${overviewStats.latePercent}%` : '--%', iconColor: 'text-[#F2994A]', bg: 'bg-[#FFF6ED]', border: 'border-[#F2994A]/10' },
                    { label: 'Leave', val: overviewStats ? `${overviewStats.leavePercent}%` : '--%', iconColor: 'text-[#7F56D9]', bg: 'bg-[#F9F5FF]', border: 'border-[#7F56D9]/10' },
                    { label: 'Holiday', val: overviewStats ? `${overviewStats.holidayPercent}%` : '--%', iconColor: 'text-[#7F56D9]', bg: 'bg-[#F9F5FF]', border: 'border-[#7F56D9]/10', isH: true }
                  ].map((card, idx) => (
                    <div key={idx} className={`rounded-xl p-2.5 border ${card.border} ${card.bg} flex flex-col items-center justify-center text-center shadow-[0_1px_3px_rgba(0,0,0,0.01)]`}>
                      {card.isH ? (
                        <span className="w-4.5 h-4.5 rounded-full bg-[#7F56D9]/15 flex items-center justify-center text-[9px] font-black text-[#7F56D9] mb-1">H</span>
                      ) : (
                        <Check size={12} className={`${card.iconColor} mb-1`} strokeWidth={3.5} />
                      )}
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-tight leading-none mb-1">{card.label}</p>
                      <p className="text-[11px] font-black text-gray-700 leading-none">{card.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Quick Stats Card (Slightly Bigger with More Padding and Larger Icons) */}
            <div className="px-6 mt-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                <h3 className="text-[15px] font-black text-gray-800 mb-5">Quick Stats</h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* Present Days */}
                  <div className="bg-gray-50/50 border border-gray-100/50 rounded-2xl p-4.5 flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#EBFBF0] flex items-center justify-center text-[#34A853] shrink-0">
                      <CalendarIcon size={18} />
                    </div>
                    <div>
                      <p className="text-[14.5px] font-black text-gray-850 leading-none">
                        {overviewStats ? `${overviewStats.presentDays} / ${overviewStats.totalDays}` : '-- / --'}
                      </p>
                      <p className="text-[10px] font-black text-gray-500 mt-2 uppercase tracking-wider leading-none">Days Present</p>
                      <p className="text-[9.5px] font-semibold text-gray-400 mt-1">
                        {overviewStats ? `${overviewStats.presentPercent}% of total` : '--% of total'}
                      </p>
                    </div>
                  </div>

                  {/* Absent Days */}
                  <div className="bg-gray-50/50 border border-gray-100/50 rounded-2xl p-4.5 flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#FEF3F2] flex items-center justify-center text-[#D93025] shrink-0">
                      <AlertCircle size={18} />
                    </div>
                    <div>
                      <p className="text-[14.5px] font-black text-gray-850 leading-none">
                        {overviewStats ? `${overviewStats.absentDays} / ${overviewStats.totalDays}` : '-- / --'}
                      </p>
                      <p className="text-[10px] font-black text-gray-500 mt-2 uppercase tracking-wider leading-none">Days Absent</p>
                      <p className="text-[9.5px] font-semibold text-gray-400 mt-1">
                        {overviewStats ? `${overviewStats.absentPercent}% of total` : '--% of total'}
                      </p>
                    </div>
                  </div>

                  {/* Late Days */}
                  <div className="bg-gray-50/50 border border-gray-100/50 rounded-2xl p-4.5 flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#FFF6ED] flex items-center justify-center text-[#F2994A] shrink-0">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-[14.5px] font-black text-gray-855 leading-none">
                        {overviewStats ? `${overviewStats.lateDays}` : '--'}
                      </p>
                      <p className="text-[10px] font-black text-gray-500 mt-2 uppercase tracking-wider leading-none">Days Late</p>
                      <p className="text-[9.5px] font-semibold text-gray-400 mt-1">
                        {overviewStats ? `${overviewStats.latePercent}% of total` : '--% of total'}
                      </p>
                    </div>
                  </div>

                  {/* Leave Days */}
                  <div className="bg-gray-50/50 border border-gray-100/50 rounded-2xl p-4.5 flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#F9F5FF] flex items-center justify-center text-[#7F56D9] shrink-0">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[14.5px] font-black text-gray-855 leading-none">
                        {overviewStats ? `${overviewStats.leaveDays}` : '--'}
                      </p>
                      <p className="text-[10px] font-black text-gray-500 mt-2 uppercase tracking-wider leading-none">Days Leave</p>
                      <p className="text-[9.5px] font-semibold text-gray-400 mt-1">
                        {overviewStats ? `${overviewStats.leavePercent}% of total` : '--% of total'}
                      </p>
                    </div>
                  </div>

                  {/* Holidays Spanning 2 columns */}
                  <div className="bg-gray-50/50 border border-gray-100/50 rounded-2xl p-4.5 flex items-start gap-3.5 col-span-2">
                    <div className="w-10 h-10 rounded-xl bg-[#F9F5FF] border border-[#7F56D9]/15 flex items-center justify-center text-[#7F56D9] shrink-0">
                      <span className="text-[11.5px] font-black leading-none">H</span>
                    </div>
                    <div>
                      <p className="text-[14.5px] font-black text-gray-855 leading-none">
                        {overviewStats ? `${overviewStats.holidayDays}` : '--'}
                      </p>
                      <p className="text-[10px] font-black text-gray-500 mt-2 uppercase tracking-wider leading-none">Holidays</p>
                      <p className="text-[9.5px] font-semibold text-gray-400 mt-1">
                        {overviewStats ? `${overviewStats.holidayPercent}% of total` : '--% of total'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Banner: Consistency matters! */}
            <div className="px-6 mt-4">
              <div className="bg-[#F9F5FF] border border-[#7F56D9]/10 rounded-2xl p-4.5 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-[#7F56D9]/10 flex items-center justify-center text-[#7F56D9] shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div className="min-w-0">
                  <h5 className="text-[12px] font-black text-[#7F56D9]">Consistency matters!</h5>
                  <p className="text-[11px] font-bold text-gray-500 leading-normal mt-1">
                    Regular attendance helps your child build better learning habits and stay ahead in class.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ParentAttendance;
