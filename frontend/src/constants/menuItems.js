import { LayoutDashboard, ShoppingBag, FileText, ClipboardList, Wallet, Users, Layers, MessageSquare } from 'lucide-react';
import { ROUTES } from './routes';
import { ROLES } from './roles';

export const SIDEBAR_MENU = {
  [ROLES.SCHOOL]: [
    { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: LayoutDashboard },
    { label: 'Browse Products', path: ROUTES.SCHOOL.PRODUCTS, icon: ShoppingBag },
    { label: 'My Quotations', path: ROUTES.SCHOOL.QUOTATIONS, icon: FileText },
    { label: 'Order History', path: ROUTES.SCHOOL.ORDERS, icon: ClipboardList },
    { label: 'Messages', path: '/messages', icon: MessageSquare },
  ],
  [ROLES.VENDOR]: [
    { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: LayoutDashboard },
    { label: 'Manage Products', path: ROUTES.VENDOR.PRODUCTS, icon: ShoppingBag },
    { label: 'Quote Requests', path: ROUTES.VENDOR.QUOTATIONS, icon: FileText },
    { label: 'Manage Orders', path: ROUTES.VENDOR.ORDERS, icon: ClipboardList },
    { label: 'Wallet', path: ROUTES.VENDOR.WALLET, icon: Wallet },
    { label: 'Messages', path: '/messages', icon: MessageSquare },
  ],
  [ROLES.ADMIN]: [
    { label: 'Overview', path: ROUTES.DASHBOARD, icon: LayoutDashboard },
    { label: 'Manage Users', path: ROUTES.ADMIN.USERS, icon: Users },
    { label: 'Categories', path: ROUTES.ADMIN.CATEGORIES, icon: Layers },
    { label: 'All Orders', path: ROUTES.ADMIN.ORDERS, icon: ClipboardList },
    { label: 'Reports', path: ROUTES.ADMIN.REPORTS, icon: FileText },
  ],
};
