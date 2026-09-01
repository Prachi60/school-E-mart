import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Search, Users, CheckCircle2, XCircle, Package,
  Loader2, AlertCircle, ShoppingBag, Phone, Mail, CreditCard,
  Timer, TimerOff,
} from 'lucide-react';
import { getKitPurchases } from '../../../services/schoolApi';
import KitSaleCountdown from '../../components/KitSaleCountdown';
import { useSchoolId } from '../../../utils/schoolContext';
import { getErrorMessage } from '../../../utils/apiHelpers';

const paymentStatusStyle = (status) => {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'partially_paid') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (status === 'failed') return 'bg-red-50 text-red-600 border-red-100';
  return 'bg-gray-50 text-gray-500 border-gray-150';
};

const SchoolKitPurchasesPage = () => {
  const navigate = useNavigate();
  const schoolId = useSchoolId();
  const { kitId } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('purchased'); // 'purchased' | 'not_purchased'
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!schoolId || !kitId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getKitPurchases(schoolId, kitId);
      setReport(data || null);
    } catch (err) {
      setReport(null);
      setError(getErrorMessage(err, 'Unable to load purchase report'));
    } finally {
      setLoading(false);
    }
  }, [schoolId, kitId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredPurchases = (report?.purchases || []).filter((p) =>
    !search || p.parentName?.toLowerCase().includes(search.toLowerCase()) ||
    p.orderNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredNotPurchased = (report?.notPurchased || []).filter((c) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPurchasedChildren = (report?.purchasedChildren || []).filter((c) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-24 font-outfit">

      {/* Top Sticky Header */}
      <div className="bg-[#3b2d7d] text-white px-6 py-6 sticky top-0 z-50 rounded-b-[2rem] shadow-lg flex items-center gap-4 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/school/kits')}
          className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all text-white border border-white/10 shrink-0"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-black leading-tight truncate">{report?.kit?.name || 'Kit Purchases'}</h1>
          <span className="text-[11px] text-purple-200 font-bold block mt-0.5">
            Who has purchased this kit — and who hasn&apos;t yet
          </span>
        </div>
      </div>

      {loading && (
        <div className="text-center py-20">
          <Loader2 size={32} className="text-[#3b2d7d] mx-auto block animate-spin" />
          <span className="text-xs font-black text-gray-500 block mt-3">Loading purchase report…</span>
        </div>
      )}

      {!loading && error && (
        <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200/80 rounded-2xl text-xs font-bold text-red-600 flex items-center gap-2.5">
          <AlertCircle size={18} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {!loading && report && (
        <>
          {/* Metric Cards */}
          <div className="px-6 pt-6 overflow-x-auto scrollbar-none">
            <div className="flex sm:grid sm:grid-cols-4 gap-3 min-w-[560px] pb-1">
              <div className="flex-1 bg-white border border-gray-200/80 p-3.5 rounded-2xl shadow-sm text-center">
                <div className="w-8 h-8 rounded-full bg-purple-50 text-[#3b2d7d] flex items-center justify-center mx-auto border border-purple-100">
                  <ShoppingBag size={15} />
                </div>
                <span className="text-[10px] text-gray-400 font-bold block mt-2">Total Orders</span>
                <span className="text-sm font-black text-deep-purple block mt-0.5">{report.totalOrders}</span>
              </div>
              <div className="flex-1 bg-white border border-gray-200/80 p-3.5 rounded-2xl shadow-sm text-center">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                  <Users size={15} />
                </div>
                <span className="text-[10px] text-gray-400 font-bold block mt-2">Eligible Students</span>
                <span className="text-sm font-black text-deep-purple block mt-0.5">{report.totalEligibleChildren}</span>
              </div>
              <div className="flex-1 bg-white border border-gray-200/80 p-3.5 rounded-2xl shadow-sm text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                  <CheckCircle2 size={15} />
                </div>
                <span className="text-[10px] text-gray-400 font-bold block mt-2">Purchased</span>
                <span className="text-sm font-black text-deep-purple block mt-0.5">{report.purchasedChildrenCount}</span>
              </div>
              <div className="flex-1 bg-white border border-gray-200/80 p-3.5 rounded-2xl shadow-sm text-center">
                <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mx-auto border border-orange-100">
                  <XCircle size={15} />
                </div>
                <span className="text-[10px] text-gray-400 font-bold block mt-2">Not Purchased</span>
                <span className="text-sm font-black text-deep-purple block mt-0.5">{report.notPurchasedCount}</span>
              </div>
            </div>
          </div>

          {/* Why the Not Purchased list may have stopped moving: once the sale
              window closes, none of the students left on it can still buy. */}
          {report.kit?.purchaseWindow?.endsAt && (
            <div className="px-6 pt-4">
              {report.kit.purchaseWindow.expired ? (
                <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-start gap-2.5">
                  <TimerOff size={18} className="shrink-0 text-rose-500 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-rose-800">
                      Sale window closed on{' '}
                      {new Date(report.kit.purchaseWindow.endsAt).toLocaleDateString('en-GB')}
                    </p>
                    <p className="text-[11px] font-bold text-rose-700/80 mt-0.5 leading-relaxed">
                      This kit is hidden from parents who never bought it, so the{' '}
                      {report.notPurchasedCount} student{report.notPurchasedCount === 1 ? '' : 's'} below
                      can no longer order it. Re-publish the kit from the kits list to reopen the window.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-2.5">
                  <Timer size={18} className="shrink-0 text-amber-600 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-black text-amber-900">Sale window still open</p>
                      <KitSaleCountdown endsAt={report.kit.purchaseWindow.endsAt} variant="admin" />
                    </div>
                    <p className="text-[11px] font-bold text-amber-800/80 mt-0.5 leading-relaxed">
                      After that the kit auto-hides from the {report.notPurchasedCount} student
                      {report.notPurchasedCount === 1 ? '' : 's'} who haven&apos;t bought it yet.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {report.kit?.classGrade && (
            <p className="px-6 pt-3 text-[11px] font-bold text-gray-400">
              Coverage scoped to <span className="text-[#3b2d7d]">{report.kit.classGrade}</span> — the kit&apos;s target class.
            </p>
          )}

          {/* Search */}
          <div className="px-6 pt-5">
            <div className="relative flex items-center w-full">
              <Search size={16} className="absolute left-4.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by parent, student, or order number..."
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-deep-purple focus:outline-none focus:border-[#3b2d7d]/50 transition-colors shadow-inner"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('purchased')}
              className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border ${
                tab === 'purchased'
                  ? 'bg-[#3b2d7d] text-white border-[#3b2d7d] shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              Purchased ({report.purchasedChildrenCount})
            </button>
            <button
              type="button"
              onClick={() => setTab('not_purchased')}
              className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border ${
                tab === 'not_purchased'
                  ? 'bg-[#3b2d7d] text-white border-[#3b2d7d] shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              Not Purchased ({report.notPurchasedCount})
            </button>
          </div>

          {/* Purchased tab: orders list */}
          {tab === 'purchased' && (
            <div className="px-6 py-5 space-y-3">
              {filteredPurchases.length === 0 && (
                <div className="text-center py-14 bg-white border border-gray-150 rounded-[2rem] shadow-sm">
                  <Package size={40} className="text-gray-300 mx-auto block" />
                  <span className="text-xs font-black text-gray-500 block mt-3">No purchases yet</span>
                </div>
              )}
              {filteredPurchases.map((p) => (
                <div key={p.orderId} className="bg-white border border-gray-200/80 rounded-3xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-deep-purple truncate">{p.parentName}</h4>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 font-bold flex-wrap">
                        {p.parentPhone && (
                          <span className="flex items-center gap-1"><Phone size={10} /> {p.parentPhone}</span>
                        )}
                        {p.parentEmail && (
                          <span className="flex items-center gap-1"><Mail size={10} /> {p.parentEmail}</span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border shrink-0 ${paymentStatusStyle(p.paymentStatus)}`}>
                      {p.paymentStatus?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-[10px] font-bold text-gray-400">
                    <span>#{p.orderNumber}</span>
                    <span className="flex items-center gap-1"><CreditCard size={11} /> Qty {p.quantity}</span>
                    <span>{p.purchasedAt ? new Date(p.purchasedAt).toLocaleDateString('en-GB') : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Purchased tab also shows which students are covered, for context */}
          {tab === 'purchased' && filteredPurchasedChildren.length > 0 && (
            <div className="px-6 pb-5">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 px-1">Covered Students</h3>
              <div className="bg-white border border-gray-200/80 rounded-3xl divide-y divide-gray-100 shadow-sm overflow-hidden">
                {filteredPurchasedChildren.map((c) => (
                  <div key={c.childId} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                      <span className="text-xs font-black text-gray-800 truncate">{c.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 shrink-0">
                      {c.grade}{c.rollNo ? ` • Roll ${c.rollNo}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not purchased tab */}
          {tab === 'not_purchased' && (
            <div className="px-6 py-5">
              {filteredNotPurchased.length === 0 ? (
                <div className="text-center py-14 bg-white border border-gray-150 rounded-[2rem] shadow-sm">
                  <CheckCircle2 size={40} className="text-emerald-300 mx-auto block" />
                  <span className="text-xs font-black text-gray-500 block mt-3">Everyone eligible has purchased this kit 🎉</span>
                </div>
              ) : (
                <div className="bg-white border border-gray-200/80 rounded-3xl divide-y divide-gray-100 shadow-sm overflow-hidden">
                  {filteredNotPurchased.map((c) => (
                    <div key={c.childId} className="px-4 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <XCircle size={15} className="text-orange-400 shrink-0" />
                        <span className="text-xs font-black text-gray-800 truncate">{c.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 shrink-0">
                        {c.grade}{c.rollNo ? ` • Roll ${c.rollNo}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SchoolKitPurchasesPage;
