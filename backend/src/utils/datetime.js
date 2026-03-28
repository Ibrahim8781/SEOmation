const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const formatterCache = new Map();

function pad(value) {
  return String(value).padStart(2, '0');
}

function getFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    );
  }
  return formatterCache.get(timeZone);
}

function parseLocalDateTime(value) {
  const normalized = String(value || '').trim();
  const match = LOCAL_DATETIME_PATTERN.exec(normalized);
  if (!match) {
    throw new Error('Invalid local datetime');
  }

  const [, year, month, day, hour, minute, second = '00'] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second)
  };
}

function extractParts(date, timeZone) {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
}

function matchesLocalParts(date, timeZone, target) {
  const actual = extractParts(date, timeZone);
  return (
    actual.year === target.year &&
    actual.month === target.month &&
    actual.day === target.day &&
    actual.hour === target.hour &&
    actual.minute === target.minute &&
    actual.second === target.second
  );
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = extractParts(date, timeZone);
  const utcEquivalent = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return utcEquivalent - date.getTime();
}

export function isValidTimeZone(timeZone) {
  try {
    if (!timeZone) return false;
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function zonedLocalDateTimeToUtc(localDateTime, timeZone) {
  if (!isValidTimeZone(timeZone)) {
    throw new Error('Invalid timezone');
  }

  const target = parseLocalDateTime(localDateTime);
  const utcGuess = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second
  );

  const candidateOffsets = new Set();
  const probeTimes = [utcGuess, utcGuess - 60 * 60 * 1000, utcGuess + 60 * 60 * 1000];
  for (const probeTime of probeTimes) {
    candidateOffsets.add(getTimeZoneOffsetMs(new Date(probeTime), timeZone));
  }

  for (const offset of candidateOffsets) {
    const candidate = new Date(utcGuess - offset);
    if (matchesLocalParts(candidate, timeZone, target)) {
      return candidate;
    }
  }

  throw new Error('Local datetime is invalid for timezone');
}

export function formatUtcInTimeZone(dateInput, timeZone) {
  if (!isValidTimeZone(timeZone)) {
    throw new Error('Invalid timezone');
  }

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }

  const parts = extractParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
