import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ProtectedRoute, RoleRoute } from './ProtectedRoute';
import { ROLES } from '../constants/roles';
import { ROUTES } from '../constants/routes';
import MainLayout from '../layouts/MainLayout';
import LandingLayout from '../layouts/LandingLayout';

// Lazy Load Components
const Home = React.lazy(() => import('../features/home/Home'));
const MarketplaceHome = React.lazy(() => import('../features/home/MarketplaceHome'));
const About = React.lazy(() => import('../features/about/About'));
const HowItWorks = React.lazy(() => import('../features/how-it-works/HowItWorks'));
const CategoryPage = React.lazy(() => import('../features/products/CategoryPage'));
const SchoolFAQ = React.lazy(() => import('../features/faq/SchoolFAQ'));
const HelpCenter = React.lazy(() => import('../features/help/HelpCenter'));
const TrackOrder = React.lazy(() => import('../features/orders/TrackOrder'));
const GradeProductsPage = React.lazy(() => import('../features/products/GradeProductsPage.jsx'));
const MySchool = React.lazy(() => import('../features/parent/MySchool'));
const TermsAndConditions = React.lazy(() => import('../features/legal/TermsAndConditions'));
const PrivacyPolicy = React.lazy(() => import('../features/legal/PrivacyPolicy'));
const RefundPolicy = React.lazy(() => import('../features/legal/RefundPolicy'));



