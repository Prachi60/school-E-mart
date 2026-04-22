import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

const Footer = () => {
  return (
    <footer className="bg-primary text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          
          {/* Brand Column */}
          <div className="space-y-6">
            <div className="flex items-center group cursor-pointer">
              <img src="/assets/logo.jpeg" alt="School E-Mart" className="h-10 w-auto bg-white rounded-lg p-1 transition-transform group-hover:scale-110" />
              <span className="ml-3 text-xl font-medium tracking-tight group-hover:text-accent-orange transition-colors">School E-Mart</span>
            </div>
            <p className="text-white/60 text-[13px] leading-relaxed font-normal">
              India's premier B2B marketplace for school supplies, uniforms, and educational technology. Streamlining institutional procurement through transparency and verified vendors.
            </p>
            <div className="flex space-x-4">
              {/* Social icons removed temporarily */}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-[15px] font-semibold mb-6 tracking-wide uppercase text-white/40">Quick Links</h4>
            <ul className="space-y-4 text-white/60 text-sm font-normal">
              <li><Link to={ROUTES.ABOUT} className="hover:text-accent-orange transition-colors">About Us</Link></li>
              <li><Link to={ROUTES.HOW_IT_WORKS} className="hover:text-accent-orange transition-colors">How it Works</Link></li>
              <li><Link to={ROUTES.REGISTER} className="hover:text-accent-orange transition-colors text-accent-green font-medium">Sell with Us</Link></li>
              <li><Link to="#" className="hover:text-accent-orange transition-colors">Privacy Policy</Link></li>
              <li><Link to="#" className="hover:text-accent-orange transition-colors">Terms & Conditions</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-[15px] font-semibold mb-6 tracking-wide uppercase text-white/40">Support</h4>
            <ul className="space-y-4 text-white/60 text-sm font-normal">
              <li><a href="#" className="hover:text-accent-orange transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-accent-orange transition-colors">Track Order</a></li>
              <li><a href="#" className="hover:text-accent-orange transition-colors">Refund Policy</a></li>
              <li><a href="#" className="hover:text-accent-orange transition-colors">Complaint System</a></li>
              <li><a href="#" className="hover:text-accent-orange transition-colors">FAQs</a></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-[15px] font-semibold mb-6 tracking-wide uppercase text-white/40">Contact Us</h4>
            <ul className="space-y-4 text-white/60 text-[13px] font-normal leading-relaxed">
              <li className="flex items-center gap-4 group">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-accent-orange group-hover:bg-accent-orange group-hover:text-white transition-all">
                  <Phone size={16} />
                </div>
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-4 group">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-accent-orange group-hover:bg-accent-orange group-hover:text-white transition-all">
                  <Mail size={16} />
                </div>
                <span>support@schoolemart.com</span>
              </li>
              <li className="flex items-start gap-4 group">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-accent-orange group-hover:bg-accent-orange group-hover:text-white transition-all shrink-0">
                  <MapPin size={16} />
                </div>
                <span className="text-white/50">123, Education Hub, Knowledge Park, New Delhi, India</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-white/5 text-center text-white/30 text-[11px] font-medium tracking-widest uppercase">
          <p>© {new Date().getFullYear()} School E-Mart. All Rights Reserved. Built with ❤️ for Education.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
