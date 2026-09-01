import React, { useState, useEffect, useCallback } from 'react';
import {
  Hourglass, Save, Loader2, CheckCircle2, AlertCircle,
  EyeOff, Timer, CalendarClock,
} from 'lucide-react';
import { getKitSettings, updateKitSettings } from '../../../services/adminApi';
import { getErrorMessage } from '../../../utils/apiHelpers';

// Shortcuts for the windows schools actually ask for; the field stays free-form
// for anything in between.
const PRESET_DAYS = [3, 7, 15, 30];

const MIN_DAYS = 1;
const MAX_DAYS = 365;

const KitSaleWindowManagement = () => {
  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState(7);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getKitSettings();
      setEnabled(Boolean(data?.purchaseWindowEnabled));
      setDays(Number(data?.purchaseWindowDays) || 7);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load kit sale window settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3500);
  };

  const daysValue = Number(days);
  const daysInvalid =
    !Number.isFinite(daysValue) ||
    !Number.isInteger(daysValue) ||
    daysValue < MIN_DAYS ||
    daysValue > MAX_DAYS;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (daysInvalid) {
      setError(`Enter a whole number of days between ${MIN_DAYS} and ${MAX_DAYS}.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateKitSettings({
        purchaseWindowEnabled: enabled,
        purchaseWindowDays: daysValue,
      });
      showToast('Kit sale window updated.');
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save kit sale window settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl font-outfit">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5">
          <CheckCircle2 size={16} strokeWidth={3} className="shrink-0" />
          <span className="text-xs font-black">{toast}</span>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black text-deep-purple tracking-tight">Kit Sale Window</h1>
        <p className="text-xs font-bold text-gray-400 mt-1">
          Put every school kit on a countdown. Once a kit has been published for this many days, it
          auto-hides from parents who haven&apos;t bought it — and parents see the time left ticking
          down on every kit until then.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600 flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-gray-150 rounded-[2.2rem] p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-purple-50 text-primary flex items-center justify-center">
              <Hourglass size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-deep-purple uppercase tracking-wider">
                Auto-hide unsold kits
              </h2>
              <p className="text-[11px] text-gray-400 font-bold">
                Applies to every school on the platform
              </p>
            </div>
          </div>

          {/* Master switch */}
          <button
            type="button"
            onClick={() => setEnabled((prev) => !prev)}
            className={`w-full flex items-center justify-between gap-4 p-4 rounded-2xl border text-left transition-all ${
              enabled
                ? 'bg-purple-50/60 border-primary/40'
                : 'bg-gray-50/70 border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <EyeOff size={16} className={enabled ? 'text-primary shrink-0' : 'text-gray-400 shrink-0'} />
              <div className="min-w-0">
                <p className="text-xs font-black text-deep-purple">Kit sale window is {enabled ? 'ON' : 'OFF'}</p>
                <p className="text-[11px] font-bold text-gray-400">
                  {enabled
                    ? 'Kits disappear from the parent app once their window closes.'
                    : 'Kits stay on sale to parents indefinitely.'}
                </p>
              </div>
            </div>
            <span
              className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
                enabled ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                  enabled ? 'left-[1.375rem]' : 'left-0.5'
                }`}
              />
            </span>
          </button>

          {/* Days */}
          <div className={`space-y-3 transition-opacity ${enabled ? '' : 'opacity-50'}`}>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 block">
              Days on sale after a kit is published
            </label>
            <div className="relative max-w-xs">
              <Timer size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                min={MIN_DAYS}
                max={MAX_DAYS}
                step={1}
                disabled={!enabled}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className={`w-full pl-11 pr-16 py-3 bg-gray-50/70 border rounded-2xl text-xs font-bold text-deep-purple focus:outline-none focus:border-primary/50 disabled:cursor-not-allowed ${
                  daysInvalid && enabled ? 'border-red-300' : 'border-gray-200'
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Days
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESET_DAYS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setDays(preset)}
                  className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black border transition-all disabled:cursor-not-allowed ${
                    Number(days) === preset
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-primary/40'
                  }`}
                >
                  {preset} days
                </button>
              ))}
            </div>
          </div>

          {/* What this actually does, in the admin's terms. */}
          <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl space-y-2">
            <div className="flex items-center gap-2">
              <CalendarClock size={15} className="text-amber-600 shrink-0" />
              <p className="text-[11px] font-black text-amber-900 uppercase tracking-wider">
                Before you turn this on
              </p>
            </div>
            <ul className="text-[11px] font-bold text-amber-800/90 space-y-1.5 list-disc list-inside leading-relaxed">
              <li>
                The countdown runs from the day a school <strong>publishes</strong> the kit, not the day
                it was drafted. Re-publishing a kit starts a fresh window.
              </li>
              <li>
                Kits already published longer ago than this close <strong>immediately</strong> when you
                save. Check the age of live kits first.
              </li>
              <li>
                A parent who already bought a kit keeps seeing it, so their &quot;kits purchased&quot;
                progress and order history stay intact.
              </li>
              <li>Schools and admins always see every kit here — only the parent app hides them.</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || (enabled && daysInvalid)}
            className="px-6 py-3 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{saving ? 'Saving…' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default KitSaleWindowManagement;
