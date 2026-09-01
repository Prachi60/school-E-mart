import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Flame } from 'lucide-react';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// The admin's kit sale window means every kit a parent can still buy has a
// deadline. Showing it — rather than silently vanishing the kit later — is the
// point: a parent should know the clock is running while they can still act,
// and a school should know when one of its kits stopped selling.
//
// `endsAt` comes straight off the kit's `purchaseWindow.endsAt` (ISO string, or
// null whenever the admin has the window switched off), so this renders nothing
// at all on an install that isn't using the feature. `startsAt` is when the kit
// was published; given both, the strip can show how much of the window has
// already burned down, not just what's left.
//
// Variants:
//   strip  — the parent's kit card. A full-width bar with a live countdown and
//            a burn-down meter, on screen for the whole window rather than only
//            once it gets urgent.
//   banner — the parent's kit detail page.
//   admin  — the same facts stated flatly for a school or platform admin
//            reading a management list: no alarm styling, closing date spelled
//            out, because they are auditing rather than being nudged to buy.

const formatRemaining = (ms) => {
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  const seconds = Math.floor((ms % MINUTE) / SECOND);

  // Always three moving parts while there are days left, so the number visibly
  // ticks down instead of sitting on "6d 14h" for an hour at a time.
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${String(seconds).padStart(2, '0')}s`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
};

// A compact form for the tight admin pill, where the row has no space for
// three units.
const formatRemainingShort = (ms) => {
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// Three tiers so urgency reads at a glance instead of having to parse the
// number: calm for "next week sometime", amber once it's days, red for the
// final day.
const toneFor = (ms) => {
  if (ms <= DAY) {
    return {
      key: 'critical',
      pill: 'bg-red-50 text-red-700 border-red-200',
      banner: 'bg-red-50 border-red-200 text-red-800',
      strip: 'bg-red-50 border-red-200 text-red-700',
      bar: 'bg-red-500',
      track: 'bg-red-200/70',
      Icon: Flame,
    };
  }
  if (ms <= 3 * DAY) {
    return {
      key: 'warning',
      pill: 'bg-amber-50 text-amber-800 border-amber-200/80',
      banner: 'bg-amber-50 border-amber-200/80 text-amber-900',
      strip: 'bg-amber-50 border-amber-200/80 text-amber-800',
      bar: 'bg-amber-500',
      track: 'bg-amber-200/70',
      Icon: Clock,
    };
  }
  return {
    key: 'calm',
    pill: 'bg-purple-50 text-[#3b2d7d] border-purple-100',
    banner: 'bg-purple-50/70 border-purple-100 text-[#3b2d7d]',
    strip: 'bg-purple-50/70 border-purple-100 text-[#3b2d7d]',
    bar: 'bg-[#3b2d7d]',
    track: 'bg-purple-200/70',
    Icon: Clock,
  };
};

const formatDate = (ms) =>
  new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const toMs = (value) => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const KitSaleCountdown = ({ endsAt, startsAt, variant = 'strip', className = '', onExpire }) => {
  const target = useMemo(() => toMs(endsAt), [endsAt]);
  const origin = useMemo(() => toMs(startsAt), [startsAt]);

  const [now, setNow] = useState(() => Date.now());
  const msLeft = target ? Math.max(0, target - now) : 0;
  const expired = Boolean(target) && msLeft <= 0;

  // Under an hour the seconds are the whole point; above it a 30s tick keeps
  // the label honest without re-rendering a screenful of kit cards every
  // second. Flipping `fast` re-runs the effect, so the switch is automatic.
  const fast = msLeft <= HOUR;
  useEffect(() => {
    if (!target || expired) return undefined;
    const id = setInterval(() => setNow(Date.now()), fast ? SECOND : 30 * SECOND);
    return () => clearInterval(id);
  }, [target, fast, expired]);

  // Lets the page refetch the moment a kit's window closes under an open app,
  // so the kit disappears then rather than on the next navigation. Held in a
  // ref so a caller passing an inline arrow doesn't re-fire it every render.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);
  useEffect(() => {
    if (expired) onExpireRef.current?.();
  }, [expired]);

  if (!target) return null;

  const tone = toneFor(msLeft);
  const { Icon } = tone;

  if (variant === 'admin') {
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border inline-flex items-center gap-1 ${
          expired ? 'bg-gray-100 text-gray-500 border-gray-200' : tone.pill
        } ${className}`}
      >
        <Icon size={10} className="stroke-[3] shrink-0" />
        {expired ? `Sale closed ${formatDate(target)}` : `Closes in ${formatRemainingShort(msLeft)}`}
      </span>
    );
  }

  if (variant === 'banner') {
    return (
      <div
        className={`p-3.5 rounded-2xl border flex items-center gap-2.5 shadow-2xs ${tone.banner} ${className}`}
      >
        <Icon size={18} className={`shrink-0 stroke-[2.5] ${tone.key === 'critical' ? 'animate-pulse' : ''}`} />
        {expired ? (
          <span className="text-xs font-bold">
            This kit&apos;s purchase window has closed — it is no longer available to order.
          </span>
        ) : (
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider opacity-70">
              {tone.key === 'critical' ? 'Last chance to order' : 'Available for a limited time'}
            </p>
            <p className="text-sm font-black leading-tight tabular-nums">
              Closes in {formatRemaining(msLeft)}
              <span className="text-[10px] font-bold opacity-70 ml-1.5">({formatDate(target)})</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  // strip — how much of the window is gone, so the bar is meaningful from the
  // day the kit is published rather than only near the end. Without a start
  // date there's nothing honest to draw, so the meter is simply omitted.
  const elapsedPercent =
    origin && target > origin
      ? Math.min(100, Math.max(0, ((now - origin) / (target - origin)) * 100))
      : null;

  return (
    <div className={`rounded-xl border px-2.5 py-1.5 ${expired ? 'bg-gray-50 border-gray-200 text-gray-500' : tone.strip} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider opacity-80 min-w-0">
          <Icon
            size={11}
            className={`stroke-[3] shrink-0 ${!expired && tone.key === 'critical' ? 'animate-pulse' : ''}`}
          />
          <span className="truncate">
            {expired
              ? 'Sale closed'
              : tone.key === 'critical'
              ? 'Hurry — closing today'
              : 'Offer ends in'}
          </span>
        </span>
        <span className="text-[11px] font-black tabular-nums shrink-0">
          {expired ? formatDate(target) : formatRemaining(msLeft)}
        </span>
      </div>

      {elapsedPercent !== null && (
        <div className={`mt-1.5 h-1 rounded-full overflow-hidden ${expired ? 'bg-gray-200' : tone.track}`}>
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${expired ? 'bg-gray-400' : tone.bar}`}
            style={{ width: `${elapsedPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default KitSaleCountdown;
