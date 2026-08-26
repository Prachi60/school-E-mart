import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ShoppingBag,
  CreditCard, Wallet,
  Plus, Minus, Info, CheckCircle2,
  Building2, Truck, Loader2
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { createOrder, confirmPayment } from '../../../services/ordersApi';
import { openRazorpayCheckout } from '../../../utils/razorpay';
import { ENV } from '../../../config/env';
import useAuthStore from '../../../store/useAuthStore';
import { useCheckoutSummary } from '../../../hooks/useCheckoutSummary';
import { mapOrderForDetail } from '../../../utils/mappers/orderMapper';

const SchoolCheckoutPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { cartItems, updateQuantity, refreshCart } = useCart();

  const [paymentMethod, setPaymentMethod] = useState('online');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');

  const [schoolInfo] = useState(() => {
    const saved = localStorage.getItem('childInfo');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      name: parsed.school || "School",
      address: parsed.schoolAddress || parsed.address || 'Institutional delivery address',
      city: parsed.city || 'Indore',
      pinCode: parsed.pinCode || '452018',
      adminName: parsed.name || 'Admin Office',
    };
  });

  const deliveryType = 'school';
  const schoolIdForPickup = user?.tenantSchoolId || schoolInfo.schoolId;

  const addressSource = useMemo(
    () => ({
      address: schoolInfo.address,
      city: schoolInfo.city,
      pinCode: schoolInfo.pinCode,
    }),
    [schoolInfo.address, schoolInfo.city, schoolInfo.pinCode]
  );

  const { loading: summaryLoading, error: summaryError, totals, buildPayload } =
    useCheckoutSummary({
      deliveryType,
      paymentMethod,
      addressSource,
      schoolIdForPickup,
      audience: 'school',
      enabled: isAuthenticated && cartItems.length > 0,
    });

  const parsePrice = (item) => {
    if (item.pricePaise) return item.pricePaise / 100;
    if (typeof item.price === 'number') return item.price;
    if (typeof item.price === 'string') {
      return parseFloat(item.price.replace(/[^\d.]/g, '')) || 0;
    }
    return 0;
  };

  const fallbackSubtotal = cartItems.reduce(
    (acc, item) => acc + parsePrice(item) * item.quantity,
    0
  );
  const subtotal = totals.subtotal || fallbackSubtotal;
  const handlingCharge = totals.handlingCharge || 0;
  const grandTotal = totals.grandTotal || subtotal + handlingCharge;

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) {
      navigate('/school/login');
      return;
    }

    setOrderError('');
    setIsPlacingOrder(true);

    try {
      const { order, checkout } = await createOrder(buildPayload(), { audience: 'school' });

      if (paymentMethod === 'online' && checkout?.razorpayOrderId) {
        const razorpayResponse = await openRazorpayCheckout({
          keyId: checkout.keyId || ENV.RAZORPAY_KEY_ID,
          razorpayOrderId: checkout.razorpayOrderId,
          amountPaise: checkout.amountPaise,
          currency: checkout.currency,
          description: `Bulk order ${order.orderNumber}`,
          prefill: { name: schoolInfo.adminName },
          notes: { orderId: order._id },
        });

        await confirmPayment(order._id, {
          razorpayPaymentId: razorpayResponse.razorpay_payment_id,
          razorpayOrderId: razorpayResponse.razorpay_order_id,
          razorpaySignature: razorpayResponse.razorpay_signature,
        });
      } else if (paymentMethod === 'online') {
        // Same rule as the parent checkout: with no gateway order there is no payment
        // to confirm, and confirming one anyway marked the order paid for free.
        throw new Error(
          'Online payment is unavailable right now. Please choose Cash on Delivery, or try again later.'
        );
      }

      await refreshCart();
      const mapped = mapOrderForDetail(order);
      navigate('/school/orders', {
        state: {
          orderPlaced: true,
          orderNumber: mapped.orderNumber,
          totalAmount: mapped.totalAmount,
        },
      });
    } catch (error) {
      setOrderError(
        error.response?.data?.message ||
          error.message ||
          'Unable to place bulk order. Please try again.'
      );
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center font-outfit">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6">
          <Building2 size={48} />
        </div>
        <h2 className="text-xl font-bold text-deep-purple mb-2">No active bulk procurements</h2>
        <p className="text-gray-400 text-sm mb-8">Add items to your institutional cart to proceed</p>
        <button
          onClick={() => navigate('/school/admin')}
          className="px-8 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20"
        >
          Explore Supplies
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-outfit pb-48">
      <div className="bg-white px-6 pt-6 pb-4 flex items-center justify-center relative border-b border-gray-100 sticky top-0 z-50">
        <button
          onClick={() => navigate(-1)}
          className="absolute left-6 w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 active:scale-90 transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-black text-deep-purple">Bulk Checkout</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ordering for</p>
              <p className="text-sm font-bold text-deep-purple">{schoolInfo.name}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-50">
            <h2 className="font-bold text-deep-purple mb-1">School Pickup Address</h2>
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Institutional delivery point</p>
          </div>
          <div className="p-4">
            <div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/5">
              <h3 className="font-bold text-deep-purple mb-1">{schoolInfo.adminName}</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed font-medium">{schoolInfo.address}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-4">
            Bulk Shipment ({cartItems.length} items)
          </p>
          <div className="space-y-6">
            {cartItems.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100">
                  <img src={item.image} alt={item.name} className="w-full h-full object-contain p-2" />
                </div>
                <div className="flex-1 flex flex-col justify-between py-0.5">
                  <h3 className="text-sm font-bold text-deep-purple truncate">{item.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center bg-gray-50 rounded-full border border-gray-100 px-1 py-1">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-deep-purple">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-primary"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="text-sm font-black text-black">
                      ₹{(parsePrice(item) * item.quantity).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <CreditCard size={18} className="text-primary" />
            <h2 className="font-bold text-deep-purple text-sm uppercase tracking-widest">Payment Method</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['online', 'cod'].map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`p-5 rounded-3xl border-2 transition-all ${
                  paymentMethod === method ? 'border-primary bg-white shadow-xl shadow-primary/5' : 'border-gray-50 bg-gray-50/30'
                }`}
              >
                <span className="text-[11px] font-black text-deep-purple uppercase tracking-widest">
                  {method === 'online' ? 'Corporate / UPI' : 'Pay on Delivery'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <Info size={16} className="text-primary" />
            <h2 className="font-bold text-deep-purple text-sm uppercase tracking-widest">Bulk Bill Details</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400 font-medium">Bulk Items Subtotal</span>
              <span className="font-bold text-deep-purple">₹{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400 font-medium">Handling Fee</span>
              <span className="font-bold text-deep-purple">₹{handlingCharge.toLocaleString()}</span>
            </div>
            <div className="pt-3 border-t border-gray-50 flex justify-between items-center">
              <span className="text-base font-bold text-deep-purple">Total Bulk Amount</span>
              <span className="text-lg font-black text-black">
                {summaryLoading ? '...' : `₹${grandTotal.toLocaleString()}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-[72px] left-0 right-0 p-6 bg-white border-t border-gray-100 z-[60] flex flex-col gap-3 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] max-w-md mx-auto">
        {orderError && <p className="text-sm text-red-500 text-center">{orderError}</p>}
        {summaryError && <p className="text-sm text-amber-600 text-center">{summaryError}</p>}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Amount to Pay</span>
            <span className="text-xl font-black text-black leading-none">
              {summaryLoading ? '...' : `₹${grandTotal.toLocaleString()}`}
            </span>
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder || summaryLoading || !isAuthenticated}
            className="flex-1 max-w-[240px] h-14 bg-primary text-white font-black text-base rounded-2xl shadow-xl shadow-primary/25 active:scale-[0.98] transition-all flex items-center justify-center uppercase tracking-widest disabled:opacity-60"
          >
            {isPlacingOrder ? <Loader2 size={22} className="animate-spin" /> : 'Confirm Bulk Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchoolCheckoutPage;
