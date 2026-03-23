import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/s;

function ensureLeadingSlash(value) {
  return value.startsWith('/') ? value : `/${value}`;
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function defaultBaseUrl() {
  return config.assets.publicBaseUrl || `http://localhost:${config.port}`;
}

function normalizePublicPath(value) {
  return ensureLeadingSlash(value || '/media').replace(/\/+$/, '');
}

function inferFormatFromMimeType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('svg')) return 'svg';
  return 'jpg';
}

function inferMimeTypeFromUrl(url) {
  const normalized = String(url || '').toLowerCase();
  if (/\.png(\?|$)/.test(normalized)) return 'image/png';
  if (/\.webp(\?|$)/.test(normalized)) return 'image/webp';
  if (/\.gif(\?|$)/.test(normalized)) return 'image/gif';
  if (/\.svg(\?|$)/.test(normalized)) return 'image/svg+xml';
  return 'image/jpeg';
}

function isExternallyReachable(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return false;
    if (host.endsWith('.local')) return false;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
      return false;
    }
    return true;
  } catch (_error) {
    return false;
  }
}

function buildStorageKey(userId, format) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return path.join(userId, year, month, `${randomUUID()}.${format}`);
}

function buildPublicUrl(storageKey) {
  const base = ensureTrailingSlash(defaultBaseUrl());
  const publicPath = normalizePublicPath(config.assets.publicPath).replace(/^\//, '');
  const safeKey = storageKey.replace(/\\/g, '/');
  return new URL(`${publicPath}/${safeKey}`, base).toString();
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(DATA_URL_PATTERN);
  if (!match) {
    throw new Error('Invalid data URL');
  }
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  };
}

async function fetchRemoteBuffer(sourceUrl) {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch remote image (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    mimeType: response.headers.get('content-type') || inferMimeTypeFromUrl(sourceUrl),
    buffer: Buffer.from(arrayBuffer)
  };
}

export const AssetStorageService = {
  getPublicAssetUrl(storageKey) {
    return buildPublicUrl(storageKey);
  },

  async persistImage({ userId, sourceUrl, dataUrl }) {
    const input = dataUrl || sourceUrl;
    if (!input) {
      throw new Error('An image source is required');
    }

    let originalUrl = null;
    let mimeType;
    let buffer;

    if (String(input).startsWith('data:')) {
      ({ mimeType, buffer } = parseDataUrl(input));
    } else {
      originalUrl = String(input);
      ({ mimeType, buffer } = await fetchRemoteBuffer(originalUrl));
    }

    const format = inferFormatFromMimeType(mimeType);
    const storageKey = buildStorageKey(userId, format);
    const absolutePath = path.join(config.assets.storageDir, storageKey);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);

    const publicUrl = buildPublicUrl(storageKey);

    return {
      url: publicUrl,
      format,
      storageMeta: {
        key: storageKey.replace(/\\/g, '/'),
        mimeType,
        bytes: buffer.length,
        originalUrl,
        publicUrl,
        isExternallyReachable: isExternallyReachable(publicUrl)
      }
    };
  }
};