// Mobile App Components
const AppLayout = React.lazy(() => import('../app/layouts/AppLayout'));
const SchoolLayout = React.lazy(() => import('../app/layouts/SchoolLayout'));
const AppAuthPage = React.lazy(() => import('../app/features/auth/AppAuthPage'));
const SchoolAuthPage = React.lazy(() => import('../app/features/auth/SchoolAuthPage'));
const ParentHome = React.lazy(() => import('../app/features/parent/ParentHome'));
const AppCategoryPage = React.lazy(() => import('../app/features/parent/CategoryPage'));
const SubcategoryPage = React.lazy(() => import('../app/features/parent/SubcategoryPage'));
const MySchoolPage = React.lazy(() => import('../app/features/parent/MySchoolPage'));
const OrderHistoryPage = React.lazy(() => import('../app/features/parent/OrderHistoryPage'));
const SelectGradePage = React.lazy(() => import('../app/features/parent/SelectGradePage'));
const ParentGradeProductsPage = React.lazy(() => import('../app/features/parent/GradeProductsPage'));
const ProductDetailsPage = React.lazy(() => import('../app/features/parent/ProductDetailsPage'));
const CartPage = React.lazy(() => import('../app/features/parent/CartPage'));
const EditProfilePage = React.lazy(() => import('../app/features/parent/EditProfilePage'));
const ProfilePage = React.lazy(() => import('../app/features/parent/ProfilePage'));
const WishlistPage = React.lazy(() => import('../app/features/parent/WishlistPage'));
const ContactUsPage = React.lazy(() => import('../app/features/parent/ContactUsPage'));
const AboutUsPage = React.lazy(() => import('../app/features/parent/AboutUsPage'));
const ReferEarnPage = React.lazy(() => import('../app/features/parent/ReferEarnPage'));
const WalletPage = React.lazy(() => import('../app/features/parent/WalletPage'));
const ParentTermsAndConditions = React.lazy(() => import('../app/features/parent/TermsAndConditions'));
const ParentPrivacyPolicy = React.lazy(() => import('../app/features/parent/PrivacyPolicy'));
const CheckoutPage = React.lazy(() => import('../app/features/parent/CheckoutPage'));
const OrderSuccessPage = React.lazy(() => import('../app/features/parent/OrderSuccessPage'));
const OrderTrackingPage = React.lazy(() => import('../app/features/parent/OrderTrackingPage'));
const NotificationsPage = React.lazy(() => import('../app/features/parent/NotificationsPage'));
const ProfileSetupPage = React.lazy(() => import('../app/features/parent/ProfileSetupPage'));
const KitDetailsPage = React.lazy(() => import('../app/features/parent/KitDetailsPage'));
const ParentAttendance = React.lazy(() => import('../app/features/parent/ParentAttendance'));
const ParentHomework = React.lazy(() => import('../app/features/parent/ParentHomework'));
const ParentDiary = React.lazy(() => import('../app/features/parent/ParentDiary'));
const ParentNotices = React.lazy(() => import('../app/features/parent/ParentNotices'));
const ParentCalendar = React.lazy(() => import('../app/features/parent/ParentCalendar'));
const ParentPhonebook = React.lazy(() => import('../app/features/parent/ParentPhonebook'));
const ParentReels = React.lazy(() => import('../app/features/parent/ParentReels'));
const ParentLearningHubAll = React.lazy(() => import('../app/features/parent/ParentLearningHubAll'));
const LearnPlatformPage = React.lazy(() => import('../app/features/parent/LearnPlatformPage'));
const SchoolHome = React.lazy(() => import('../app/features/school/SchoolHome'));
const SchoolGradePage = React.lazy(() => import('../app/features/school/SchoolGradePage'));
const SchoolCategoryPage = React.lazy(() => import('../app/features/school/SchoolCategoryPage'));
const SchoolCartPage = React.lazy(() => import('../app/features/school/SchoolCartPage'));
const SchoolEditProfilePage = React.lazy(() => import('../app/features/school/SchoolEditProfilePage'));
const SchoolWishlistPage = React.lazy(() => import('../app/features/school/SchoolWishlistPage'));
const SchoolMySchoolPage = React.lazy(() => import('../app/features/school/SchoolMySchoolPage'));
const SchoolSubcategoryPage = React.lazy(() => import('../app/features/school/SchoolSubcategoryPage'));
const SchoolNotificationsPage = React.lazy(() => import('../app/features/school/SchoolNotificationsPage'));
const SchoolOrderHistoryPage = React.lazy(() => import('../app/features/school/SchoolOrderHistoryPage'));
const SchoolProductsPage = React.lazy(() => import('../app/features/school/SchoolProductsPage'));
const SchoolReferEarnPage = React.lazy(() => import('../app/features/school/SchoolReferEarnPage'));
const SchoolPartnerPage = React.lazy(() => import('../app/features/school/SchoolPartnerPage'));
const SchoolContactUsPage = React.lazy(() => import('../app/features/school/SchoolContactUsPage'));
const SchoolAboutUsPage = React.lazy(() => import('../app/features/school/SchoolAboutUsPage'));
const SchoolCheckoutPage = React.lazy(() => import('../app/features/school/SchoolCheckoutPage'));
const SchoolKitDetailsPage = React.lazy(() => import('../app/features/school/SchoolKitDetailsPage'));
const SchoolSendNotice = React.lazy(() => import('../app/features/school/SchoolSendNotice'));
const SchoolCreateEvent = React.lazy(() => import('../app/features/school/SchoolCreateEvent'));
const SchoolEventsPage = React.lazy(() => import('../app/features/school/SchoolEventsPage'));
const SchoolCreateKit = React.lazy(() => import('../app/features/school/SchoolCreateKit'));
const SchoolCreateRequest = React.lazy(() => import('../app/features/school/SchoolCreateRequest'));
const SchoolDraftRequests = React.lazy(() => import('../app/features/school/SchoolDraftRequests'));
const SchoolTeacherApprovals = React.lazy(() => import('../app/features/school/SchoolTeacherApprovals'));
const SchoolParentsPage = React.lazy(() => import('../app/features/school/SchoolParentsPage'));
const SchoolMorePage = React.lazy(() => import('../app/features/school/SchoolMorePage'));
const SchoolStudentsPage = React.lazy(() => import('../app/features/school/SchoolStudentsPage'));
const SchoolVendorsPage = React.lazy(() => import('../app/features/school/SchoolVendorsPage'));
const SchoolQuotationsPage = React.lazy(() => import('../app/features/school/SchoolQuotationsPage'));
const SchoolKitsPage = React.lazy(() => import('../app/features/school/SchoolKitsPage'));
const SchoolKitPurchasesPage = React.lazy(() => import('../app/features/school/SchoolKitPurchasesPage'));
const SchoolWallet = React.lazy(() => import('../app/features/school/SchoolWallet'));
const SchoolChangePasswordPage = React.lazy(() => import('../app/features/school/SchoolChangePasswordPage'));
const SchoolAddClass = React.lazy(() => import('../app/features/school/SchoolAddClass'));
const SchoolTeacherAssignments = React.lazy(() => import('../app/features/school/SchoolTeacherAssignments'));
const SchoolPhonebookPage = React.lazy(() => import('../app/features/school/SchoolPhonebookPage'));
const SchoolLearnPlatformPage = React.lazy(() => import('../app/features/school/SchoolLearnPlatformPage'));
const SchoolReels = React.lazy(() => import('../app/features/school/SchoolReels'));


