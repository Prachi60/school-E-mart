import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Layers, Box, Users, MapPin, Ticket, Truck,
  ChevronDown, ChevronRight, Search, Bell, User, LogOut, Menu, X, ShieldAlert,
  ArrowLeftRight, Wallet, TrendingUp, Coins, HelpCircle, ShoppingCart, Clock, CheckCircle,
  FileText, Flag, XCircle, Package, Home, Store, Image, IndianRupee, Video, GraduationCap, School, Phone, MonitorPlay, Hourglass
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const SuperAdminLayout = () => {
  // Navigation & Location
  const navigate = useNavigate();
  const location = useLocation();
  
  // Auth Store
  const { user, logout } = useAuthStore();

  // Sidebar responsive / toggle states
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track open state of submenus (accordion states)
  const [openSubmenus, setOpenSubmenus] = useState({
    'Category': true, // Keep open by default as in screenshot
    'Product': true,
    'Manage Vendor': true,
    'Manage School': true,
    'Manage Location': true,
    'Delivery Boy': true,
    'Order List': true,
  });

  // Reference for focus shortcut (Ctrl + F)
  const searchInputRef = useRef(null);

  // Keyboard shortcut listener for Ctrl + F to focus search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/superadmin/login');
  };

  // Toggle single submenu accordion
  const toggleSubmenu = (label) => {
    setOpenSubmenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  // Define sidebar menu structure from the mockup screenshot
  const menuStructure = [
    {
      type: 'item',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/superadmin/dashboard'
    },
    {
      type: 'section',
      label: 'PRODUCT SECTION',
    },
    {
      type: 'submenu',
      label: 'Category',
      icon: Layers,
      items: [
        { label: 'Category', path: '/superadmin/category' },
        { label: 'Header Category', path: '/superadmin/header-category' }
      ]
    },
    {
      type: 'submenu',
      label: 'Product',
      icon: Box,
      items: [
        { label: 'Product List', path: '/superadmin/product-list' },
        { label: 'Master Kit Products', path: '/superadmin/kit-products' }
      ]
    },
    {
      type: 'submenu',
      label: 'Manage Vendor',
      icon: Users,
      items: [
        { label: 'Manage Vendor List', path: '/superadmin/vendor-list' }
      ]
    },
    {
      type: 'submenu',
      label: 'Manage School',
      icon: School,
      items: [
        { label: 'School List', path: '/superadmin/school-list' },
        { label: 'School Kits', path: '/superadmin/school-kits' },
        { label: 'Teacher List', path: '/superadmin/teacher-list' }
      ]
    },
    {
      type: 'section',
      label: 'DELIVERY SECTION',
    },
    {
      type: 'submenu',
      label: 'Manage Location',
      icon: MapPin,
      items: [
        { label: 'Vendor Location', path: '/superadmin/vendor-location' }
      ]
    },



    {
      type: 'section',
      label: 'FINANCE SECTION',
    },
    {
      type: 'item',
      label: 'Wallet',
      icon: Wallet,
      path: '/superadmin/wallet'
    },
    {
      type: 'item',
      label: 'Withdrawals',
      icon: TrendingUp,
      path: '/superadmin/withdrawals'
    },
    {
      type: 'item',
      label: 'Vendor Transaction',
      icon: Users,
      path: '/superadmin/vendor-transactions'
    },
    {
      type: 'item',
      label: 'Commission & Profit',
      icon: IndianRupee,
      path: '/superadmin/commissions'
    },

    {
      type: 'section',
      label: 'MISCELLANEOUS',
    },
    {
      type: 'item',
      label: 'Users',
      icon: Users,
      path: '/superadmin/users'
    },
    {
      type: 'item',
      label: 'Notification',
      icon: Bell,
      path: '/superadmin/notifications'
    },
    {
      type: 'item',
      label: 'FAQ',
      icon: HelpCircle,
      path: '/superadmin/faq'
    },
    {
      type: 'section',
      label: 'ORDER SECTION',
    },
    {
      type: 'item',
      label: 'Order List',
      icon: ShoppingCart,
      path: '/superadmin/orders'
    },
    {
      type: 'section',
      label: 'PROMOTION',
    },
    {
      type: 'item',
      label: 'Home Sections',
      icon: Home,
      path: '/superadmin/promo-home-section'
    },
    {
      type: 'item',
      label: 'Reels',
      icon: Video,
      path: '/superadmin/reels'
    },
    {
      type: 'item',
      label: 'LMS',
      icon: GraduationCap,
      path: '/superadmin/lms'
    },
    {
      type: 'item',
      label: 'Platform Tutorials',
      icon: MonitorPlay,
      path: '/superadmin/tutorials'
    },
    {
      type: 'item',
      label: 'Home Banners',
      icon: Image,
      path: '/superadmin/promo-home-banners'
    },
    {
      type: 'section',
      label: 'SETTING',
    },
    {
      type: 'item',
      label: 'Billing & Charges',
      icon: IndianRupee,
      path: '/superadmin/setting-billing-charges'
    },
    {
      type: 'item',
      label: 'Kit Sale Window',
      icon: Hourglass,
      path: '/superadmin/setting-kit-sale-window'
    },
    {
      type: 'item',
      label: 'Contact Us Settings',
      icon: Phone,
      path: '/superadmin/contact-us-settings'
    }
  ];

  // Filtering logic for search menu query
  const filteredMenu = menuStructure.filter(menu => {
    if (!searchQuery) return true;
    
    // If it's a section header, we keep it if any of the items under it match
    if (menu.type === 'section') return true;

    // Standard item search
    if (menu.type === 'item') {
      return menu.label.toLowerCase().includes(searchQuery.toLowerCase());
    }

    // Submenu search (matches submenu label or any of its items)
    if (menu.type === 'submenu') {
      const matchParent = menu.label.toLowerCase().includes(searchQuery.toLowerCase());
      const matchChild = menu.items.some(child => child.label.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchParent || matchChild;
    }

    return true;
  });

  return (
    <div className="flex h-screen bg-[#F4F6F9] font-sans antialiased text-gray-800 overflow-hidden">
      
      {/* 1. SIDEBAR PANEL (Desktop and Drawer) */}
      <aside className="hidden md:flex flex-col w-[260px] bg-[#111827] text-gray-300 border-r border-gray-800 shrink-0 select-none">
        
        {/* Sidebar Header with Ctrl + F search */}
        <div className="p-4 border-b border-gray-800 shrink-0">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
            <input 
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Menu Ctrl + F" 
              className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-gray-200 placeholder-gray-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Nav Items List */}
        <nav className="flex-1 py-4 overflow-y-auto no-scrollbar space-y-1.5 px-3">
          {filteredMenu.map((menu, index) => {
            if (menu.type === 'section') {
              return (
                <div key={index} className="pt-4 pb-1 px-3 text-[10px] font-black tracking-widest text-gray-500 uppercase">
                  {menu.label}
                </div>
              );
            }

            const Icon = menu.icon;

            if (menu.type === 'item') {
              const isActive = location.pathname === menu.path;
              return (
                <Link
                  key={menu.label}
                  to={menu.path}
                  className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-sm font-medium ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 font-semibold' 
                      : 'hover:bg-gray-800/50 hover:text-white text-gray-400'
                  }`}
                >
                  <Icon size={16} className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-white'}`} />
                  <span>{menu.label}</span>
                </Link>
              );
            }

            if (menu.type === 'submenu') {
              const isOpen = openSubmenus[menu.label];
              const hasActiveChild = menu.items.some(child => location.pathname === child.path);

              return (
                <div key={menu.label} className="space-y-1">
                  <button
                    onClick={() => toggleSubmenu(menu.label)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-sm font-medium ${
                      hasActiveChild 
                        ? 'text-white bg-gray-800/40 font-semibold' 
                        : 'hover:bg-gray-800/50 hover:text-white text-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <Icon size={16} className={`shrink-0 transition-colors ${hasActiveChild ? 'text-indigo-400' : 'text-gray-500 group-hover:text-white'}`} />
                      <span>{menu.label}</span>
                    </div>
                    <ChevronDown 
                      size={14} 
                      className={`text-gray-500 group-hover:text-white transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
                    />
                  </button>

                  {/* Indented Dropdown List */}
                  {isOpen && (
                    <div className="ml-5 pl-3 border-l border-gray-800 space-y-1 animate-fade-in">
                      {menu.items.map(subItem => {
                        const isSubActive = location.pathname === subItem.path;
                        const SubIcon = subItem.icon;
                        return (
                          <Link
                            key={subItem.label}
                            to={subItem.path}
                            className={`flex items-center gap-2 py-2 px-3 text-xs rounded-lg transition-all ${
                              isSubActive 
                                ? 'text-indigo-400 font-bold bg-indigo-500/5' 
                                : 'text-gray-500 hover:text-white'
                            }`}
                          >
                            {SubIcon && <SubIcon size={12} className="shrink-0" />}
                            <span>{subItem.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </nav>
      </aside>

      {/* Responsive Mobile Drawer Menu */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm">
          <div className="w-[260px] bg-[#111827] text-gray-300 flex flex-col h-full shadow-2xl animate-fade-in border-r border-gray-800">
            {/* Header / Brand */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-gray-800 shrink-0">
              <span className="font-extrabold text-sm text-white tracking-wide uppercase">Super Console</span>
              <button 
                onClick={() => setIsMobileOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            {/* Nav List */}
            <nav className="flex-1 py-4 overflow-y-auto space-y-1.5 px-3">
              {menuStructure.map((menu, index) => {
                if (menu.type === 'section') {
                  return (
                    <div key={index} className="pt-4 pb-1 px-3 text-[10px] font-black tracking-widest text-gray-500 uppercase">
                      {menu.label}
                    </div>
                  );
                }

                const Icon = menu.icon;

                if (menu.type === 'item') {
                  const isActive = location.pathname === menu.path;
                  return (
                    <Link
                      key={menu.label}
                      to={menu.path}
                      onClick={() => setIsMobileOpen(false)}
                      className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-sm font-medium ${
                        isActive 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' 
                          : 'hover:bg-gray-800/50 hover:text-white text-gray-400'
                      }`}
                    >
                      <Icon size={16} className={isActive ? 'text-white' : 'text-gray-500'} />
                      <span>{menu.label}</span>
                    </Link>
                  );
                }

                if (menu.type === 'submenu') {
                  const isOpen = openSubmenus[menu.label];
                  return (
                    <div key={menu.label} className="space-y-1">
                      <button
                        onClick={() => toggleSubmenu(menu.label)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-gray-800/50 hover:text-white text-gray-400 text-sm font-medium"
                      >
                        <div className="flex items-center gap-3.5">
                          <Icon size={16} className="text-gray-500" />
                          <span>{menu.label}</span>
                        </div>
                        <ChevronDown size={14} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="ml-5 pl-3 border-l border-gray-800 space-y-1">
                          {menu.items.map(subItem => {
                            const isSubActive = location.pathname === subItem.path;
                            const SubIcon = subItem.icon;
                            return (
                              <Link
                                key={subItem.label}
                                to={subItem.path}
                                onClick={() => setIsMobileOpen(false)}
                                className={`flex items-center gap-2 py-2 px-3 text-xs rounded-lg transition-all ${
                                  isSubActive ? 'text-indigo-400 font-bold bg-indigo-500/5' : 'text-gray-500 hover:text-white'
                                }`}
                              >
                                {SubIcon && <SubIcon size={12} className="shrink-0" />}
                                <span>{subItem.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </nav>
          </div>
        </div>
      )}

      {/* 2. MAIN LAYOUT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 justify-between shrink-0 select-none">
          
          {/* Header Left (Logo + Mobile Trigger) */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileOpen(true)}
              className="p-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 md:hidden"
            >
              <Menu size={18} />
            </button>

            {/* Custom brand cursive typography matching mockup */}
            <Link to="/superadmin/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity select-none">
              <div className="w-9 h-9 bg-[#503EFA] text-white rounded-2xl flex items-center justify-center font-black text-base shadow-md shadow-[#503EFA]/25">
                E
              </div>
              <span className="font-black text-lg text-[#0B1528] tracking-tight">
                School E-Mart
              </span>
            </Link>
          </div>

          {/* Header Middle Navigation (Mockup Menu Links) */}
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/superadmin/orders" className="text-xs font-black tracking-widest uppercase text-gray-500 hover:text-indigo-600 transition-colors">Orders</Link>
            <Link to="/superadmin/users" className="text-xs font-black tracking-widest uppercase text-gray-500 hover:text-indigo-600 transition-colors">Manage Customer</Link>
          </nav>

          {/* Header Right Controls */}
          <div className="flex items-center gap-3">
            
            {/* Header Search Button */}
            <button 
              onClick={() => searchInputRef.current?.focus()}
              title="Focus Sidebar Menu Search (Ctrl + F)"
              className="w-9 h-9 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-gray-50 flex items-center justify-center transition-all cursor-pointer"
            >
              <Search size={16} />
            </button>

            {/* Notification Alert Bell */}
            <div className="relative">
              <Link 
                to="/superadmin/notifications"
                title="Broadcast Notifications"
                className="w-9 h-9 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-gray-50 flex items-center justify-center transition-all relative"
              >
                <Bell size={16} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </Link>
            </div>

            {/* Vertical Splitter */}
            <div className="h-6 w-[1px] bg-gray-200 hidden sm:block"></div>

            {/* Profile Avatar Icon */}
            <Link 
              to="/superadmin/profile" 
              title="Super Admin Profile"
              className="flex items-center gap-2.5 pl-1.5 hover:opacity-85 transition-opacity group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-extrabold text-xs flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform select-none">
                SA
              </div>
              <div className="hidden sm:flex flex-col text-left leading-tight select-none">
                <span className="font-extrabold text-[11px] text-gray-800 tracking-tight group-hover:text-indigo-600 transition-colors">Super Admin</span>
                <span className="text-[9px] text-indigo-500 font-bold tracking-wider uppercase">Console</span>
              </div>
            </Link>

            {/* Safe Logout Button */}
            <button 
              onClick={handleLogout}
              title="Logout Administrative Console"
              className="w-9 h-9 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all ml-1 cursor-pointer"
            >
              <LogOut size={16} />
            </button>

          </div>
        </header>

        {/* Page Content viewport */}
        <main className="flex-1 overflow-y-auto bg-[#F9FAFC] p-6">
          <div className="max-w-[1600px] mx-auto animate-fade-in pb-12">
            <Outlet />
          </div>
        </main>
      </div>

    </div>
  );
};

export default SuperAdminLayout;
