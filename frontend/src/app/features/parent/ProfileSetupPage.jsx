import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, User, Building2,
  GraduationCap, Phone, ArrowRight,
  Sparkles, ChevronDown
} from 'lucide-react';
import apiClient from '../../../services/apiClient';
import { lookupSchoolForRegistration } from '../../../services/authApi';
import useAuthStore from '../../../store/useAuthStore';
import { getErrorMessage } from '../../../utils/apiHelpers';
import { toAbsoluteUrl } from '../../../utils/url';

const ProfileSetupPage = () => {
  const navigate = useNavigate();
  const firstInputRef = useRef(null);

  const [formData, setFormData] = useState({
    phone: '',
    studentName: '',
    schoolId: '',
    schoolRefNo: '',
    grade: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [isGradeDropdownOpen, setIsGradeDropdownOpen] = useState(false);

  useEffect(() => {
    // Auto-focus on first input (Mobile)
    firstInputRef.current?.focus();
  }, []);

  const [grades, setGrades] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [schoolLookupError, setSchoolLookupError] = useState('');

  useEffect(() => {
    const normalizedRef = (formData.schoolRefNo || '').trim().toUpperCase();
    if (!normalizedRef) {
      setFormData((prev) => (prev.schoolId ? { ...prev, schoolId: '', grade: '' } : prev));
      setGrades([]);
      setSchoolLookupError('');
      setClassesLoading(false);
      return undefined;
    }

    let cancelled = false;
    setClassesLoading(true);
    setSchoolLookupError('');

    const timer = setTimeout(() => {
      lookupSchoolForRegistration(normalizedRef)
        .then(({ school, classes }) => {
          if (cancelled) return;

          const labels = [
            ...new Set((classes || []).map((c) => c.classGrade || c.class || c.grade).filter(Boolean)),
          ];

          setFormData((prev) => ({
            ...prev,
            schoolId: school?.id || '',
            grade: labels.includes(prev.grade) ? prev.grade : '',
          }));
          setGrades(labels);
          setSchoolLookupError(
            labels.length === 0 ? 'No classes found for this school code' : ''
          );
        })
        .catch((err) => {
          if (cancelled) return;

          setFormData((prev) => ({ ...prev, schoolId: '', grade: '' }));
          setGrades([]);
          const code = err.response?.data?.code;
          setSchoolLookupError(
            code === 'INVALID_SCHOOL_REF'
              ? 'Invalid school reference number'
              : 'Unable to load classes for this school code'
          );
        })
        .finally(() => {
          if (!cancelled) setClassesLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.schoolRefNo]);

  const handleInputChange = (field, value) => {
    let finalValue = value;
    if (field === 'phone') {
      finalValue = value.replace(/\D/g, '').slice(0, 10);
    }
    setFormData(prev => ({ ...prev, [field]: finalValue }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.phone || formData.phone.length !== 10) newErrors.phone = "Valid 10-digit mobile is required";
    if (!formData.studentName.trim()) newErrors.studentName = "Student name is required";
    if (!formData.grade) newErrors.grade = "Please select a grade";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = formData.phone.length === 10 && formData.studentName && formData.grade;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      const response = await apiClient.post('/auth/parent/register', {
        phone: formData.phone,
        studentName: formData.studentName,
        grade: formData.grade,
        classGrade: formData.grade,
        schoolRefNo: formData.schoolRefNo
      });

      const { user, accessToken } = response.data.data;

      // Update zustand auth store
      useAuthStore.getState().login(user, accessToken);

      // Construct and save childInfo details for local usage across parent pages
      const childInfo = {
        name: user.childProfile?.name || formData.studentName,
        school: user.childProfile?.schoolName || 'Explore Schools',
        schoolId: user.childProfile?.schoolId || 'explore-schools',
        schoolLogo: toAbsoluteUrl(user.childProfile?.schoolLogo) || '',
        grade: user.childProfile?.grade || formData.grade,
        phone: user.phone || formData.phone,
        schoolRefNo: user.childProfile?.schoolRefNo || formData.schoolRefNo,
        studentId: user.childProfile?.studentId || null
      };

      localStorage.setItem('childInfo', JSON.stringify(childInfo));

      navigate('/user/home');
    } catch (err) {
      console.error('Registration failed:', err);
      const errorMessage = err.response?.data?.message || 'Registration failed. Please try again.';
      const errorCode = err.response?.data?.code;

      if (errorCode === 'VALIDATION_ERROR' && err.response?.data?.errors) {
        setErrors(prev => ({ ...prev, ...err.response.data.errors }));
      } else if (errorCode === 'PROFILE_ALREADY_SET_UP') {
        setErrors(prev => ({ ...prev, phone: 'Your profile is already set up. Pull down to refresh your home screen.' }));
      } else if (errorCode === 'PHONE_EXISTS') {
        setErrors(prev => ({ ...prev, phone: 'This number is already registered to another account. Please log in with it instead.' }));
      } else if (errorCode === 'PHONE_ALREADY_LINKED_TO_ANOTHER_STUDENT') {
        setErrors(prev => ({ ...prev, phone: 'This number is linked to another student. Use a different number for this child.' }));
      } else if (errorCode === 'INVALID_SCHOOL_REF') {
        setErrors(prev => ({ ...prev, schoolRefNo: errorMessage }));
      } else {
        setErrors(prev => ({ ...prev, phone: errorMessage }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-outfit relative">
      {/* Header */}
      <div className="px-6 py-5 flex items-center gap-4 bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100/50">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-deep-purple active:scale-90 transition-all shrink-0"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-black text-deep-purple">Create Account</h1>
      </div>

      <div className="flex-1 px-6 pt-6 pb-40">

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Mobile Number */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Mobile Number</label>
            <div className={`relative group transition-all duration-300 ${errors.phone ? 'scale-[0.98]' : ''}`}>
              <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${errors.phone ? 'text-red-400' : 'text-gray-400 group-focus-within:text-primary'}`} size={18} />
              <input
                ref={firstInputRef}
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Enter 10 digit number"
                className={`w-full pl-12 pr-4 py-4 bg-gray-50 border-2 rounded-[14px] text-sm font-bold text-deep-purple outline-none transition-all ${errors.phone ? 'border-red-100 bg-red-50/30' : 'border-transparent focus:border-primary/10 focus:bg-white focus:shadow-xl focus:shadow-primary/5'}`}
              />
            </div>
            {errors.phone && <p className="text-[9px] font-bold text-red-500 ml-1">{errors.phone}</p>}
          </div>

          {/* Student Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Student Name</label>
            <div className={`relative group transition-all duration-300 ${errors.studentName ? 'scale-[0.98]' : ''}`}>
              <User className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${errors.studentName ? 'text-red-400' : 'text-gray-400 group-focus-within:text-primary'}`} size={18} />
              <input
                type="text"
                value={formData.studentName}
                onChange={(e) => handleInputChange('studentName', e.target.value)}
                placeholder="Child's full name"
                className={`w-full pl-12 pr-4 py-4 bg-gray-50 border-2 rounded-[14px] text-sm font-bold text-deep-purple outline-none transition-all ${errors.studentName ? 'border-red-100 bg-red-50/30' : 'border-transparent focus:border-primary/10 focus:bg-white focus:shadow-xl focus:shadow-primary/5'}`}
              />
            </div>
            {errors.studentName && <p className="text-[9px] font-bold text-red-500 ml-1">{errors.studentName}</p>}
          </div>
          {/* School Ref No (Optional) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">
              School Ref No
            </label>
            <div className={`relative group transition-all duration-300 ${errors.schoolRefNo ? 'scale-[0.98]' : ''}`}>
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors font-bold text-sm ${errors.schoolRefNo ? 'text-red-400' : 'text-gray-400 group-focus-within:text-primary'}`}>#</div>
              <input
                type="text"
                value={formData.schoolRefNo || ''}
                onChange={(e) => handleInputChange('schoolRefNo', e.target.value)}
                placeholder="Enter reference number"
                className={`w-full pl-12 pr-4 py-4 bg-gray-50 border-2 rounded-[14px] text-sm font-bold text-deep-purple outline-none transition-all ${errors.schoolRefNo ? 'border-red-100 bg-red-50/30' : 'border-transparent focus:border-primary/10 focus:bg-white focus:shadow-xl focus:shadow-primary/5'}`}
              />
            </div>
            {errors.schoolRefNo && <p className="text-[9px] font-bold text-red-500 ml-1">{errors.schoolRefNo}</p>}
          </div>

          {/* Grade / Class */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Select Grade / Class</label>
            <div className="relative">
              <GraduationCap className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors z-10 ${isGradeDropdownOpen ? 'text-primary' : 'text-gray-400'}`} size={18} />
              <button
                type="button"
                onClick={() => setIsGradeDropdownOpen(!isGradeDropdownOpen)}
                className={`w-full pl-12 pr-10 py-4 bg-gray-50 border-2 rounded-[14px] text-sm font-bold outline-none transition-all text-left flex items-center justify-between relative ${isGradeDropdownOpen
                    ? 'border-primary/20 bg-white shadow-xl shadow-primary/5 text-deep-purple'
                    : 'border-transparent text-deep-purple'
                  }`}
              >
                <span className={formData.grade ? 'text-deep-purple' : 'text-gray-400 font-medium'}>
                  {formData.grade || "Select class"}
                </span>
              </button>
              <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform duration-300 z-10 ${isGradeDropdownOpen ? 'rotate-180 text-primary' : ''}`} size={18} />

              {isGradeDropdownOpen && (
                <>
                  {/* Click outside backdrop to close */}
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsGradeDropdownOpen(false)}
                  />
                  {/* Dropdown Options - Opens upwards to prevent cutoff */}
                  <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="py-2">
                      {grades.length > 0 ? (
                        grades.map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => {
                              handleInputChange('grade', g);
                              setIsGradeDropdownOpen(false);
                            }}
                            className={`w-full text-left px-5 py-3 text-xs font-bold transition-all hover:bg-primary/5 active:bg-primary/10 ${formData.grade === g
                                ? 'text-primary bg-primary/5 font-black'
                                : 'text-deep-purple font-bold'
                              }`}
                          >
                            {g}
                          </button>
                        ))
                      ) : (
                        <div className="px-5 py-3 text-xs font-semibold text-gray-400">
                          {classesLoading
                            ? 'Loading classes...'
                            : schoolLookupError
                              || (formData.schoolRefNo
                                ? 'No classes found for this school code'
                                : 'Enter school ref no to load classes')}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Already have an account? Login */}
          <div className="text-center pt-4 space-y-6">
            <p className="text-gray-400 text-sm font-medium">
              Already have an account?
              <button
                type="button"
                onClick={() => navigate('/user/login')}
                className="ml-2 text-primary font-black hover:underline"
              >
                Login
              </button>
            </p>
            <p className="text-[11px] font-semibold text-gray-400/90 leading-relaxed px-4 mt-6">
              By signing up, you accept the{" "}
              <button
                type="button"
                onClick={() => navigate('/user/terms')}
                className="text-primary font-bold hover:underline inline"
              >
                Terms & Conditions
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={() => navigate('/user/privacy')}
                className="text-primary font-bold hover:underline inline"
              >
                Privacy Policy
              </button>
              .
            </p>
          </div>
        </form>
      </div>

      {/* Sticky Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50">
        <button
          onClick={handleSubmit}
          disabled={!isFormValid || loading}
          className={`
            w-full py-5 bg-primary text-white rounded-[18px] text-base font-black shadow-2xl shadow-primary/30
            active:scale-95 transition-all flex items-center justify-center gap-3 tracking-widest uppercase
            ${(!isFormValid || loading) ? 'opacity-40 grayscale cursor-not-allowed shadow-none' : 'hover:bg-deep-purple'}
          `}
        >
          {loading ? (
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              Sign Up
              <ArrowRight size={20} strokeWidth={3} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProfileSetupPage;