// Teacher App Components
const TeacherLayout = React.lazy(() => import('../app/layouts/TeacherLayout'));
const TeacherDashboard = React.lazy(() => import('../app/features/teacher/TeacherDashboard'));
const TeacherAttendance = React.lazy(() => import('../app/features/teacher/TeacherAttendance'));
const TeacherHomework = React.lazy(() => import('../app/features/teacher/TeacherHomework'));
const TeacherDiary = React.lazy(() => import('../app/features/teacher/TeacherDiary'));
const TeacherManageStudents = React.lazy(() => import('../app/features/teacher/TeacherManageStudents'));
const TeacherProfile = React.lazy(() => import('../app/features/teacher/TeacherProfile'));
const TeacherNotifications = React.lazy(() => import('../app/features/teacher/TeacherNotifications'));
const TeacherCheckHomework = React.lazy(() => import('../app/features/teacher/TeacherCheckHomework'));
const TeacherManageHomework = React.lazy(() => import('../app/features/teacher/TeacherManageHomework'));
const TeacherLearnPlatformPage = React.lazy(() => import('../app/features/teacher/TeacherLearnPlatformPage'));

// Vendor Panel Components
const VendorLayout = React.lazy(() => import('../layouts/VendorLayout'));
const VendorDashboard = React.lazy(() => import('../features/vendor/VendorDashboard'));
const VendorLogin = React.lazy(() => import('../features/vendor/VendorLogin'));
const VendorOrders = React.lazy(() => import('../features/vendor/VendorOrders'));
const VendorQuotations = React.lazy(() => import('../features/vendor/VendorQuotations'));
const VendorProducts = React.lazy(() => import('../features/vendor/VendorProducts'));
const VendorStock = React.lazy(() => import('../features/vendor/VendorStock'));
const VendorReturns = React.lazy(() => import('../features/vendor/VendorReturns'));
const VendorMoneyRequests = React.lazy(() => import('../features/vendor/VendorMoneyRequests'));
const VendorPaymentHistory = React.lazy(() => import('../features/vendor/VendorPaymentHistory'));
const VendorProfile = React.lazy(() => import('../features/vendor/VendorProfile'));

