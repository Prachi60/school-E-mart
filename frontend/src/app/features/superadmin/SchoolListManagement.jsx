import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search, Eye, X, School, MapPin, Mail, User, Check, Ban, RefreshCw, Loader2,
  GraduationCap, Plus, Phone, Hash, CalendarDays, AlertCircle, Package, Edit, Trash2,
  Users, PhoneCall, CheckCircle2, Clock, Copy, Activity, Zap, UserCheck
} from 'lucide-react';
import {
  listSchools,
  createSchool,
  updateSchool,
  deleteSchool,
  approveSchool,
  rejectSchool,
  suspendSchool,
  reactivateSchool,
  getSchoolParents,
} from '../../../services/adminApi';
import { getErrorMessage } from '../../../utils/apiHelpers';
import { mapAdminSchoolForList } from '../../../utils/mappers/adminSchoolMapper';

const TABS = ['All', 'Pending', 'Active', 'Suspended', 'Rejected'];

// The tab label maps to the backend's computed display status, not the stored
// partnerStatus — 'Pending' and 'Rejected' are both partnerStatus 'prospect'.
const TAB_STATUS = {
  Pending: 'pending',
  Active: 'active',
  Suspended: 'suspended',
  Rejected: 'rejected',
};

const EMPTY_FORM = {
  schoolName: '',
  fullName: '',
  principalName: '',
  email: '',
  mobile: '',
  password: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pinCode: '',
  academicYearCurrent: '',
  gradesOffered: '',
};

// Which tab each field lives on, so a validation failure can reveal the field it
// is complaining about rather than reporting an error the user cannot see.
const FIELD_TAB = {
  schoolName: 'Details',
  fullName: 'Details',
  principalName: 'Details',
  email: 'Details',
  mobile: 'Details',
  password: 'Details',
  pinCode: 'Address',
  academicYearCurrent: 'Academic',
};

/**
 * Mirrors the server's Joi rules. The form is tabbed, so native `required` cannot
 * be used: the browser refuses to submit when an invalid control sits on a hidden
 * tab and gives no visible reason.
 */
const validateForm = (f) => {
  if (f.schoolName.trim().length < 2) return ['schoolName', 'School name must be at least 2 characters'];
  if (f.fullName.trim().length < 2) return ['fullName', 'Admin full name must be at least 2 characters'];
  if (f.principalName.trim() && f.principalName.trim().length < 2) {
    return ['principalName', 'Principal name must be at least 2 characters'];
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return ['email', 'Enter a valid email address'];
  if (!/^[6-9]\d{9}$/.test(f.mobile.trim())) {
    return ['mobile', 'Mobile must be a valid 10-digit Indian number starting 6-9'];
  }
  if (f.password.length < 8) return ['password', 'Password must be at least 8 characters'];
  if (!/(?=.*[0-9])(?=.*[^A-Za-z0-9])/.test(f.password)) {
    return ['password', 'Password must contain at least one number and one special character'];
  }
  if (f.pinCode.trim() && !/^\d{6}$/.test(f.pinCode.trim())) {
    return ['pinCode', 'PIN code must be exactly 6 digits'];
  }
  if (f.academicYearCurrent.trim() && !/^\d{4}-\d{2}(\d{2})?$/.test(f.academicYearCurrent.trim())) {
    return ['academicYearCurrent', 'Academic year must look like 2024-25 or 2024-2025'];
  }
  return null;
};

const STATUS_STYLES = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Suspended: 'bg-rose-50 text-rose-700 border-rose-100',
  Rejected: 'bg-gray-100 text-gray-600 border-gray-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-100',
};

const getStatusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES.Pending;

const StatCard = ({ icon, tone, label, value }) => (
  <div className="bg-white rounded-2xl border border-gray-200/70 p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${tone}`}>
      {icon}
    </div>
    <div>
      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{label}</span>
      <span className="text-2xl font-black text-gray-900">{value}</span>
    </div>
  </div>
);

const Field = ({ label, required, children, hint }) => (
  <label className="block">
    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </span>
    {children}
    {hint && <span className="text-[9px] font-bold text-gray-400 mt-1 block">{hint}</span>}
  </label>
);

const inputClass =
  'w-full mt-1.5 bg-[#F8F9FB]/60 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder-gray-400 font-medium';

const DetailBlock = ({ icon, label, value }) => (
  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
    <div className="flex items-center gap-2 text-gray-400 mb-1">
      {icon}
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-sm font-extrabold text-gray-800 break-words">{value || '—'}</p>
  </div>
);

