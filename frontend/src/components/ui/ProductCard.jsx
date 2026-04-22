import React from 'react';
import { ShoppingCart, ArrowRight, MessageSquareQuote } from 'lucide-react';

const ProductCard = ({ 
  product = {
    image: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&q=80&w=600',
    category: 'Furniture & Accessories',
    title: 'Modern Ergonomic Classroom Student Desk',
    currentPrice: 4971,
    originalPrice: 5990,
    discount: 17,
    hasBulkQuote: true,
  } 
}) => {
  const {
    image,
    category,
    title,
    currentPrice,
    originalPrice,
    discount,
    hasBulkQuote
  } = product;

  const formattedPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="group bg-white rounded-xl border border-gray-50 transition-all duration-500 hover:shadow-[0_12px_40px_rgb(0,0,0,0.04)] flex flex-col h-full overflow-hidden">
      
      {/* 1. Image Area */}
      <div className="relative aspect-[4/3] bg-[#F9FAFB] flex items-center justify-center overflow-hidden">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>

      {/* 2. Content Area */}
      <div className="p-5 flex flex-col flex-1">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.12em] mb-2">
          {category}
        </p>

        <h3 className="text-text-primary font-medium text-[15px] leading-snug mb-4 line-clamp-2 h-[42px] group-hover:text-primary transition-colors">
          {title}
        </h3>

        {/* Bulk Pricing Chip (Subtle) */}
        {hasBulkQuote && (
          <div className="mb-2">
            <span className="bg-primary/[0.04] text-primary/60 text-[9px] font-semibold px-2 py-0.5 rounded-full border border-primary/5">
              Bulk Pricing Available
            </span>
          </div>
        )}

        {/* Pricing */}
        <div className="flex flex-col mb-6">
          <span className="text-[17px] font-medium text-text-primary">
            {formattedPrice(currentPrice)}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-gray-300 line-through">
              {formattedPrice(originalPrice)}
            </span>
            <span className="text-[11px] font-medium text-accent-green">
              {discount}% OFF
            </span>
          </div>
        </div>

        {/* Hybrid Actions */}
        <div className="mt-auto space-y-4">
          {/* Primary CTA: Add to Cart (Reduced height) */}
          <button className="w-full py-2.5 bg-primary text-white rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-[#1a3a6b] transition-all shadow-sm active:scale-95">
            <ShoppingCart size={16} />
            Add to Cart
          </button>
          
          <div className="flex items-center justify-between px-1">
            {/* Secondary CTA: View Details (Clean text link) */}
            <button className="flex items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-primary transition-all group/link">
              View Details
              <ArrowRight size={12} className="transition-transform group-hover/link:translate-x-1" />
            </button>

            {/* Procurement CTA: Bulk Quote (Outlined pill) */}
            {hasBulkQuote && (
              <button className="flex items-center gap-1.5 px-3 py-1 border border-accent-orange/30 text-accent-orange rounded-full text-[10px] font-semibold hover:bg-accent-orange hover:text-white transition-all duration-300 active:scale-95">
                <MessageSquareQuote size={12} />
                Bulk Quote
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
