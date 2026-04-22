import React, { useState, useEffect } from 'react';
import { Search, User, Menu, X, Tag, Store, Zap, UserPlus } from 'lucide-react';
import { ROUTES } from '../../constants/routes';
import { useNavigate, NavLink, Link } from 'react-router-dom';

const categories = [
  'Furniture', 'Teaching & Learning', 'Books', 'Toys & Sports', 
  'Technology', 'Stationary', 'Uniform', 'Electrical', 
  'Bathroom', 'Plumbing', 'Transport'
];

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`w-full sticky top-0 z-50 bg-white transition-all duration-500 ${
      isScrolled ? 'shadow-[0_8px_30px_rgb(0,0,0,0.04)]' : ''
    }`}>
      {/* 1. Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-10">
          
          {/* Logo Section (Branding Clarity) */}
          <div 
            className="flex-shrink-0 flex items-center gap-3 cursor-pointer group" 
            onClick={() => navigate(ROUTES.HOME)}
          >
            <div className="relative overflow-hidden rounded-lg">
              <img src="/assets/logo.jpeg" alt="School E-Mart" className="h-13 w-auto object-contain transition-transform duration-500 group-hover:scale-105" />
            </div>
            <span className="text-xl font-medium text-primary tracking-tight hidden sm:block group-hover:text-accent-orange transition-colors duration-300">
              School E-Mart
            </span>
          </div>

          {/* 2. Search Bar (Prominent & Pill Shape) */}
          <div className="hidden lg:flex flex-1 max-w-xl relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors duration-300 pointer-events-none">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Search school supplies, books, uniforms..."
              className="w-full bg-gray-50 border border-gray-200 rounded-full py-3.5 px-6 pl-14 text-[14px] text-text-primary placeholder:text-gray-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary focus:shadow-sm transition-all duration-300"
            />
          </div>

          {/* 3. Right Section (Conversion Focused) */}
          <div className="hidden md:flex items-center space-x-7">
            <NavLink 
              to="#" 
              className="flex items-center gap-2 text-[13px] font-medium text-text-secondary hover:text-accent-orange transition-all duration-300 py-2"
            >
              <Store size={18} className="text-primary/70" />
              Sell with Us
            </NavLink>
            
            <NavLink 
              to="#" 
              className="flex items-center gap-2 text-[13px] font-medium text-text-secondary hover:text-accent-orange transition-all duration-300 py-2"
            >
              <Tag size={18} className="text-primary/70" />
              Deals
            </NavLink>
            
            {/* Primary CTA: Register (Prominent & Green) */}
            <NavLink 
              to={ROUTES.REGISTER} 
              className="flex items-center gap-2 px-7 py-2.5 bg-accent-green text-white rounded-full text-[13px] font-medium hover:bg-green-700 hover:shadow-[0_8px_20px_-6px_rgba(22,163,74,0.4)] transition-all duration-300 active:scale-95 shadow-md"
            >
              <UserPlus size={18} />
              Register
            </NavLink>
            
            <div className="h-8 w-[1px] bg-gray-100"></div>

            {/* Profile/Login Icon */}
            <button 
              onClick={() => navigate(ROUTES.LOGIN)}
              className="h-10 w-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-text-secondary hover:bg-primary hover:text-white hover:border-primary hover:shadow-md transition-all duration-300"
            >
              <User size={20} />
            </button>
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="p-2 text-primary hover:bg-gray-50 rounded-lg transition-colors"
            >
              {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Sub-Navigation (Categories & Divider) */}
      <div className="border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="overflow-x-auto no-scrollbar scroll-smooth">
            <div className="flex items-center space-x-9 h-12 whitespace-nowrap">
              {categories.map((category) => (
                <NavLink
                  key={category}
                  to={`/category/${category.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}
                  className={({ isActive }) => `
                    text-[13px] font-medium transition-all duration-300 relative py-3 cursor-pointer
                    ${isActive ? 'text-accent-orange' : 'text-text-secondary hover:text-accent-orange'}
                    after:content-[''] after:absolute after:bottom-0 after:left-0 after:h-[2px] 
                    after:bg-accent-orange after:transition-all after:duration-300 
                    ${isActive ? 'after:w-full' : 'after:w-0 hover:after:w-full'}
                  `}
                >
                  {category}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-20 bg-white z-40 p-6 overflow-y-auto animate-in fade-in slide-in-from-right duration-300">
          <div className="flex flex-col space-y-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search supplies..."
                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 pl-12 focus:outline-none"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              <NavLink to={ROUTES.REGISTER} className="flex items-center justify-between p-5 bg-green-50 rounded-xl font-semibold text-accent-green border border-green-100">
                <div className="flex items-center gap-3"><UserPlus size={22} /> Join School E-Mart</div>
              </NavLink>
              <NavLink to="#" className="flex items-center justify-between p-4 bg-gray-50 rounded-xl font-medium text-text-primary">
                <div className="flex items-center gap-3"><Store size={20} className="text-primary" /> Sell with Us</div>
              </NavLink>
              <NavLink to="#" className="flex items-center justify-between p-4 bg-gray-50 rounded-xl font-medium text-text-primary">
                <div className="flex items-center gap-3"><Tag size={20} className="text-primary" /> Today's Deals</div>
              </NavLink>
            </div>

            <div className="pt-4">
              <h5 className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.2em] mb-4">Categories</h5>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <Link key={cat} to="#" className="text-sm font-medium text-text-secondary hover:text-primary py-2">{cat}</Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