// Super Admin Console Components
const SuperAdminLogin = React.lazy(() => import('../app/features/superadmin/SuperAdminLogin'));
const SuperAdminLayout = React.lazy(() => import('../layouts/SuperAdminLayout'));
const SuperAdminDashboard = React.lazy(() => import('../app/features/superadmin/SuperAdminDashboard'));
const CategoryManagement = React.lazy(() => import('../app/features/superadmin/CategoryManagement'));
const HeaderCategoryManagement = React.lazy(() => import('../app/features/superadmin/HeaderCategoryManagement'));
const ProductListManagement = React.lazy(() => import('../app/features/superadmin/ProductListManagement'));
const VendorListManagement = React.lazy(() => import('../app/features/superadmin/VendorListManagement'));
const SchoolListManagement = React.lazy(() => import('../app/features/superadmin/SchoolListManagement'));
const TeacherListManagement = React.lazy(() => import('../app/features/superadmin/TeacherListManagement'));
const VendorLocations = React.lazy(() => import('../app/features/superadmin/VendorLocations'));
const WalletManagement = React.lazy(() => import('../app/features/superadmin/WalletManagement'));
const WithdrawalsManagement = React.lazy(() => import('../app/features/superadmin/WithdrawalsManagement'));
const VendorTransactions = React.lazy(() => import('../app/features/superadmin/VendorTransactions'));
const UserManagement = React.lazy(() => import('../app/features/superadmin/UserManagement'));
const NotificationManagement = React.lazy(() => import('../app/features/superadmin/NotificationManagement'));
const FAQManagement = React.lazy(() => import('../app/features/superadmin/FAQManagement'));
const OrdersListManagement = React.lazy(() => import('../app/features/superadmin/OrdersListManagement'));
const PromoHomeSections = React.lazy(() => import('../app/features/superadmin/PromoHomeSections'));
const ReelsManagement = React.lazy(() => import('../app/features/superadmin/ReelsManagement'));
const PlatformTutorialsManagement = React.lazy(() => import('../app/features/superadmin/PlatformTutorialsManagement'));
const LMSManagement = React.lazy(() => import('../app/features/superadmin/LMSManagement'));
const PromoHomeBanners = React.lazy(() => import('../app/features/superadmin/PromoHomeBanners'));
const BillingChargesManagement = React.lazy(() => import('../app/features/superadmin/BillingChargesManagement'));
const KitSaleWindowManagement = React.lazy(() => import('../app/features/superadmin/KitSaleWindowManagement'));
const AdminProfileManagement = React.lazy(() => import('../app/features/superadmin/AdminProfileManagement'));
const KitProductsManagement = React.lazy(() => import('../app/features/superadmin/KitProductsManagement'));
const SchoolKitsManagement = React.lazy(() => import('../app/features/superadmin/SchoolKitsManagement'));
const ContactManagement = React.lazy(() => import('../app/features/superadmin/ContactManagement'));
const CommissionAnalyticsManagement = React.lazy(() => import('../app/features/superadmin/CommissionAnalyticsManagement'));




const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50/50">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const Dashboard = () => <div className="p-10"><h1>Dashboard</h1><p>Welcome back!</p></div>;

// Forwards /admin/<rest> to /superadmin/<rest> so deep links and old bookmarks
// keep working. A path with no /superadmin counterpart falls through to the 404
// route, exactly as mistyping the /superadmin URL directly would.
const AdminAliasRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const rest = pathname.slice('/admin'.length);
  return <Navigate to={`${ROUTES.SUPER_ADMIN.ROOT}${rest}${search}${hash}`} replace />;
};

