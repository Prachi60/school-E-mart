import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ShoppingBag,
  CreditCard, Wallet, ChevronRight,
  Heart, Plus, Minus, Info, CheckCircle2,
  Building2, Truck, BadgePercent, Loader2,
  MapPin, Pencil, X, ShieldCheck, Package
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { createOrder, confirmPayment } from '../../../services/ordersApi';
import { getMyWallet } from '../../../services/walletApi';
import { openRazorpayCheckout } from '../../../utils/razorpay';
import { ENV } from '../../../config/env';
import useAuthStore from '../../../store/useAuthStore';
import { useCheckoutSummary } from '../../../hooks/useCheckoutSummary';
import { mapOrderForDetail } from '../../../utils/mappers/orderMapper';
import GuestCheckoutGate from './GuestCheckoutGate';
import { isSchoolLinked } from '../../../utils/schoolLinked';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { cartItems, updateQuantity, refreshCart } = useCart();

  const [deliveryType, setDeliveryType] = useState('school'); // 'school' | 'home'
  const [paymentMethod, setPaymentMethod] = useState('online'); // 'online' | 'cod'
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [walletBalancePaise, setWalletBalancePaise] = useState(0);
  const [applyWallet, setApplyWallet] = useState(false);

  // Address Modal State
  const [showAddressModal, setShowAddressModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    getMyWallet()
      .then((w) => setWalletBalancePaise(w?.balancePaise || 0))
      .catch(() => setWalletBalancePaise(0));
  }, [isAuthenticated]);

  const readChildInfo = () => {
    const saved = localStorage.getItem('childInfo');
    return saved ? JSON.parse(saved) : { name: 'Guest', school: 'Explore Schools', grade: 'Select Grade' };
  };

  const toAddress = (parsed = {}) => ({
    name: parsed.name || 'Guest',
    phone: parsed.phone || '',
    address: parsed.address || 'Please update your delivery address in profile',
    city: parsed.city || 'Indore',
    state: parsed.state || 'Madhya Pradesh',
    pinCode: parsed.pinCode || '452018',
    addressType: parsed.addressType || 'home',
  });

  const [childInfo, setChildInfo] = useState(readChildInfo);
  const [address, setAddress] = useState(() => toAddress(readChildInfo()));

  // Address Modal Form State
  const [editAddressForm, setEditAddressForm] = useState(address);

  const openAddressModal = () => {
    setEditAddressForm({ ...address });
    setShowAddressModal(true);
  };

  const handleSaveAddress = (e) => {
    e.preventDefault();
    setAddress(editAddressForm);
    setShowAddressModal(false);

    // Save updated address to localStorage
    const currentChild = readChildInfo();
    const updated = {
      ...currentChild,
      name: editAddressForm.name,
      phone: editAddressForm.phone,
      address: editAddressForm.address,
      city: editAddressForm.city,
      state: editAddressForm.state,
      pinCode: editAddressForm.pinCode,
    };
    localStorage.setItem('childInfo', JSON.stringify(updated));
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const info = readChildInfo();
    setChildInfo(info);
    setAddress(toAddress(info));
  }, [isAuthenticated]);

  // Two independent address shapes — one per delivery destination — so each
  // option card below can show its OWN real delivery charge. Previously both
  // cards shared a single summary fetched for whichever type was selected, so
  // toggling to Home and back made the School card display Home's charge.
  const homeAddressSource = useMemo(
    () => ({
      name: address.name,
      phone: address.phone,
      line1: address.address,
      address: address.address,
      city: address.city,
      state: address.state,
      pinCode: address.pinCode,
      addressType: 'home',
    }),
    [address]
  );

  const schoolAddressSource = useMemo(
    () => ({
      name: address.name,
      phone: address.phone,
      line1: childInfo.school || 'School Address',
      address: childInfo.school || 'School Address',
      city: address.city,
      state: address.state,
      pinCode: address.pinCode,
      addressType: 'school',
    }),
    [address, childInfo]
  );

  const schoolIdForPickup = childInfo.schoolId || null;

  const homeCheckout = useCheckoutSummary({
    deliveryType: 'home',
    paymentMethod,
    addressSource: homeAddressSource,
    schoolIdForPickup: null,
    audience: 'parent',
    enabled: isAuthenticated && cartItems.length > 0,
  });

  const schoolCheckout = useCheckoutSummary({
    deliveryType: 'school',
    paymentMethod,
    addressSource: schoolAddressSource,
    schoolIdForPickup,
    audience: 'parent',
    enabled: isAuthenticated && cartItems.length > 0,
  });

  // Bill breakdown / order placement always uses whichever destination is
  // currently selected; the badges below read straight from each hook so
  // both stay accurate regardless of selection.
  const activeCheckout = deliveryType === 'school' ? schoolCheckout : homeCheckout;
  const { summary, loading: summaryLoading, error: summaryError, totals, buildPayload } = activeCheckout;
  const homeDeliveryCharge = homeCheckout.totals.deliveryCharge ?? 0;
  const schoolDeliveryCharge = schoolCheckout.totals.deliveryCharge ?? 0;

  // Block COD automatically when school address delivery is selected
  useEffect(() => {
    if (deliveryType === 'school' && paymentMethod === 'cod') {
      setPaymentMethod('online');
    }
  }, [deliveryType, paymentMethod]);

  const parsePrice = (item) => {
    if (item?.pricePaise) return item.pricePaise / 100;
    if (typeof item?.price === 'number' && item.price > 0) return item.price;
    if (typeof item?.price === 'string') {
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
  const platformFee = totals.platformFee || 0;

  // Delivery charge computed dynamically by backend checkout summary (respecting Admin settings & free delivery rules)
  const deliveryCharge = totals.deliveryCharge ?? 0;
  const grandTotal = totals.grandTotal || subtotal + handlingCharge + platformFee + deliveryCharge;

  // Wallet deduction calculation
  const grandTotalPaise = Math.round(grandTotal * 100);
  const walletAmountPaise =
    applyWallet && walletBalancePaise > 0 ? Math.min(walletBalancePaise, grandTotalPaise) : 0;
  const payableAfterWallet = (grandTotalPaise - walletAmountPaise) / 100;

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) return;

    setOrderError('');
    setIsPlacingOrder(true);

    try {
      const payloadData = {
        ...buildPayload(),
        deliveryType,
        schoolIdForPickup: deliveryType === 'school' ? childInfo.schoolId || undefined : undefined,
        address: {
          name: address.name,
          phone: address.phone,
          line1: deliveryType === 'school' ? (childInfo.school || 'School Address') : address.address,
          address: deliveryType === 'school' ? (childInfo.school || 'School Address') : address.address,
          city: address.city || 'Indore',
          state: address.state || 'Madhya Pradesh',
          pinCode: address.pinCode || '452018',
          addressType: deliveryType,
        },
        walletAmountPaise,
      };

      const { order, checkout } = await createOrder(
        payloadData,
        { audience: 'parent' }
      );

      if (paymentMethod === 'online' && checkout?.razorpayOrderId) {
        const razorpayResponse = await openRazorpayCheckout({
          keyId: checkout.keyId || ENV.RAZORPAY_KEY_ID,
          razorpayOrderId: checkout.razorpayOrderId,
          amountPaise: checkout.amountPaise,
          currency: checkout.currency,
          description: `Order ${order.orderNumber}`,
          prefill: { name: address.name, contact: address.phone },
          notes: { orderId: order._id },
        });

        await confirmPayment(order._id, {
          razorpayPaymentId: razorpayResponse.razorpay_payment_id,
          razorpayOrderId: razorpayResponse.razorpay_order_id,
          razorpaySignature: razorpayResponse.razorpay_signature,
        });
      } else if (paymentMethod === 'online') {
        // No gateway order came back, so there is nothing for the customer to pay
        // through and no payment to confirm. This used to call confirmPayment with an
        // empty body, which the server accepted — marking the order paid without a
        // rupee moving. The order stays unpaid (and is released automatically), and
        // the customer is told to use Cash on Delivery instead.
        throw new Error(
          'Online payment is unavailable right now. Please choose Cash on Delivery, or try again later.'
        );
      }

      await refreshCart();

      const mapped = mapOrderForDetail(order);
      navigate('/user/order-success', {
        state: {
          orderId: mapped.id,
          orderNumber: mapped.orderNumber,
          city: mapped.city || address.city,
          address: mapped.address || address.address,
          paymentMethod: mapped.paymentMethod,
          subtotal: mapped.subtotal,
          shipping: mapped.shipping,
          totalAmount: mapped.totalAmount,
          itemsCount: mapped.itemsCount,
        },
      });
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Unable to place order. Please try again.';
      setOrderError(message);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center font-outfit">
        <div className="w-24 h-24 bg-[#3b2d7d]/10 rounded-full flex items-center justify-center text-[#3b2d7d] mb-6">
          <ShoppingBag size={48} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-400 text-sm mb-8">Add items to your cart to proceed with checkout</p>
        <button
          onClick={() => navigate('/user/home')}
          className="px-8 py-3 bg-[#3b2d7d] text-white font-bold rounded-2xl shadow-lg shadow-purple-950/10"
        >
          Explore Store
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-outfit pb-32 text-gray-800">
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-200/80 sticky top-0 z-50 shadow-xs">
        <button
          onClick={() => navigate(-1)}
          className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all active:scale-95 shrink-0"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-black text-gray-900 uppercase tracking-wider">Order Checkout</h1>
        <div className="w-9" />
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 space-y-5">
        
        {/* Error Notification */}
        {orderError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-600 flex items-center gap-2.5 shadow-xs">
            <Info size={16} className="text-red-500 shrink-0" />
            <span>{orderError}</span>
          </div>
        )}

        {/* STEP 1: DELIVERY ADDRESS OPTION TOGGLE (School Address vs Home Address) */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-[#3b2d7d]" />
              <h2 className="text-xs font-black text-gray-900 uppercase tracking-wider">1. Choose Delivery Destination</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* School Address Delivery Option (FREE) */}
            <button
              type="button"
              onClick={() => setDeliveryType('school')}
              className={`p-4 rounded-2xl border-2 transition-all text-left relative flex flex-col justify-between ${
                deliveryType === 'school'
                  ? 'border-[#3b2d7d] bg-purple-50/40 shadow-xs'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#3b2d7d] flex items-center justify-center font-bold">
                    <Building2 size={18} />
                  </div>
                  <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[9px] font-black uppercase tracking-wider">
                    {schoolDeliveryCharge > 0 ? `+ ₹${schoolDeliveryCharge}` : 'FREE (₹0)'}
                  </span>
                </div>
                <h3 className="text-xs font-black text-gray-900 leading-tight">School Address</h3>
                <p className="text-[10px] font-extrabold text-purple-700 mt-0.5 truncate">
                  {childInfo.school || 'School Campus Pickup'}
                </p>
                <p className="text-[10px] text-gray-400 font-medium mt-1 leading-normal">
                  Delivered directly to school campus with ZERO shipping charges.
                </p>
              </div>
              {deliveryType === 'school' && (
                <div className="mt-3 flex items-center gap-1 text-[10px] font-black text-emerald-600">
                  <CheckCircle2 size={12} />
                  <span>Selected (Free Delivery)</span>
                </div>
              )}
            </button>

            {/* Home Address Delivery Option */}
            <button
              type="button"
              onClick={() => setDeliveryType('home')}
              className={`p-4 rounded-2xl border-2 transition-all text-left relative flex flex-col justify-between ${
                deliveryType === 'home'
                  ? 'border-[#3b2d7d] bg-purple-50/40 shadow-xs'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Truck size={18} />
                  </div>
                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[9px] font-black uppercase tracking-wider">
                    {homeDeliveryCharge > 0 ? `+ ₹${homeDeliveryCharge}` : 'FREE (₹0)'}
                  </span>
                </div>
                <h3 className="text-xs font-black text-gray-900 leading-tight">Home Address</h3>
                <p className="text-[10px] font-extrabold text-gray-700 mt-0.5 truncate">
                  {address.name} — {address.city}
                </p>
                <p className="text-[10px] text-gray-400 font-medium mt-1 leading-normal line-clamp-2">
                  {address.address}
                </p>
              </div>
              {deliveryType === 'home' && (
                <div className="mt-3 flex items-center gap-1 text-[10px] font-black text-[#3b2d7d]">
                  <CheckCircle2 size={12} />
                  <span>Selected (Home Delivery)</span>
                </div>
              )}
            </button>
          </div>

          {/* Detailed Selected Address Preview Box */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <MapPin size={18} className="text-[#3b2d7d] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider block">
                  {deliveryType === 'school' ? 'School Shipping Address' : 'Home Shipping Address'}
                </span>
                <h4 className="text-xs font-black text-gray-900 mt-0.5">{address.name} ({address.phone})</h4>
                <p className="text-[11px] font-bold text-gray-500 mt-0.5 leading-snug">
                  {deliveryType === 'school' ? `${childInfo.school} • ${address.city}, ${address.pinCode}` : `${address.address}, ${address.city}, ${address.state} - ${address.pinCode}`}
                </p>
              </div>
            </div>

            {deliveryType === 'home' && (
              <button
                type="button"
                onClick={openAddressModal}
                className="px-3 py-1.5 bg-white border border-gray-200 hover:border-[#3b2d7d] text-[#3b2d7d] font-black text-[10px] uppercase rounded-xl transition-all shrink-0 flex items-center gap-1"
              >
                <Pencil size={11} /> Edit Address
              </button>
            )}
          </div>
        </div>

        {/* STEP 2: CART ITEMS SUMMARY */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-150 pb-3">
            <h2 className="text-xs font-black text-gray-900 uppercase tracking-wider">
              2. Items Summary ({cartItems.length})
            </h2>
            <span className="text-[10px] font-bold text-gray-400">Review products in your order</span>
          </div>

          <div className="divide-y divide-gray-100">
            {cartItems.map((item) => {
              const itemPrice = parsePrice(item);
              const priceToDisplay = itemPrice > 0 ? itemPrice * item.quantity : subtotal;
              return (
                <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-150 p-1 shrink-0 overflow-hidden flex items-center justify-center">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                      ) : (
                        <Package size={22} className="text-purple-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-gray-900 leading-snug truncate">{item.name}</h4>
                      <span className="text-[10px] font-bold text-gray-400 block mt-0.5">Quantity: {item.quantity}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-[#3b2d7d]">
                      ₹{priceToDisplay.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP 3: WALLET OPTION */}
        {walletBalancePaise > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-gray-200/90 shadow-xs">
            <button
              type="button"
              onClick={() => setApplyWallet((v) => !v)}
              className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border-2 transition-all text-left ${
                applyWallet ? 'border-[#3b2d7d] bg-purple-50/40' : 'border-gray-200 bg-gray-50/50'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${applyWallet ? 'bg-[#3b2d7d] text-white' : 'bg-gray-200 text-gray-500'}`}>
                <Wallet size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-xs font-black text-gray-900">Apply Wallet Balance</span>
                <span className="block text-[10px] font-bold text-gray-400 mt-0.5">
                  Available: ₹{(walletBalancePaise / 100).toFixed(2)}
                  {applyWallet && walletAmountPaise > 0 && (
                    <span className="text-emerald-600 font-extrabold"> · Deducting ₹{(walletAmountPaise / 100).toFixed(2)}</span>
                  )}
                </span>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${applyWallet ? 'border-[#3b2d7d] bg-[#3b2d7d]' : 'border-gray-300'}`}>
                {applyWallet && <CheckCircle2 size={12} className="text-white" />}
              </div>
            </button>
          </div>
        )}

        {/* STEP 4: PAYMENT METHOD SELECTOR */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-150 pb-3">
            <CreditCard size={18} className="text-[#3b2d7d]" />
            <h2 className="text-xs font-black text-gray-900 uppercase tracking-wider">3. Select Payment Method</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Razorpay Online */}
            <button
              type="button"
              onClick={() => setPaymentMethod('online')}
              className={`p-4 rounded-2xl border-2 transition-all relative flex flex-col items-center gap-2 text-center ${
                paymentMethod === 'online'
                  ? 'border-[#3b2d7d] bg-purple-50/40 shadow-xs'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === 'online' ? 'bg-[#3b2d7d] text-white' : 'bg-gray-100 text-gray-400'}`}>
                <CreditCard size={20} />
              </div>
              <div>
                <span className="text-xs font-black text-gray-900 block leading-tight">Pay Online (Razorpay)</span>
                <span className="text-[9px] font-bold text-gray-400 mt-0.5 block">UPI / Cards / NetBanking</span>
              </div>
              {paymentMethod === 'online' && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-[#3b2d7d] rounded-full flex items-center justify-center">
                  <CheckCircle2 size={10} className="text-white" />
                </div>
              )}
            </button>

            {/* Cash on Delivery (Disabled for School Address Delivery) */}
            <button
              type="button"
              disabled={deliveryType === 'school'}
              onClick={() => setPaymentMethod('cod')}
              className={`p-4 rounded-2xl border-2 transition-all relative flex flex-col items-center gap-2 text-center ${
                deliveryType === 'school'
                  ? 'border-gray-200 bg-gray-100/80 opacity-50 cursor-not-allowed'
                  : paymentMethod === 'cod'
                    ? 'border-[#3b2d7d] bg-purple-50/40 shadow-xs'
                    : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === 'cod' ? 'bg-[#3b2d7d] text-white' : 'bg-gray-100 text-gray-400'}`}>
                <Wallet size={20} />
              </div>
              <div>
                <span className="text-xs font-black text-gray-900 block leading-tight">Cash on Delivery</span>
                <span className="text-[9px] font-bold text-gray-400 mt-0.5 block">
                  {deliveryType === 'school' ? 'Disabled for school delivery' : 'Pay upon receipt'}
                </span>
              </div>
              {paymentMethod === 'cod' && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-[#3b2d7d] rounded-full flex items-center justify-center">
                  <CheckCircle2 size={10} className="text-white" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* STEP 5: BILL SUMMARY */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200/90 shadow-xs space-y-3">
          <h2 className="text-xs font-black text-gray-900 uppercase tracking-wider border-b border-gray-150 pb-3">
            4. Bill Breakdown
          </h2>

          <div className="space-y-2 text-xs font-bold text-gray-600">
            <div className="flex justify-between items-center">
              <span>Items Total</span>
              <span className="font-black text-gray-900">₹{subtotal.toLocaleString()}</span>
            </div>

            {platformFee > 0 && (
              <div className="flex justify-between items-center text-gray-700">
                <span>Platform Fee</span>
                <span className="font-black text-gray-900">₹{platformFee}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span>Handling Fee</span>
              <span className="font-black text-gray-900">₹{handlingCharge}</span>
            </div>

            <div className="flex justify-between items-center">
              <span>Delivery Fee</span>
              <span className={`font-black ${deliveryCharge === 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                {deliveryCharge === 0 ? 'FREE (₹0)' : `₹${deliveryCharge}`}
              </span>
            </div>

            {applyWallet && walletAmountPaise > 0 && (
              <div className="flex justify-between items-center text-emerald-600">
                <span>Wallet Discount</span>
                <span className="font-black">- ₹{(walletAmountPaise / 100).toFixed(2)}</span>
              </div>
            )}

            <div className="pt-3 border-t border-gray-200 flex justify-between items-center text-sm font-black text-gray-900">
              <span>Total Amount</span>
              <span className="text-base font-black text-[#3b2d7d]">₹{payableAfterWallet.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-xl border-t border-gray-200 z-[90] shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <div>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Total Payable</span>
            <span className="text-xl font-black text-[#3b2d7d]">₹{payableAfterWallet.toFixed(2)}</span>
          </div>

          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder || summaryLoading}
            className="px-6 py-3.5 bg-[#3b2d7d] hover:bg-[#2c2060] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-purple-950/15 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60"
          >
            {isPlacingOrder ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>{paymentMethod === 'online' ? 'Pay Online' : 'Place COD Order'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* EDIT ADDRESS MODAL */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-150 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Update Delivery Address</h3>
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">Recipient Name</label>
                <input
                  type="text"
                  required
                  value={editAddressForm.name}
                  onChange={(e) => setEditAddressForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-[#3b2d7d]"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Phone / Mobile Number</label>
                <input
                  type="text"
                  required
                  value={editAddressForm.phone}
                  onChange={(e) => setEditAddressForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-[#3b2d7d]"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Full Address (Flat/House No, Building, Street)</label>
                <textarea
                  rows={2}
                  required
                  value={editAddressForm.address}
                  onChange={(e) => setEditAddressForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-[#3b2d7d]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={editAddressForm.city}
                    onChange={(e) => setEditAddressForm((p) => ({ ...p, city: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-[#3b2d7d]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={editAddressForm.state}
                    onChange={(e) => setEditAddressForm((p) => ({ ...p, state: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-[#3b2d7d]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Pincode</label>
                <input
                  type="text"
                  required
                  value={editAddressForm.pinCode}
                  onChange={(e) => setEditAddressForm((p) => ({ ...p, pinCode: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-[#3b2d7d]"
                />
              </div>

              <div className="pt-3 border-t border-gray-150 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#3b2d7d] hover:bg-[#2c2060] text-white font-black rounded-xl uppercase tracking-wider"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <GuestCheckoutGate
        onDone={() => {
          const info = readChildInfo();
          setChildInfo(info);
          setAddress(toAddress(info));
        }}
      />
    </div>
  );
};

export default CheckoutPage;
