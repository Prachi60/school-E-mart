import React from 'react';
import ProductCard from '../../components/ui/ProductCard';

const demoProducts = [
  {
    image: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&q=80&w=600',
    category: 'Furniture & Accessories',
    title: 'Modern Ergonomic Classroom Student Desk & Chair Set',
    currentPrice: 4971,
    originalPrice: 5990,
    discount: 17,
    hasBulkQuote: true,
  },
  {
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=600',
    category: 'Teaching & Learning',
    title: 'Advanced STEM Robotics Kit for Middle School Students',
    currentPrice: 8500,
    originalPrice: 10000,
    discount: 15,
    hasBulkQuote: true,
  },
  {
    image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&q=80&w=600',
    category: 'Books & Stationery',
    title: 'Premium Hardcover School Journal - Pack of 10',
    currentPrice: 1200,
    originalPrice: 1500,
    discount: 20,
    hasBulkQuote: false,
  },
  {
    image: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&q=80&w=600',
    category: 'Uniform & Apparel',
    title: 'Unisex Primary School Blazer - Navy Blue',
    currentPrice: 2450,
    originalPrice: 3000,
    discount: 18,
    hasBulkQuote: true,
  },
  {
    image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600',
    category: 'Library & Media',
    title: 'World Atlas Encyclopedia - 2024 Collector\'s Edition',
    currentPrice: 3200,
    originalPrice: 4000,
    discount: 20,
    hasBulkQuote: true,
  },
  {
    image: 'https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?auto=format&fit=crop&q=80&w=600',
    category: 'Sports & Outdoors',
    title: 'Professional Grade Basketball - Size 7 Official',
    currentPrice: 1850,
    originalPrice: 2200,
    discount: 16,
    hasBulkQuote: false,
  },
  {
    image: 'https://images.unsplash.com/photo-1516533075015-a3838414c3ca?auto=format&fit=crop&q=80&w=600',
    category: 'Art & Craft',
    title: 'Professional Watercolor Paint Set - 48 Colors',
    currentPrice: 2100,
    originalPrice: 2800,
    discount: 25,
    hasBulkQuote: true,
  },
  {
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=600',
    category: 'Technology',
    title: 'Portable Interactive Whiteboard Projector System',
    currentPrice: 45000,
    originalPrice: 55000,
    discount: 18,
    hasBulkQuote: true,
  }
];

const ProductShowcase = () => {
  return (
    <div className="py-12 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-text-primary tracking-tight">Featured School Supplies</h2>
            <p className="text-text-secondary mt-2 text-lg font-normal">Premium curated products for your educational infrastructure.</p>
          </div>
          <button className="px-7 py-2.5 border-2 border-primary text-primary font-medium rounded-full hover:bg-primary hover:text-white transition-all shadow-sm">
            View All Marketplace
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {demoProducts.map((product, index) => (
            <ProductCard key={index} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductShowcase;