const SchoolListManagement = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [showCount, setShowCount] = useState(10);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formTab, setFormTab] = useState('Details');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState('');

  // Parents modal state for admin to inspect logged-in vs never logged-in parents for a school
  const [parentsSchool, setParentsSchool] = useState(null);
  const [parentsList, setParentsList] = useState([]);
  const [parentsStats, setParentsStats] = useState(null);
  const [parentsLoading, setParentsLoading] = useState(false);
  const [parentsError, setParentsError] = useState('');
  const [parentsTab, setParentsTab] = useState('all');
  const [parentsSearch, setParentsSearch] = useState('');
  const [copiedPhone, setCopiedPhone] = useState('');

  const loadParentsModalData = useCallback(async () => {
    if (!parentsSchool) return;
    setParentsLoading(true);
    setParentsError('');
    try {
      const res = await getSchoolParents(parentsSchool.mongoId, {
        loginStatus: parentsTab,
        search: parentsSearch,
        limit: 200,
      });
      setParentsList(res.data || []);
      if (res.stats) {
        setParentsStats(res.stats);
        setSchools((prev) =>
          prev.map((s) =>
            s.mongoId === parentsSchool.mongoId
              ? {
                  ...s,
                  parentStats: {
                    total: res.stats.totalParents,
                    loggedIn: res.stats.loggedInParents,
                    neverLoggedIn: res.stats.neverLoggedInParents,
                  },
                }
              : s
          )
        );
      }
    } catch (err) {
      setParentsError(getErrorMessage(err, 'Unable to load parent details'));
      setParentsList([]);
    } finally {
      setParentsLoading(false);
    }
  }, [parentsSchool, parentsTab, parentsSearch]);

  useEffect(() => {
    if (parentsSchool) {
      loadParentsModalData();
    }
  }, [loadParentsModalData]);

  const openParentsModal = (school, initialTab = 'all') => {
    setParentsSchool(school);
    setParentsTab(initialTab);
    setParentsSearch('');
    setParentsStats(
      school.parentStats
        ? {
            totalParents: school.parentStats.total,
            loggedInParents: school.parentStats.loggedIn,
            neverLoggedInParents: school.parentStats.neverLoggedIn,
          }
        : { totalParents: 0, loggedInParents: 0, neverLoggedInParents: 0 }
    );
  };

  // Fetched unfiltered so the stat cards count every school. Filtering per tab
  // server-side made each card report only the visible tab's total.
  const loadSchools = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await listSchools({ limit: 100, status: 'all' });
      setSchools((response.data || []).map(mapAdminSchoolForList));
    } catch (err) {
      setSchools([]);
      setError(getErrorMessage(err, 'Unable to load schools'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  const counts = useMemo(() => {
    const total = schools.length;
    const active = schools.filter((s) => s.statusRaw === 'active').length;
    const pending = schools.filter((s) => s.statusRaw === 'pending').length;
    const suspended = schools.filter((s) => s.statusRaw === 'suspended').length;
    const rejected = schools.filter((s) => s.statusRaw === 'rejected').length;
    const activeTodaySchools = schools.filter((s) => s.activityStats?.dailyUsage?.status === 'active_today').length;
    const activeTeachersToday = schools.reduce((sum, s) => sum + (s.activityStats?.teacherStats?.activeToday || 0), 0);
    return { total, active, pending, suspended, rejected, activeTodaySchools, activeTeachersToday };
  }, [schools]);

  const visibleSchools = useMemo(() => {
    const status = TAB_STATUS[activeTab];
    const term = searchQuery.trim().toLowerCase();

    return schools.filter((school) => {
      if (status && school.statusRaw !== status) return false;
      if (!term) return true;
      return [school.name, school.code, school.id, school.adminEmail, school.adminPhone, school.city]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [schools, activeTab, searchQuery]);

  const runSchoolAction = async (school, action) => {
    if (!school?.mongoId) return;
    setActionId(school.mongoId);
    setError('');
    try {
      if (action === 'approve') await approveSchool(school.mongoId, {});
      if (action === 'reject') await rejectSchool(school.mongoId, { reason: 'Rejected by admin' });
      if (action === 'suspend') await suspendSchool(school.mongoId, { reason: 'Suspended by admin' });
      if (action === 'reactivate') await reactivateSchool(school.mongoId, {});
      await loadSchools();
      if (selectedSchool?.mongoId === school.mongoId) setSelectedSchool(null);
    } catch (err) {
      setError(getErrorMessage(err, `Unable to ${action} school`));
    } finally {
      setActionId(null);
    }
  };

  const openAddModal = () => {
    setForm(EMPTY_FORM);
    setFormTab('Details');
    setFormError('');
    setShowAddModal(true);
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleCreateSchool = async (event) => {
    event.preventDefault();
    const problem = validateForm(form);
    if (problem) {
      const [field, message] = problem;
      setFormTab(FIELD_TAB[field] || 'Details');
      setFormError(message);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const address = {
        line1: form.line1.trim(),
        line2: form.line2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pinCode: form.pinCode.trim(),
      };
      // Send only what was filled in; blank strings would overwrite nothing but
      // do land in the document as empty values the table then renders.
      const cleanAddress = Object.fromEntries(
        Object.entries(address).filter(([, value]) => value !== '')
      );

      const grades = form.gradesOffered
        .split(',')
        .map((grade) => grade.trim())
        .filter(Boolean);

      await createSchool({
        schoolName: form.schoolName.trim(),
        fullName: form.fullName.trim(),
        ...(form.principalName.trim() ? { principalName: form.principalName.trim() } : {}),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        password: form.password,
        ...(Object.keys(cleanAddress).length ? { address: cleanAddress } : {}),
        ...(form.academicYearCurrent.trim()
          ? { academicYearCurrent: form.academicYearCurrent.trim() }
          : {}),
        ...(grades.length ? { gradesOffered: grades } : {}),
      });

      setShowAddModal(false);
      setForm(EMPTY_FORM);
      await loadSchools();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Unable to create school'));
    } finally {
      setSaving(false);
    }
  };

  // Only fields that genuinely live on the School document itself — adminName/
  // adminPhone are the linked school-admin User's own name/phone (joined in by
  // the list API, not stored on School), so they are intentionally not
  // editable here; editing them would silently no-op.
  const openEditModal = (school) => {
    setEditingSchool(school);
    setEditError('');
    setEditForm({
      name: school.name,
      principalName: school.principalName,
      adminEmail: school.adminEmail,
      phone: school.raw?.phone || '',
      line1: school.address.line1,
      line2: school.address.line2,
      city: school.address.city,
      state: school.address.state,
      pinCode: school.address.pinCode,
      academicYearCurrent: school.academicYear,
      gradesOffered: school.gradesOffered.join(', '),
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateSchool = async (event) => {
    event.preventDefault();
    if (!editingSchool || !editForm) return;
    const f = editForm;

    if (f.name.trim().length < 2) {
      setEditError('School name must be at least 2 characters');
      return;
    }
    if (f.pinCode.trim() && !/^\d{6}$/.test(f.pinCode.trim())) {
      setEditError('PIN code must be exactly 6 digits');
      return;
    }
    setEditError('');

    const payload = {
      name: f.name.trim(),
      principalName: f.principalName.trim(),
      adminEmail: f.adminEmail.trim(),
      phone: f.phone.trim(),
      address: {
        line1: f.line1.trim(),
        line2: f.line2.trim(),
        city: f.city.trim(),
        state: f.state.trim(),
        pinCode: f.pinCode.trim(),
      },
      academicYearCurrent: f.academicYearCurrent.trim(),
      gradesOffered: f.gradesOffered.split(',').map((g) => g.trim()).filter(Boolean),
    };

    try {
      setSaving(true);
      await updateSchool(editingSchool.mongoId, payload);
      setIsEditModalOpen(false);
      setEditingSchool(null);
      await loadSchools();
    } catch (err) {
      setEditError(getErrorMessage(err, 'Unable to update school'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchool = async (school) => {
    if (!confirm(
      `Permanently delete "${school.name}"?\n\nThis also permanently deletes all of its students, teachers, staff accounts, and kits. Past orders are kept. This cannot be undone.`
    )) return;
    setActionId(school.mongoId);
    try {
      await deleteSchool(school.mongoId);
      if (selectedSchool?.mongoId === school.mongoId) setSelectedSchool(null);
      await loadSchools();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to delete school'));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6 font-sans antialiased text-gray-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none pb-2 border-b border-gray-200">
        <div className="text-left">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[#0B1528] tracking-tight">School Management</h1>
            <span className="bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none">
              PARTNERS
            </span>
          </div>
          <p className="text-xs text-gray-400 font-bold mt-1.5">
            Review partner schools, approve registrations, and manage access status.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B1528] text-white text-xs font-black hover:bg-[#16233d] transition-all shadow-sm self-start sm:self-auto"
        >
          <Plus size={14} className="stroke-[3]" />
          Add School
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 select-none">
        <StatCard
          icon={<School size={22} />}
          tone="bg-blue-50 border-blue-100 text-blue-600"
          label="Total Schools"
          value={counts.total}
        />
        <StatCard
          icon={<Check size={22} />}
          tone="bg-emerald-50 border-emerald-100 text-emerald-600"
          label="Active Schools"
          value={counts.active}
        />
        <StatCard
          icon={<Zap size={22} />}
          tone="bg-indigo-50 border-indigo-100 text-indigo-600"
          label="Active Today"
          value={counts.activeTodaySchools}
        />
        <StatCard
          icon={<UserCheck size={22} />}
          tone="bg-teal-50 border-teal-100 text-teal-600"
          label="Teachers Active Today"
          value={counts.activeTeachersToday}
        />
        <StatCard
          icon={<GraduationCap size={22} />}
          tone="bg-amber-50 border-amber-100 text-amber-600"
          label="Pending Approval"
          value={counts.pending}
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/75 p-3 flex flex-wrap gap-2 select-none shadow-sm">
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          const count = tab === 'All' ? counts.total : counts[TAB_STATUS[tab]];
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                isActive
                  ? 'bg-[#0B1528] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-transparent hover:border-gray-200/60'
              }`}
            >
              {tab} ({count})
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/75 p-4 flex flex-col md:flex-row items-center justify-between gap-4 select-none shadow-sm">
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="text-xs font-bold text-gray-400">Show</span>
          <select
            value={showCount}
            onChange={(e) => setShowCount(parseInt(e.target.value, 10))}
            className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-extrabold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={100}>100</option>
            <option value={10000}>All</option>
          </select>
          <span className="text-xs font-bold text-gray-400">entries</span>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, code, email, phone…"
            className="w-full bg-[#F8F9FB]/60 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder-gray-400 font-medium"
          />
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="bg-white rounded-[1.25rem] border border-gray-250/60 shadow-sm overflow-hidden p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            <span className="text-sm font-bold">Loading schools…</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200/80 rounded-2xl shadow-inner bg-[#FCFDFE]">
            <table className="w-full text-left text-xs font-semibold text-gray-600 border-collapse select-none">
              <thead>
                <tr className="border-b border-gray-250 bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  <th className="py-4 px-5">Ref No</th>
                  <th className="py-4 px-5">School</th>
                  <th className="py-4 px-5">Admin / Contact</th>
                  <th className="py-4 px-5">Teachers Activity</th>
                  <th className="py-4 px-5">Students & Attendance</th>
                  <th className="py-4 px-5">Parent Logins</th>
                  <th className="py-4 px-5">Usage Status</th>
                  <th className="py-4 px-5">Partner Status</th>
                  <th className="py-4 px-5 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {visibleSchools.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-xs font-black text-gray-400">
                      No school records found.
                    </td>
                  </tr>
                ) : (
                  visibleSchools.slice(0, showCount).map((school) => (
                    <tr key={school.mongoId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-5">
                        <span className="font-extrabold text-[#0B1528] text-xs">{school.id || '—'}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="font-extrabold text-gray-800 text-xs block">{school.name || '—'}</span>
                        <span className="text-[9px] text-gray-400 font-bold">{school.code || '—'}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-xs font-bold text-gray-700 block">
                          {school.adminName || school.principalName || '—'}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500 block">{school.adminEmail || '—'}</span>
                        <span className="text-[9px] text-gray-400 font-bold">{school.adminPhone || '—'}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-xs font-extrabold text-gray-800 block">
                          {school.activityStats?.teacherStats?.total || 0} Total
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 block">
                          {school.activityStats?.teacherStats?.activeToday || 0} Active Today
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-xs font-extrabold text-gray-800 block mb-1">
                          {school.activityStats?.studentStats?.total || 0} Students
                        </span>
                        {school.activityStats?.studentStats?.attendanceToday ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 size={10} /> Marked Today
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200">
                            <Clock size={10} /> Pending Today
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <button
                          type="button"
                          onClick={() => openParentsModal(school, 'all')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50/80 hover:bg-indigo-50/70 hover:border-indigo-300 transition-all text-xs font-black group cursor-pointer whitespace-nowrap"
                          title="Click to view parent account details"
                        >
                          <span className="text-emerald-600 font-black" title="Logged In Parents">{school.parentStats?.loggedIn ?? 0}</span>
                          <span className="text-gray-300 font-bold">/</span>
                          <span className="text-amber-600 font-black" title="Never Logged In Parents">{school.parentStats?.neverLoggedIn ?? 0}</span>
                          <span className="text-gray-400 font-bold text-[10px] group-hover:text-indigo-600 ml-0.5">
                            ({school.parentStats?.total ?? 0} Total)
                          </span>
                        </button>
                      </td>
                      <td className="py-4 px-5">
                        {school.activityStats?.dailyUsage?.status === 'active_today' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Zap size={10} className="fill-emerald-500 text-emerald-600" /> Active Today
                          </span>
                        )}
                        {school.activityStats?.dailyUsage?.status === 'active_week' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                            <Activity size={10} /> Active This Week
                          </span>
                        )}
                        {(!school.activityStats?.dailyUsage?.status || school.activityStats?.dailyUsage?.status === 'inactive') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase bg-gray-100 text-gray-500 border border-gray-200">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-xs font-extrabold text-gray-700">{school.gradesCount}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-[10px] font-bold text-gray-500">{school.registeredOn || '—'}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-wider ${getStatusStyle(school.status)}`}>
                          {school.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right pr-6">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedSchool(school)}
                            title="View school details"
                            className="w-7 h-7 rounded-xl border border-gray-250/60 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/50 flex items-center justify-center transition-all"
                          >
                            <Eye size={12} className="stroke-[2.5]" />
                          </button>

                          {school.needsDecision && (
                            <>
                              <button
                                type="button"
                                disabled={actionId === school.mongoId}
                                onClick={() => runSchoolAction(school, 'approve')}
                                title="Approve school"
                                className="w-7 h-7 rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition-all disabled:opacity-50"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={actionId === school.mongoId}
                                onClick={() => runSchoolAction(school, 'reject')}
                                title="Reject school"
                                className="w-7 h-7 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all disabled:opacity-50"
                              >
                                <X size={12} />
                              </button>
                            </>
                          )}

                          {school.statusRaw === 'active' && (
                            <button
                              type="button"
                              disabled={actionId === school.mongoId}
                              onClick={() => runSchoolAction(school, 'suspend')}
                              title="Suspend school"
                              className="w-7 h-7 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all disabled:opacity-50"
                            >
                              <Ban size={12} />
                            </button>
                          )}

                          {(school.statusRaw === 'suspended' || school.statusRaw === 'rejected') && (
                            <button
                              type="button"
                              disabled={actionId === school.mongoId}
                              onClick={() => runSchoolAction(school, 'reactivate')}
                              title={school.statusRaw === 'rejected' ? 'Approve school' : 'Reactivate school'}
                              className="w-7 h-7 rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition-all disabled:opacity-50"
                            >
                              <RefreshCw size={12} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openEditModal(school)}
                            title="Edit school"
                            className="w-7 h-7 rounded-xl border border-gray-250/60 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/50 flex items-center justify-center transition-all"
                          >
                            <Edit size={12} className="stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            disabled={actionId === school.mongoId}
                            onClick={() => handleDeleteSchool(school)}
                            title="Delete school"
                            className="w-7 h-7 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center transition-all disabled:opacity-50"
                          >
                            {actionId === school.mongoId ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} className="stroke-[2.5]" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-gray-150 flex items-center justify-between bg-white px-6">
              <div>
                <h3 className="text-base font-black text-[#0B1528]">Add School</h3>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                  Created as approved — the admin receives their credentials by email.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all border border-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 pt-4 flex gap-2">
              {['Details', 'Address', 'Academic'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFormTab(tab)}
                  className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                    formTab === tab
                      ? 'bg-[#0B1528] text-white'
                      : 'text-gray-500 hover:bg-gray-100 border border-gray-200/70'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {formError && (
              <div className="mx-6 mt-4 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2">
                <AlertCircle size={14} />
                {formError}
              </div>
            )}

            <form id="add-school-form" onSubmit={handleCreateSchool} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {formTab === 'Details' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="School Name" required>
                    <input
                      className={inputClass}
                      value={form.schoolName}
                      onChange={(e) => setField('schoolName', e.target.value)}
                      placeholder="Delhi Public School"
                    />
                  </Field>
                  <Field label="Admin Full Name" required>
                    <input
                      className={inputClass}
                      value={form.fullName}
                      onChange={(e) => setField('fullName', e.target.value)}
                      placeholder="Account holder's name"
                    />
                  </Field>
                  <Field label="Principal Name" hint="Defaults to the admin's name">
                    <input
                      className={inputClass}
                      value={form.principalName}
                      onChange={(e) => setField('principalName', e.target.value)}
                      placeholder="Optional"
                    />
                  </Field>
                  <Field label="Email" required>
                    <input
                      type="email"
                      className={inputClass}
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                      placeholder="admin@school.edu"
                    />
                  </Field>
                  <Field label="Mobile" required>
                    <input
                      inputMode="numeric"
                      className={inputClass}
                      value={form.mobile}
                      onChange={(e) => setField('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit number"
                    />
                  </Field>
                  <Field label="Password" required hint="Min 8 chars, one number and one special character">
                    <input
                      type="text"
                      className={inputClass}
                      value={form.password}
                      onChange={(e) => setField('password', e.target.value)}
                      placeholder="Shared with the school by email"
                    />
                  </Field>
                </div>
              )}

              {formTab === 'Address' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Address Line 1">
                    <input className={inputClass} value={form.line1} onChange={(e) => setField('line1', e.target.value)} />
                  </Field>
                  <Field label="Address Line 2">
                    <input className={inputClass} value={form.line2} onChange={(e) => setField('line2', e.target.value)} />
                  </Field>
                  <Field label="City">
                    <input className={inputClass} value={form.city} onChange={(e) => setField('city', e.target.value)} />
                  </Field>
                  <Field label="State">
                    <input className={inputClass} value={form.state} onChange={(e) => setField('state', e.target.value)} />
                  </Field>
                  <Field label="PIN Code" hint="6 digits">
                    <input
                      inputMode="numeric"
                      className={inputClass}
                      value={form.pinCode}
                      onChange={(e) => setField('pinCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                  </Field>
                </div>
              )}

              {formTab === 'Academic' && (
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Academic Year" hint="Format: 2024-25">
                    <input
                      className={inputClass}
                      value={form.academicYearCurrent}
                      onChange={(e) => setField('academicYearCurrent', e.target.value)}
                      placeholder="2024-25"
                    />
                  </Field>
                  <Field label="Grades Offered" hint="Comma separated, e.g. Nursery, 1, 2, 3">
                    <input
                      className={inputClass}
                      value={form.gradesOffered}
                      onChange={(e) => setField('gradesOffered', e.target.value)}
                      placeholder="1, 2, 3, 4, 5"
                    />
                  </Field>
                </div>
              )}
            </form>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-black hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-school-form"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#0B1528] text-white text-xs font-black hover:bg-[#16233d] disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? 'Creating…' : 'Create School'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {selectedSchool && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-gray-150 flex items-center justify-between bg-white px-6">
              <div>
                <h3 className="text-base font-black text-[#0B1528]">{selectedSchool.name || 'School'}</h3>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">School partner profile</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSchool(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all border border-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${getStatusStyle(selectedSchool.status)}`}>
                  {selectedSchool.status}
                </span>
                <span className="text-xs font-bold text-gray-400">Ref: {selectedSchool.id || '—'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailBlock icon={<Hash size={14} />} label="School Code" value={selectedSchool.code} />
                <DetailBlock icon={<User size={14} />} label="Principal" value={selectedSchool.principalName} />
                <DetailBlock icon={<User size={14} />} label="Account Admin" value={selectedSchool.adminName} />
                <DetailBlock icon={<Mail size={14} />} label="Admin Email" value={selectedSchool.adminEmail} />
                <DetailBlock icon={<Phone size={14} />} label="Admin Phone" value={selectedSchool.adminPhone} />
                <DetailBlock icon={<MapPin size={14} />} label="Address" value={selectedSchool.addressLine} />
                <DetailBlock icon={<CalendarDays size={14} />} label="Academic Year" value={selectedSchool.academicYear} />
                <DetailBlock
                  icon={<GraduationCap size={14} />}
                  label="Grades / Classes"
                  value={`${selectedSchool.gradesCount} grades · ${selectedSchool.classesCount} classes`}
                />
                <DetailBlock
                  icon={<GraduationCap size={14} />}
                  label="Grades Offered"
                  value={selectedSchool.gradesOffered.join(', ')}
                />
                <DetailBlock icon={<CalendarDays size={14} />} label="Registered" value={selectedSchool.registeredOn} />
              </div>

              {/* Platform Activity & Usage Track Block */}
              <div className="border-t border-gray-150 pt-4 space-y-3">
                <h4 className="text-xs font-black text-[#0B1528] uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={14} className="text-indigo-600" /> Platform Usage & Activity Track
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/80">
                    <span className="text-[10px] font-black uppercase text-indigo-700 block">Teachers Activity</span>
                    <span className="text-lg font-black text-[#0B1528] mt-1 block">
                      {selectedSchool.activityStats?.teacherStats?.total || 0} Total
                    </span>
                    <span className="text-xs font-bold text-emerald-600 block mt-0.5">
                      {selectedSchool.activityStats?.teacherStats?.activeToday || 0} Logged In Today
                    </span>
                  </div>

                  <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/80">
                    <span className="text-[10px] font-black uppercase text-emerald-700 block">Students & Attendance</span>
                    <span className="text-lg font-black text-[#0B1528] mt-1 block">
                      {selectedSchool.activityStats?.studentStats?.total || 0} Students
                    </span>
                    <span className="text-xs font-bold text-emerald-700 block mt-0.5">
                      {selectedSchool.activityStats?.studentStats?.attendanceToday ? '✅ Marked Today' : '⏰ Pending Today'}
                    </span>
                  </div>

                  <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100/80">
                    <span className="text-[10px] font-black uppercase text-amber-800 block">Daily Platform Status</span>
                    <span className="text-sm font-black text-[#0B1528] mt-1 block">
                      {selectedSchool.activityStats?.dailyUsage?.label || 'Inactive'}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block mt-0.5">
                      Parent Logins: {selectedSchool.parentStats?.loggedIn || 0} / {selectedSchool.parentStats?.total || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-wrap justify-end gap-2">
              {selectedSchool.needsDecision && (
                <>
                  <button
                    type="button"
                    disabled={actionId === selectedSchool.mongoId}
                    onClick={() => runSchoolAction(selectedSchool, 'approve')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={actionId === selectedSchool.mongoId}
                    onClick={() => runSchoolAction(selectedSchool, 'reject')}
                    className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {selectedSchool.statusRaw === 'active' && (
                <button
                  type="button"
                  disabled={actionId === selectedSchool.mongoId}
                  onClick={() => runSchoolAction(selectedSchool, 'suspend')}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700 disabled:opacity-50"
                >
                  Suspend
                </button>
              )}
              {(selectedSchool.statusRaw === 'suspended' || selectedSchool.statusRaw === 'rejected') && (
                <button
                  type="button"
                  disabled={actionId === selectedSchool.mongoId}
                  onClick={() => runSchoolAction(selectedSchool, 'reactivate')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 disabled:opacity-50"
                >
                  {selectedSchool.statusRaw === 'rejected' ? 'Approve' : 'Reactivate'}
                </button>
              )}
              <button
                type="button"
                onClick={() => { const s = selectedSchool; setSelectedSchool(null); openEditModal(s); }}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-black hover:bg-gray-50 flex items-center gap-1.5"
              >
                <Edit size={12} /> Edit
              </button>
              <button
                type="button"
                disabled={actionId === selectedSchool.mongoId}
                onClick={() => handleDeleteSchool(selectedSchool)}
                className="px-4 py-2 rounded-xl border border-red-200 bg-white text-red-600 text-xs font-black hover:bg-red-50 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isEditModalOpen && editForm && editingSchool && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-gray-150 flex items-center justify-between bg-white px-6">
              <div>
                <h3 className="text-base font-black text-[#0B1528]">Edit School</h3>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">Ref: {editingSchool.id || '—'}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all border border-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div className="mx-6 mt-4 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2">
                <AlertCircle size={14} />
                {editError}
              </div>
            )}

            <form id="edit-school-form" onSubmit={handleUpdateSchool} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="School Name" required>
                  <input className={inputClass} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </Field>
                <Field label="Principal Name">
                  <input className={inputClass} value={editForm.principalName} onChange={(e) => setEditForm({ ...editForm, principalName: e.target.value })} />
                </Field>
                <Field label="School Email" hint="Not the admin login email">
                  <input type="email" className={inputClass} value={editForm.adminEmail} onChange={(e) => setEditForm({ ...editForm, adminEmail: e.target.value })} />
                </Field>
                <Field label="School Phone" hint="Not the admin login phone">
                  <input className={inputClass} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </Field>
              </div>

              <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Address Line 1">
                  <input className={inputClass} value={editForm.line1} onChange={(e) => setEditForm({ ...editForm, line1: e.target.value })} />
                </Field>
                <Field label="Address Line 2">
                  <input className={inputClass} value={editForm.line2} onChange={(e) => setEditForm({ ...editForm, line2: e.target.value })} />
                </Field>
                <Field label="City">
                  <input className={inputClass} value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input className={inputClass} value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
                </Field>
                <Field label="PIN Code" hint="6 digits">
                  <input
                    inputMode="numeric"
                    className={inputClass}
                    value={editForm.pinCode}
                    onChange={(e) => setEditForm({ ...editForm, pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  />
                </Field>
              </div>

              <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Academic Year" hint="Format: 2024-25">
                  <input className={inputClass} value={editForm.academicYearCurrent} onChange={(e) => setEditForm({ ...editForm, academicYearCurrent: e.target.value })} />
                </Field>
                <Field label="Grades Offered" hint="Comma separated">
                  <input className={inputClass} value={editForm.gradesOffered} onChange={(e) => setEditForm({ ...editForm, gradesOffered: e.target.value })} />
                </Field>
              </div>
            </form>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-black hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-school-form"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#0B1528] text-white text-xs font-black hover:bg-[#16233d] disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Parent Logins Modal (Superadmin view) */}
      {parentsSchool && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-150 bg-gradient-to-r from-slate-900 to-[#0B1528] text-white flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white leading-tight">Parent Accounts &amp; Logins</h3>
                  <p className="text-[11px] text-gray-300 font-medium">
                    {parentsSchool.name} ({parentsSchool.code || parentsSchool.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setParentsSchool(null)}
                className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-[#F9FAFC]">

              {/* Stat Cards Row */}
              <div className="grid grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setParentsTab('all')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    parentsTab === 'all'
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase text-gray-400 block">Total Registered</span>
                  <span className="text-xl font-black text-[#0B1528] mt-1 block">
                    {parentsStats?.totalParents ?? parentsSchool.parentStats?.total ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setParentsTab('logged_in')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    parentsTab === 'logged_in'
                      ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase text-emerald-600 block">Logged In Users</span>
                  <span className="text-xl font-black text-emerald-700 mt-1 block">
                    {parentsStats?.loggedInParents ?? parentsSchool.parentStats?.loggedIn ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setParentsTab('never_logged_in')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    parentsTab === 'never_logged_in'
                      ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase text-amber-700 block">Never Logged In</span>
                  <span className="text-xl font-black text-amber-800 mt-1 block">
                    {parentsStats?.neverLoggedInParents ?? parentsSchool.parentStats?.neverLoggedIn ?? 0}
                  </span>
                </button>
              </div>

              {/* Controls Bar: Filter Tabs + Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex gap-2">
                  {[
                    { key: 'all', label: 'All Parents' },
                    { key: 'logged_in', label: 'Logged In' },
                    { key: 'never_logged_in', label: 'Never Logged In' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setParentsTab(tab.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                        parentsTab === tab.key
                          ? 'bg-[#0B1528] text-white shadow-sm'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={parentsSearch}
                    onChange={(e) => setParentsSearch(e.target.value)}
                    placeholder="Search parent name, mobile, child..."
                    className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {parentsError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600">
                  {parentsError}
                </div>
              )}

              {/* Parent Accounts List / Table */}
              {parentsLoading ? (
                <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin text-indigo-600" />
                  <span className="text-xs font-bold">Loading parent details...</span>
                </div>
              ) : parentsList.length === 0 ? (
                <div className="py-12 bg-white rounded-2xl border border-gray-200 text-center">
                  <span className="text-xs font-bold text-gray-400">No parent records found matching criteria.</span>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-semibold text-gray-700">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                          <th className="py-3 px-4">Parent Name</th>
                          <th className="py-3 px-4">Phone / Contact</th>
                          <th className="py-3 px-4">Linked Student(s)</th>
                          <th className="py-3 px-4">Login Status</th>
                          <th className="py-3 px-4 text-right pr-5">Call / Remind</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parentsList.map((parent) => {
                          const phone = parent.user?.phone || '';
                          const name = parent.user?.name || 'Unnamed Parent';
                          const hasLoggedIn = parent.hasLoggedIn;
                          return (
                            <tr key={parent._id || parent.user?._id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-extrabold text-[#0B1528] text-xs block">{name}</span>
                                {parent.user?.refId && (
                                  <span className="text-[9px] font-bold text-gray-400">ID: {parent.user.refId}</span>
                                )}
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-800 text-xs">{phone || '—'}</span>
                                  {phone && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(phone);
                                        setCopiedPhone(phone);
                                        setTimeout(() => setCopiedPhone(''), 2000);
                                      }}
                                      title="Copy mobile number"
                                      className="text-gray-400 hover:text-indigo-600 transition-colors"
                                    >
                                      {copiedPhone === phone ? <Check size={13} className="text-emerald-600" /> : <Copy size={12} />}
                                    </button>
                                  )}
                                </div>
                                {parent.user?.email && (
                                  <span className="text-[10px] text-gray-400 font-bold block truncate max-w-[180px]">
                                    {parent.user.email}
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4">
                                {(parent.children || []).length === 0 ? (
                                  <span className="text-[10px] text-gray-400 italic">No linked students</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {parent.children.map((c) => (
                                      <span
                                        key={c._id || c.studentId}
                                        className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-extrabold px-2 py-0.5 rounded-lg"
                                      >
                                        {c.name} {c.grade ? `(${c.grade})` : ''}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-4">
                                {hasLoggedIn ? (
                                  <div>
                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                      <CheckCircle2 size={10} /> Logged In
                                    </span>
                                    {parent.lastLoginAt && (
                                      <span className="text-[9px] font-bold text-gray-400 block mt-0.5">
                                        Last: {new Date(parent.lastLoginAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                      <Clock size={10} /> Never Logged In
                                    </span>
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-4 text-right pr-5">
                                {phone ? (
                                  <a
                                    href={`tel:${phone}`}
                                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[10px] font-black inline-flex items-center gap-1.5 shadow-sm transition-all"
                                  >
                                    <PhoneCall size={12} />
                                    <span>Call Parent</span>
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-gray-400 font-bold">No phone</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-150 bg-white flex items-center justify-between px-6">
              <span className="text-xs font-bold text-gray-400">
                Showing {parentsList.length} parent accounts
              </span>
              <button
                type="button"
                onClick={() => setParentsSchool(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black transition-all"
              >
                Close
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SchoolListManagement;
