import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Filter, ChevronDown, Check, X,
  MoreVertical, Package, CheckCircle, AlertCircle, Plus,
  Users, Layers, Award, Tag, Sparkles, ShoppingBag, Eye, Loader2,
  Pencil, Trash2, Power, ToggleLeft, ToggleRight, UserX, TimerOff
} from 'lucide-react';
import { listKits, updateKit, deleteKit } from '../../../services/schoolApi';
import { useSchoolId } from '../../../utils/schoolContext';
import { getErrorMessage } from '../../../utils/apiHelpers';
import { toAbsoluteUrl } from '../../../utils/url';
import KitSaleCountdown from '../../components/KitSaleCountdown';

const mapKit = (k) => {
  const imageUrl = toAbsoluteUrl(k.imageId?.storageKey || k.imageUrl || k.image?.url);
  const avatar = imageUrl ? imageUrl : `https://ui-avatars.com/api/?background=3b2d7d&color=fff&bold=true&name=${encodeURIComponent(k.name || 'Kit')}`;
  const itemsList = (k.items || []).map((item) => {
    return {
      name: item.name || item.masterProductId?.name || 'Item',
      qty: item.qty || 1,
      attributes: item.attributes || {},
      productType: item.masterProductId?.productType || 'general',
    };
  });
  const vendorName = k.vendorId?.storeName || k.vendorId?.businessName || k.vendorId?.name || 'Assigned Vendor';
  return {
    id: k._id,
    name: k.name,
    desc: k.description || '',
    category: k.category || 'General',
    tag: k.category || 'Kit',
    classes: k.classGrade || 'All classes',
    itemsCount: (k.items || []).length,
    itemsList,
    price: ((k.pricePaise || 0) / 100).toFixed(0),
    mrp: k.mrpPaise ? ((k.mrpPaise || 0) / 100).toFixed(0) : null,
    vendorName,
    salesCount: k.salesCount || 0,
    // How many students this kit is for still don't have it, and whether the
    // admin's sale window has already taken it off the parent app.
    pendingCount: k.coverage?.pendingCount || 0,
    eligibleCount: k.coverage?.eligibleCount || 0,
    saleEndsAt: k.purchaseWindow?.endsAt || null,
    saleExpired: Boolean(k.purchaseWindow?.expired),
    status: k.status === 'active' ? 'Active' : 'Draft',
    updatedDate: k.audit?.updatedAt
      ? new Date(k.audit.updatedAt).toLocaleDateString('en-GB')
      : '—',
    avatar,
    raw: k,
  };
};

