import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Trash2, ArrowLeft, ChevronRight, 
  ShieldCheck, Truck, ShoppingCart, Minus, Plus 
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import QuantitySelector from '../../components/QuantitySelector';
import useAuthStore from '../../../store/useAuthStore';
import { useCheckoutSummary } from '../../../hooks/useCheckoutSummary';

// Module-level so the reference stays stable across renders.
const NO_ADDRESS = {};

const CartPage = () => {
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

  // Fetch real fees from backend when authenticated
  const { summary, totals, loading: summaryLoading } = useCheckoutSummary({
    deliveryType: 'home',
    paymentMethod: 'online',
    addressSource: NO_ADDRESS,
    audience: 'parent',
    enabled: isAuthenticated && cartItems.length > 0,
  });

  // `totals` is always a zero-filled object, so only trust it once `summary` has
  // actually arrived. Without a summary we can only show the item subtotal —
  // fees are decided by the backend billing config at checkout.
  const hasSummary = Boolean(summary);
  const subtotal = hasSummary ? totals.subtotal : localSubtotal;
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
          <ShoppingCart size={80} className="text-primary/20" />
        </div>
        <h2 className="text-2xl font-black text-deep-purple mb-2">Your cart is empty</h2>
        <p className="text-gray-400 text-sm font-medium mb-10 max-w-[240px]">
          Looks like you haven't added anything yet. Start exploring our school essentials!
        </p>
        <Link 
          to="/user/home"
          className="w-full py-4 bg-primary text-white rounded-2xl text-sm font-black shadow-lg shadow-primary/20 active:scale-95 transition-all"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7FF] pb-32 font-outfit relative">
      {/* Toast Notification */}
      {showRemoveToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] w-max animate-in fade-in slide-in-from-top duration-300">
          <div className="bg-black/90 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 backdrop-blur-md">
            <Trash2 size={14} className="text-red-400" />
            <span className="text-xs font-bold">Item removed from cart</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-gray-100 z-50 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-deep-purple p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-black text-deep-purple">My Cart ({totalQuantity})</h1>
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
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Standard Pack</p>
              
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
          <h3 className="text-sm font-black text-deep-purple uppercase tracking-widest mb-2">Payment Details</h3>
          <div className="flex justify-between text-xs font-bold">
            <span className="text-gray-400">Items Subtotal</span>
            <span className="text-deep-purple">₹{subtotal.toLocaleString()}</span>
          </div>

          {hasSummary ? (
            <>
              {totals.discount > 0 && (
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-400">Discount</span>
                  <span className="text-green-500">-₹{totals.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-bold">
                <span className="text-gray-400">Delivery Fee</span>
                <span className={totals.deliveryCharge === 0 ? 'text-green-500' : 'text-deep-purple'}>
                  {totals.deliveryCharge === 0 ? 'FREE' : `₹${totals.deliveryCharge.toLocaleString()}`}
                </span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-gray-400">Platform Fee</span>
                <span className="text-deep-purple">₹{totals.platformFee.toLocaleString()}</span>
              </div>
              {totals.handlingCharge > 0 && (
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-400">Handling Charge</span>
                  <span className="text-deep-purple">₹{totals.handlingCharge.toLocaleString()}</span>
                </div>
              )}
              {totals.tax > 0 && (
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-400">Tax</span>
                  <span className="text-deep-purple">₹{totals.tax.toLocaleString()}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-between text-xs font-bold">
              <span className="text-gray-400">Delivery &amp; fees</span>
              <span className="text-gray-400">
                {summaryLoading ? 'Calculating…' : 'Calculated at checkout'}
              </span>
            </div>
          )}

          <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
            <span className="text-sm font-black text-deep-purple">
              {hasSummary ? 'Total Amount' : 'Items Total'}
            </span>
            <span className="text-xl font-black text-primary">₹{total.toLocaleString()}</span>
          </div>
        </div>

        {/* Security & Trust */}
        <div className="flex items-center justify-center gap-6 py-6 opacity-40 grayscale">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} />
            <span className="text-[10px] font-bold">Secure</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck size={16} />
            <span className="text-[10px] font-bold">Fast</span>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-20 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-40">
        <button 
          onClick={() => navigate('/user/checkout')}
          className="w-full py-4 bg-primary text-white rounded-2xl text-sm font-black shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          Proceed to Checkout
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default CartPage;
