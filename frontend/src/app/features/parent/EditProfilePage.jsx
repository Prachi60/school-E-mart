import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, User, Mail, Phone,
  MapPin, Home, Globe, Navigation,
  ShieldCheck, Check, AlertCircle, ImageIcon,
  Hash, GraduationCap, School, FileText, Camera
} from 'lucide-react';
import { updateMyProfile } from '../../../services/parentApi';
import useAuthStore from '../../../store/useAuthStore';
import { toAbsoluteUrl } from '../../../utils/url';

const EditProfilePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const refreshUser = useAuthStore((state) => state.refreshUser);

  const [formData, setFormData] = useState({
    studentName: "",
    parentName: "",
    rollNo: "",
    grade: "",
    schoolName: "",
    email: "",
    phone: "",
    altPhone: "",
    address: "",
    pinCode: "",
    city: "",
    state: "",
    country: "India",
    photo: ""
  });

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      try {
        const user = await refreshUser();
        if (cancelled) return;
        setFormData({
          studentName: user.childProfile?.name || "",
          // Strip any legacy " Parent" suffix so the real parent name shows
          parentName: (user.name || "").replace(/\s+Parent$/i, ""),
          rollNo: user.childProfile?.rollNo || "",
          grade: user.childProfile?.grade || "",
          schoolName: user.childProfile?.schoolName || "",
          email: user.email || "",
          phone: user.phone || "",
          altPhone: user.profile?.altPhone || "",
          address: user.profile?.address || "",
          pinCode: user.profile?.pinCode || "",
          city: user.profile?.city || "",
          state: user.profile?.state || "",
          country: user.profile?.country || "India",
          photo: user.childProfile?.photo || user.childProfile?.avatarUrl || user.profile?.avatarUrl || ""
        });
      } catch (err) {
        console.error("Failed to load profile on mount", err);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleAutoFill = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await response.json();
          const addr = data.address || {};
          setFormData((prev) => ({
            ...prev,
            pinCode: addr.postcode || prev.pinCode,
            city: addr.city || addr.town || addr.village || prev.city,
            state: addr.state || prev.state,
            country: addr.country || prev.country,
            address: [addr.road, addr.suburb, addr.neighbourhood]
              .filter(Boolean)
              .join(', ') || prev.address,
          }));
        } catch {
          alert('Unable to fetch address. Please enter manually.');
        }
      },
      () => {
        alert('Location access denied. Please enter your address manually.');
      }
    );
  };