const SchoolKitsPage = () => {
  const navigate = useNavigate();
  const schoolId = useSchoolId();

  // Tab category selection state
  const [activeCategory, setActiveCategory] = useState('All');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedKit, setSelectedKit] = useState(null);

  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadKits = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await listKits(schoolId, { limit: 100 });
      setKits((data || []).map(mapKit));
    } catch (err) {
      setKits([]);
      setError(getErrorMessage(err, 'Unable to load kits'));
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadKits();
  }, [loadKits]);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // The card menu is absolutely positioned, so an outside click has to close it
  useEffect(() => {
    if (openMenuId === null) return undefined;
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuId]);

  const handleDeleteKit = async () => {
    if (!confirmingDelete) return;
    setDeleting(true);
    setError('');
    try {
      await deleteKit(schoolId, confirmingDelete.id);
      setConfirmingDelete(null);
      await loadKits();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to delete this kit'));
      setConfirmingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleKitStatus = async (kit) => {
    setError('');
    try {
      const nextStatus = kit.status === 'Active' ? 'draft' : 'active';
      await updateKit(schoolId, kit.id, { status: nextStatus });
      await loadKits();
      if (selectedKit && selectedKit.id === kit.id) {
        setSelectedKit((prev) => prev ? { ...prev, status: nextStatus === 'active' ? 'Active' : 'Draft' } : null);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update status of this kit'));
    }
  };

  const totalCount = kits.length;
  const activeCount = kits.filter((k) => k.status === 'Active').length;
  const draftCount = kits.filter((k) => k.status === 'Draft').length;
  // Live kits the sale window has already closed — they still exist here, but
  // no parent can buy them any more, so they need to be visible at a glance.
  const closedCount = kits.filter((k) => k.status === 'Active' && k.saleExpired).length;
  // Students across every kit who still haven't got the one meant for them.
  // Counts a student once per kit they're missing, which is what "outstanding
  // purchases" means to a school chasing them.
  const pendingTotal = kits.reduce((sum, k) => sum + (k.status === 'Active' ? k.pendingCount : 0), 0);

  // Filter kits list
  // Derived from the kits actually loaded. The list used to be a hardcoded five
  // plus a "More" button that only popped an alert, so any kit in a category
  // outside that list could not be filtered to at all.
  const categories = ['All', ...Array.from(new Set(kits.map((k) => k.category).filter(Boolean))).sort()];

  const filteredKits = kits.filter(k => {
    const matchesSearch = k.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          k.desc.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          k.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === 'All' || k.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-24 font-outfit">
      
      {/* Top Sticky Header */}
      <div className="bg-[#3b2d7d] text-white px-6 py-6 sticky top-0 z-50 rounded-b-[2rem] shadow-lg flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => navigate('/school/more')}
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all text-white border border-white/10"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-xl font-black leading-tight">Kits</h1>
            <span className="text-[11px] text-purple-200 font-bold block mt-0.5">
              View and manage all procurement kits
            </span>
          </div>
        </div>
        
        {/* Outline Create Kit Button */}
        <button 
          onClick={() => navigate('/school/create-kit')}
          className="px-4 py-2 border border-white/25 rounded-2xl text-[10px] font-black flex items-center gap-1.5 hover:bg-white/10 active:scale-95 transition-all uppercase tracking-wider text-white shrink-0"
        >
          <Plus size={14} className="stroke-[3]" />
          Create Kit
        </button>
      </div>

      {/* Metric Cards Row Grid */}
      <div className="px-6 pt-6 overflow-x-auto scrollbar-none">
        <div className="flex sm:grid sm:grid-cols-5 gap-3 min-w-[690px] pb-1">
          
          {/* Card 1: Total Kits */}
          <div className="flex-1 bg-white border border-gray-200/80 p-3.5 rounded-2xl shadow-sm text-center">
            <div className="w-8 h-8 rounded-full bg-purple-50 text-[#3b2d7d] flex items-center justify-center mx-auto shrink-0 border border-purple-100">
              <Package size={15} />
            </div>
            <span className="text-[10px] text-gray-400 font-bold block mt-2">Total Kits</span>
            <span className="text-sm font-black text-deep-purple block mt-0.5">{totalCount}</span>
          </div>

          {/* Card 2: Active Kits */}
          <div className="flex-1 bg-white border border-gray-200/80 p-3.5 rounded-2xl shadow-sm text-center">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shrink-0 border border-emerald-100">
              <CheckCircle size={15} />
            </div>
            <span className="text-[10px] text-gray-400 font-bold block mt-2">Active Kits</span>
            <span className="text-sm font-black text-deep-purple block mt-0.5">{activeCount}</span>
          </div>

          {/* Card 3: Draft Kits */}
          <div className="flex-1 bg-white border border-gray-200/80 p-3.5 rounded-2xl shadow-sm text-center">
            <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mx-auto shrink-0 border border-orange-100">
              <AlertCircle size={15} />
            </div>
            <span className="text-[10px] text-gray-400 font-bold block mt-2">Draft Kits</span>
            <span className="text-sm font-black text-deep-purple block mt-0.5">{draftCount}</span>
          </div>

          {/* Card 4: Students still missing a kit */}
          <div className="flex-1 bg-white border border-gray-200/80 p-3.5 rounded-2xl shadow-sm text-center">
            <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mx-auto shrink-0 border border-orange-100">
              <UserX size={15} />
            </div>
            <span className="text-[10px] text-gray-400 font-bold block mt-2">Not Purchased</span>
            <span className="text-sm font-black text-deep-purple block mt-0.5">{pendingTotal}</span>
          </div>

          {/* Card 5: Kits the sale window has already closed */}
          <div className="flex-1 bg-white border border-gray-200/80 p-3.5 rounded-2xl shadow-sm text-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto shrink-0 border ${
              closedCount > 0
                ? 'bg-rose-50 text-rose-500 border-rose-100'
                : 'bg-gray-50 text-gray-400 border-gray-150'
            }`}>
              <TimerOff size={15} />
            </div>
            <span className="text-[10px] text-gray-400 font-bold block mt-2">Sale Closed</span>
            <span className="text-sm font-black text-deep-purple block mt-0.5">{closedCount}</span>
          </div>

        </div>
      </div>

      {/* Search Input Filter Wrapper */}
      <div className="px-6 pt-6 space-y-4">
        
        {/* Search Bar */}
        <div className="relative flex items-center w-full">
          <Search size={16} className="absolute left-4.5 text-gray-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search kits by name or category..."
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-deep-purple focus:outline-none focus:border-[#3b2d7d]/50 transition-colors shadow-inner"
          />
        </div>

        {/* Category horizontal scroll pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2.5 rounded-full text-xs font-black shrink-0 transition-all active:scale-95 border ${
                activeCategory === cat
                  ? 'bg-[#3b2d7d] border-[#3b2d7d] text-white shadow-sm'
                  : 'bg-white border-gray-200 text-deep-purple hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

      </div>

      {/* Row count & Sort Header */}
      <div className="px-6 pt-6 flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-400">
          Showing 1 – {filteredKits.length} of {totalCount} kits
        </span>
        
        {/* Sort Select options dropdown */}
        <div className="relative flex items-center gap-1.5 text-xs">
          <span className="text-gray-400 font-bold">Sort:</span>
          <select 
            className="bg-transparent border-none font-black text-deep-purple focus:outline-none cursor-pointer pr-5"
            defaultValue="Updated"
          >
            <option value="Updated">Recently Updated</option>
            <option value="Price (Low - High)">Price (Low - High)</option>
            <option value="Price (High - Low)">Price (High - Low)</option>
          </select>
          <ChevronDown size={12} className="absolute right-0 text-deep-purple pointer-events-none" />
        </div>
      </div>

      {/* Kits Cards list exactly matching the mockup */}
      <div className="px-6 py-4 space-y-4">

        {loading && (
          <div className="text-center py-16 bg-white border border-gray-150 rounded-[2.2rem] p-6 shadow-sm">
            <Loader2 size={32} className="text-[#3b2d7d] mx-auto block animate-spin" />
            <span className="text-xs font-black text-gray-500 block mt-3">Loading kits…</span>
          </div>
        )}

        {!loading && kits.length === 0 && (
          <div className="text-center py-16 bg-white border border-gray-150 rounded-[2.2rem] p-6 shadow-sm">
            <Package size={44} className="text-gray-300 mx-auto block stroke-[1.5]" />
            <span className="text-xs font-black text-gray-500 block mt-3">
              {error ? 'Unable to load kits' : 'No procurement kits yet'}
            </span>
            <span className="text-[10px] text-gray-400 font-bold block mt-1">
              {error || 'Create your first kit from the Create Kit page.'}
            </span>
          </div>
        )}
        
        {filteredKits.map((kit) => (
          <div 
            key={kit.id}
            onClick={() => setSelectedKit(kit)}
            className="bg-white border border-gray-200/80 rounded-[2rem] p-5 shadow-sm flex items-center justify-between gap-4 relative overflow-hidden cursor-pointer hover:border-purple-200 hover:shadow-md transition-all active:scale-[0.99]"
          >
            
            <div className="flex items-center gap-4 min-w-0">
              {/* Kit Avatar/Image */}
              <img 
                src={kit.avatar} 
                alt={kit.name}
                className="w-16 h-16 rounded-[1.2rem] object-cover border border-purple-100 shadow-inner shrink-0"
              />
              
              {/* Info Detail stack */}
              <div className="min-w-0">
                <h3 className="text-sm font-black text-deep-purple leading-tight truncate">{kit.name}</h3>
                
                {/* Category tag badge */}
                <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-purple-50 text-purple-600 rounded-lg text-[9px] font-black uppercase tracking-wider">
                  <Tag size={9} />
                  {kit.tag}
                </span>

                {/* Subtitle desc */}
                <p className="text-[10px] text-gray-400 font-bold mt-1.5 leading-tight truncate max-w-[200px]">
                  {kit.desc}
                </p>

                {/* Classes & items count splits */}
                <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-gray-400">
                  <div className="flex items-center gap-0.5">
                    <Users size={11} className="text-[#3b2d7d]" />
                    <span>{kit.classes}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-0.5">
                    <Package size={11} className="text-[#3b2d7d]" />
                    <span>{kit.itemsCount} Items</span>
                  </div>
                </div>

                {/* Sold / still-missing counts — both open the purchases report,
                    which is where the actual student names live. */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/school/kits/${kit.id}/purchases`);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 hover:bg-emerald-100 transition-all"
                  >
                    <ShoppingBag size={10} />
                    {kit.salesCount} Sold
                  </button>

                  {kit.eligibleCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/school/kits/${kit.id}/purchases`);
                      }}
                      className={`inline-flex items-center gap-1 text-[10px] font-black rounded-full px-2 py-0.5 border transition-all ${
                        kit.pendingCount > 0
                          ? 'text-orange-700 bg-orange-50 border-orange-100 hover:bg-orange-100'
                          : 'text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100'
                      }`}
                    >
                      <UserX size={10} />
                      {kit.pendingCount > 0
                        ? `${kit.pendingCount} of ${kit.eligibleCount} not purchased`
                        : 'All students covered'}
                    </button>
                  )}
                </div>

              </div>
            </div>

            {/* Pricing, Status & Actions container */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              
              {/* Status Badge */}
              {kit.status === 'Active' ? (
                <span className="px-2 py-0.5 bg-emerald-50 text-[9px] font-black text-emerald-600 rounded-full border border-emerald-100 flex items-center gap-0.5 uppercase">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  Active
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-orange-50 text-[9px] font-black text-orange-600 rounded-full border border-orange-100 flex items-center gap-0.5 uppercase">
                  <span className="w-1 h-1 rounded-full bg-orange-500" />
                  Draft
                </span>
              )}

              {/* Sale window — a kit can be Active and still be unbuyable, which
                  is exactly the case a school needs told. Sits under the status
                  badge to stay clear of the card's absolute three-dot menu. */}
              {kit.status === 'Active' && (
                <KitSaleCountdown endsAt={kit.saleEndsAt} variant="admin" />
              )}

              {/* Pricing Display */}
              <span className="text-base font-black text-purple-800 tracking-tight leading-none mt-1">
                ₹{kit.price}
              </span>

              {/* Updated footer */}
              <span className="text-[9px] text-gray-400 font-bold block mt-1">
                {kit.updatedDate}
              </span>

            </div>

            {/* Three dot context settings */}
            <div className="absolute top-4 right-4">
              <button
                aria-label={`Actions for ${kit.name}`}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-50 text-gray-400 active:scale-90 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId((prev) => (prev === kit.id ? null : kit.id));
                }}
              >
                <MoreVertical size={16} />
              </button>

              {openMenuId === kit.id && (
                <div
                  className="absolute right-0 top-8 z-20 w-44 bg-white border border-gray-150 rounded-2xl shadow-xl overflow-hidden py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuId(null);
                      navigate(`/school/create-kit?kitId=${kit.id}`);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-2.5 text-[11px] font-black text-deep-purple hover:bg-gray-50 text-left"
                  >
                    <Pencil size={13} className="text-[#3b2d7d]" /> Edit kit details
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuId(null);
                      navigate(`/school/kits/${kit.id}/purchases`);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-2.5 text-[11px] font-black text-deep-purple hover:bg-gray-50 text-left border-t border-gray-100"
                  >
                    <ShoppingBag size={13} className="text-emerald-600" /> View sales / purchases
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuId(null);
                      handleToggleKitStatus(kit);
                    }}
                    className={`w-full px-4 py-2.5 flex items-center gap-2.5 text-[11px] font-black text-left border-t border-gray-100 ${
                      kit.status === 'Active'
                        ? 'text-orange-600 hover:bg-orange-50'
                        : 'text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {kit.status === 'Active' ? (
                      <>
                        <Power size={13} className="text-orange-500" /> Mark as Inactive
                      </>
                    ) : (
                      <>
                        <CheckCircle size={13} className="text-emerald-600" /> Activate Kit
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuId(null);
                      setConfirmingDelete(kit);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-2.5 text-[11px] font-black text-red-600 hover:bg-red-50 text-left border-t border-gray-100"
                  >
                    <Trash2 size={13} /> Delete kit
                  </button>
                </div>
              )}
            </div>

          </div>
        ))}

      </div>

      {/* Delete confirmation — kits can be referenced by orders, so never one-tap */}
      {confirmingDelete && (
        <div
          className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-5"
          onClick={() => !deleting && setConfirmingDelete(null)}
        >
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-deep-purple">Delete this kit?</h3>
              <button
                type="button"
                onClick={() => setConfirmingDelete(null)}
                disabled={deleting}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 disabled:opacity-60"
              >
                <X size={15} />
              </button>
            </div>
            <p className="text-[11px] font-bold text-gray-500 mb-5">
              “{confirmingDelete.name}” will no longer be available to parents. This cannot be undone.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmingDelete(null)}
                disabled={deleting}
                className="flex-1 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-gray-600 text-xs font-black disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteKit}
                disabled={deleting}
                className="flex-1 py-3 rounded-2xl bg-red-600 text-white text-xs font-black inline-flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-60"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kit Detailed Item breakdown Modal */}
      {selectedKit && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-[2.2rem] shadow-2xl border border-gray-150 overflow-hidden animate-in zoom-in duration-300 relative flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#3b2d7d] to-[#5942bc] text-white px-6 py-5 relative flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-black tracking-wider uppercase">{selectedKit.name}</h3>
                <span className="text-[10px] text-purple-200 font-bold block mt-0.5">Procurement Kit Contents</span>
              </div>
              <button 
                onClick={() => setSelectedKit(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all text-white border border-white/10"
              >
                <X size={16} className="stroke-[3]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 scrollbar-none text-xs">
              
              {/* Cover card header */}
              <div className="flex items-center gap-4 bg-purple-50/40 p-4 rounded-3xl border border-purple-150/40">
                <img 
                  src={selectedKit.avatar} 
                  alt={selectedKit.name}
                  className="w-16 h-16 rounded-[1.2rem] object-cover border border-purple-100 shrink-0"
                />
                <div>
                  <h4 className="text-sm font-black text-deep-purple leading-tight">{selectedKit.name}</h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-gray-400 font-bold">Standard price:</span>
                    <span className="text-sm font-black text-[#3b2d7d]">₹{selectedKit.price}</span>
                  </div>
                  <span className="text-[9px] text-emerald-600 font-black uppercase mt-1 block">✓ Procurement Ready</span>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="space-y-3">
                <h4 className="text-[9px] text-[#3b2d7d] font-black uppercase tracking-wider flex items-center gap-1.5 pl-1">
                  <Layers size={13} />
                  Included Items Breakdown ({selectedKit.itemsList.length})
                </h4>

                <div className="border border-gray-150 rounded-2xl overflow-hidden shadow-inner bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-150 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="py-3 px-4">Item Name</th>
                        <th className="py-3 px-4 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold text-deep-purple">
                      {selectedKit.itemsList.map((item, idx) => (
                        <tr key={idx} className="hover:bg-purple-50/20 transition-all">
                          <td className="py-3.5 px-4 text-xs font-black">{item.name}</td>
                          <td className="py-3.5 px-4 text-right text-xs text-[#3b2d7d] font-black">{item.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Quick instructions details */}
              <div className="bg-purple-50/20 p-4.5 rounded-2xl border border-purple-100 flex items-start gap-3 shadow-sm">
                <Sparkles size={16} className="text-[#3b2d7d] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-black text-deep-purple uppercase tracking-wider block">Customization Tip</span>
                  <p className="text-[10px] text-gray-400 font-bold mt-1 leading-normal">
                    This kit can be ordered as-is in bulk bundles or customized for individual class sections inside the Procurement request forms wizard.
                  </p>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const kitToEdit = selectedKit;
                    setSelectedKit(null);
                    navigate(`/school/create-kit?kitId=${kitToEdit.id}`);
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-white border border-gray-200 hover:border-[#3b2d7d] text-[#3b2d7d] font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs"
                >
                  <Pencil size={13} />
                  <span>Edit Kit</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleKitStatus(selectedKit)}
                  className={`flex-1 sm:flex-initial px-4 py-2.5 border font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs ${
                    selectedKit.status === 'Active'
                      ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <Power size={13} />
                  <span>{selectedKit.status === 'Active' ? 'Set Inactive' : 'Activate'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const kitToView = selectedKit;
                    setSelectedKit(null);
                    navigate(`/school/kits/${kitToView.id}/purchases`);
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs"
                >
                  <ShoppingBag size={13} />
                  <span>Sales ({selectedKit.salesCount})</span>
                </button>
              </div>

              <button 
                onClick={() => setSelectedKit(null)}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default SchoolKitsPage;
