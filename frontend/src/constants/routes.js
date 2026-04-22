export const ROUTES = {
  // Public
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  ABOUT: '/about',
  HOW_IT_WORKS: '/how-it-works',
  
  // Protected
  DASHBOARD: '/dashboard',
  
  // School Portal
  SCHOOL: {
    ROOT: '/school',
    PROFILE: '/school/profile',
    PRODUCTS: '/school/products',
    QUOTATIONS: '/school/quotations',
    ORDERS: '/school/orders',
  },
  
  // Vendor Portal
  VENDOR: {
    ROOT: '/vendor',
    PROFILE: '/vendor/profile',
    PRODUCTS: '/vendor/products',
    QUOTATIONS: '/vendor/quotations',
    ORDERS: '/vendor/orders',
    WALLET: '/vendor/wallet',
  },
  
  // Admin Panel
  ADMIN: {
    ROOT: '/admin',
    USERS: '/admin/users',
    CATEGORIES: '/admin/categories',
    ORDERS: '/admin/orders',
    REPORTS: '/admin/reports',
  }
};
