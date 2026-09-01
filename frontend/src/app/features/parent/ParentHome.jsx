import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home, Search, ShoppingBag, User,
  ChevronDown, Bell, Sparkles, Package,
  Shirt, Book, PenTool, Footprints,
  ArrowRight, Star, ShoppingCart, Filter, Play,
  Grid, Layout, CheckCircle2, BookOpen, Check, Trophy, ChevronRight
} from 'lucide-react';
import AppHeader from '../../components/AppHeader';
import { getAttendanceHistory, fetchParentHomework, listParentNotices } from '../../../services/parentApi';
import { useKitProcurementProgress } from '../../../hooks/useKitProcurementProgress';
import { useChildInfo } from '../../../utils/parentContext';
import { toLocalDateKey, toUtcDateKey } from '../../../utils/date';
import { buildHomeworkStats, mapAssignmentForParentHomework } from '../../../utils/mappers/parentMapper';
import ProductCard from '../../components/ProductCard';
import SectionHeader from '../../components/SectionHeader';
import CategoryStory from '../../components/CategoryStory';
import { useDraggableScroll } from '../../hooks/useDraggableScroll';
import AuthPrompt from '../../components/AuthPrompt';
import RecentUpdates from './RecentUpdates';
import QuickActions from './QuickActions';
import ParentLearningHub from './ParentLearningHub';
import RecommendedKits from './RecommendedKits';
import KitSaleCountdown from '../../components/KitSaleCountdown';
import PromoCategoryBanners from './PromoCategoryBanners';
import ReelsRow from './ReelsRow';
import { useCategoryTree } from '../../../hooks/useCategoryTree';
import { useProducts } from '../../../hooks/useProducts';
import { findHeaderCategory } from '../../../utils/mappers/categoryMapper';
import { toAbsoluteUrl } from '../../../utils/url';

import useAuthStore from '../../../store/useAuthStore';

