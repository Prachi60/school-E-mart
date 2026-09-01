import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Package, School, Eye, Edit2, Trash2, CheckCircle2,
  AlertCircle, Loader2, RefreshCw, Filter, Layers, Tag, DollarSign,
  Ban, Check, Sparkles, UserX
} from 'lucide-react';
import { listKits, listSchools, updateKit, deleteKit } from '../../../services/schoolApi';
import { getErrorMessage } from '../../../utils/apiHelpers';
import { toAbsoluteUrl } from '../../../utils/url';
import KitSaleCountdown from '../../components/KitSaleCountdown';

const CATEGORY_OPTIONS = [
  'All Categories',
  'Textbooks & Notebooks',
  'School Uniforms',
  'Stationary Packs',
  'Winter Kit',
  'Initial Kit',
  'Project Kit',
];

const SchoolKitsManagement = () => {
  const navigate = useNavigate();

  const [kits, setKits] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showCount, setShowCount] = useState(10);

  // Load Schools & Kits
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [schoolsRes, kitsRes] = await Promise.all([
        listSchools({ limit: 100 }).catch((err) => {
          console.error('Failed to load schools:', err);
          return { data: [] };
        }),
        listKits('all', { limit: 100 }).catch((err) => {
          console.error('Failed to load kits:', err);
          return { data: [] };
        }),
      ]);

      const schoolsList = Array.isArray(schoolsRes) ? schoolsRes : (schoolsRes?.data || []);
      const kitsList = Array.isArray(kitsRes) ? kitsRes : (kitsRes?.data || kitsRes?.kits || []);

      setSchools(schoolsList);
      setKits(kitsList);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load school kits'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Kit Status Toggle (Active <-> Draft)
  const handleToggleStatus = async (kit) => {
    const kitId = kit._id || kit.id;
    const schoolId = kit.schoolId?._id || kit.schoolId || 'all';
    const newStatus = kit.status === 'active' ? 'draft' : 'active';
    setActionId(kitId);

    try {
      await updateKit(schoolId, kitId, { status: newStatus });
      setKits((prev) =>
        prev.map((k) => ((k._id || k.id) === kitId ? { ...k, status: newStatus } : k))
      );
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to update kit status'));
    } finally {
      setActionId(null);
    }
  };

  // Handle Delete Kit
  const handleDeleteKit = async (kit) => {
    const kitId = kit._id || kit.id;
    const schoolId = kit.schoolId?._id || kit.schoolId || 'all';

    if (!window.confirm(`Are you sure you want to delete kit "${kit.name}"? This action cannot be undone.`)) {
      return;
    }

    setActionId(kitId);
    try {
      await deleteKit(schoolId, kitId);
      setKits((prev) => prev.filter((k) => (k._id || k.id) !== kitId));
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to delete kit'));
    } finally {
      setActionId(null);
    }
  };

  // Filtered Kits Logic
  const filteredKits = useMemo(() => {
    return kits.filter((kit) => {
      const sId = kit.schoolId?._id || kit.schoolId;
      const matchesSchool = selectedSchoolId === 'all' || String(sId) === String(selectedSchoolId);
      const matchesCategory =
        selectedCategory === 'All Categories' || kit.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || kit.status === selectedStatus;

      const q = searchQuery.toLowerCase().trim();
      const schoolName = kit.schoolId?.name || '';
      const schoolCode = kit.schoolId?.schoolRefNo || kit.schoolId?.code || '';
      const matchesSearch =
        !q ||
        kit.name.toLowerCase().includes(q) ||
        schoolName.toLowerCase().includes(q) ||
        schoolCode.toLowerCase().includes(q) ||
        (kit.category && kit.category.toLowerCase().includes(q));

      return matchesSchool && matchesCategory && matchesStatus && matchesSearch;
    });
  }, [kits, selectedSchoolId, selectedCategory, selectedStatus, searchQuery]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = kits.length;
    const active = kits.filter((k) => k.status === 'active').length;
    const draft = kits.filter((k) => k.status === 'draft').length;
    const schoolSet = new Set(
      kits.map((k) => k.schoolId?._id || k.schoolId).filter(Boolean)
    );
    return { total, active, draft, schoolsCount: schoolSet.size };
  }, [kits]);

  return (
    <div className="space-y-6 font-outfit pb-24">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-purple-50 text-[#3b2d7d] border border-purple-100 rounded-lg text-[9px] font-black uppercase tracking-wider">
              Procurement Catalog
            </span>
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">School Kits Management</h1>
          <p className="text-xs font-medium text-gray-400 mt-1">
            Manage, edit, and publish kits across all partner schools system-wide.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={loadData}
            title="Refresh data"
            className="p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-2xl transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/superadmin/create-kit')}
            className="px-5 py-3 bg-[#3b2d7d] hover:bg-[#4a3a99] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md shadow-purple-950/15 flex items-center gap-2 transition-all active:scale-95 shrink-0"
          >
            <Plus size={16} className="stroke-[3]" />
            <span>Add Kit for School</span>
          </button>
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/70 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border bg-purple-50 text-[#3b2d7d] border-purple-100">
            <Package size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Kits</p>
            <h3 className="text-xl font-black text-gray-900 leading-tight">{stats.total}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/70 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border bg-emerald-50 text-emerald-600 border-emerald-100">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Active Kits</p>
            <h3 className="text-xl font-black text-gray-900 leading-tight">{stats.active}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/70 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border bg-amber-50 text-amber-600 border-amber-100">
            <Tag size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Draft Kits</p>
            <h3 className="text-xl font-black text-gray-900 leading-tight">{stats.draft}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/70 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border bg-indigo-50 text-indigo-600 border-indigo-100">
            <School size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Schools with Kits</p>
            <h3 className="text-xl font-black text-gray-900 leading-tight">{stats.schoolsCount}</h3>
          </div>
        </div>
      </div>

      {/* Filters & Control Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search kit or school name…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2d7d]/20 placeholder-gray-400"
            />
          </div>

          {/* School Selector Filter */}
          <div>
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2d7d]/20"
            >
              <option value="all">All Partner Schools ({schools.length})</option>
              {schools.map((s) => (
                <option key={s._id || s.id} value={s._id || s.id}>
                  {s.name} {s.schoolRefNo ? `(${s.schoolRefNo})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2d7d]/20"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2d7d]/20"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="draft">Draft Only</option>
            </select>
          </div>

          {/* Show Entries */}
          <div>
            <select
              value={showCount}
              onChange={(e) => setShowCount(parseInt(e.target.value, 10))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2d7d]/20"
            >
              <option value={10}>Show 10</option>
              <option value={25}>Show 25</option>
              <option value={50}>Show 50</option>
              <option value={100}>Show 100</option>
              <option value={10000}>Show All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-600 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Kits Table Section */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-[#3b2d7d]" />
            <span className="text-xs font-black text-gray-500">Loading school kits list…</span>
          </div>
        ) : filteredKits.length === 0 ? (
          <div className="py-20 text-center space-y-3 px-4">
            <Package size={48} className="text-gray-300 mx-auto" />
            <h3 className="text-sm font-black text-gray-800">No kits found</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              No school procurement kits match the current filters or search criteria.
            </p>
            <button
              type="button"
              onClick={() => navigate('/superadmin/create-kit')}
              className="mt-2 px-5 py-2.5 bg-[#3b2d7d] text-white text-xs font-black rounded-xl shadow-sm inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> Create New Kit
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse select-none">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  <th className="py-4 px-5">Kit Image & Name</th>
                  <th className="py-4 px-5">Target School</th>
                  <th className="py-4 px-5">Category & Class</th>
                  <th className="py-4 px-5">Items</th>
                  <th className="py-4 px-5">Price (MRP)</th>
                  <th className="py-4 px-5">Coverage</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredKits.slice(0, showCount).map((kit) => {
                  const kitId = kit._id || kit.id;
                  const schoolObj = kit.schoolId;
                  const schoolName = typeof schoolObj === 'object' ? schoolObj?.name : 'Explore Schools';
                  const schoolCode = typeof schoolObj === 'object' ? schoolObj?.schoolRefNo || schoolObj?.code : '';
                  const schoolIdVal = typeof schoolObj === 'object' ? schoolObj?._id || schoolObj?.id : schoolObj;

                  const price = kit.pricePaise ? (kit.pricePaise / 100).toFixed(0) : '0';
                  const mrp = kit.mrpPaise ? (kit.mrpPaise / 100).toFixed(0) : null;
                  const avatar = toAbsoluteUrl(kit.imageId?.storageKey || kit.imageUrl);

                  return (
                    <tr key={kitId} className="hover:bg-purple-50/20 transition-colors">
                      {/* Image & Kit Name */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 p-1 shrink-0 overflow-hidden flex items-center justify-center">
                            {avatar ? (
                              <img src={avatar} alt={kit.name} className="w-full h-full object-contain" />
                            ) : (
                              <Package size={20} className="text-purple-400" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-gray-900 leading-snug">{kit.name}</h4>
                            <span className="text-[10px] text-gray-400 font-bold block mt-0.5">{kit.sku || `KIT-${kitId.slice(-6)}`}</span>
                          </div>
                        </div>
                      </td>

                      {/* School Name */}
                      <td className="py-4 px-5">
                        <span className="text-xs font-extrabold text-gray-800 block">{schoolName}</span>
                        {schoolCode && (
                          <span className="text-[9px] font-black uppercase text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                            {schoolCode}
                          </span>
                        )}
                      </td>

                      {/* Category & Class */}
                      <td className="py-4 px-5">
                        <span className="text-xs font-bold text-gray-700 block">{kit.category || 'General Kit'}</span>
                        <span className="text-[10px] text-gray-400 font-extrabold block">{kit.classGrade || 'All Classes'}</span>
                      </td>

                      {/* Included Items Count */}
                      <td className="py-4 px-5">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-[10px] font-black inline-flex items-center gap-1">
                          <Package size={11} className="text-[#3b2d7d]" />
                          {(kit.items || []).length} Items
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-4 px-5">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-black text-[#3b2d7d]">₹{Number(price).toLocaleString()}</span>
                          {mrp && Number(mrp) > Number(price) && (
                            <span className="text-[10px] font-bold text-gray-400 line-through">₹{Number(mrp).toLocaleString()}</span>
                          )}
                        </div>
                      </td>

                      {/* Coverage — how many of the students this kit targets
                          still haven't got it. Blank when the school has no
                          roster to measure against. */}
                      <td className="py-4 px-5">
                        {kit.coverage?.eligibleCount > 0 ? (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 border ${
                              kit.coverage.pendingCount > 0
                                ? 'bg-orange-50 text-orange-700 border-orange-200/80'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            }`}
                          >
                            <UserX size={10} className="stroke-[3]" />
                            {kit.coverage.pendingCount} / {kit.coverage.eligibleCount} pending
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-300">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        <div className="flex flex-col items-start gap-1">
                          {kit.status === 'active' ? (
                            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                              <CheckCircle2 size={10} className="stroke-[3]" /> Active
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                              <Tag size={10} /> Draft
                            </span>
                          )}
                          {/* An active kit past its window is still listed here
                              but unbuyable in the parent app. */}
                          {kit.status === 'active' && (
                            <KitSaleCountdown endsAt={kit.purchaseWindow?.endsAt} variant="admin" />
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/superadmin/create-kit?schoolId=${schoolIdVal}&kitId=${kitId}`
                              )
                            }
                            title="Edit Kit"
                            className="w-8 h-8 rounded-xl border border-gray-200 text-gray-600 hover:text-[#3b2d7d] hover:bg-purple-50 hover:border-purple-200 flex items-center justify-center transition-all"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Toggle Status Button */}
                          <button
                            type="button"
                            disabled={actionId === kitId}
                            onClick={() => handleToggleStatus(kit)}
                            title={kit.status === 'active' ? 'Deactivate Kit' : 'Activate Kit'}
                            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all disabled:opacity-50 ${
                              kit.status === 'active'
                                ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {actionId === kitId ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : kit.status === 'active' ? (
                              <Ban size={13} />
                            ) : (
                              <Check size={13} className="stroke-[3]" />
                            )}
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            disabled={actionId === kitId}
                            onClick={() => handleDeleteKit(kit)}
                            title="Delete Kit"
                            className="w-8 h-8 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all disabled:opacity-50"
                          >
                            {actionId === kitId ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchoolKitsManagement;
