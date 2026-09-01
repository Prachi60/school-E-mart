import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Lock, ArrowRight, ChevronLeft } from 'lucide-react';
import useAuthStore from '../../../store/useAuthStore';
import * as authApi from '../../../services/authApi';
import { getErrorMessage } from '../../../utils/apiHelpers';
import { getLoginRedirectPath } from '../../../utils/mappers/userMapper';

const AppAuthPage = () => {
  const navigate = useNavigate();
  const loginFromAuthResponse = useAuthStore((state) => state.loginFromAuthResponse);

  const [showSplash, setShowSplash] = useState(true);
  const [splashStage, setSplashStage] = useState('initial');

  const [step, setStep] = useState(2);
  const [contactValue, setContactValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Only ever set when the server has OTP verification switched off
  // (OTP_ENABLED=false): it sends no SMS and returns the fixed code so the field can
  // be filled in for the user. With OTP on, the response carries no code and this
  // stays empty.
  const [prefilledOtp, setPrefilledOtp] = useState('');

  useEffect(() => {
    if (showSplash) {
      const timer1 = setTimeout(() => {
        setSplashStage('transitioning');
        const timer2 = setTimeout(() => {
          setSplashStage('completed');
          setShowSplash(false);
          sessionStorage.setItem('splashSeen', 'true');
        }, 1350);
        return () => clearTimeout(timer2);
      }, 3000);
      return () => clearTimeout(timer1);
    }
  }, [showSplash]);

  const handleBack = () => {
    setError('');
    if (step > 2) {
      setStep(step - 1);
    } else navigate(-1);
  };

  const handleSendOtp = async (phone) => {
    setError('');
    setLoading(true);
    try {
      const result = await authApi.requestParentOtp(phone);
      setPrefilledOtp(result?.otpBypassed ? result.otp || '' : '');
      setContactValue(phone);
      setStep(3);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to send OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (otp) => {
    setError('');
    setLoading(true);
    try {
      const authData = await authApi.verifyParentOtp(contactValue, otp);
      loginFromAuthResponse(authData, 'parent');
      navigate(getLoginRedirectPath(authData.user, 'parent'));
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 2:
        return (
          <ContactInput
            onSendOtp={handleSendOtp}
            onError={setError}
            error={error}
            loading={loading}
          />
        );
      case 3:
        return (
          <Verification
            phone={contactValue}
            prefilledOtp={prefilledOtp}
            onVerifyOtp={handleVerifyOtp}
            onError={setError}
            error={error}
            loading={loading}
          />
        );
      default:
        return (
          <ContactInput
            onSendOtp={handleSendOtp}
            onError={setError}
            error={error}
            loading={loading}
          />
        );
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden relative">
      <style>
        {`
          @keyframes shimmer {
            0% { transform: translateX(-150%) skewX(-20deg); }
            100% { transform: translateX(150%) skewX(-20deg); }
          }
          @keyframes bounce-gentle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          .animate-bounce-gentle { animation: bounce-gentle 3s ease-in-out infinite; }
        `}
      </style>

      {showSplash && (
        <div className={`fixed inset-0 z-[100] bg-primary flex items-center justify-center transition-all duration-[1200ms] ease-in-out ${splashStage === 'transitioning' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className={`relative transition-all duration-[1200ms] ease-in-out transform ${splashStage === 'transitioning' ? 'scale-[0.25] -translate-y-[40vh] opacity-0' : 'scale-100 translate-y-0 opacity-100'}`}>
            <div className="w-32 h-32 bg-white p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-bounce-gentle">
              <img src="/assets/logo.jpeg" alt="Logo" className="w-full h-full object-contain relative z-10" />
              <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)', animation: 'shimmer 2s infinite ease-out' }}></div>
            </div>
          </div>
        </div>
      )}

      <div className="h-44 bg-primary relative overflow-hidden flex items-center justify-center shrink-0">
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
          <img src="/assets/app/app_login.webp" alt="Background" className="w-full h-full object-cover mix-blend-overlay" />
        </div>
        {step > 1 && (
          <button onClick={() => navigate('/user/home')} className="absolute top-6 right-6 z-30 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-white text-[10px] font-semibold uppercase tracking-widest border border-white/20 active:scale-95">Skip</button>
        )}
        <div className={`relative z-10 flex flex-col items-center gap-3 transition-all duration-[1200ms] ${!showSplash || splashStage === 'transitioning' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="w-12 h-12 bg-white p-2 rounded-2xl shadow-xl"><img src="/assets/logo.jpeg" alt="Logo" className="w-full h-full object-contain" /></div>
          <h1 className="text-white font-semibold text-base">School E-Mart</h1>
        </div>
      </div>

      <div className={`flex-1 bg-white -mt-6 rounded-t-[2.5rem] relative z-20 px-6 pt-4 flex flex-col overflow-y-auto transition-all duration-[1000ms] ${!showSplash || splashStage === 'transitioning' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col pt-2 pb-32">
          {step > 2 && (
            <div className="flex items-center gap-4 mb-2 h-8 shrink-0">
              <button onClick={handleBack} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-primary transition-colors z-30 shrink-0"><ChevronLeft size={20} /></button>
            </div>
          )}
          <div className="flex-1">{renderStep()}</div>
          <div className="mt-auto py-2 text-center shrink-0">
            <p className="text-gray-400 text-xs font-bold leading-relaxed">
              To register, please contact your school administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ContactInput = ({ onSendOtp, onError, error, loading }) => {
  const [phone, setPhone] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) return onError('Please enter a valid 10-digit mobile number');
    await onSendOtp(cleanPhone);
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <h1 className="text-3xl font-bold text-deep-purple mb-2">Welcome! 👋</h1>
      <p className="text-gray-400 text-sm mb-10">Enter your 10-digit mobile number to get started.</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-[13px] font-semibold text-black ml-1">Mobile Number</label>
          <div className="relative group">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error) onError('');
              }}
              placeholder="e.g. 9876543210"
              maxLength={10}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-base focus:ring-2 focus:ring-primary/10 outline-none transition-all font-medium text-black placeholder-gray-300"
            />
          </div>
          {error && <p className="text-red-500 text-[11px] font-medium ml-1 mt-1">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={loading || phone.replace(/\D/g, '').length !== 10}
          className={`w-full py-4 font-medium rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 ${
            phone.replace(/\D/g, '').length === 10 && !loading
              ? 'bg-primary text-white shadow-xl shadow-primary/20 active:scale-95 cursor-pointer'
              : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>Send OTP <ArrowRight size={20} /></>
          )}
        </button>
      </form>
    </div>
  );
};

const Verification = ({ phone, prefilledOtp = '', onVerifyOtp, onResendOtp, onError, error, loading }) => {
  const [value, setValue] = useState(prefilledOtp.slice(0, 4));
  const [timer, setTimer] = useState(60);
  const [resending, setResending] = useState(false);

  // Fill the field when the server tells us OTP verification is off. Deliberately not
  // auto-submitted: the person still presses Verify, so the flow they learn here is
  // the same one they will use once real OTPs are switched back on.
  useEffect(() => {
    if (prefilledOtp) setValue(prefilledOtp.slice(0, 4));
  }, [prefilledOtp]);

  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer]);

  const handleResend = async () => {
    if (timer > 0 || resending || loading) return;
    setResending(true);
    if (error) onError('');
    try {
      await onResendOtp(phone);
      setTimer(60);
      setValue('');
    } catch (err) {
      onError(getErrorMessage(err, 'Unable to resend OTP. Please try again.'));
    } finally {
      setResending(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setValue(val);
    if (error) onError('');
    if (val.length === 4) {
      setTimeout(() => onVerifyOtp(val), 300);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (value.length !== 4) return onError('Please enter the 4-digit OTP');
    await onVerifyOtp(value);
  };

  const isValid = value.length === 4;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <h2 className="text-2xl font-semibold text-deep-purple mb-2">Verify it's you</h2>
      <p className="text-gray-400 text-sm mb-8">
        {prefilledOtp
          ? <>Verification is off, so the code is filled in for you. Signing in as <span className="font-semibold text-black">{phone || 'your phone'}</span>.</>
          : <>Enter the 4-digit code sent to <span className="font-semibold text-black">{phone || 'your phone'}</span></>}
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-3">
          <label className="block text-[13px] font-semibold text-black ml-1">OTP code</label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
            <input
              type="tel"
              value={value}
              onChange={handleInputChange}
              maxLength={4}
              placeholder="••••"
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-base focus:ring-2 focus:ring-primary/10 outline-none tracking-[1em] font-mono"
            />
          </div>
          {error && <p className="text-red-500 text-[11px] font-medium ml-1 mt-1">{error}</p>}
        </div>

        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-gray-400">Didn't receive the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={timer > 0 || resending || loading}
            className={`font-semibold transition-colors ${
              timer === 0 && !resending && !loading
                ? 'text-primary hover:underline cursor-pointer'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            {resending ? 'Sending...' : timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
          </button>
        </div>

        <button
          type="submit"
          disabled={!isValid || loading}
          className={`w-full py-4 font-medium rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 ${isValid && !loading ? 'bg-primary text-white shadow-xl shadow-primary/20 active:scale-95 cursor-pointer' : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed'}`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>Verify & Continue <ArrowRight size={20} /></>
          )}
        </button>
      </form>
    </div>
  );
};

export default AppAuthPage;
