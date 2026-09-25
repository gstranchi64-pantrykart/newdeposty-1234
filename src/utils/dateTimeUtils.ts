/**
 * Universal Date & Time parser and formatter for Orders and Transactions.
 * Ensures consistent handling of Indian date formats (DD/MM/YYYY), 12-hour AM/PM,
 * 24-hour formats, ISO strings, and date-only fallbacks.
 */

export const parseOrderDate = (dateStr?: string | number | null): Date | null => {
  if (!dateStr) return null;
  if (typeof dateStr === 'number') {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(dateStr).trim();
  if (!str) return null;

  // 1. Check if ISO string with T
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Format: "DD/MM/YYYY [hh:mm:ss [AM|PM]]" or "YYYY-MM-DD [hh:mm:ss [AM|PM]]"
  const parts = str.split(' ').filter(Boolean);
  const dateSegment = parts[0];
  const slashParts = dateSegment.includes('/')
    ? dateSegment.split('/')
    : dateSegment.includes('-')
    ? dateSegment.split('-')
    : [];

  if (slashParts.length === 3) {
    let day = 0;
    let month = 0;
    let year = 0;

    if (slashParts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(slashParts[0], 10);
      month = parseInt(slashParts[1], 10) - 1;
      day = parseInt(slashParts[2], 10);
    } else {
      // DD/MM/YYYY
      day = parseInt(slashParts[0], 10);
      month = parseInt(slashParts[1], 10) - 1;
      year = parseInt(slashParts[2], 10);
    }

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (parts.length >= 2) {
      const timeSegment = parts[1];
      const timeParts = timeSegment.split(':');
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0], 10) || 0;
        minutes = parseInt(timeParts[1], 10) || 0;
        seconds = timeParts.length >= 3 ? parseInt(timeParts[2], 10) || 0 : 0;
      }

      // Check for AM/PM in parts[2] or embedded in timeSegment
      const ampm = (
        parts[2] ||
        (timeSegment.toLowerCase().includes('pm')
          ? 'PM'
          : timeSegment.toLowerCase().includes('am')
          ? 'AM'
          : '')
      ).toUpperCase();

      if (ampm === 'PM' && hours < 12) {
        hours += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      }
    }

    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Fallback standard date parsing
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
};

/**
 * Extracts the most precise timestamp available for an order.
 * If createdAt is date-only (e.g. "2026-09-23"), checks tracking timeline step 0 timestamp.
 */
export const getOrderPreciseTimestamp = (order: {
  createdAt?: string;
  trackingTimeline?: Array<{ timestamp?: string }>;
}): string => {
  if (!order) return '';
  const created = (order.createdAt || '').trim();

  // If createdAt already has time (contains space or T)
  if (created.includes(' ') || created.includes('T')) {
    return created;
  }

  // Check tracking timeline initial registration timestamp
  if (order.trackingTimeline && order.trackingTimeline.length > 0) {
    const timelineTime = order.trackingTimeline[0]?.timestamp;
    if (timelineTime && (timelineTime.includes(' ') || timelineTime.includes('T'))) {
      return timelineTime;
    }
  }

  return created;
};

/**
 * Formats an order date string into separate and combined human-readable Date and Time.
 */
export const formatOrderDateTime = (
  dateInput?: string | number | null
): { date: string; time: string; full: string; hasTime: boolean } => {
  if (!dateInput) {
    return { date: 'N/A', time: '', full: 'N/A', hasTime: false };
  }

  const str = String(dateInput).trim();
  const dateObj = parseOrderDate(str);

  if (!dateObj) {
    return { date: str, time: '', full: str, hasTime: false };
  }

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const dateStr = `${day}/${month}/${year}`;

  // Check if original input had time specified
  const hadTime =
    str.includes(':') ||
    str.includes('T') ||
    typeof dateInput === 'number' ||
    (dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0 || dateObj.getSeconds() !== 0);

  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');

  const timeStr = hadTime ? `${hoursStr}:${minutes}:${seconds} ${ampm}` : '';
  const shortTimeStr = hadTime ? `${hoursStr}:${minutes} ${ampm}` : '';

  return {
    date: dateStr,
    time: timeStr || shortTimeStr,
    full: hadTime ? `${dateStr} ${timeStr}` : dateStr,
    hasTime: hadTime,
  };
};

/**
 * Returns current timestamp in Indian standard format: DD/MM/YYYY hh:mm:ss AM/PM
 */
export const getCurrentOrderTimestamp = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${day}/${month}/${year} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
};

/**
 * Calculates live day count starting from the delivery date for tracking purposes.
 * - Delivery day itself = Day 1
 * - Next day = Day 2
 * - Up to Day 15 shows (Day X / 15, days left in initial 15d cycle)
 * - Beyond 15 days shows Day X (X days elapsed)
 * - Note: Returns are NEVER locked; return is always allowed at any time.
 */
export const getDeliveryDayCount = (
  deliveryDateInput?: string | number | null
): {
  dayNumber: number;
  diffDays: number;
  isWithin15Days: boolean;
  daysRemaining: number;
  badgeLabel: string;
  detailLabel: string;
  statusBadgeColor: string;
} => {
  if (!deliveryDateInput) {
    return {
      dayNumber: 1,
      diffDays: 0,
      isWithin15Days: true,
      daysRemaining: 14,
      badgeLabel: 'Day 1 of 15',
      detailLabel: 'Day 1 (Delivered Today)',
      statusBadgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  }

  const deliveryDate = parseOrderDate(deliveryDateInput);
  if (!deliveryDate) {
    return {
      dayNumber: 1,
      diffDays: 0,
      isWithin15Days: true,
      daysRemaining: 14,
      badgeLabel: 'Day 1 of 15',
      detailLabel: 'Day 1 (Delivered Today)',
      statusBadgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  }

  const now = new Date();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const delMidnight = new Date(deliveryDate.getFullYear(), deliveryDate.getMonth(), deliveryDate.getDate()).getTime();

  const diffTime = Math.max(0, nowMidnight - delMidnight);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const dayNumber = diffDays + 1; // Delivery day is Day 1

  if (dayNumber <= 15) {
    const daysRemaining = 15 - dayNumber;
    return {
      dayNumber,
      diffDays,
      isWithin15Days: true,
      daysRemaining,
      badgeLabel: `Day ${dayNumber} / 15`,
      detailLabel:
        diffDays === 0
          ? 'Day 1 (Delivered Today)'
          : `Day ${dayNumber} of 15 (${diffDays}d elapsed)`,
      statusBadgeColor:
        dayNumber <= 7
          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
          : dayNumber <= 12
          ? 'bg-blue-100 text-blue-800 border-blue-300'
          : 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }

  return {
    dayNumber,
    diffDays,
    isWithin15Days: false,
    daysRemaining: 0,
    badgeLabel: `Day ${dayNumber}`,
    detailLabel: `Day ${dayNumber} (${diffDays} days elapsed since delivery)`,
    statusBadgeColor:
      dayNumber <= 21
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-rose-100 text-rose-800 border-rose-300',
  };
};
