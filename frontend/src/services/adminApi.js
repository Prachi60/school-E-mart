import apiClient from './apiClient';
import { unwrapData } from '../utils/apiHelpers';

const extractPaginated = (response, key) => {
  const { data, pagination } = response.data;
  return {
    data: data?.[key] || [],
    pagination: pagination || null,
  };
};

export const getDashboard = async (params = {}) => {
  const response = await apiClient.get('/admin/dashboard', { params });
  return unwrapData(response);
};

export const getOrderAnalytics = async (params = {}) => {
  const response = await apiClient.get('/admin/analytics/orders', { params });
  return unwrapData(response)?.analytics;
};

export const listUsers = async (params = {}) => {
  const response = await apiClient.get('/admin/users', { params });
  return extractPaginated(response, 'users');
};

export const suspendUser = async (userId, payload = {}) => {
  const response = await apiClient.patch(`/admin/users/${userId}/suspend`, payload);
  return unwrapData(response)?.user;
};

export const activateUser = async (userId) => {
  const response = await apiClient.patch(`/admin/users/${userId}/activate`);
  return unwrapData(response)?.user;
};

export const updateUser = async (userId, payload) => {
  const response = await apiClient.patch(`/admin/users/${userId}`, payload);
  return unwrapData(response)?.user;
};

export const deleteUser = async (userId, payload = {}) => {
  const response = await apiClient.delete(`/admin/users/${userId}`, { data: payload });
  return unwrapData(response);
};

// Teacher Management (cross-school)
export const listTeachers = async (params = {}) => {
  const response = await apiClient.get('/admin/teachers', { params });
  return extractPaginated(response, 'teachers');
};

export const getTeacher = async (teacherId) => {
  const response = await apiClient.get(`/admin/teachers/${teacherId}`);
  return unwrapData(response)?.teacher;
};

export const updateTeacher = async (teacherId, payload) => {
  const response = await apiClient.patch(`/admin/teachers/${teacherId}`, payload);
  return unwrapData(response)?.teacher;
};

export const deleteTeacher = async (teacherId) => {
  const response = await apiClient.delete(`/admin/teachers/${teacherId}`);
  return unwrapData(response);
};

export const listVendors = async (params = {}) => {
  const response = await apiClient.get('/admin/vendors', { params });
  return extractPaginated(response, 'vendors');
};

export const listPendingVendors = async (params = {}) => {
  const response = await apiClient.get('/admin/vendors/pending', { params });
  return extractPaginated(response, 'vendors');
};

export const createVendor = async (payload) => {
  const response = await apiClient.post('/admin/vendors', payload);
  return unwrapData(response)?.vendor;
};

export const updateVendor = async (vendorId, payload) => {
  const response = await apiClient.patch(`/admin/vendors/${vendorId}`, payload);
  return unwrapData(response)?.vendor;
};

export const deleteVendor = async (vendorId) => {
  const response = await apiClient.delete(`/admin/vendors/${vendorId}`);
  return unwrapData(response);
};

export const approveVendor = async (vendorId, payload = {}) => {
  const response = await apiClient.post(`/admin/vendors/${vendorId}/approve`, payload);
  return unwrapData(response)?.vendor;
};

export const rejectVendor = async (vendorId, payload = {}) => {
  const response = await apiClient.post(`/admin/vendors/${vendorId}/reject`, payload);
  return unwrapData(response)?.vendor;
};

export const suspendVendor = async (vendorId, payload = {}) => {
  const response = await apiClient.post(`/admin/vendors/${vendorId}/suspend`, payload);
  return unwrapData(response)?.vendor;
};

export const reactivateVendor = async (vendorId, payload = {}) => {
  const response = await apiClient.post(`/admin/vendors/${vendorId}/reactivate`, payload);
  return unwrapData(response)?.vendor;
};

export const listSchools = async (params = {}) => {
  const response = await apiClient.get('/admin/schools', { params });
  return extractPaginated(response, 'schools');
};

export const listPendingSchools = async (params = {}) => {
  const response = await apiClient.get('/admin/schools/pending', { params });
  return extractPaginated(response, 'schools');
};

export const getSchool = async (schoolId) => {
  const response = await apiClient.get(`/admin/schools/${schoolId}`);
  return unwrapData(response)?.school;
};

export const getSchoolParents = async (schoolId, params = {}) => {
  const response = await apiClient.get(`/admin/schools/${schoolId}/parents`, { params });
  return {
    data: response.data?.data?.parents || [],
    pagination: response.data?.pagination || null,
    stats: response.data?.data?.stats || null,
  };
};