const ParentHome = () => {
  const navigate = useNavigate();
  const notifRef = useDraggableScroll();
  const catsRef = useDraggableScroll();
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);

  const activeChildInfo = useChildInfo();
  const childInfo = activeChildInfo || {
    name: "Guest",
    school: "Explore Schools",
    grade: "Select Grade",
    phone: ""
  };

  const isGuest = !localStorage.getItem('childInfo') && !useAuthStore.getState().user;
  const { tree: categoryTree } = useCategoryTree();
  const { products: essentialProducts, loading: essentialLoading } = useProducts({ limit: 4, sort: 'popular' });
  const uniformsHeader = findHeaderCategory(categoryTree, 'uniforms');
  const stationeryHeader = findHeaderCategory(categoryTree, 'stationery');
  const { products: uniformProducts } = useProducts(
    { headerId: uniformsHeader?.id, limit: 2, sort: 'popular' },
    { enabled: Boolean(uniformsHeader?.id) }
  );
  const { products: stationeryProducts } = useProducts(
    { headerId: stationeryHeader?.id, limit: 2, sort: 'popular' },
    { enabled: Boolean(stationeryHeader?.id) }
  );

  const categories = categoryTree.map((cat) => ({
    name: cat.name,
    image: cat.image,
    slug: cat.slug,
  }));

  const [todayAttendance, setTodayAttendance] = useState(null);
  const [pendingHomeworkCount, setPendingHomeworkCount] = useState(0);
  const [noticeAlerts, setNoticeAlerts] = useState([]);
  const kitStats = useKitProcurementProgress(childInfo, { isGuest });

  const getResolvedContext = () => {
    let studentId = childInfo?.studentId;
    let schoolId = childInfo?.schoolId;

    if (!studentId || !schoolId || schoolId === 'explore-schools') {
      try {
        const authUser = useAuthStore.getState().user;
        if (authUser) {
          studentId = studentId || authUser.studentId || authUser.childProfile?.studentId || authUser.profile?.studentId || authUser.childProfileId || authUser._id;
          if (!schoolId || schoolId === 'explore-schools') {
            schoolId = authUser.tenantSchoolId || authUser.schoolId;
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (!schoolId || schoolId === 'explore-schools') {
      try {
        const selected = localStorage.getItem('selectedSchool');
        if (selected) {
          const parsed = JSON.parse(selected);
          schoolId = parsed._id || parsed.id;
        }
      } catch (e) {
        // ignore
      }
    }

    return { studentId, schoolId };
  };

  useEffect(() => {
    const fetchTodayAttendance = async () => {
      const { studentId, schoolId } = getResolvedContext();
      if (!schoolId || schoolId === 'explore-schools') return;

      try {
        const today = toLocalDateKey();
        const { data: records } = await getAttendanceHistory(schoolId, studentId ? { studentId, date: today } : { date: today });
        if (records && records.length > 0) {
          setTodayAttendance(records[0]);
        } else {
          // If no specific single-date record returned, query recent history to find today's entry
          const { data: recentRecords } = await getAttendanceHistory(schoolId, studentId ? { studentId, limit: 10 } : { limit: 10 });
          // Records are stamped at UTC midnight, so the calendar day has to be read back
          // in UTC. Converting to the local day first lands on the previous date for any
          // viewer west of UTC, which showed yesterday's status as today's.
          const todayRecord = (recentRecords || []).find((r) => toUtcDateKey(r.date) === today);
          setTodayAttendance(todayRecord || null);
        }
      } catch (err) {
        console.error('Failed to fetch today attendance:', err);
      }
    };
    fetchTodayAttendance();
  }, [childInfo?.schoolId, childInfo?.studentId]);

  useEffect(() => {
    const loadHomeworkSummary = async () => {
      const { studentId, schoolId } = getResolvedContext();
      if (!schoolId || schoolId === 'explore-schools') return;

      try {
        const res = await fetchParentHomework(schoolId, childInfo?.grade, studentId);
        const rows = res?.homework || (Array.isArray(res) ? res : []);
        const mapped = rows.map(({ assignment, course, submission }) =>
          mapAssignmentForParentHomework(assignment, course, submission)
        );
        setPendingHomeworkCount(buildHomeworkStats(mapped).pending);
      } catch (err) {
        console.error('Failed to load homework summary:', err);
        setPendingHomeworkCount(0);
      }
    };
    loadHomeworkSummary();
  }, [childInfo?.schoolId, childInfo?.studentId, childInfo?.grade]);

  useEffect(() => {
    const loadNoticeAlerts = async () => {
      const { schoolId } = getResolvedContext();
      if (!schoolId || schoolId === 'explore-schools') {
        setNoticeAlerts([]);
        return;
      }
      try {
        const { data } = await listParentNotices(schoolId, { limit: 3 });
        setNoticeAlerts(
          (data || []).slice(0, 2).map((notice) => ({
            id: notice._id || notice.id,
            text: notice.title || notice.summary || 'New school notice',
          }))
        );
      } catch {
        setNoticeAlerts([]);
      }
    };
    loadNoticeAlerts();
  }, [childInfo?.schoolId]);

  const getTodayStatusDetails = () => {
    if (!todayAttendance) {
      return {
        label: 'Pending',
        color: 'text-[#F2994A]',
        bg: 'bg-[#FEF6EC]',
        dotBg: 'bg-[#F2994A]',
        time: 'Not marked yet',
        icon: <BookOpen size={12} strokeWidth={2.5} />
      };
    }
    const status = todayAttendance.status;
    const remarks = todayAttendance.remarks;
    if (status === 'present' && remarks === 'Late') {
      return {
        label: 'Late',
        color: 'text-[#F2994A]',
        bg: 'bg-[#FFF6ED]',
        dotBg: 'bg-[#F2994A]',
        time: 'Marked at 09:45 a.m.',
        icon: <Check size={12} strokeWidth={3.5} />
      };
    }
    if (status === 'present') {
      return {
        label: 'Present',
        color: 'text-[#34A853]',
        bg: 'bg-[#EBFBF0]',
        dotBg: 'bg-[#34A853]',
        time: 'Marked at 09:15 a.m.',
        icon: <Check size={12} strokeWidth={3.5} />
      };
    }
    if (status === 'absent') {
      return {
        label: 'Absent',
        color: 'text-[#D93025]',
        bg: 'bg-[#FEF3F2]',
        dotBg: 'bg-[#D93025]',
        time: 'Absent today',
        icon: <Check size={12} strokeWidth={3.5} />
      };
    }
    if (status === 'leave') {
      return {
        label: 'Leave',
        color: 'text-[#7F56D9]',
        bg: 'bg-[#F9F5FF]',
        dotBg: 'bg-[#7F56D9]',
        time: 'Approved leave',
        icon: <Check size={12} strokeWidth={3.5} />
      };
    }
    return {
      label: 'Holiday',
      color: 'text-[#7F56D9]',
      bg: 'bg-[#F9F5FF]',
      dotBg: 'bg-[#7F56D9]',
      time: 'School closed',
      icon: <Check size={12} strokeWidth={3.5} />
    };
  };

  const todayDetails = getTodayStatusDetails();

  const handleScroll = (e) => {
    const scrollPos = e.target.scrollTop;
    setScrolled(scrollPos > 50);
  };

  const products = essentialProducts;

  const renderProductCard = (product) => (
    <ProductCard key={product.id} product={product} />
  );

  return (
    <>
            <AppHeader
        scrolled={scrolled}
        onMenuClick={() => setIsMenuOpen(true)}
        childInfo={childInfo}
        transparentAtTop={true}
      />
      <div
        onScroll={handleScroll}
        className="flex flex-col h-full bg-gray-50/50 pb-40 overflow-y-auto overflow-x-hidden w-full font-outfit"
      >
        {/* Flat Purple Header Background Block */}
        <div className="bg-gradient-to-b from-[#3B248C] to-[#5B3FD6] h-[160px] w-full relative shrink-0">
          {/* Soft Premium Warm Accent Glows */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#FFC933]/15 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16 blur-2xl pointer-events-none"></div>
        </div>

        {/* Today at a Glance Overlapping Section (Narrower and floating halfway) */}
        {!isGuest && (
          <div className="relative z-10 -mt-10 mx-5 sm:mx-6 bg-white rounded-2xl p-5 shadow-lg border border-gray-100/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-deep-purple">Today at a Glance</h2>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              {/* Attendance Status Card */}
              <div 
                onClick={() => navigate('/user/attendance')}
                className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md active:scale-[0.98] transition-all duration-300 cursor-pointer"
              >
                {/* Double Ring Badge */}
                <div className={`w-9 h-9 rounded-full ${todayDetails.bg} flex items-center justify-center shrink-0`}>
                  <div className={`w-[26px] h-[26px] rounded-full ${todayDetails.dotBg} flex items-center justify-center text-white shadow-sm`}>
                    {todayDetails.icon}
                  </div>
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <p className="text-[11px] font-semibold text-gray-500 leading-none">Attendance</p>
                  <p className={`text-[13px] font-black ${todayDetails.color} leading-none mt-1.5 truncate`}>{todayDetails.label}</p>
                  <p className="text-[9px] font-medium text-gray-400 leading-none mt-1 truncate">{todayDetails.time}</p>
                </div>
              </div>

              {/* Homework Summary Card */}
              <div 
                onClick={() => navigate('/user/homework')}
                className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md active:scale-[0.98] transition-all duration-300 cursor-pointer"
              >
                {/* Double Ring Orange Book Badge */}
                <div className="w-9 h-9 rounded-full bg-[#FFF6ED] flex items-center justify-center shrink-0">
                  <div className="w-[26px] h-[26px] rounded-full bg-[#F2994A] flex items-center justify-center text-white shadow-sm">
                    <BookOpen size={12} strokeWidth={2.5} />
                  </div>
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <p className="text-[11px] font-semibold text-gray-500 leading-none">Homework</p>
                  <p className="text-[13px] font-black text-[#F2994A] leading-none mt-1.5 truncate">
                    {pendingHomeworkCount} Pending
                  </p>
                  <p className="text-[9px] font-medium text-gray-400 leading-none mt-1 truncate">
                    {pendingHomeworkCount > 0 ? 'Check homework' : 'All caught up'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isGuest && noticeAlerts.length > 0 && (
          <div className="mt-4">
            <div ref={notifRef} className="flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-hide select-none active:cursor-grabbing">
              {noticeAlerts.map((notif, idx) => (
                <button
                  key={notif.id}
                  onClick={() => navigate('/user/notifications')}
                  className={`min-w-[280px] ${idx === 0 ? 'bg-accent-gold/10 border-accent-gold/20' : 'bg-primary/10 border-primary/20'} border px-4 py-3 rounded-2xl flex items-center gap-3 active:scale-95 transition-all cursor-pointer text-left`}
                >
                  {idx === 0 ? (
                    <Sparkles size={16} className="text-accent-gold shrink-0" />
                  ) : (
                    <Bell size={16} className="text-primary shrink-0" />
                  )}
                  <p className="text-[11px] font-semibold text-deep-purple leading-tight">
                    {notif.text}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Gamification Procurement Readiness Card (Matching MySchool page) */}
        {!isGuest && (
          <div className="px-6 mt-6">
            <div
              onClick={() => navigate('/user/my-school')}
              className="bg-gradient-to-br from-[#3b2d7d] via-[#4a3a99] to-[#2c2060] rounded-[2.5rem] p-6 sm:p-7 text-white shadow-xl shadow-purple-900/15 relative overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 group"
            >
              {/* Decorative background blurs */}
              <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-purple-400/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute right-12 top-0 w-24 h-24 bg-amber-400/15 rounded-full blur-xl pointer-events-none" />

              <div className="relative z-10 space-y-5">
                {/* Header line */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center backdrop-blur-md text-amber-300 border border-white/20 shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                      <Trophy size={24} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-purple-200 uppercase tracking-widest block">
                        {childInfo.grade || 'Class Procurement'}
                      </span>
                      <h2 className="text-lg font-black tracking-tight text-white leading-none flex items-center gap-1.5">
                        Procurement Readiness
                        <ChevronRight size={18} className="text-purple-300 group-hover:translate-x-1 transition-transform shrink-0" />
                      </h2>
                    </div>
                  </div>

                  {kitStats.totalKits > 0 && kitStats.purchasedCount === kitStats.totalKits ? (
                    <span className="px-3 py-1 bg-emerald-400 text-emerald-950 text-[10px] font-black uppercase tracking-wider rounded-full shadow-md shrink-0 flex items-center gap-1">
                      <CheckCircle2 size={13} className="stroke-[3]" /> 100% Ready
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-white/15 backdrop-blur-md text-white border border-white/20 text-[10px] font-extrabold uppercase tracking-wider rounded-full shadow-sm shrink-0 flex items-center gap-1 group-hover:bg-white/25 transition-colors">
                      View Kits <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  )}
                </div>

                {/* Progress Bar Container */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-purple-100 flex items-center gap-1.5 font-extrabold">
                      <Sparkles size={14} className="text-amber-300" />
                      <span>{kitStats.purchasedCount} of {kitStats.totalKits} Kits Purchased</span>
                    </span>
                    <span className="text-amber-300 font-black text-sm">{kitStats.progressPercent}%</span>
                  </div>

                  {/* Smooth Progress Bar */}
                  <div className="w-full h-3 bg-black/25 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 rounded-full transition-all duration-1000 shadow-sm"
                      style={{ width: `${kitStats.progressPercent}%` }}
                    />
                  </div>

                  {/* Gamification Motivation Text */}
                  <div className="text-[11px] font-bold text-purple-100 flex items-center justify-between pt-0.5">
                    {kitStats.totalKits === 0 ? (
                      <span>No procurement kits configured for your school yet.</span>
                    ) : kitStats.remainingCount > 0 ? (
                      <span className="leading-snug">
                        🔥 You have purchased <strong className="text-amber-300 font-black">{kitStats.purchasedCount} kit{kitStats.purchasedCount !== 1 ? 's' : ''}</strong>! Only <strong className="text-amber-300 font-black">{kitStats.remainingCount} left</strong> to complete your child's class setup.
                      </span>
                    ) : (
                      <span className="text-emerald-300 font-black">
                        🎉 Awesome! All required procurement kits for your child's class have been purchased.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline-style Recent Updates Section */}
        {!isGuest && <RecentUpdates />}

        {/* Quick Actions Grid Section */}
        <QuickActions />

        {/* Official School Procurement Kits Section on Dashboard */}
        {!isGuest && kitStats.kits && kitStats.kits.length > 0 && (
          <div className="mt-6 font-outfit">
            <SectionHeader
              title={`Class Kits ${childInfo.grade ? `(${childInfo.grade})` : ''}`}
              onViewAll={() => navigate('/user/my-school')}
            />
            <div className="px-6 space-y-3.5 mt-3">
              {kitStats.kits.slice(0, 4).map((kit) => {
                const id = kit._id || kit.id;
                const imageUrl = toAbsoluteUrl(kit.imageId?.storageKey || kit.imageUrl || kit.image?.url);
                const avatar = imageUrl
                  ? imageUrl
                  : `https://ui-avatars.com/api/?background=3b2d7d&color=fff&bold=true&name=${encodeURIComponent(kit.name || 'Kit')}`;
                const price = ((kit.pricePaise || 0) / 100).toFixed(0);
                const mrp = kit.mrpPaise ? ((kit.mrpPaise || 0) / 100).toFixed(0) : null;
                const isPurchased = kitStats.isPurchased(kit);
                const itemsCount = (kit.items || []).length;

                return (
                  <div
                    key={id}
                    onClick={() => navigate(`/user/kit/${id}`)}
                    className={`bg-white rounded-2xl p-3.5 border transition-all shadow-2xs hover:shadow-md flex flex-col gap-2.5 relative overflow-hidden cursor-pointer active:scale-[0.99] ${
                      isPurchased
                        ? 'border-emerald-300 bg-emerald-50/20'
                        : 'border-gray-200/80 hover:border-[#3b2d7d]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Left Thumbnail + Info Stack */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-150 p-1 shrink-0 overflow-hidden flex items-center justify-center">
                          {avatar ? (
                            <img src={avatar} alt={kit.name} className="w-full h-full object-contain" />
                          ) : (
                            <Package size={24} className="text-purple-300" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Category & Status Badges */}
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="px-2 py-0.5 bg-purple-50 text-[#3b2d7d] border border-purple-100 rounded-md text-[9px] font-black uppercase tracking-wider">
                              {kit.category || 'General Kit'}
                            </span>
                            {isPurchased ? (
                              <span className="px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-0.5 shadow-2xs">
                                <CheckCircle2 size={10} className="stroke-[3]" />
                                Purchased
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-[8px] font-black uppercase tracking-wider">
                                Required
                              </span>
                            )}
                          </div>

                          {/* Kit Name */}
                          <h3 className="text-xs font-black text-gray-900 leading-snug truncate">
                            {kit.name}
                          </h3>

                          {/* Items & Grade */}
                          <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-gray-400">
                            <span className="flex items-center gap-0.5">
                              <Package size={10} className="text-[#3b2d7d]" />
                              {itemsCount} Items
                            </span>
                            <span>•</span>
                            <span>{kit.classGrade || childInfo.grade || 'All Classes'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Price & CTA */}
                      <div className="flex flex-col items-end justify-between self-stretch shrink-0 py-0.5 pl-3 border-l border-gray-100">
                        <div className="text-right">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">Price</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-[#3b2d7d] leading-none">₹{price}</span>
                            {mrp && Number(mrp) > Number(price) && (
                              <span className="text-[10px] text-gray-400 font-bold line-through">₹{mrp}</span>
                            )}
                          </div>
                        </div>

                        {isPurchased ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/user/kit/${id}`);
                            }}
                            className="mt-2 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-black text-[10px] uppercase rounded-lg transition-all flex items-center gap-1 active:scale-95"
                          >
                            <Check size={11} className="stroke-[3]" />
                            <span>View</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/user/kit/${id}`);
                            }}
                            className="mt-2 px-3.5 py-1.5 bg-[#3b2d7d] hover:bg-[#2c2060] text-white font-black text-[10px] uppercase rounded-lg shadow-xs transition-all flex items-center gap-1 active:scale-95"
                          >
                            <ShoppingCart size={11} />
                            <span>Buy</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Live for the whole window, from the day the school
                        published the kit to the moment it closes. */}
                    {!isPurchased && (
                      <KitSaleCountdown
                        startsAt={kit.purchaseWindow?.startsAt}
                        endsAt={kit.purchaseWindow?.endsAt}
                        onExpire={kitStats.reload}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Learning Hub Section */}
        <ParentLearningHub />

        <RecommendedKits 
          isGuest={isGuest} 
          onAuthRequired={() => setIsAuthPromptOpen(true)} 
        />

        <div className="mt-8">
          <SectionHeader title="Categories" />
          <div className="flex gap-5 overflow-x-auto px-6 pb-2 scrollbar-hide">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-400 px-2 py-4">No categories available</p>
            ) : (
              categories.map((cat) => (
                <CategoryStory
                  key={cat.name}
                  name={cat.name}
                  image={cat.image}
                  to={`/user/category/${cat.slug || cat.name.toLowerCase()}`}
                />
              ))
            )}
          </div>
        </div>

        {/* Admin Uploaded Promo Banners (Placed Below Categories) */}
        <PromoCategoryBanners />

        <div className="mt-10 pb-6">
          <SectionHeader
            title="Essential Products"
            onViewAll={() => navigate('/user/products')}
          />
          <div className="grid grid-cols-2 gap-4 px-6">
            {essentialLoading ? (
              <p className="col-span-2 text-center text-sm text-gray-400 py-6">Loading products...</p>
            ) : (
              products.map((product) => renderProductCard(product))
            )}
          </div>
        </div>

        <div className="mt-4 px-6">
          <h2 className="text-lg font-semibold text-deep-purple mb-4">Uniforms</h2>
          <div className="rounded-2xl overflow-hidden mb-4 shadow-md border border-gray-100 bg-white">
            <img src="/assets/category_banner1.png" className="w-full h-auto max-h-[280px] object-contain block mx-auto" alt="Uniforms" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {uniformProducts.map((product) => renderProductCard(product))}
          </div>
        </div>

        <div className="mt-8 px-6 pb-12">
          <h2 className="text-lg font-semibold text-deep-purple mb-4">Stationery</h2>
          <div className="rounded-2xl overflow-hidden mb-4 shadow-md border border-gray-100 bg-white">
            <img src="/assets/category_banner3.png" className="w-full h-auto max-h-[280px] object-contain block mx-auto" alt="Stationery" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stationeryProducts.map((product) => renderProductCard(product))}
          </div>
        </div>

        <ReelsRow />
      </div>

      <AuthPrompt
        isOpen={isAuthPromptOpen}
        onClose={() => setIsAuthPromptOpen(false)}
        title="Complete Your Kit"
        message="Login to add these recommended school kits to your cart and ensure your child is session-ready!"
      />
    </>
  );
};

export default ParentHome;
