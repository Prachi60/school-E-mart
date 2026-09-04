import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Trash2, ArrowLeft, ChevronRight,
  ShieldCheck, Truck, ShoppingCart, Minus, Plus, Building2
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import QuantitySelector from '../../components/QuantitySelector';
import { useCheckoutSummary } from '../../../hooks/useCheckoutSummary';
import useAuthStore from '../../../store/useAuthStore';

// Module-level so the reference stays stable across renders.
const NO_ADDRESS = {};

const SchoolCartPage = () => {
  const navigate = useNavigate();
  const { cartItems, updateQuantity, removeFromCart, totalQuantity, loading } = useCart();
  const [showRemoveToast, setShowRemoveToast] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const localSubtotal = cartItems.reduce((sum, item) => {
    if (item.pricePaise) return sum + (item.pricePaise / 100) * item.quantity;
    const price = typeof item.price === 'string'
      ? parseInt(item.price.replace('₹', '').replace(/,/g, ''), 10)
      : item.price;
    return sum + (price * item.quantity);
  }, 0);

  // Fees come from the admin's billing config via the server-authoritative
  // checkout summary — never hardcoded here, or the cart would disagree with
  // what SchoolCheckoutPage charges.
  const { summary, totals, loading: summaryLoading } = useCheckoutSummary({
    deliveryType: 'school',
    paymentMethod: 'online',
    addressSource: NO_ADDRESS,
    audience: 'school',
    enabled: isAuthenticated && cartItems.length > 0,
  });

  // `totals` is zero-filled until the summary actually arrives, so fall back to
  // the item subtotal rather than showing ₹0 fees we haven't confirmed.
  const hasSummary = Boolean(summary);
  const subtotal = hasSummary ? totals.subtotal : localSubtotal;
  const deliveryFee = hasSummary ? totals.deliveryCharge : 0;
  const platformFee = hasSummary ? totals.platformFee : 0;
  const total = hasSummary ? totals.grandTotal : localSubtotal;

  const handleRemove = (id) => {
    removeFromCart(id);
    setShowRemoveToast(true);
    setTimeout(() => setShowRemoveToast(false), 2000);
  };

  if (loading && cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8F7FF] flex items-center justify-center font-outfit">
        <p className="text-sm text-gray-400">Loading cart...</p>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8F7FF] flex flex-col items-center justify-center px-6 text-center font-outfit">
        <div className="w-64 h-64 bg-primary/5 rounded-full flex items-center justify-center mb-8 animate-pulse">
          <Building2 size={80} className="text-primary/20" />
        </div>
        <h2 className="text-2xl font-black text-deep-purple mb-2">No active procurements</h2>
        <p className="text-gray-400 text-sm font-medium mb-10 max-w-[240px]">
          Your institutional cart is empty. Start adding bulk supplies for your school.
        </p>
        <Link 
          to="/school/admin"
          className="w-full py-4 bg-primary text-white rounded-2xl text-sm font-black shadow-lg shadow-primary/20 active:scale-95 transition-all"
        >
          Explore Supplies
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7FF] pb-32 font-outfit relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-gray-100 z-50 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-deep-purple p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-black text-deep-purple">School Cart ({totalQuantity})</h1>
      </div>

      <div className="pt-20 px-6 space-y-4">
        {/* Cart Items */}
        {cartItems.map((item) => (
          <div key={item.id} className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50 flex gap-4 relative animate-in slide-in-from-right-4 duration-300">
            <div className="w-24 h-24 bg-gray-50 rounded-2xl overflow-hidden shrink-0">
              <img src={item.image} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
            </div>
            
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-sm font-bold text-deep-purple line-clamp-1 pr-6">{item.name}</h3>
                <button 
                  onClick={() => handleRemove(item.id)}
                  className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-[10px] text-primary font-bold uppercase mb-2">Institutional Pack</p>
              
              <div className="mt-auto flex items-center justify-between">
                <span className="text-base font-black text-black">
                  ₹{(typeof item.price === 'string' ? parseInt(item.price.replace('₹', '').replace(',', '')) : item.price)}
                </span>
                <QuantitySelector 
                  quantity={item.quantity}
                  onIncrease={() => updateQuantity(item.id, 1)}
                  onDecrease={() => {
                    if (item.quantity === 1) {
                      handleRemove(item.id);
                    } else {
                      updateQuantity(item.id, -1);
                    }
                  }}
                  className="scale-90 origin-right"
                />
              </div>
            </div>
          </div>
        ))}

        {/* Price Breakdown */}
        <div className="mt-8 bg-white rounded-3xl p-6 shadow-sm border border-gray-50 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-primary" />
            <h3 className="text-sm font-black text-deep-purple uppercase tracking-widest">Procurement Summary</h3>
          </div>
          <div className="flex justify-between text-xs font-bold">
            <span className="text-gray-400">Items Subtotal</span>
            <span className="text-deep-purple">₹{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs font-bold">
            <span className="text-gray-400">Institutional Delivery</span>
            <span className={deliveryFee === 0 ? 'text-green-500 font-black' : 'text-deep-purple'}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee.toLocaleString()}`}
            </span>
          </div>
          {platformFee > 0 && (
            <div className="flex justify-between text-xs font-bold">
              <span className="text-gray-400">Procurement Handling</span>
              <span className="text-deep-purple">₹{platformFee.toLocaleString()}</span>
            </div>
          )}
          <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
            <span className="text-sm font-black text-deep-purple">Final Amount</span>
            <span className="text-xl font-black text-primary">₹{total.toLocaleString()}</span>
          </div>
          {!hasSummary && (
            <p className="text-[10px] font-bold text-gray-300 text-center">
              {summaryLoading ? 'Calculating…' : 'Charges calculated at checkout'}
            </p>
          )}
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-20 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-40 max-w-md mx-auto">
        <button 
          onClick={() => navigate('/school/checkout')}
          className="w-full py-4 bg-primary text-white rounded-2xl text-sm font-black shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          Confirm Procurement Order
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default SchoolCartPage;
