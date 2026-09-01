import React, { useState } from 'react';
import { User, Phone, MapPin, Loader2, ShieldCheck, ArrowRight, X } from 'lucide-react';
import * as authApi from '../../../services/authApi';
import { updateMyProfile } from '../../../services/parentApi';
import useAuthStore from '../../../store/useAuthStore';
import { getErrorMessage } from '../../../utils/apiHelpers';

/**
 * Guest checkout gate. Shown on the checkout page when the shopper isn't logged
 * in. Collects name + phone + address, verifies the phone via OTP (which creates
 * an unlinked customer account — no school, no child), saves the address, then
 * calls onDone so the checkout can proceed.
 */
const GuestCheckoutGate = ({ onDone, onCancel }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loginFromAuthResponse = useAuthStore((s) => s.loginFromAuthResponse);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  if (isAuthenticated) return null;

  const [step, setStep] = useState('details'); // 'details' | 'otp'
  const [form, setForm] = useState({ name: '', phone: '', address: '', city: '', state: '', pinCode: '' });
  const [otp, setOtp] = useState('');
  // Set only when the server has OTP verification switched off (OTP_ENABLED=false):
  // it sends no SMS and returns the fixed code so the field can be filled in.
  const [otpBypassed, setOtpBypassed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const sendOtp = async () => {
    setError('');
    if (!form.name.trim()) return setError('Please enter your name');
    if (!/^[6-9]\d{9}$/.test(form.phone)) return setError('Enter a valid 10-digit mobile number');
    if (!form.address.trim() || !form.city.trim() || !form.state.trim() || !form.pinCode.trim()) {
      return setError('Please enter your full delivery address');
    }
    setBusy(true);
    try {
      const result = await authApi.requestCustomerOtp(form.phone);
      if (result?.otpBypassed && result.otp) {
        setOtp(String(result.otp).slice(0, 4));
        setOtpBypassed(true);
      }
      setStep('otp');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send OTP. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError('');
    if (!/^\d{4}$/.test(otp)) return setError('Enter the 4-digit OTP');
    setBusy(true);
    try {
      const authData = await authApi.verifyCustomerOtp(form.phone, otp, form.name.trim());
      loginFromAuthResponse(authData, 'parent');
      // Persist the delivery address on the new account, then refresh so the
      // checkout picks it up.
      await updateMyProfile({
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pinCode: form.pinCode.trim(),
      });
      await refreshUser();
      // Write the entered details straight into childInfo so the checkout uses
      // this exact address immediately (before the async profile sync lands).
      try {
        const raw = localStorage.getItem('childInfo');
        const ci = raw ? JSON.parse(raw) : {};
        localStorage.setItem(
          'childInfo',
          JSON.stringify({
            ...ci,
            name: form.name.trim(),
            phone: form.phone,
            address: form.address.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            pinCode: form.pinCode.trim(),
          })
        );
      } catch {
        // non-fatal
      }
      window.dispatchEvent(new Event('storage'));
      onDone?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not verify OTP. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full py-3.5 pl-11 pr-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-bold text-deep-purple outline-none focus:border-primary/30';

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-[32px] w-full max-w-md shadow-2xl p-6 pb-10 relative animate-in slide-in-from-bottom-8 duration-300">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        {onCancel && (
          <button onClick={onCancel} className="absolute right-6 top-6 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
            <X size={14} />
          </button>
        )}

        {step === 'details' ? (
          <>
            <h2 className="text-lg font-black text-deep-purple">Quick Checkout</h2>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">Enter your details — we'll verify your number to place the order.</p>

            <div className="mt-5 space-y-3">
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className={inputCls} placeholder="Your name" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="relative">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className={inputCls} type="tel" inputMode="numeric" placeholder="Mobile number" value={form.phone}
                  onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} />
              </div>
              <div className="relative">
                <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className={inputCls} placeholder="House no. & street" value={form.address} onChange={(e) => set('address', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="w-full py-3.5 px-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-bold text-deep-purple outline-none focus:border-primary/30" placeholder="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
                <input className="w-full py-3.5 px-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-bold text-deep-purple outline-none focus:border-primary/30" placeholder="State" value={form.state} onChange={(e) => set('state', e.target.value)} />
              </div>
              <input className="w-full py-3.5 px-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-bold text-deep-purple outline-none focus:border-primary/30" placeholder="Pin code" inputMode="numeric" value={form.pinCode} onChange={(e) => set('pinCode', e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>

            {error && <p className="text-[11px] text-rose-500 font-bold mt-3">{error}</p>}

            <button onClick={sendOtp} disabled={busy}
              className="w-full mt-5 flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl text-sm font-black shadow-lg shadow-primary/25 active:scale-[0.98] transition-all disabled:opacity-60">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <>Send OTP <ArrowRight size={16} /></>}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-black text-deep-purple">Verify your number</h2>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">
              {otpBypassed
                ? 'Verification is off, so the code is filled in for you.'
                : `Enter the 4-digit code sent to +91 ${form.phone}.`}
            </p>

            <input
              className="w-full mt-5 py-4 px-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-center text-2xl font-black tracking-[0.5em] text-deep-purple outline-none focus:border-primary/30"
              inputMode="numeric" maxLength={4} placeholder="––––"
              value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />

            {error && <p className="text-[11px] text-rose-500 font-bold mt-3">{error}</p>}

            <button onClick={verify} disabled={busy}
              className="w-full mt-5 flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl text-sm font-black shadow-lg shadow-primary/25 active:scale-[0.98] transition-all disabled:opacity-60">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <><ShieldCheck size={18} /> Verify &amp; Continue</>}
            </button>
            <button onClick={() => { setStep('details'); setOtp(''); setError(''); }} className="w-full mt-3 text-[11px] font-black text-gray-400">
              Change details
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GuestCheckoutGate;
