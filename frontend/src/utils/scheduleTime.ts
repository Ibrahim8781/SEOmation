const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function resolveScheduleTimeZone(timeZone?: string | null) {
  const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  for (const candidate of [timeZone, fallback, 'UTC']) {
    if (!candidate) continue;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: candidate }).format(new Date());
      return candidate;
    } catch {
      /* ignore invalid timezone */
    }
  }

  return 'UTC';
}

function extractParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
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

function parseLocalDateTime(value: string) {
  const match = LOCAL_DATETIME_PATTERN.exec(String(value || '').trim());
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

function matchesLocalParts(date: Date, timeZone: string, target: ReturnType<typeof parseLocalDateTime>) {
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

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
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

export function scheduledLocalInputToUtc(value: string, timeZone?: string | null) {
  const resolvedTimeZone = resolveScheduleTimeZone(timeZone);
  const target = parseLocalDateTime(value);
  const utcGuess = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second
  );

  const candidateOffsets = new Set<number>();
  for (const probeTime of [utcGuess, utcGuess - 60 * 60 * 1000, utcGuess + 60 * 60 * 1000]) {
    candidateOffsets.add(getTimeZoneOffsetMs(new Date(probeTime), resolvedTimeZone));
  }

  for (const offset of candidateOffsets) {
    const candidate = new Date(utcGuess - offset);
    if (matchesLocalParts(candidate, resolvedTimeZone, target)) {
      return candidate;
    }
  }

  throw new Error('Local datetime is invalid for timezone');
}

export function isFutureScheduledInput(value: string, timeZone?: string | null) {
  return scheduledLocalInputToUtc(value, timeZone).getTime() > Date.now();
}

export function formatDateTimeLocalMin(timeZone?: string | null, leadMinutes = 5) {
  const date = new Date(Date.now() + leadMinutes * 60 * 1000);
  const parts = extractParts(date, resolveScheduleTimeZone(timeZone));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatScheduledDateTime(isoDate: string, timeZone?: string | null) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: resolveScheduleTimeZone(timeZone),
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(isoDate));
}

export function formatScheduledDateKey(isoDate: string, timeZone?: string | null) {
  const parts = extractParts(new Date(isoDate), resolveScheduleTimeZone(timeZone));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}