export const createSchool = async (payload) => {
  const response = await apiClient.post('/admin/schools', payload);
  return unwrapData(response)?.school;
};

// Master-admin-only: set a school's commission rates (kit % + retail %).
export const updateSchoolCommission = async (schoolId, payload) => {
  const response = await apiClient.patch(`/admin/schools/${schoolId}/commission`, payload);
  return unwrapData(response)?.school;
};

// General school edit/delete live under the school module's own router
// (/schools/:schoolId, not /admin/schools/:schoolId) — same apiClient, a
// different base path than the rest of this section.
export const updateSchool = async (schoolId, payload) => {
  const response = await apiClient.patch(`/schools/${schoolId}`, payload);
  return unwrapData(response)?.school;
};

export const deleteSchool = async (schoolId) => {
  const response = await apiClient.delete(`/schools/${schoolId}`);
  return unwrapData(response);
};

export const approveSchool = async (schoolId, payload = {}) => {
  const response = await apiClient.post(`/admin/schools/${schoolId}/approve`, payload);
  return unwrapData(response)?.school;
};

export const rejectSchool = async (schoolId, payload = {}) => {
  const response = await apiClient.post(`/admin/schools/${schoolId}/reject`, payload);
  return unwrapData(response)?.school;
};

export const suspendSchool = async (schoolId, payload = {}) => {
  const response = await apiClient.post(`/admin/schools/${schoolId}/suspend`, payload);
  return unwrapData(response)?.school;
};

export const reactivateSchool = async (schoolId, payload = {}) => {
  const response = await apiClient.post(`/admin/schools/${schoolId}/reactivate`, payload);
  return unwrapData(response)?.school;
};

export const listFaqs = async (params = {}) => {
  const response = await apiClient.get('/admin/cms/faqs', { params });
  return extractPaginated(response, 'faqs');
};

export const getContactInfo = async () => {
  const response = await apiClient.get('/admin/cms/contact');
  return unwrapData(response)?.content || unwrapData(response);
};

export const createFaq = async (payload) => {
  const response = await apiClient.post('/admin/cms/faqs', payload);
  return unwrapData(response)?.faq;
};

export const updateFaq = async (faqId, payload) => {
  const response = await apiClient.patch(`/admin/cms/faqs/${faqId}`, payload);
  return unwrapData(response)?.faq;
};

export const deleteFaq = async (faqId) => {
  const response = await apiClient.delete(`/admin/cms/faqs/${faqId}`);
  return unwrapData(response);
};

export const listBanners = async (params = {}) => {
  const response = await apiClient.get('/admin/cms/banners', { params });
  return extractPaginated(response, 'banners');
};

export const deleteBanner = async (bannerId) => {
  const response = await apiClient.delete(`/admin/cms/banners/${bannerId}`);
  return unwrapData(response);
};

export const createBanner = async (payload) => {
  const response = await apiClient.post('/admin/cms/banners', payload);
  return unwrapData(response)?.banner;
};

export const updateBanner = async (bannerId, payload) => {
  const response = await apiClient.patch(`/admin/cms/banners/${bannerId}`, payload);
  return unwrapData(response)?.banner;
};

