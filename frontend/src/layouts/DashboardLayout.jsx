import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, User } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { SIDEBAR_MENU } from '../constants/menuItems';

const DashboardLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = SIDEBAR_MENU[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside 
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-primary text-white transition-all duration-300 flex flex-col fixed h-full z-20 shadow-xl`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
          {!isCollapsed && <span className="font-bold text-xl tracking-tight">School E-Mart</span>}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-6 space-y-1 px-3 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all group ${
                  isActive 
                    ? 'bg-accent-orange text-white shadow-lg shadow-orange-500/20' 
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={20} className={`${isActive ? 'text-white' : 'group-hover:text-white'}`} />
                {!isCollapsed && (
                  <span className="ml-3 font-medium text-sm truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-white/10">
          {!isCollapsed && (
            <div className="flex items-center mb-4 px-2">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center mr-3">
                <User size={18} />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-white/50 capitalize truncate">{user?.role}</p>
              </div>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2.5 rounded-lg text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-all"
          >
            <LogOut size={20} />
            {!isCollapsed && <span className="ml-3 font-medium text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main 
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between sticky top-0 z-10">
          <h2 className="font-semibold text-lg text-text-primary">
            {menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-text-secondary">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span>Systems Online</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
