export const IMAGE_STYLE_PRESETS = [
  'auto',
  'editorial',
  'photorealistic',
  'illustration',
  'minimal',
  'cinematic',
  '3d-render'
] as const;

export type ImageStylePreset = (typeof IMAGE_STYLE_PRESETS)[number];

export const IMAGE_STYLE_OPTIONS: { label: string; value: ImageStylePreset }[] = [
  { label: 'Auto (Recommended)', value: 'auto' },
  { label: 'Editorial', value: 'editorial' },
  { label: 'Photorealistic', value: 'photorealistic' },
  { label: 'Illustration', value: 'illustration' },
  { label: 'Minimal', value: 'minimal' },
  { label: 'Cinematic', value: 'cinematic' },
  { label: '3D Render', value: '3d-render' }
];

export function normalizeImageStyle(style?: string | null) {
  const value = String(style || '').trim().toLowerCase();
  if (!value || value === 'auto') return undefined;
  return value;
}