export const uploadAdminFile = async (formData) => {
  const response = await apiClient.post('/admin/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrapData(response)?.attachment;
};

export const uploadAdminMedia = async (formData) => {
  const response = await apiClient.post('/admin/uploads/media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrapData(response)?.attachment;
};

export const listReels = async (params = {}) => {
  const response = await apiClient.get('/admin/reels', { params });
  return extractPaginated(response, 'reels');
};

export const createReel = async (payload) => {
  const response = await apiClient.post('/admin/reels', payload);
  return unwrapData(response)?.reel;
};

export const updateReel = async (reelId, payload) => {
  const response = await apiClient.patch(`/admin/reels/${reelId}`, payload);
  return unwrapData(response)?.reel;
};

export const deleteReel = async (reelId) => {
  const response = await apiClient.delete(`/admin/reels/${reelId}`);
  return unwrapData(response);
};

export const listAdminReelComments = async (reelId) => {
  const response = await apiClient.get(`/admin/reels/${reelId}/comments`);
  return unwrapData(response);
};

export const deleteAdminReelComment = async (reelId, commentId) => {
  const response = await apiClient.delete(`/admin/reels/${reelId}/comments/${commentId}`);
  return unwrapData(response);
};

// Platform Tutorials ("Learn more about platform")
export const listTutorials = async (params = {}) => {
  const response = await apiClient.get('/admin/tutorials', { params });
  return extractPaginated(response, 'tutorials');
};

export const createTutorial = async (payload) => {
  const response = await apiClient.post('/admin/tutorials', payload);
  return unwrapData(response)?.tutorial;
};

export const updateTutorial = async (tutorialId, payload) => {
  const response = await apiClient.patch(`/admin/tutorials/${tutorialId}`, payload);
  return unwrapData(response)?.tutorial;
};

export const deleteTutorial = async (tutorialId) => {
  const response = await apiClient.delete(`/admin/tutorials/${tutorialId}`);
  return unwrapData(response);
};

export const listMasterKitProducts = async (params = {}) => {
  const response = await apiClient.get('/admin/kit-products', { params });
  return extractPaginated(response, 'products');
};

export const createMasterKitProduct = async (payload) => {
  const response = await apiClient.post('/admin/kit-products', payload);
  return unwrapData(response)?.product;
};

export const updateMasterKitProduct = async (productId, payload) => {
  const response = await apiClient.patch(`/admin/kit-products/${productId}`, payload);
  return unwrapData(response)?.product;
};

export const deleteMasterKitProduct = async (productId) => {
  const response = await apiClient.delete(`/admin/kit-products/${productId}`);
  return unwrapData(response);
};

export const listCmsSections = async (params = {}) => {
  const response = await apiClient.get('/admin/cms/sections', { params });
  return extractPaginated(response, 'sections');
};

// The settings endpoints return the section under `section`, not `settings`.
export const getMarketplaceSettings = async () => {
  const response = await apiClient.get('/admin/settings/marketplace');
  return unwrapData(response)?.section;
};

export const updateMarketplaceSettings = async (payload) => {
  const response = await apiClient.put('/admin/settings/marketplace', payload);
  return unwrapData(response)?.section;
};

// Billing & charges: platform fee, delivery charges, free-delivery threshold.
// Persisted in BillingConfig and read by checkout at order time.
export const getBillingConfig = async () => {
  const response = await apiClient.get('/admin/settings/billing');
  return unwrapData(response)?.section;
};

export const updateBillingConfig = async (payload) => {
  const response = await apiClient.put('/admin/settings/billing', payload);
  return unwrapData(response)?.section;
};

// Kit sale window: how long a published school kit stays visible/purchasable to
// parents before it auto-hides. Read by every parent-facing kit endpoint.
export const getKitSettings = async () => {
  const response = await apiClient.get('/admin/settings/kits');
  return unwrapData(response)?.section || { purchaseWindowEnabled: false, purchaseWindowDays: 7 };
};

export const updateKitSettings = async (payload) => {
  const response = await apiClient.put('/admin/settings/kits', payload);
  return unwrapData(response)?.section || payload;
};

export const getContactSettings = async () => {
  const response = await apiClient.get('/admin/cms/contact');
  return unwrapData(response)?.content;
};

export const updateContactSettings = async (payload) => {
  const response = await apiClient.put('/admin/settings/contact', payload);
  return unwrapData(response)?.section;
};

export const listPlatformCourses = async (params = {}) => {
  const response = await apiClient.get('/admin/lms/courses', { params });
  return extractPaginated(response, 'courses');
};

export const createPlatformCourse = async (payload) => {
  const response = await apiClient.post('/admin/lms/courses', payload);
  return unwrapData(response)?.course;
};

export const updatePlatformCourse = async (courseId, payload) => {
  const response = await apiClient.patch(`/admin/lms/courses/${courseId}`, payload);
  return unwrapData(response)?.course;
};

export const deletePlatformCourse = async (courseId) => {
  const response = await apiClient.delete(`/admin/lms/courses/${courseId}`);
  return unwrapData(response);
};

export const setPlatformCourseStatus = async (courseId, status) => {
  const response = await apiClient.patch(`/admin/lms/courses/${courseId}/status`, { status });
  return unwrapData(response)?.course;
};

export const listPlatformLessons = async (courseId, params = {}) => {
  const response = await apiClient.get(`/admin/lms/courses/${courseId}/lessons`, { params });
  return extractPaginated(response, 'lessons');
};

export const createPlatformLesson = async (courseId, payload) => {
  const response = await apiClient.post(`/admin/lms/courses/${courseId}/lessons`, payload);
  return unwrapData(response)?.lesson;
};

export const updatePlatformLesson = async (courseId, lessonId, payload) => {
  const response = await apiClient.patch(`/admin/lms/courses/${courseId}/lessons/${lessonId}`, payload);
  return unwrapData(response)?.lesson;
};

export const deletePlatformLesson = async (courseId, lessonId) => {
  const response = await apiClient.delete(`/admin/lms/courses/${courseId}/lessons/${lessonId}`);
  return unwrapData(response);
};

// LMS course subjects — dynamic picker, not a hardcoded list on the client
export const listLmsSubjects = async () => {
  const response = await apiClient.get('/admin/lms/subjects');
  return unwrapData(response)?.subjects || [];
};

export const createLmsSubject = async (payload) => {
  const response = await apiClient.post('/admin/lms/subjects', payload);
  return unwrapData(response)?.subject;
};

export const deleteLmsSubject = async (subjectId) => {
  const response = await apiClient.delete(`/admin/lms/subjects/${subjectId}`);
  return unwrapData(response);
};

// LMS course target grades — dynamic picker, not a hardcoded list on the client
export const listLmsGrades = async () => {
  const response = await apiClient.get('/admin/lms/grades');
  return unwrapData(response)?.grades || [];
};

export const listLmsGradeSuggestions = async () => {
  const response = await apiClient.get('/admin/lms/grades/suggestions');
  return unwrapData(response)?.suggestions || [];
};

export const createLmsGrade = async (payload) => {
  const response = await apiClient.post('/admin/lms/grades', payload);
  return unwrapData(response)?.grade;
};

export const deleteLmsGrade = async (gradeId) => {
  const response = await apiClient.delete(`/admin/lms/grades/${gradeId}`);
  return unwrapData(response);
};

export const uploadAdminMediaWithProgress = async (formData, onProgress) => {
  const response = await apiClient.post('/admin/uploads/media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
  });
  return unwrapData(response)?.attachment;
};

// Wallet & payouts
export const getWalletOverview = async () => {
  const response = await apiClient.get('/admin/wallet/overview');
  return unwrapData(response)?.overview;
};

export const listVendorTransactions = async (params = {}) => {
  const response = await apiClient.get('/admin/wallet/transactions', { params });
  return extractPaginated(response, 'transactions');
};

export const createVendorAdjustment = async (payload) => {
  const response = await apiClient.post('/admin/wallet/transactions', payload);
  return unwrapData(response)?.transaction;
};

export const adjustUserWallet = async (userId, payload) => {
  const response = await apiClient.post(`/admin/users/${userId}/wallet`, payload);
  return unwrapData(response)?.transaction;
};

export const listPayoutRequests = async (params = {}) => {
  const response = await apiClient.get('/admin/wallet/payouts', { params });
  return extractPaginated(response, 'payouts');
};

export const approvePayoutRequest = async (payoutId, transactionReference) => {
  const response = await apiClient.post(`/admin/wallet/payouts/${payoutId}/approve`, {
    transactionReference,
  });
  return unwrapData(response)?.payout;
};

export const rejectPayoutRequest = async (payoutId, reason) => {
  const response = await apiClient.post(`/admin/wallet/payouts/${payoutId}/reject`, { reason });
  return unwrapData(response)?.payout;
};

export const updatePayoutStatus = async (payoutId, payload) => {
  const response = await apiClient.patch(`/admin/wallet/payouts/${payoutId}/status`, payload);
  return unwrapData(response)?.payout;
};

// Notification campaigns
export const listNotificationCampaigns = async (params = {}) => {
  const response = await apiClient.get('/admin/notifications/campaigns', { params });
  return extractPaginated(response, 'campaigns');
};

export const createNotificationCampaign = async (payload) => {
  const response = await apiClient.post('/admin/notifications/campaigns', payload);
  return unwrapData(response)?.campaign;
};

// Admin profile
export const getAdminProfile = async () => {
  const response = await apiClient.get('/admin/profile');
  return unwrapData(response)?.profile;
};

export const updateAdminProfile = async (payload) => {
  const response = await apiClient.put('/admin/profile', payload);
  return unwrapData(response)?.profile;
};

// Platform LMS Settings (Video upload size limits)
export const getLmsSettings = async () => {
  const response = await apiClient.get('/admin/settings/lms');
  return unwrapData(response)?.section || { maxVideoSizeMB: 500 };
};

export const updateLmsSettings = async (payload) => {
  const response = await apiClient.put('/admin/settings/lms', payload);
  return unwrapData(response)?.section || payload;
};

// Comprehensive Commission & Profit Earnings Report
export const getComprehensiveCommissionReport = async (params = {}) => {
  const response = await apiClient.get('/admin/reports/commissions', { params });
  return unwrapData(response) || {};
};

export const getSchoolCommissionReport = async (params = {}) => {
  const response = await apiClient.get('/admin/reports/school-commissions', { params });
  return unwrapData(response) || {};
};
