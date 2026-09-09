// Shared customer-segment definitions.
// `all` is a virtual segment that combines dealer, commercial and bulk.

export const ALL_SEGMENT = 'all';

export const SEGMENTS = [
  { id: ALL_SEGMENT, label: 'All' },
  { id: 'dealer', label: 'Dealer' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'bulk', label: 'Bulk' },
];

// Concrete segments backed by a distinct set of sales channels.
export const BASE_SEGMENTS = SEGMENTS.filter(s => s.id !== ALL_SEGMENT).map(s => s.id);

export const DEFAULT_SEGMENT = 'dealer';

const VALID = new Set(SEGMENTS.map(s => s.id));

export function isValidSegment(value) {
  return typeof value === 'string' && VALID.has(value);
}

// Coerce an arbitrary query/cookie value to a known segment id.
export function normalizeSegment(value, fallback = DEFAULT_SEGMENT) {
  if (isValidSegment(value)) return value;
  return fallback;
}

export function segmentLabel(segment) {
  return SEGMENTS.find(s => s.id === segment)?.label || segmentLabel(DEFAULT_SEGMENT);
}

// Like normalizeSegment, but never yields the virtual "all" segment.
// Use where per-segment configuration (e.g. targets) is read or written.
export function normalizeBaseSegment(value, fallback = DEFAULT_SEGMENT) {
  const seg = normalizeSegment(value, fallback);
  return seg === ALL_SEGMENT ? fallback : seg;
}
