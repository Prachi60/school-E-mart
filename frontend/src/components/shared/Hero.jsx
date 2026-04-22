import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

/**
 * MOCK CMS DATA
 * Using local assets from /public/assets
 */
const BANNER_INVENTORY = {
  main: [
    {
      id: 'main_1',
      mode: 'creative',
      image: '/assets/Hero_promo_banner.png',
      link: ROUTES.SHOP,
    },
    {
      id: 'main_2',
      mode: 'creative',
      image: '/assets/Hero_promo_banner_2.png',
      link: ROUTES.SHOP,
    }
  ],
  side: [
    {
      id: 'side_1',
      mode: 'creative',
      image: '/assets/promo_banner_1.png',
      link: '#',
    },
    {
      id: 'side_2',
      mode: 'creative',
      image: '/assets/promo_banner_2.png',
      link: '#',
    }
  ]
};

const categories = [
  { name: 'Furniture', image: '/assets/furniture.png', bgColor: 'bg-[#FFF9F0]' },
  { name: 'Books', image: '/assets/books.png', bgColor: 'bg-[#EBF7FF]' },
  { name: 'Uniforms', image: '/assets/uniforms.png', bgColor: 'bg-[#FFF3F3]' },
  { name: 'Stationery', image: '/assets/stationary.png', bgColor: 'bg-[#FFFBF0]' },
  { name: 'Technology', image: '/assets/technology.png', bgColor: 'bg-[#F2FFF4]' },
  { name: 'Toys & Sports', image: '/assets/toys_and_sports.png', bgColor: 'bg-[#F3F2FF]' },
  { name: 'Lab & Science', image: '/assets/lab_and_science.png', bgColor: 'bg-[#EFFFFD]' },
  { name: 'Transport', image: '/assets/transport.png', bgColor: 'bg-[#FFF4EB]' },
];

const PromoBanner = ({ banner, className = '' }) => {
  const navigate = useNavigate();
  const isTemplate = banner.mode === 'template';

  return (
    <div 
      className={`relative w-full h-full overflow-hidden cursor-pointer group bg-white flex items-center justify-center ${className}`}
      onClick={() => navigate(banner.link)}
    >
      <img 
        src={banner.image} 
        alt={banner.title || 'Promotion'} 
        className="max-w-full max-h-full object-contain transition-transform duration-1000 group-hover:scale-[1.01]"
      />
      {isTemplate && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center px-12">
          <div className="max-w-md">
            {banner.badge && (
              <span className="inline-block px-3 py-1 bg-accent-orange text-white text-[10px] font-bold uppercase rounded mb-4">
                {banner.badge}
              </span>
            )}
            <h2 className="text-3xl font-semibold text-white mb-4 leading-tight">{banner.title}</h2>
            <p className="text-white/80 text-sm mb-6">{banner.subtitle}</p>
            <button className="px-6 py-2 bg-white text-primary rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors">
              {banner.ctaText || 'Shop Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Hero = () => {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (BANNER_INVENTORY.main.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % BANNER_INVENTORY.main.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Banner Inventory Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-10">
          <div className="lg:col-span-8 relative rounded-3xl overflow-hidden min-h-[440px] shadow-sm bg-white">
            {BANNER_INVENTORY.main.map((banner, idx) => (
              <div 
                key={banner.id}
                className={`absolute inset-0 transition-opacity duration-700 ${idx === activeSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              >
                <PromoBanner banner={banner} />
              </div>
            ))}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {BANNER_INVENTORY.main.map((_, idx) => (
                <button 
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setActiveSlide(idx); }}
                  className={`h-1.5 rounded-full transition-all duration-500 shadow-sm ${idx === activeSlide ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
                />
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-5">
            {BANNER_INVENTORY.side.map((banner) => (
              <div key={banner.id} className="flex-1 rounded-3xl overflow-hidden shadow-sm min-h-[210px] bg-white">
                <PromoBanner banner={banner} />
              </div>
            ))}
          </div>
        </div>

        {/* REFINED Category Navigation (Visual Icons) */}
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between overflow-x-auto no-scrollbar gap-8">
            {categories.map((cat, idx) => (
              <div 
                key={idx}
                className="flex flex-col items-center gap-4 min-w-[100px] group cursor-pointer"
              >
                <div className="w-20 h-20 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                  <img 
                    src={cat.image} 
                    alt={cat.name} 
                    className="w-full h-full object-contain transition-transform duration-500 group-hover:rotate-3"
                  />
                </div>
                <span className="text-[13px] font-medium text-text-primary tracking-tight transition-colors group-hover:text-primary">
                  {cat.name}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default Hero;
