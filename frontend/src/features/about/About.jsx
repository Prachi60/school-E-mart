import React from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Globe, 
  Zap, 
  Layers,
  Building2,
  ShoppingBag,
  Target,
  Eye,
  ChevronRight,
  Warehouse,
  TrendingUp,
  FileText,
  BadgeCheck,
  BookOpen,
  Shirt,
  Armchair,
  Laptop,
  FlaskConical,
  GraduationCap,
  Users,
  Search,
  Settings,
  Truck,
  FileCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

const About = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col w-full bg-white text-text-primary overflow-x-hidden">
      
      {/* 1. Hero Section */}
      <section className="relative pt-8 pb-16 md:pb-24 overflow-hidden bg-[#f8faff]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-7 relative z-10 text-center lg:text-left">
              <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded-full mb-8">
                ABOUT US
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#0f2f5f] leading-tight mb-8">
                Simplifying Procurement. <br/>
                <span className="text-accent-orange">Empowering Education.</span>
              </h1>
              <p className="text-lg text-text-secondary mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0 font-normal">
                School E-Mart is India's leading B2B marketplace connecting educational institutions with verified vendors for quality products, competitive pricing and seamless procurement experience.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-12 justify-center lg:justify-start">
                <button 
                  onClick={() => navigate(ROUTES.REGISTER)}
                  className="px-8 py-4 bg-accent-orange text-white rounded-xl font-semibold tracking-wider hover:bg-orange-600 transition-all shadow-xl shadow-orange-950/20 active:scale-95 flex items-center justify-center gap-3"
                >
                  Register Your School <ArrowRight size={18} />
                </button>
                <button 
                  onClick={() => navigate(ROUTES.REGISTER)}
                  className="px-8 py-4 bg-white border border-gray-200 text-text-primary rounded-xl font-semibold tracking-wider hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  Become a Vendor <ArrowRight size={18} className="opacity-50" />
                </button>
              </div>

              {/* Trusted Strip */}
              <div className="mt-12 lg:mt-20">
                <p className="text-[11px] font-bold uppercase text-gray-400 tracking-widest mb-6">Trusted by leading schools and institutions</p>
                <div className="flex flex-wrap justify-center lg:justify-start items-center gap-8 md:gap-10 grayscale opacity-40">
                  {['Delhi Public School', 'Ryan International', 'Kendriya Vidyalaya', 'DAV Public', 'Shriram Millennium', 'Suncity School'].map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                       <div className="w-6 h-6 bg-primary/20 rounded-full"></div>
                       <span className="text-[12px] font-semibold">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Visuals */}
            <div className="lg:col-span-5 relative">
              <div className="relative w-full h-[500px] md:h-[600px] rounded-[3rem] overflow-hidden shadow-2xl bg-gray-100">
                <img src="/assets/about_hero.png" alt="School kids" className="w-full h-full object-cover" />
              </div>
              
              {/* Floating Stat Badges */}
              <div className="absolute top-10 -right-4 md:-right-10 flex flex-col gap-4 z-20">
                {[
                  { val: '500+', label: 'Schools & Institutions', icon: Building2, color: 'text-primary', bg: 'bg-primary/5' },
                  { val: '1,200+', label: 'Verified Vendors', icon: Users, color: 'text-accent-green', bg: 'bg-green-50' },
                  { val: '50K+', label: 'Products Listed', icon: ShoppingBag, color: 'text-accent-orange', bg: 'bg-orange-50' },
                  { val: '₹250Cr+', label: 'Procurement Facilitated', icon: TrendingUp, color: 'text-primary', bg: 'bg-blue-50' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-4 rounded-3xl shadow-xl border border-gray-100 flex items-center gap-4 min-w-[200px] transform hover:scale-105 transition-transform">
                    <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-full flex items-center justify-center shrink-0`}>
                      <stat.icon size={20} />
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${stat.color}`}>{stat.val}</div>
                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Why We Exist Section */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <div className="text-accent-green text-[11px] font-bold uppercase tracking-widest mb-4">OUR STORY</div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#0f2f5f] mb-8">Why We Exist</h2>
              <div className="space-y-6 text-text-secondary leading-relaxed text-lg font-normal mb-12">
                <p>We saw schools struggling with fragmented suppliers, inconsistent quality and manual procurement processes.</p>
                <p>School E-Mart was built to solve that—bringing transparency, efficiency and technology together in one unified platform.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                 {[
                   { icon: ShieldCheck, title: '100% Verified Vendors', color: 'text-accent-green', bg: 'bg-green-50' },
                   { icon: TrendingUp, title: 'Direct Factory Pricing', color: 'text-accent-orange', bg: 'bg-orange-50' },
                   { icon: BadgeCheck, title: 'Secure & Transparent', color: 'text-primary', bg: 'bg-blue-50' },
                 ].map((item, i) => (
                   <div key={i} className="flex flex-col gap-4">
                     <div className={`w-12 h-12 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center`}>
                       <item.icon size={24} />
                     </div>
                     <span className="text-xs font-bold text-text-primary leading-tight">{item.title}</span>
                   </div>
                 ))}
              </div>
            </div>
            
            {/* Challenge vs Solution Visual */}
            <div className="relative">
              <div className="bg-gray-50 rounded-[3rem] p-8 md:p-12 relative overflow-hidden border border-gray-100">
                <div className="grid grid-cols-2 gap-8 md:gap-16">
                  <div className="space-y-6">
                    <h4 className="text-accent-orange text-[10px] font-bold uppercase tracking-widest">The Challenge</h4>
                    <ul className="space-y-4">
                      {['Fragmented suppliers', 'High procurement cost', 'Lack of transparency', 'Time consuming'].map((li, i) => (
                        <li key={i} className="flex items-center gap-3 text-xs font-medium text-text-secondary">
                          <div className="w-5 h-5 bg-accent-orange/10 text-accent-orange rounded-full flex items-center justify-center text-[10px] font-bold">x</div> {li}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-6">
                    <h4 className="text-accent-green text-[10px] font-bold uppercase tracking-widest">Our Solution</h4>
                    <ul className="space-y-4">
                      {['One-stop marketplace', 'Competitive pricing', 'Complete transparency', 'Digital automation'].map((li, i) => (
                        <li key={i} className="flex items-center gap-3 text-xs font-medium text-text-secondary">
                          <div className="w-5 h-5 bg-accent-green/10 text-accent-green rounded-full flex items-center justify-center text-[10px] font-bold">✓</div> {li}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {/* Center Circular Image Placeholder */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-40 md:h-40 rounded-full border-8 border-white bg-gray-200 shadow-xl overflow-hidden hidden md:block">
                  <img src="/assets/About_why_exist.png" alt="Challenge vs Solution" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Ecosystem Flow */}
      <section className="py-24 bg-[#f8faff] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-accent-green text-[11px] font-bold uppercase tracking-widest mb-4">OUR ECOSYSTEM</div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0f2f5f] mb-6">One Platform. Many Possibilities.</h2>
          <p className="text-text-secondary text-lg font-normal mb-20 max-w-2xl mx-auto">A connected ecosystem that brings schools and suppliers together.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Connecting Arrows (Desktop) */}
            <div className="hidden md:block absolute top-12 left-0 w-full px-24 z-0">
               <div className="flex justify-between">
                 {[1,2,3].map(i => <ArrowRight key={i} size={24} className="text-gray-200" />)}
               </div>
            </div>
            
            {[
              { title: 'Schools & Institutions', icon: Building2, desc: 'Share requirements and manage procurement', bg: 'bg-green-50', color: 'text-accent-green' },
              { title: 'Procurement Engine', icon: Search, desc: 'Smart matching, quotes & comparison tools', bg: 'bg-orange-50', color: 'text-accent-orange' },
              { title: 'Verified Vendors', icon: ShieldCheck, desc: 'Quality suppliers provide best value', bg: 'bg-blue-50', color: 'text-primary' },
              { title: 'Logistics & Fulfillment', icon: Truck, desc: 'Timely delivery with real-time tracking', bg: 'bg-green-50', color: 'text-accent-green' },
            ].map((step, i) => (
              <div key={i} className="relative z-10 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:shadow-xl transition-all">
                <div className={`w-16 h-16 ${step.bg} ${step.color} rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110`}>
                  <step.icon size={28} />
                </div>
                <h4 className="font-bold text-sm text-[#0f2f5f] mb-4">{step.title}</h4>
                <p className="text-[11px] text-text-secondary leading-relaxed font-normal">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Category Showcase */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-accent-orange text-[11px] font-bold uppercase tracking-widest mb-4">WHAT WE OFFER</div>
          <h2 className="text-4xl md:text-5xl font-bold text-[#0f2f5f] mb-16">Everything Your Institution Needs</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-16 text-left">
            {[
              { title: 'Books & Institutions', icon: BookOpen, image: '/assets/books.png', desc: 'Curriculum books, reference material & essentials' },
              { title: 'Uniform Procurement', icon: Shirt, image: '/assets/uniforms.png', desc: 'High-quality uniforms with customization' },
              { title: 'Furniture Solutions', icon: Armchair, image: '/assets/furniture.png', desc: 'Ergonomic classroom and lab furniture' },
              { title: 'Teaching & Learning', icon: GraduationCap, image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=400', desc: 'Modern teaching aids and smart tools' },
              { title: 'Lab & Science', icon: FlaskConical, image: '/assets/lab_and_science.png', desc: 'Lab instruments and science consumables' },
              { title: 'Technology Products', icon: Laptop, image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=400', desc: 'Computers, tablets and digital solutions' },
            ].map((cat, i) => (
              <div key={i} className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 group hover:shadow-xl transition-all flex flex-col h-full">
                <div className="h-32 bg-gray-50 relative overflow-hidden shrink-0">
                   <img src={cat.image} alt={cat.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                   <div className="absolute top-3 left-3 w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center text-primary">
                     <cat.icon size={16} />
                   </div>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h4 className="text-[13px] font-semibold text-[#0f2f5f] mb-2 leading-tight">{cat.title}</h4>
                  <p className="text-[10px] text-text-secondary leading-relaxed font-normal">{cat.desc}</p>
                </div>
              </div>
            ))}
          </div>
          
          <button className="px-10 py-4 border border-gray-200 rounded-xl font-semibold tracking-wider text-text-primary hover:bg-gray-50 transition-all flex items-center gap-3 mx-auto">
            Explore All Categories <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* 5. Procurement Journey (How It Works) */}
      <section className="py-24 bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-accent-orange text-[11px] font-bold uppercase tracking-widest mb-4">HOW IT WORKS</div>
          <h2 className="text-3xl md:text-4xl font-bold mb-20">The Smart Procurement Journey</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
             <div className="hidden md:block absolute top-10 left-0 w-full px-24">
                <div className="h-[2px] bg-white/10 border-t border-dashed border-white/30"></div>
             </div>
             
             {[
               { step: '01. Register', icon: UserPlus, desc: 'Create your school or vendor account in minutes.' },
               { step: '02. Request / Quote', icon: FileText, desc: 'Share your requirements and receive quotes from verified vendors.' },
               { step: '03. Compare & Select', icon: Settings, desc: 'Compare prices, quality and delivery timelines. Choose the best.' },
               { step: '04. Order & Fulfill', icon: Truck, desc: 'Place your order and track delivery till completion.' },
             ].map((item, i) => (
               <div key={i} className="relative z-10 flex flex-col items-center">
                 <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-8 hover:bg-accent-orange hover:border-accent-orange transition-all duration-300">
                    <item.icon size={28} />
                 </div>
                 <h4 className="font-bold text-lg mb-4">{item.step}</h4>
                 <p className="text-[13px] text-white/60 leading-relaxed font-normal">{item.desc}</p>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* 6. Mission & Vision */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
            
            {/* Mission Card */}
            <div className="flex-1 bg-[#fff8f4] p-10 md:p-12 rounded-[2.5rem] relative group border border-orange-100/50 shadow-sm">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-white text-accent-orange rounded-full flex items-center justify-center shadow-sm">
                  <Target size={24} />
                </div>
                <h4 className="text-sm font-semibold uppercase tracking-widest text-[#0f2f5f]/60">OUR MISSION</h4>
              </div>
              <p className="text-[15px] md:text-[16px] text-text-primary leading-relaxed font-normal">
                To modernize the educational supply chain by providing a transparent, efficient, and technology-driven marketplace that helps schools focus more on education and less on logistics.
              </p>
            </div>
            
            {/* Center Hero Visual with Blobs */}
            <div className="relative w-full max-w-[400px] flex items-center justify-center">
               {/* Organic Blobs */}
               <div className="absolute top-0 -left-10 w-24 h-24 bg-green-100 rounded-full blur-3xl opacity-60"></div>
               <div className="absolute bottom-0 -right-10 w-32 h-32 bg-orange-100 rounded-full blur-3xl opacity-60"></div>
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gray-50 rounded-full -z-10"></div>
               
               <div className="relative w-72 h-72 md:w-80 md:h-80 rounded-full overflow-hidden border-8 border-white shadow-2xl z-10">
                  <img src="/assets/About_mission_hero.png" alt="Mission Hero" className="w-full h-full object-cover" />
               </div>
            </div>
            
            {/* Vision Card */}
            <div className="flex-1 bg-[#f4fbf8] p-10 md:p-12 rounded-[2.5rem] relative group border border-green-100/50 shadow-sm text-right lg:text-left">
              <div className="flex items-center lg:justify-start justify-end gap-4 mb-8">
                <div className="w-12 h-12 bg-white text-accent-green rounded-full flex items-center justify-center shadow-sm">
                  <Eye size={24} />
                </div>
                <h4 className="text-sm font-semibold uppercase tracking-widest text-[#0f2f5f]/60">OUR VISION</h4>
              </div>
              <p className="text-[15px] md:text-[16px] text-text-primary leading-relaxed font-normal">
                To become the global standard for educational procurement, fostering a sustainable ecosystem where quality resources are accessible to every school, regardless of location.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Role Showcase (Split Panels) */}
      <section className="pb-24 md:pb-32 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
          {/* Schools Card */}
          <div className="bg-[#f2f8ff] rounded-[3rem] p-10 md:p-14 relative overflow-hidden group border border-blue-100/50 flex flex-col md:flex-row items-center gap-10">
             <div className="relative z-10 flex-1">
                <h3 className="text-2xl md:text-3xl font-semibold text-primary mb-8">For Schools & Institutions</h3>
                <ul className="space-y-4 mb-12">
                   {['Access thousands of verified vendors', 'Centralized dashboard for all procurement', 'Automated quotes & comparison', 'Dedicated account management'].map((li, i) => (
                     <li key={i} className="flex items-center gap-3 text-[13px] font-medium text-text-primary">
                       <div className="w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px]">
                         <CheckCircle2 size={12} />
                       </div>
                       {li}
                     </li>
                   ))}
                </ul>
                <button 
                  onClick={() => navigate(ROUTES.REGISTER)}
                  className="w-full sm:w-auto px-10 py-4 bg-[#2563eb] text-white rounded-xl font-semibold tracking-wider hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  Onboard Your School <ArrowRight size={18} />
                </button>
             </div>
             <div className="relative w-full md:w-64 h-64 md:h-80 shrink-0 transform group-hover:scale-105 transition-transform duration-700">
                <img src="/assets/About_mission_school.png" alt="School illustration" className="w-full h-full object-contain" />
             </div>
          </div>
          
          {/* Vendors Card */}
          <div className="bg-[#fff9f4] rounded-[3rem] p-10 md:p-14 relative overflow-hidden group border border-orange-100/50 flex flex-col md:flex-row items-center gap-10">
             <div className="relative z-10 flex-1">
                <h3 className="text-2xl md:text-3xl font-semibold text-accent-orange mb-8">For Vendors & Manufacturers</h3>
                <ul className="space-y-4 mb-12">
                   {['Connect with 500+ schools across India', 'Zero marketing costs - we bring demand to you', 'Professional bidding & quotation platform', 'Timely payments & long-term partnerships'].map((li, i) => (
                     <li key={i} className="flex items-center gap-3 text-[13px] font-medium text-text-primary">
                       <div className="w-5 h-5 bg-accent-orange/10 text-accent-orange rounded-full flex items-center justify-center text-[10px]">
                         <CheckCircle2 size={12} />
                       </div>
                       {li}
                     </li>
                   ))}
                </ul>
                <button 
                  onClick={() => navigate(ROUTES.REGISTER)}
                  className="w-full sm:w-auto px-10 py-4 bg-accent-orange text-white rounded-xl font-semibold tracking-wider hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  Join as a Partner <ArrowRight size={18} />
                </button>
             </div>
             <div className="relative w-full md:w-64 h-64 md:h-80 shrink-0 transform group-hover:scale-105 transition-transform duration-700">
                <img src="/assets/About_mission_vendor.png" alt="Vendor illustration" className="w-full h-full object-contain" />
             </div>
          </div>
        </div>
      </section>

      {/* 8. Final CTA Section */}
      <section className="bg-accent-green py-24 text-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
           <h2 className="text-4xl md:text-5xl font-bold mb-8">Let's Build a Smarter Future for Education</h2>
           <p className="text-lg opacity-80 mb-12 max-w-2xl mx-auto font-normal">Join thousands of institutions and vendors already growing with School E-Mart.</p>
           <div className="flex flex-col sm:flex-row justify-center gap-6">
              <button className="px-12 py-5 bg-white text-accent-green rounded-2xl font-semibold tracking-wider hover:shadow-2xl transition-all active:scale-95 text-lg">
                Register Your School
              </button>
              <button className="px-12 py-5 border-2 border-white/30 text-white rounded-2xl font-semibold tracking-wider hover:bg-white/10 transition-all active:scale-95 text-lg">
                Become a Vendor
              </button>
           </div>
        </div>
      </section>

    </div>
  );
};

// Mock missing icon
const UserPlus = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line><line x1="22" x2="16" y1="11" y2="11"></line></svg>
);

export default About;