const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.85) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(event.target.result);
      img.src = event.target.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleTakePhotoClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedDataUrl = await compressImage(file, 800, 800, 0.85);
        setFormData(prev => ({ ...prev, photo: compressedDataUrl }));
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, photo: reader.result }));
        };
        reader.readAsDataURL(file);
      }
    }
    if (e.target) e.target.value = '';
  };

  const validate = () => {
    const newErrors = {};
    const effectiveParent = formData.parentName.trim() || formData.studentName.trim();
    if (!effectiveParent) newErrors.parentName = "Name is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone is required";
    if (formData.email && !formData.email.includes('@')) newErrors.email = "Valid email is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const pName = formData.parentName.trim() || formData.studentName.trim() || "Parent";
      const sName = formData.studentName.trim() || pName || "Student";
      const cleanPhone = formData.phone.trim().replace(/^\+?91/, '').replace(/\D/g, '');

      await updateMyProfile({
        studentName: sName,
        parentName: pName,
        email: formData.email.trim(),
        phone: cleanPhone || formData.phone.trim(),
        altPhone: formData.altPhone ? formData.altPhone.trim().replace(/^\+?91/, '').replace(/\D/g, '') : '',
        address: formData.address,
        pinCode: formData.pinCode,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        photo: formData.photo
      });

      await refreshUser();

      setLoading(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigate(-1);
        window.dispatchEvent(new Event('storage'));
      }, 1500);
    } catch (err) {
      console.error("Failed to save profile", err);
      alert(err.response?.data?.message || "Failed to update profile. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7FF] pb-32 font-outfit relative">
      {/* Success Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] bg-deep-purple/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-green-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-green-500/40 animate-in zoom-in duration-500">
            <Check size={40} className="text-white" strokeWidth={3} />
          </div>
          <h2 className="text-xl font-black text-white mt-6">Profile Updated!</h2>
        </div>
      )}

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-gray-100 z-50 px-6 py-5 flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-deep-purple active:scale-90 transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-black text-deep-purple">Edit Profile</h1>
        <div className="w-10 h-10"></div> {/* Spacer */}
      </div>

      <div className="pt-24 px-6 space-y-8 overflow-y-auto">
        {/* Avatar Section */}
        <div className="flex flex-col items-center gap-4">
          <input
            id="gallery-input-parent"
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".png,.jpg,.jpeg,.gif,.webp"
            className="hidden"
          />
          <input
            id="camera-input-parent"
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept=".png,.jpg,.jpeg,.gif,.webp"
            capture="user"
            className="hidden"
          />
          <div className="relative group">
            <div className="w-28 h-28 rounded-[2.5rem] bg-white p-1 shadow-xl shadow-primary/10 border-2 border-primary/20">
              <div className="w-full h-full rounded-[2.2rem] bg-gray-100 overflow-hidden relative flex items-center justify-center">
                {formData.photo ? (
                  <img
                    src={toAbsoluteUrl(formData.photo)}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-300">
                    <ImageIcon size={32} />
                    <span className="text-[8px] font-black uppercase tracking-tighter">No Photo</span>
                  </div>
                )}
              </div>
            </div>
            <label
              htmlFor="camera-input-parent"
              className="absolute bottom-0 left-0 w-10 h-10 bg-white text-primary rounded-2xl flex items-center justify-center shadow-lg border-4 border-white active:scale-90 transition-all hover:bg-primary hover:text-white cursor-pointer"
              title="Take a photo"
            >
              <Camera size={18} />
            </label>
            <label
              htmlFor="gallery-input-parent"
              className="absolute bottom-0 right-0 w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white active:scale-90 transition-all hover:bg-deep-purple cursor-pointer"
              title="Choose File"
            >
              <Upload size={18} />
            </label>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-black text-deep-purple">{formData.studentName || "New Student"}</h2>
            <p className="text-[10px] text-primary font-black uppercase tracking-[0.15em] bg-purple-50 px-3 py-1 rounded-full inline-block mt-1">
              Student Profile Picture
            </p>
          </div>
        </div>

        {/* Student Information — official school records managed by school administration */}
        <div className="space-y-5">
          <SectionTitle title="Student Information" />
          <InputField
            label="Student Name"
            icon={User}
            value={formData.studentName}
            placeholder="Student Name"
            readOnly
          />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Roll Number" icon={Hash} value={formData.rollNo} placeholder="—" readOnly />
            <InputField label="Class" icon={GraduationCap} value={formData.grade} placeholder="—" readOnly />
          </div>
          {formData.schoolName && (
            <InputField label="School" icon={School} value={formData.schoolName} readOnly />
          )}
          <div className="p-3 bg-amber-50/80 border border-amber-100 rounded-2xl flex items-start gap-2 text-amber-800 text-[10px] font-bold">
            <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <span>
              🔒 Student name, class, roll number, and school are official academic records. Only your School Administration can modify these details.
            </span>
          </div>
        </div>

        {/* Parent Information — parent contact & account details */}
        <div className="space-y-5">
          <SectionTitle title="Parent Information" />
          <InputField label="Parent Name" icon={User} value={formData.parentName} onChange={(v) => handleInputChange('parentName', v)} error={errors.parentName} placeholder="Enter parent name" />
          <InputField label="Login Phone Number" icon={Phone} value={formData.phone} placeholder="+91 XXXXX XXXXX" readOnly />
          <p className="text-[9px] font-bold text-gray-400 ml-1 -mt-3 flex items-center gap-1">
            <AlertCircle size={11} className="text-gray-300" />
            Login mobile number is registered with your school and cannot be changed here.
          </p>
          <InputField label="Email Address" icon={Mail} type="email" value={formData.email} onChange={(v) => handleInputChange('email', v)} error={errors.email} placeholder="email@example.com" />
          <InputField label="Alternate Phone" icon={Phone} value={formData.altPhone} onChange={(v) => handleInputChange('altPhone', v)} placeholder="Optional" />
        </div>

        {/* Address Section */}
        <div className="space-y-5 pb-10">
          <div className="flex items-center justify-between">
            <SectionTitle title="Address Details" />
            <button
              onClick={handleAutoFill}
              className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-tight active:scale-95 transition-all"
            >
              <Navigation size={12} fill="currentColor" /> Tap to Auto-fill
            </button>
          </div>

          <InputField label="House No. & Street" icon={Home} value={formData.address} onChange={(v) => handleInputChange('address', v)} placeholder="Flat, Floor, Street" />

          <div className="grid grid-cols-2 gap-4">
            <InputField label="Pin Code" icon={MapPin} value={formData.pinCode} onChange={(v) => handleInputChange('pinCode', v)} placeholder="XXXXXX" />
            <InputField label="City" icon={Globe} value={formData.city} onChange={(v) => handleInputChange('city', v)} placeholder="Indore" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputField label="State" icon={MapPin} value={formData.state} onChange={(v) => handleInputChange('state', v)} placeholder="Madhya Pradesh" />
            <InputField label="Country" icon={Globe} value={formData.country} onChange={(v) => handleInputChange('country', v)} placeholder="India" />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50">
        <button 
          onClick={handleSave}
          disabled={loading}
          className={`
            w-full py-4 bg-primary text-white rounded-2xl text-sm font-black shadow-lg shadow-primary/20 
            active:scale-95 transition-all flex items-center justify-center gap-3
            ${loading ? 'opacity-70 cursor-not-allowed' : ''}
          `}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              Save Changes
              <ShieldCheck size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Defined at module scope (not inside the component) so its identity is stable
// across renders — otherwise React remounts each <input> on every keystroke and
// the field loses focus after one character.
const InputField = ({ label, icon: Icon, value, onChange, error, type = 'text', placeholder, readOnly = false }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label>
    <div
      className={`relative flex items-center rounded-2xl border-2 transition-all duration-300 ${
        error
          ? 'border-red-100 bg-red-50/30'
          : readOnly
            ? 'border-gray-100 bg-gray-50'
            : 'bg-white border-gray-50 focus-within:border-primary/20 focus-within:shadow-lg focus-within:shadow-primary/5'
      }`}
    >
      <div className={`pl-4 text-gray-400 ${error ? 'text-red-400' : ''}`}>
        <Icon size={18} />
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full py-4 px-3 bg-transparent text-sm font-bold outline-none placeholder:text-gray-300 ${
          readOnly ? 'text-gray-500' : 'text-deep-purple'
        }`}
      />
      {error && (
        <div className="pr-4 text-red-500">
          <AlertCircle size={18} />
        </div>
      )}
    </div>
    {error && <p className="text-[9px] font-bold text-red-500 ml-1">{error}</p>}
  </div>
);

const SectionTitle = ({ title }) => (
  <div className="flex items-center gap-2">
    <div className="w-1 h-4 bg-primary rounded-full"></div>
    <h3 className="text-sm font-black text-deep-purple uppercase tracking-widest">{title}</h3>
  </div>
);

export default EditProfilePage;