const AppRoutes = () => {
  return (
    <React.Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Landing Page Route */}
        <Route element={<LandingLayout />}>
          <Route path={ROUTES.HOME} element={<Home />} />
        </Route>

        {/* Main App Routes */}
        <Route element={<MainLayout />}>
          <Route path={ROUTES.MARKETPLACE} element={<MarketplaceHome />} />
          <Route path={ROUTES.ABOUT} element={<About />} />
          <Route path={ROUTES.HOW_IT_WORKS} element={<HowItWorks />} />
          <Route path={ROUTES.CATEGORY} element={<CategoryPage />} />
          <Route path={ROUTES.SCHOOL_FAQ} element={<SchoolFAQ />} />
          <Route path={ROUTES.HELP_CENTER} element={<HelpCenter />} />
          <Route path={ROUTES.TRACK_ORDER} element={<TrackOrder />} />
          <Route path={ROUTES.SHOP_BY_GRADE} element={<GradeProductsPage />} />
          <Route path={ROUTES.MY_SCHOOL} element={<MySchool />} />
          <Route path={ROUTES.TERMS} element={<TermsAndConditions />} />
          <Route path={ROUTES.PRIVACY} element={<PrivacyPolicy />} />
          <Route path={ROUTES.REFUND_POLICY} element={<RefundPolicy />} />
        </Route>
        
        <Route path="/login" element={<Navigate to="/user/login" replace />} />
        <Route path="/register" element={<Navigate to="/user/login" replace />} />
        <Route path={ROUTES.VENDOR.LOGIN} element={<VendorLogin />} />
        <Route path={ROUTES.SUPER_ADMIN.LOGIN} element={<SuperAdminLogin />} />

        {/* The admin console lives under /superadmin, but /admin is the address
            people reach for first. These aliases must stay outside ProtectedRoute:
            nested inside it, /admin/login is treated as a protected page and a
            logged-out admin gets bounced to the customer login instead. */}
        <Route path="/admin/login" element={<Navigate to={ROUTES.SUPER_ADMIN.LOGIN} replace />} />
        <Route path="/admin" element={<Navigate to={ROUTES.SUPER_ADMIN.ROOT} replace />} />
        <Route path="/admin/*" element={<AdminAliasRedirect />} />
        <Route element={<RoleRoute allowedRoles={[ROLES.ADMIN]} redirectTo={ROUTES.SUPER_ADMIN.LOGIN} />}>
        <Route path={ROUTES.SUPER_ADMIN.ROOT} element={<SuperAdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="category" element={<CategoryManagement />} />
          <Route path="header-category" element={<HeaderCategoryManagement />} />
          <Route path="product-list" element={<ProductListManagement />} />
          <Route path="vendor-list" element={<VendorListManagement />} />
          <Route path="school-list" element={<SchoolListManagement />} />
          <Route path="teacher-list" element={<TeacherListManagement />} />
          <Route path="school-kits" element={<SchoolKitsManagement />} />
          <Route path="vendor-location" element={<VendorLocations />} />
          <Route path="create-kit" element={<SchoolCreateKit />} />
          <Route path="edit-kit" element={<SchoolCreateKit />} />



          <Route path="wallet" element={<WalletManagement />} />
          <Route path="withdrawals" element={<WithdrawalsManagement />} />
          <Route path="vendor-transactions" element={<VendorTransactions />} />
          <Route path="commissions" element={<CommissionAnalyticsManagement />} />
          <Route path="school-commissions" element={<Navigate to="/superadmin/commissions" replace />} />

          <Route path="users" element={<UserManagement />} />
          <Route path="notifications" element={<NotificationManagement />} />
          <Route path="faq" element={<FAQManagement />} />
          <Route path="orders" element={<OrdersListManagement />} />
          <Route path="orders-pending" element={<div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-sm leading-relaxed"><h1 className="text-xl font-black text-gray-900 font-sans">Pending Orders</h1><p className="text-sm text-gray-500 mt-2 font-sans">Re-route or dispatch pending order batches awaiting vendor approval.</p></div>} />
          <Route path="orders-received" element={<div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-sm leading-relaxed"><h1 className="text-xl font-black text-gray-900 font-sans">Received Orders</h1><p className="text-sm text-gray-500 mt-2 font-sans">Monitor freshly submitted customer orders and verify payment links.</p></div>} />
          <Route path="orders-processed" element={<div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-sm leading-relaxed"><h1 className="text-xl font-black text-gray-900 font-sans">Processed Orders</h1><p className="text-sm text-gray-500 mt-2 font-sans">Track orders currently being packaged and processed by vendor hubs.</p></div>} />
          <Route path="orders-shipped" element={<div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-sm leading-relaxed"><h1 className="text-xl font-black text-gray-900 font-sans">Shipped Orders</h1><p className="text-sm text-gray-500 mt-2 font-sans">Monitor courier assignments and track active transit status.</p></div>} />
          <Route path="orders-out-for-delivery" element={<div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-sm leading-relaxed"><h1 className="text-xl font-black text-gray-900 font-sans">Out For Delivery</h1><p className="text-sm text-gray-500 mt-2 font-sans">Track orders currently in the last mile delivery phase with couriers.</p></div>} />
          <Route path="orders-delivered" element={<div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-sm leading-relaxed"><h1 className="text-xl font-black text-gray-900 font-sans">Delivered Orders</h1><p className="text-sm text-gray-500 mt-2 font-sans">View completed orders, receipt sheets, and customer sign-offs.</p></div>} />
          <Route path="orders-cancelled" element={<div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-sm leading-relaxed"><h1 className="text-xl font-black text-gray-900 font-sans">Cancelled Orders</h1><p className="text-sm text-gray-500 mt-2 font-sans">Review order cancellations and system-wide refund statuses.</p></div>} />
          <Route path="orders-returned" element={<div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-sm leading-relaxed"><h1 className="text-xl font-black text-gray-900 font-sans">Returned Items</h1><p className="text-sm text-gray-500 mt-2 font-sans">Process store returns, replacements, and merchant stock corrections.</p></div>} />
          <Route path="promo-home-section" element={<PromoHomeSections />} />
          <Route path="reels" element={<ReelsManagement />} />
          <Route path="tutorials" element={<PlatformTutorialsManagement />} />
          <Route path="lms" element={<LMSManagement />} />
          <Route path="promo-home-banners" element={<PromoHomeBanners />} />
          <Route path="setting-billing-charges" element={<BillingChargesManagement />} />
          <Route path="setting-kit-sale-window" element={<KitSaleWindowManagement />} />
          <Route path="contact-us-settings" element={<ContactManagement />} />
          <Route path="profile" element={<AdminProfileManagement />} />
          <Route path="kit-products" element={<KitProductsManagement />} />
        </Route>
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
          
          {/* Role Specific Routes */}
          <Route element={<RoleRoute allowedRoles={[ROLES.SCHOOL]} />}>
            <Route path={`${ROUTES.SCHOOL.ROOT}/*`} element={<div>School Portal</div>} />
          </Route>

          <Route element={<RoleRoute allowedRoles={[ROLES.VENDOR]} redirectTo={ROUTES.VENDOR.LOGIN} />}>
            <Route path={ROUTES.VENDOR.ROOT} element={<VendorLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<VendorDashboard />} />
              <Route path="orders" element={<VendorOrders />} />
              <Route path="quotations" element={<VendorQuotations />} />
              <Route path="products" element={<VendorProducts />} />
              <Route path="catalog" element={<div>Catalog Page</div>} />
              <Route path="price-stock" element={<VendorStock />} />
              <Route path="payments" element={<VendorMoneyRequests />} />
              <Route path="wallet" element={<VendorPaymentHistory />} />
              <Route path="returns" element={<VendorReturns />} />
              <Route path="profile" element={<VendorProfile />} />
              <Route path="announcements" element={<div>Announcements Page</div>} />
              <Route path="reports" element={<div>Reports Page</div>} />
              <Route path="settings" element={<div>Settings Page</div>} />
              <Route path="help-support" element={<div>Help & Support Page</div>} />
            </Route>
          </Route>

        </Route>

        {/* Mobile App Experience Routes */}
        <Route path="/user" element={<AppLayout />}>
          <Route index element={<Navigate to="home" replace />} />

          {/* Public — browsing allowed without login (skip-login flow) */}
          <Route path="login" element={<AppAuthPage />} />
          <Route path="profile-setup" element={<ProfileSetupPage />} />
          <Route path="home" element={<ParentHome />} />
          <Route path="categories" element={<AppCategoryPage />} />
          <Route path="category/:categoryId" element={<SubcategoryPage />} />
          <Route path="select-grade" element={<SelectGradePage />} />
          <Route path="products" element={<ParentGradeProductsPage />} />
          <Route path="product/:productId" element={<ProductDetailsPage />} />
          <Route path="kit/:kitId" element={<KitDetailsPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="contact" element={<ContactUsPage />} />
          <Route path="about" element={<AboutUsPage />} />
          <Route path="reels" element={<ParentReels />} />
          <Route path="learning-hub" element={<ParentLearningHubAll />} />
          <Route path="terms" element={<ParentTermsAndConditions />} />
          <Route path="privacy" element={<ParentPrivacyPolicy />} />

          {/* Guest-accessible: a shopper can reach checkout without an account and
              onboard (phone + address + OTP) via the guest gate on the page. */}
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="order-success" element={<OrderSuccessPage />} />

          {/* Protected — account and student-linked features (parent login required) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.PARENT]} redirectTo="/user/login" />}>
            <Route path="my-school" element={<MySchoolPage />} />
            <Route path="track-order/:orderId" element={<OrderTrackingPage />} />
            <Route path="orders" element={<OrderHistoryPage />} />
            <Route path="edit-profile" element={<EditProfilePage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="refer" element={<ReferEarnPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="attendance" element={<ParentAttendance />} />
            <Route path="homework" element={<ParentHomework />} />
            <Route path="diary" element={<ParentDiary />} />
            <Route path="notices" element={<ParentNotices />} />
            <Route path="calendar" element={<ParentCalendar />} />
            <Route path="phonebook" element={<ParentPhonebook />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="learn-platform" element={<LearnPlatformPage />} />
          </Route>
        </Route>

        <Route path="/school" element={<SchoolLayout />}>
          {/* Public auth pages */}
          <Route path="login" element={<SchoolAuthPage />} />
          <Route path="signup" element={<SchoolAuthPage />} />

          {/* Protected — school portal (school login required) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.SCHOOL]} redirectTo="/school/login" />}>
            <Route index element={<Navigate to="admin" replace />} />
            <Route path="admin" element={<SchoolHome />} />
            <Route path="add-class" element={<SchoolAddClass />} />
            <Route path="teacher-assignments" element={<SchoolTeacherAssignments />} />
            <Route path="phonebook" element={<SchoolPhonebookPage />} />
            <Route path="send-notice" element={<SchoolSendNotice />} />
            <Route path="create-event" element={<SchoolCreateEvent />} />
            <Route path="events" element={<SchoolEventsPage />} />
            <Route path="create-kit" element={<SchoolCreateKit />} />
            <Route path="create-request" element={<SchoolCreateRequest />} />
            <Route path="draft-requests" element={<SchoolDraftRequests />} />
            <Route path="teacher-approvals" element={<SchoolTeacherApprovals />} />
            <Route path="parents" element={<SchoolParentsPage />} />
            <Route path="more" element={<SchoolMorePage />} />
            <Route path="students" element={<SchoolStudentsPage />} />
            <Route path="vendors" element={<SchoolVendorsPage />} />
            <Route path="quotations" element={<SchoolQuotationsPage />} />
            <Route path="kits" element={<SchoolKitsPage />} />
            <Route path="kits/:kitId/purchases" element={<SchoolKitPurchasesPage />} />
            <Route path="wallet" element={<SchoolWallet />} />
            <Route path="grade" element={<SchoolGradePage />} />
            <Route path="categories" element={<SchoolCategoryPage />} />
            <Route path="cart" element={<SchoolCartPage />} />
            <Route path="edit-profile" element={<SchoolEditProfilePage />} />
            <Route path="change-password" element={<SchoolChangePasswordPage />} />
            <Route path="wishlist" element={<SchoolWishlistPage />} />
            <Route path="my-school" element={<SchoolMySchoolPage />} />
            <Route path="orders" element={<SchoolOrderHistoryPage />} />
            <Route path="category/:categoryName" element={<SchoolSubcategoryPage />} />
            <Route path="notifications" element={<SchoolNotificationsPage />} />
            <Route path="products" element={<SchoolProductsPage />} />
            <Route path="refer" element={<SchoolReferEarnPage />} />
            <Route path="partner" element={<SchoolPartnerPage />} />
            <Route path="contact" element={<SchoolContactUsPage />} />
            <Route path="about" element={<SchoolAboutUsPage />} />
            <Route path="checkout" element={<SchoolCheckoutPage />} />
            <Route path="kit/:kitId" element={<SchoolKitDetailsPage />} />
            <Route path="reels" element={<SchoolReels />} />
            <Route path="product/:productId" element={<ProductDetailsPage />} />
            <Route path="learn-platform" element={<SchoolLearnPlatformPage />} />
          </Route>
        </Route>

        <Route path="/school/teacher" element={<TeacherLayout />}>
          {/* Protected — teacher portal (teacher login required, via school auth) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.TEACHER]} redirectTo="/school/login" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="students" element={<TeacherManageStudents />} />
            <Route path="attendance" element={<TeacherAttendance />} />
            <Route path="homework" element={<TeacherHomework />} />
            <Route path="homework/manage" element={<TeacherManageHomework />} />
            <Route path="homework/:assignmentId/edit" element={<TeacherHomework />} />
            <Route path="homework/check" element={<TeacherCheckHomework />} />
            <Route path="diary" element={<TeacherDiary />} />
            <Route path="send-notice" element={<SchoolSendNotice />} />
            <Route path="profile" element={<TeacherProfile />} />
            <Route path="notifications" element={<TeacherNotifications />} />
            <Route path="learn-platform" element={<TeacherLearnPlatformPage />} />
          </Route>
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<div>Page Not Found</div>} />
      </Routes>
    </React.Suspense>
  );
};

export default AppRoutes;
