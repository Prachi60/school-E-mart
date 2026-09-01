import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight, ArrowLeft, Bell, Info,
  CheckCircle2, ShoppingBag, RotateCcw,
  Megaphone, ShieldCheck, ChevronDown,
  Star, Package, ListChecks, AlertCircle, Loader2,
  Check, Sparkles, Trophy, ShoppingCart, Lock, Tag, Users
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AppHeader from '../../components/AppHeader';
import SectionHeader from '../../components/SectionHeader';
import LoginRequired from '../../components/LoginRequired';
import AuthPrompt from '../../components/AuthPrompt';
import { getSchool, listNotices } from '../../../services/schoolApi';
import { toAbsoluteUrl } from '../../../utils/url';
import { getChildInfoFromStorage, useChildInfo } from '../../../utils/parentContext';
import { useKitProcurementProgress } from '../../../hooks/useKitProcurementProgress';
import KitSaleCountdown from '../../components/KitSaleCountdown';
import useAuthStore from '../../../store/useAuthStore';

const MySchoolPage = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const activeChildInfo = useChildInfo();
  const childInfo = activeChildInfo || {
    name: 'Guest',
    school: 'Explore Schools',
    grade: 'Select Grade',
    schoolId: null,
  };

  const isGuest = !localStorage.getItem('childInfo') && !useAuthStore.getState().user;
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(isGuest);

  const progress = useKitProcurementProgress(childInfo, { isGuest });
  const schoolId = progress.schoolId;

  const [announcements, setAnnouncements] = useState([]);
  const [noticesLoading, setNoticesLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState('All');
  const [activeGradeFilter, setActiveGradeFilter] = useState('My Class');

  // Load School Name
  const loadSchool = useCallback(async () => {
    if (!schoolId) return;
    try {
      const school = await getSchool(schoolId);
      setChildInfo((prev) => ({
        ...prev,
        school: school?.name || prev.school,
      }));
    } catch {
      // keep fallback
    }
  }, [schoolId]);

  useEffect(() => {
    loadSchool();
  }, [loadSchool]);

  // Display-shape the already grade-filtered kits the hook fetched, tagging
  // each with its purchased state for the card UI below.
  const kits = progress.kits.map((k) => {
    const imageUrl = toAbsoluteUrl(k.imageId?.storageKey || k.imageUrl || k.image?.url);
    const avatar = imageUrl
      ? imageUrl
      : `https://ui-avatars.com/api/?background=3b2d7d&color=fff&bold=true&name=${encodeURIComponent(k.name || 'Kit')}`;
    const price = ((k.pricePaise || 0) / 100).toFixed(0);
    const mrp = k.mrpPaise ? ((k.mrpPaise || 0) / 100).toFixed(0) : null;

    return {
      id: k._id || k.id,
      name: k.name,
      desc: k.description || '',
      category: k.category || 'General Kit',
      classes: k.classGrade || 'All Classes',
      itemsCount: (k.items || []).length,
      price,
      mrp,
      avatar,
      isPurchased: progress.isPurchased(k),
      // Both null unless the admin has the kit sale window switched on.
      saleStartsAt: k.purchaseWindow?.startsAt || null,
      saleEndsAt: k.purchaseWindow?.endsAt || null,
      raw: k,
    };
  });

  // Load School Notices
  useEffect(() => {
    let cancelled = false;

    const loadNotices = async () => {
      if (!schoolId || isGuest) {
        setAnnouncements([]);
        setNoticesLoading(false);
        return;
      }

      setNoticesLoading(true);
      try {
        const { data } = await listNotices(schoolId, { limit: 5 });
        if (!cancelled) {
          setAnnouncements(
            (data || []).map((notice) => ({
              id: notice._id || notice.id,
              title: notice.title,
              date: notice.publishedAt || notice.createdAt
                ? new Date(notice.publishedAt || notice.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                : '',
            }))
          );
        }
      } catch {
        if (!cancelled) setAnnouncements([]);
      } finally {
        if (!cancelled) setNoticesLoading(false);
      }
    };

    loadNotices();
    return () => {
      cancelled = true;
    };
  }, [schoolId, isGuest]);

  // Sync Child Info on storage event
  useEffect(() => {
    const handleUpdate = () => {
      const saved = getChildInfoFromStorage();
      if (saved) {
        setChildInfo((prev) => ({
          ...prev,
          name: saved.name || prev.name,
          school: saved.school || prev.school,
          grade: saved.grade || prev.grade,
          schoolId: saved.schoolId || prev.schoolId,
        }));
      }
    };
    window.addEventListener('storage', handleUpdate);
    return () => window.removeEventListener('storage', handleUpdate);
  }, []);

  const handleScroll = (e) => {
    const scrollPos = e.target.scrollTop;
    setScrolled(scrollPos > 50);
  };

  // `kits` (above) is already grade-filtered by the shared hook — no need to
  // filter it again here.
  const categories = ['All', ...Array.from(new Set(kits.map((k) => k.category).filter(Boolean)))];

  const displayedKits = kits.filter((k) => {
    if (activeCategory === 'All') return true;
    return k.category === activeCategory;
  });

  // Gamification Metrics — sourced from the shared hook so this page's numbers
  // can never drift from the Home page's for the same parent.
  const { totalKits, purchasedCount, remainingCount, progressPercent } = progress;
  const kitsLoading = progress.loading;

  return (
    <>
      <AppHeader
        scrolled={scrolled}
        onMenuClick={() => setIsMenuOpen(true)}
        childInfo={childInfo}
      />
      <div
        onScroll={handleScroll}
        className="flex flex-col h-full bg-gray-50/50 pb-32 font-outfit overflow-y-auto"
      >
        <div className="h-[140px] shrink-0"></div>

        {isGuest ? (
          <LoginRequired
            title="School Store Protected"
            message="Please login to see procurement kits, notices, and mandatory items specifically for your child's school."
          />
        ) : !schoolId ? (
          <div className="px-6 py-12 text-center bg-white border border-gray-200 rounded-3xl m-6 space-y-4">
            <Package size={48} className="text-gray-300 mx-auto" />
            <h3 className="text-base font-black text-gray-800">No School Selected</h3>
            <p className="text-xs text-gray-400 font-bold max-w-sm mx-auto">
              Please link your child's school in your profile to view class procurement kits.
            </p>
            <button
              type="button"
              onClick={() => navigate('/user/profile-setup')}
              className="px-6 py-3 bg-[#3b2d7d] text-white text-xs font-black rounded-2xl shadow-md"
            >
              Select Your School
            </button>
          </div>
        ) : (
          <>
            {/* Student Profile Header Bar */}
            <div className="px-6 py-4 bg-white border-b border-gray-200/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-purple-100 text-[#3b2d7d] border border-purple-200/80 rounded-2xl flex items-center justify-center font-black text-base shadow-xs">
                  {(childInfo.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 leading-tight">{childInfo.name}</h2>
                  <span className="text-[11px] text-purple-700 font-extrabold block mt-0.5">
                    {childInfo.school} • {childInfo.grade}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 pt-6 space-y-8">
              
              {/* GAMIFICATION PROGRESS HERO CARD */}
              <section>
                <div className="bg-gradient-to-br from-[#3b2d7d] via-[#4a3a99] to-[#2c2060] rounded-[2.5rem] p-6 sm:p-7 text-white shadow-xl shadow-purple-900/15 relative overflow-hidden">
                  {/* Decorative background blurs */}
                  <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-purple-400/20 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute right-12 top-0 w-24 h-24 bg-amber-400/15 rounded-full blur-xl pointer-events-none" />

                  <div className="relative z-10 space-y-5">
                    {/* Header line */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center backdrop-blur-md text-amber-300 border border-white/20 shadow-inner shrink-0">
                          <Trophy size={24} />
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-purple-200 uppercase tracking-widest block">
                            {childInfo.grade || 'Class Procurement'}
                          </span>
                          <h2 className="text-lg font-black tracking-tight text-white leading-none">
                            Procurement Readiness
                          </h2>
                        </div>
                      </div>

                      {totalKits > 0 && purchasedCount === totalKits && (
                        <span className="px-3 py-1 bg-emerald-400 text-emerald-950 text-[10px] font-black uppercase tracking-wider rounded-full shadow-md shrink-0 flex items-center gap-1">
                          <CheckCircle2 size={13} className="stroke-[3]" /> 100% Ready
                        </span>
                      )}
                    </div>

                    {/* Progress Bar Container */}
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-purple-100 flex items-center gap-1.5 font-extrabold">
                          <Sparkles size={14} className="text-amber-300" />
                          <span>{purchasedCount} of {totalKits} Kits Purchased</span>
                        </span>
                        <span className="text-amber-300 font-black text-sm">{progressPercent}%</span>
                      </div>

                      {/* Smooth Progress Bar */}
                      <div className="w-full h-3 bg-black/25 rounded-full overflow-hidden p-0.5 border border-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 rounded-full transition-all duration-1000 shadow-sm"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>

                      {/* Gamification Motivation Text */}
                      <div className="text-[11px] font-bold text-purple-100 flex items-center justify-between pt-0.5">
                        {totalKits === 0 ? (
                          <span>No procurement kits configured for your school yet.</span>
                        ) : remainingCount > 0 ? (
                          <span className="leading-snug">
                            🔥 You have purchased <strong className="text-amber-300 font-black">{purchasedCount} kit{purchasedCount !== 1 ? 's' : ''}</strong>! Only <strong className="text-amber-300 font-black">{remainingCount} left</strong> to complete your child's class setup.
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
              </section>

              {/* SCHOOL KITS SECTION */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-gray-900 tracking-tight">
                      Class Kits {childInfo.grade ? `(${childInfo.grade})` : ''}
                    </h2>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">Official procurement kits for {childInfo.school}</p>
                  </div>

                  <span className="px-3 py-1 bg-purple-50 text-[#3b2d7d] border border-purple-100/80 rounded-xl text-xs font-black">
                    {childInfo.grade || 'My Class'}
                  </span>
                </div>

                {/* Category Pills */}
                {categories.length > 2 && (
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-2 rounded-full text-xs font-black shrink-0 transition-all border ${
                          activeCategory === cat
                            ? 'bg-[#3b2d7d] border-[#3b2d7d] text-white shadow-xs'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {/* Kits Grid */}
                {kitsLoading ? (
                  <div className="py-16 text-center text-gray-400 font-bold flex flex-col items-center gap-3 bg-white rounded-3xl border border-gray-150 p-6">
                    <Loader2 size={28} className="animate-spin text-[#3b2d7d]" />
                    <span className="text-xs font-black text-gray-500">Loading school kits...</span>
                  </div>
                ) : displayedKits.length === 0 ? (
                  <div className="text-center py-14 bg-white border border-dashed border-gray-200 rounded-3xl p-8 space-y-2">
                    <Package size={40} className="text-gray-300 mx-auto" />
                    <h3 className="text-xs font-black text-gray-700">No kits found</h3>
                    <p className="text-[11px] text-gray-400 font-medium">
                      No active kits found for this class category yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedKits.map((kit) => (
                      <div
                        key={kit.id}
                        className={`bg-white rounded-2xl p-3.5 border transition-all shadow-2xs hover:shadow-md flex flex-col gap-2.5 relative overflow-hidden ${
                          kit.isPurchased
                            ? 'border-emerald-300 bg-emerald-50/20'
                            : 'border-gray-200/80 hover:border-[#3b2d7d]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          {/* Left Thumbnail + Info Stack */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gray-50 border border-gray-150 p-1 shrink-0 overflow-hidden flex items-center justify-center">
                              {kit.avatar ? (
                                <img src={kit.avatar} alt={kit.name} className="w-full h-full object-contain" />
                              ) : (
                                <Package size={24} className="text-purple-300" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              {/* Category & Purchased Status Pills */}
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span className="px-2 py-0.5 bg-purple-50 text-[#3b2d7d] border border-purple-100 rounded-md text-[9px] font-black uppercase tracking-wider">
                                  {kit.category}
                                </span>
                                {kit.isPurchased ? (
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

                              {/* Items & Class grade info */}
                              <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-gray-400">
                                <span className="flex items-center gap-0.5">
                                  <Users size={10} className="text-[#3b2d7d]" />
                                  {kit.classes}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <Package size={10} className="text-[#3b2d7d]" />
                                  {kit.itemsCount} Items
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Price & CTA Action */}
                          <div className="flex flex-col items-end justify-between self-stretch shrink-0 py-0.5 pl-3 border-l border-gray-100">
                            <div className="text-right">
                              <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">Price</span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-black text-[#3b2d7d] leading-none">₹{kit.price}</span>
                                {kit.mrp && Number(kit.mrp) > Number(kit.price) && (
                                  <span className="text-[10px] text-gray-400 font-bold line-through">₹{kit.mrp}</span>
                                )}
                              </div>
                            </div>

                            {kit.isPurchased ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/user/kit/${kit.id}`)}
                                className="mt-2 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-black text-[10px] uppercase rounded-lg transition-all flex items-center gap-1 active:scale-95"
                              >
                                <Check size={11} className="stroke-[3]" />
                                <span>View</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => navigate(`/user/kit/${kit.id}`)}
                                className="mt-2 px-3.5 py-1.5 bg-[#3b2d7d] hover:bg-[#2c2060] text-white font-black text-[10px] uppercase rounded-lg shadow-xs transition-all flex items-center gap-1 active:scale-95"
                              >
                                <ShoppingCart size={11} />
                                <span>Buy</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Live for the whole window, from the day the school
                            published the kit to the moment it closes. Hitting
                            zero removes the kit from this list, so refetch
                            rather than leave a card that can't be bought. */}
                        {!kit.isPurchased && (
                          <KitSaleCountdown
                            startsAt={kit.saleStartsAt}
                            endsAt={kit.saleEndsAt}
                            onExpire={progress.reload}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* SCHOOL ANNOUNCEMENTS / NOTICES */}
              <section className="bg-white border border-gray-200/80 rounded-3xl p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <Megaphone size={18} className="text-[#3b2d7d]" />
                  <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">School Notices</h2>
                </div>
                {noticesLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 size={24} className="animate-spin text-[#3b2d7d]" />
                  </div>
                ) : announcements.length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold text-center py-4">No school notices published yet.</p>
                ) : (
                  <div className="space-y-3.5">
                    {announcements.map((msg) => (
                      <div key={msg.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-150">
                        <div className="w-2 h-2 bg-[#3b2d7d] rounded-full mt-1.5 shrink-0" />
                        <div>
                          <h4 className="text-xs font-black text-gray-900 leading-tight">{msg.title}</h4>
                          <p className="text-[10px] text-gray-400 font-bold mt-0.5 uppercase">{msg.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

            </div>
          </>
        )}
      </div>
      <AuthPrompt
        isOpen={isAuthPromptOpen}
        onClose={() => setIsAuthPromptOpen(false)}
        title="School Store Protected"
        message="Login to see procurement kits, notices, and mandatory items specifically for your child's school."
      />
    </>
  );
};

export default MySchoolPage;
