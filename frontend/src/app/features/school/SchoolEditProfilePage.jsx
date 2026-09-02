import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Upload, User, Mail, Phone,
  MapPin, Home, Globe, Navigation,
  ShieldCheck, Check, AlertCircle, ImageIcon, Building2, Camera
} from 'lucide-react';
import { getSchool, updateSchool } from '../../../services/schoolApi';
import { getMyProfile, updateMyProfile } from '../../../services/parentApi';
import { getErrorMessage } from '../../../utils/apiHelpers';
import { useSchoolId } from '../../../utils/schoolContext';
import { toAbsoluteUrl } from '../../../utils/url';

const SchoolEditProfilePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const schoolId = useSchoolId();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState('');

  const [formData, setFormData] = useState({
    schoolName: '',
    fullName: '',
    email: '',
    phone: '',
    altPhone: '',
    address: '',
    pinCode: '',
    city: '',
    state: '',
    country: 'India',
    photo: '',
  });

  const loadProfile = useCallback(async () => {
    const saved = localStorage.getItem('childInfo');
    const parsed = saved ? JSON.parse(saved) : {};

    setInitialLoading(true);
    setLoadError('');
    try {
      // User profile and school details are independent — fetch in parallel.
      const [profileData, school] = await Promise.all([
        getMyProfile(),
        schoolId ? getSchool(schoolId) : Promise.resolve(null),
      ]);
      const user = profileData?.user;
      const profile = profileData?.profile;

      setFormData({
        schoolName: school?.name || profile?.schoolName || parsed.school || '',
        fullName: user?.name || school?.principalName || parsed.name || 'School Admin',
        email: user?.email || school?.adminEmail || parsed.email || '',
        phone: user?.phone || school?.phone || parsed.phone || '',
        altPhone: profile?.altPhone || parsed.altPhone || '',
        address: school?.address?.line1 || parsed.address || '',
        pinCode: school?.address?.pinCode || parsed.pinCode || '',
        city: school?.address?.city || parsed.city || '',
        state: school?.address?.state || parsed.state || '',
        country: school?.address?.country || parsed.country || 'India',
        photo: toAbsoluteUrl(school?.logoUrl || profile?.schoolLogo || profile?.avatarUrl) || parsed.schoolLogo || parsed.photo || '',
      });
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Unable to load school profile'));
    } finally {
      setInitialLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
    if (!formData.schoolName.trim()) newErrors.schoolName = "School Name is required";
    if (!formData.fullName.trim()) newErrors.fullName = "Contact Name is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);

    const cleanPhone = formData.phone.trim().replace(/^\+?91/, '').replace(/\D/g, '') || formData.phone.trim();
    const cleanAltPhone = formData.altPhone ? formData.altPhone.trim().replace(/^\+?91/, '').replace(/\D/g, '') : '';

    const saved = localStorage.getItem('childInfo');
    const existing = saved ? JSON.parse(saved) : { role: 'school' };

    const updatedInfo = {
      ...existing,
      school: formData.schoolName,
      schoolLogo: formData.photo,
      name: formData.fullName,
      email: formData.email,
      phone: cleanPhone,
      altPhone: cleanAltPhone,
      address: formData.address,
      pinCode: formData.pinCode,
      city: formData.city,
      state: formData.state,
      country: formData.country,
      photo: formData.photo,
    };

    try {
      // 1. Update backend user profile credentials, phone, altPhone & photo avatar
      await updateMyProfile({
        schoolName: formData.schoolName,
        name: formData.fullName,
        email: formData.email,
        phone: cleanPhone,
        altPhone: cleanAltPhone,
        address: formData.address,
        pinCode: formData.pinCode,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        photo: formData.photo,
      });

      // 2. Sync with School document directly
      if (schoolId) {
        await updateSchool(schoolId, {
          name: formData.schoolName,
          logoUrl: formData.photo,
          phone: formData.phone,
          principalName: formData.fullName,
          adminEmail: formData.email,
          address: {
            line1: formData.address,
            pinCode: formData.pinCode,
            city: formData.city,
            state: formData.state,
            country: formData.country,
          },
        });
      }

      localStorage.setItem('childInfo', JSON.stringify(updatedInfo));
      setLoading(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigate(-1);
        window.dispatchEvent(new Event('storage'));
      }, 1500);
    } catch (err) {
      setLoading(false);
      alert(getErrorMessage(err, 'Unable to save school profile'));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7FF] pb-32 font-outfit">
      {showSuccess && (
        <div className="fixed inset-0 z-[100] bg-deep-purple/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-green-500 rounded-3xl flex items-center justify-center shadow-2xl animate-in zoom-in duration-500">
            <Check size={40} className="text-white" strokeWidth={3} />
          </div>
          <h2 className="text-xl font-black text-white mt-6">School Profile Updated!</h2>
        </div>
      )}

      <div className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-gray-100 z-50 px-6 py-5 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-deep-purple">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-black text-deep-purple">Edit School Profile</h1>
        <div className="w-10 h-10"></div>
      </div>

      <div className="pt-24 px-6 space-y-8 overflow-y-auto pb-48">
        {loadError && (
          <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600">
            {loadError}
          </div>
        )}

        {initialLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
        <>
        <div className="flex flex-col items-center gap-4">
          <input id="gallery-input-school" type="file" ref={fileInputRef} onChange={handleFileChange} accept=".png,.jpg,.jpeg,.gif,.webp" className="hidden" />
          <input id="camera-input-school" type="file" ref={cameraInputRef} onChange={handleFileChange} accept=".png,.jpg,.jpeg,.gif,.webp" capture="user" className="hidden" />
          <div className="relative group">
            <div className="w-28 h-28 rounded-[2.5rem] bg-white p-1.5 shadow-xl border-2 border-primary/20">
              <div className="w-full h-full rounded-[2rem] bg-gray-100 overflow-hidden relative flex items-center justify-center">
                {formData.photo ? <img src={toAbsoluteUrl(formData.photo)} alt="School Logo" className="w-full h-full object-cover" /> : <Building2 size={36} className="text-gray-300" />}
              </div>
            </div>
            <label htmlFor="camera-input-school" title="Take a photo" className="absolute bottom-0 left-0 w-10 h-10 bg-white text-primary rounded-2xl flex items-center justify-center shadow-lg border-4 border-white active:scale-90 transition-all hover:bg-primary hover:text-white cursor-pointer">
              <Camera size={18} />
            </label>
            <label htmlFor="gallery-input-school" title="Choose File" className="absolute bottom-0 right-0 w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white active:scale-90 transition-all cursor-pointer">
              <Upload size={18} />
            </label>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-black text-deep-purple">{formData.schoolName || 'School Name'}</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Upload Official School Logo & Info</p>
          </div>
        </div>

        <div className="space-y-5">
          <SectionTitle title="School Details" />
          <InputField label="School Name" icon={Building2} value={formData.schoolName} onChange={(v) => handleInputChange('schoolName', v)} error={errors.schoolName} placeholder="Enter official school name" />
        </div>

        <div className="space-y-5">
          <SectionTitle title="School Admin Contact" />
          <InputField label="Contact Person / Principal" icon={User} value={formData.fullName} onChange={(v) => handleInputChange('fullName', v)} error={errors.fullName} placeholder="Enter principal or admin name" />
          <InputField label="School Email" icon={Mail} type="email" value={formData.email} onChange={(v) => handleInputChange('email', v)} error={errors.email} placeholder="admin@school.com" />
          <InputField label="Direct Phone" icon={Phone} value={formData.phone} onChange={(v) => handleInputChange('phone', v)} error={errors.phone} placeholder="+91 XXXXX XXXXX" />
          <InputField label="Alternate Phone" icon={Phone} value={formData.altPhone} onChange={(v) => handleInputChange('altPhone', v)} placeholder="+91 XXXXX XXXXX" />
        </div>

        <div className="space-y-5 pb-10">
          <SectionTitle title="School Address" />
          <InputField label="School Campus Address" icon={Home} value={formData.address} onChange={(v) => handleInputChange('address', v)} placeholder="Building, Block, Area" />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Pin Code" icon={MapPin} value={formData.pinCode} onChange={(v) => handleInputChange('pinCode', v)} placeholder="XXXXXX" />
            <InputField label="City" icon={Globe} value={formData.city} onChange={(v) => handleInputChange('city', v)} placeholder="City" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="State" icon={Globe} value={formData.state} onChange={(v) => handleInputChange('state', v)} placeholder="State" />
            <InputField label="Country" icon={Globe} value={formData.country} onChange={(v) => handleInputChange('country', v)} placeholder="Country" />
          </div>
        </div>
        </>
        )}
      </div>

      <div className="fixed bottom-[72px] left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50 max-w-md mx-auto">
        <button onClick={handleSave} disabled={loading} className="w-full py-4 bg-primary text-white rounded-2xl text-sm font-black shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3">
          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <>Save Changes <ShieldCheck size={18} /></>}
        </button>
      </div>
    </div>
  );
};

// Module scope (not inside the component) so its identity stays stable across
// renders — otherwise each <input> remounts on every keystroke and loses focus.
const InputField = ({ label, icon: Icon, value, onChange, error, type = 'text', placeholder }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label>
    <div className={`relative flex items-center bg-white rounded-2xl border-2 transition-all duration-300 ${error ? 'border-red-100 bg-red-50/30' : 'border-gray-50 focus-within:border-primary/20'}`}>
      <div className={`pl-4 text-gray-400 ${error ? 'text-red-400' : ''}`}>
        <Icon size={18} />
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full py-4 px-3 bg-transparent text-sm font-bold text-deep-purple outline-none"
      />
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

export default SchoolEditProfilePage;
