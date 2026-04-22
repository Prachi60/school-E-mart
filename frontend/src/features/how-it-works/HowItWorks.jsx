import React, { useState } from 'react';
import { 
  Building2, 
  Store, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  TrendingUp, 
  Package, 
  Truck, 
  CreditCard, 
  Search, 
  ClipboardCheck, 
  ChevronDown,
  ChevronUp,
  FileText,
  BadgeCheck,
  Star,
  Users,
  Wallet,
  Zap,
  BarChart3,
  Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

const StepCard = ({ number, title, desc, icon: Icon, color = "primary" }) => (
  <div className="group bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden">
    <div className={`absolute top-0 right-0 w-24 h-24 ${color === 'primary' ? 'bg-primary/5' : 'bg-accent-orange/5'} rounded-full translate-x-1/2 -translate-y-1/2`}></div>
    <div className="flex flex-col h-full relative z-10">
      <div className="flex items-center justify-between mb-8">
        <div className={`w-14 h-14 rounded-2xl ${color === 'primary' ? 'bg-primary/5 text-primary' : 'bg-accent-orange/5 text-accent-orange'} flex items-center justify-center transition-transform group-hover:scale-110`}>
          <Icon size={28} />
        </div>
        <span className="text-4xl font-black text-gray-100 group-hover:text-gray-200 transition-colors">{number}</span>
      </div>
      <h4 className="text-xl font-bold text-text-primary mb-4">{title}</h4>
      <p className="text-sm text-text-secondary leading-relaxed font-normal">{desc}</p>
    </div>
  </div>
);

const FeatureItem = ({ icon: Icon, title, desc, colorClass }) => (
  <div className="flex items-start gap-4 p-6 rounded-3xl bg-white border border-gray-50 shadow-sm group hover:shadow-md transition-all">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
      <Icon size={22} />
    </div>
    <div>
      <h5 className="text-sm font-bold text-text-primary mb-1">{title}</h5>
      <p className="text-[11px] text-text-secondary leading-relaxed font-normal">{desc}</p>
    </div>
  </div>
);

const FAQItem = ({ question, answer, isOpen, onClick }) => (
  <div className="border border-gray-100 rounded-2xl overflow-hidden mb-4 transition-all">
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-6 text-left transition-colors ${isOpen ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}`}
    >
      <span className="font-semibold text-[#0f2f5f]">{question}</span>
      {isOpen ? <ChevronUp size={20} className="text-primary" /> : <ChevronDown size={20} className="text-gray-400" />}
    </button>
    {isOpen && (
      <div className="p-6 pt-0 bg-gray-50 text-text-secondary text-sm leading-relaxed font-normal animate-in fade-in slide-in-from-top-1">
        {answer}
      </div>
    )}
  </div>
);

const HowItWorks = () => {
  const [activeTab, setActiveTab] = useState('school');
  const [openFAQ, setOpenFAQ] = useState(0);
  const navigate = useNavigate();

  const faqs = [
    {
      question: "Is there any registration fee for vendors?",
      answer: "No, joining School E-Mart as a vendor is completely free. We follow a performance-based model where we only succeed when you succeed."
    },
    {
      question: "How long does it take to get paid?",
      answer: "Once the school confirms delivery and quality satisfaction, payments are processed within 3-5 business days directly into your registered wallet."
    },
    {
      question: "What types of products can I sell?",
      answer: "You can sell anything related to educational institutions - from uniforms and books to laboratory equipment, furniture, and smart learning technology."
    },
    {
      question: "How are vendors verified?",
      answer: "Every vendor undergoes a strict 4-step verification process including business registration check, manufacturing capacity audit, and quality certification review."
    }
  ];

  return (
    <div className="w-full bg-[#fcfcfd] text-text-primary">
      
      {/* 1. Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden bg-white">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/5 -skew-x-12 translate-x-1/4"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary text-[11px] font-bold uppercase tracking-widest rounded-full mb-8">
                <Zap size={14} className="text-accent-orange" /> 
                Simplified Procurement
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-primary leading-[1.15] mb-6 tracking-tight">
                How Procurement <br/>Works for <br/>
                <span className="text-accent-orange">Schools</span> & <span className="text-accent-green">Vendors</span>
              </h1>
              <p className="text-lg text-text-secondary mb-10 leading-relaxed max-w-md font-normal">
                One marketplace. Two journeys. Seamless institutional buying and selling rebuilt for the digital age.
              </p>
              
              {/* Persona Switcher */}
              <div className="flex p-1.5 bg-gray-100 rounded-3xl w-fit">
                <button 
                  onClick={() => setActiveTab('school')}
                  className={`flex items-center gap-3 px-8 py-4 rounded-2xl transition-all duration-300 font-bold text-sm ${activeTab === 'school' ? 'bg-white text-primary shadow-xl scale-105' : 'text-text-secondary hover:text-primary'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeTab === 'school' ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-400'}`}>
                    <Building2 size={18} />
                  </div>
                  <div>
                    <div className="text-xs">For Schools</div>
                    <div className="text-[10px] opacity-60 font-medium">Buying Made Simple</div>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('vendor')}
                  className={`flex items-center gap-3 px-8 py-4 rounded-2xl transition-all duration-300 font-bold text-sm ${activeTab === 'vendor' ? 'bg-white text-primary shadow-xl scale-105' : 'text-text-secondary hover:text-primary'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeTab === 'vendor' ? 'bg-accent-orange/10 text-accent-orange' : 'bg-gray-200 text-gray-400'}`}>
                    <Store size={18} />
                  </div>
                  <div>
                    <div className="text-xs">For Vendors</div>
                    <div className="text-[10px] opacity-60 font-medium">Selling Made Easy</div>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Hero Visual - Balanced Size */}
            <div className="relative">
               <div className="w-full relative group transform lg:translate-x-4">
                  <img 
                    src="/assets/How_works_hero.png" 
                    alt="Marketplace Workflow" 
                    className="w-full h-auto object-contain transform group-hover:scale-[1.03] transition-transform duration-700"
                  />
                  {/* Subtle Floating Decorative Elements */}
                  <div className="absolute top-[12%] right-[8%] p-4 bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl animate-float border border-white/50 z-20">
                    <ShieldCheck size={28} className="text-accent-green" />
                  </div>
                  <div className="absolute bottom-[18%] left-[2%] p-4 bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl animate-float border border-white/50 z-20" style={{ animationDelay: '1.2s' }}>
                    <Truck size={28} className="text-primary" />
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Journey Section */}
      <section className="py-32 bg-[#fcfcfd]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-24">
            <div className={`text-[11px] font-bold uppercase tracking-[0.3em] mb-4 ${activeTab === 'school' ? 'text-primary' : 'text-accent-orange'}`}>
              Your Journey as a {activeTab === 'school' ? 'School' : 'Vendor'}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-primary tracking-tight">
              {activeTab === 'school' ? '4 Simple Steps to Smarter Procurement' : 'Grow Your Business with School E-Mart'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {activeTab === 'school' ? (
              <>
                <StepCard number="01" icon={Search} title="Post Requirement" desc="Tell us what you need. Upload your requirement list or create a detailed RFQ in minutes." />
                <StepCard number="02" icon={FileText} title="Receive Quotes" desc="Get competitive quotes from verified manufacturers and vendors across India instantly." />
                <StepCard number="03" icon={ClipboardCheck} title="Compare & Approve" desc="Compare pricing, quality ratings, and delivery timelines. Choose the best fit for your budget." />
                <StepCard number="04" icon={Truck} title="Delivery & Tracking" desc="Track your institutional order in real-time and get it delivered directly to your campus." />
              </>
            ) : (
              <>
                <StepCard number="01" color="orange" icon={BadgeCheck} title="Register" desc="Complete your vendor profile with necessary business credentials and get verified." />
                <StepCard number="02" color="orange" icon={Layers} title="Build Catalogue" desc="List your high-quality products and set your competitive bulk pricing for institutions." />
                <StepCard number="03" color="orange" icon={Zap} title="Receive Orders" desc="Get instant notifications when schools across India place orders or request quotations." />
                <StepCard number="04" color="orange" icon={Wallet} title="Get Paid" desc="Fulfill orders through our logistics partners and receive secure payments directly to your wallet." />
              </>
            )}
            {/* Progress Connectors (Desktop) */}
            <div className="hidden lg:block absolute top-1/2 left-0 w-full px-24 -z-10">
               <div className="flex justify-between">
                 {[1,2,3].map(i => <div key={i} className="w-12 h-0.5 bg-gray-100 border-t border-dashed"></div>)}
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Section */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-24">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">
              Why {activeTab === 'school' ? 'Schools Love' : 'Vendors Choose'} School E-Mart
            </h2>
            <div className="w-20 h-1 bg-accent-orange mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {activeTab === 'school' ? (
              <>
                <FeatureItem icon={ShieldCheck} colorClass="bg-blue-50 text-primary" title="Verified Vendors" desc="Only manufacturers and distributors with verified credentials can sell on the platform." />
                <FeatureItem icon={TrendingUp} colorClass="bg-green-50 text-accent-green" title="Competitive Pricing" desc="Direct factory sourcing ensures you get the best possible prices for bulk orders." />
                <FeatureItem icon={Package} colorClass="bg-orange-50 text-accent-orange" title="Bulk Ordering" desc="Designed specifically for institutional needs - from 100 to 100,000 units." />
                <FeatureItem icon={Layers} colorClass="bg-purple-50 text-purple-600" title="Transparent Procurement" desc="Complete audit trail of quotes, approvals, and payments for institutional compliance." />
                <FeatureItem icon={Zap} colorClass="bg-yellow-50 text-yellow-600" title="Fast Delivery" desc="Optimized logistics network for timely doorstep delivery to your institution." />
                <FeatureItem icon={Search} colorClass="bg-gray-50 text-gray-600" title="Order Tracking" desc="Real-time visibility into every stage of your procurement lifecycle." />
              </>
            ) : (
              <>
                <FeatureItem icon={ShieldCheck} colorClass="bg-blue-50 text-primary" title="Genuine Orders" desc="Receive prepaid and verified orders from established educational institutions." />
                <FeatureItem icon={Wallet} colorClass="bg-green-50 text-accent-green" title="Fast Payments" desc="Get paid within 3-5 days of successful delivery and satisfaction confirmation." />
                <FeatureItem icon={TrendingUp} colorClass="bg-orange-50 text-accent-orange" title="Low Commission" desc="Pay minimal platform fees only when you make a sale. No hidden costs." />
                <FeatureItem icon={BarChart3} colorClass="bg-purple-50 text-purple-600" title="Sales Insights" desc="Access detailed analytics on your product performance and market demand." />
                <FeatureItem icon={Zap} colorClass="bg-yellow-50 text-yellow-600" title="Free Promotions" desc="We market your high-quality products to hundreds of schools across the country." />
                <FeatureItem icon={Users} colorClass="bg-gray-50 text-gray-600" title="Training Support" desc="Get access to resources and webinars to help you scale your institutional sales." />
              </>
            )}
          </div>
        </div>
      </section>

      {/* 4. Infographic Section (Placeholder) */}
      <section className="py-32 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-4xl mx-auto bg-white p-12 md:p-24 rounded-[4rem] shadow-sm border border-gray-100">
             <h2 className="text-3xl font-bold text-primary mb-12">Institutional Procurement Workflow</h2>
             <div className="relative flex flex-col md:flex-row items-center justify-between gap-8 py-10">
                {/* Visual Flow Connector */}
                <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 -z-10"></div>
                
                {[
                  { label: 'Need Identified', icon: Search },
                  { label: 'RFQ Posted', icon: FileText },
                  { label: 'Quotes Submitted', icon: TrendingUp },
                  { label: 'Evaluation', icon: ClipboardCheck },
                  { label: 'Order Placed', icon: Package },
                  { label: 'Delivered', icon: Truck },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-4 relative z-10">
                    <div className="w-16 h-16 bg-white border-2 border-gray-50 rounded-2xl shadow-md flex items-center justify-center text-primary transition-all hover:border-accent-orange hover:text-accent-orange">
                      <item.icon size={24} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">{item.label}</span>
                  </div>
                ))}
             </div>
             <p className="mt-16 text-text-secondary text-sm font-normal max-w-2xl mx-auto leading-relaxed">
               A digital-first procurement process designed for transparency, efficiency and complete accountability at every level of the institution.
             </p>
          </div>
        </div>
      </section>

      {/* 6. Shared Trust Section */}
      <section className="py-24 bg-primary text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
            <div>
              <div className="text-5xl font-bold mb-4">500<span className="text-accent-orange">+</span></div>
              <div className="text-xs font-bold uppercase tracking-widest opacity-60">Schools Trust Us</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-4">1,200<span className="text-accent-green">+</span></div>
              <div className="text-xs font-bold uppercase tracking-widest opacity-60">Verified Vendors</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-4">50K<span className="text-accent-orange">+</span></div>
              <div className="text-xs font-bold uppercase tracking-widest opacity-60">Products Listed</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-4">95<span className="text-accent-green">%</span></div>
              <div className="text-xs font-bold uppercase tracking-widest opacity-60">Repeat Procurement</div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ Section */}
      <section className="py-32 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold text-primary mb-6 tracking-tight">Frequently Asked Questions</h2>
            <p className="text-text-secondary font-normal">Everything you need to know about the School E-Mart ecosystem.</p>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <FAQItem 
                key={idx} 
                question={faq.question} 
                answer={faq.answer} 
                isOpen={openFAQ === idx} 
                onClick={() => setOpenFAQ(openFAQ === idx ? -1 : idx)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-white px-4">
        <div className="max-w-7xl mx-auto bg-gray-50 rounded-[4rem] p-12 md:p-24 text-center border border-gray-100 shadow-sm overflow-hidden relative">
           <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
           <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold text-primary mb-10 tracking-tight">Ready to get started?</h2>
              <p className="text-text-secondary mb-12 max-w-xl mx-auto font-normal">
                Join thousands of schools and vendors already growing with School E-Mart. Free onboarding for verified educational partners.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <button 
                  onClick={() => navigate(ROUTES.REGISTER)}
                  className="px-12 py-5 bg-primary text-white rounded-2xl font-bold hover:shadow-2xl hover:bg-blue-800 transition-all active:scale-95 text-lg"
                >
                  Register Your School
                </button>
                <button 
                  onClick={() => navigate(ROUTES.REGISTER)}
                  className="px-12 py-5 bg-accent-green text-white rounded-2xl font-bold hover:shadow-2xl hover:bg-green-700 transition-all active:scale-95 text-lg"
                >
                  Become a Vendor
                </button>
              </div>
           </div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}} />

    </div>
  );
};

export default HowItWorks;
