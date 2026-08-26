/**
 * The calendar date in the viewer's own timezone, as YYYY-MM-DD.
 *
 * Not interchangeable with `toISOString().slice(0, 10)`, which yields the UTC date:
 * in IST (UTC+5:30) that is still the previous day until 05:30 local, so attendance
 * marked early in the morning would be filed against yesterday.
 */
export const toLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * The calendar day an attendance-style record belongs to, as YYYY-MM-DD.
 *
 * Records are pinned to UTC midnight, so the day has to be read back in UTC. Passing
 * one through `toLocalDateKey` instead lands on the previous date for any viewer west
 * of UTC — the record for the 12th reads as the 11th.
 */
export const toUtcDateKey = (dateObjOrStr) => {
  const date = new Date(dateObjOrStr);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
