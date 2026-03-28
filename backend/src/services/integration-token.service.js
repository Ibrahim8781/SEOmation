import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { config } from '../config/index.js';

const TOKEN_PREFIX = 'enc:v1:';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKey;

function deriveEncryptionKey(secret) {
  const value = String(secret || '').trim();
  if (!value) return null;

  if (value.startsWith('base64:')) {
    const decoded = Buffer.from(value.slice('base64:'.length), 'base64');
    if (decoded.length !== 32) {
      throw new Error('INTEGRATION_TOKEN_ENCRYPTION_KEY base64 value must decode to exactly 32 bytes');
    }
    return decoded;
  }

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }

  if (value.length < 32) {
    throw new Error('INTEGRATION_TOKEN_ENCRYPTION_KEY must be at least 32 characters, 64 hex chars, or base64:32-byte-key');
  }

  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function getEncryptionKey() {
  if (cachedKey !== undefined) {
    return cachedKey;
  }

  cachedKey = deriveEncryptionKey(config.integrations?.tokenEncryptionKey || '');
  return cachedKey;
}

function requireEncryptionKey() {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error('INTEGRATION_TOKEN_ENCRYPTION_KEY is required for storing or using platform OAuth tokens');
  }
  return key;
}

export function hasIntegrationTokenEncryptionKey() {
  return Boolean(getEncryptionKey());
}

export function isEncryptedIntegrationToken(value) {
  return typeof value === 'string' && value.startsWith(TOKEN_PREFIX);
}

export function assertIntegrationTokenEncryptionReady() {
  requireEncryptionKey();
}

export function encryptIntegrationToken(value) {
  if (!value) return null;
  if (isEncryptedIntegrationToken(value)) return value;

  const key = requireEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, ciphertext]).toString('base64url');
  return `${TOKEN_PREFIX}${payload}`;
}

export function decryptIntegrationToken(value) {
  if (!value) return null;
  if (!isEncryptedIntegrationToken(value)) return String(value);

  const key = requireEncryptionKey();
  const payload = String(value).slice(TOKEN_PREFIX.length);
  const data = Buffer.from(payload, 'base64url');

  if (data.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error('Encrypted integration token payload is malformed');
  }

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function sanitizeIntegrationSecrets(integration) {
  if (!integration) return integration;
  const { accessToken, refreshToken, ...safeIntegration } = integration;
  void accessToken;
  void refreshToken;
  return safeIntegration;
}

async function upgradeLegacyPlaintextTokens(integration) {
  const data = {};

  if (integration?.accessToken && !isEncryptedIntegrationToken(integration.accessToken)) {
    data.accessToken = encryptIntegrationToken(integration.accessToken);
  }

  if (integration?.refreshToken && !isEncryptedIntegrationToken(integration.refreshToken)) {
    data.refreshToken = encryptIntegrationToken(integration.refreshToken);
  }

  if (!Object.keys(data).length) {
    return integration;
  }

  await prisma.platformIntegration.update({
    where: { id: integration.id },
    data
  });

  return {
    ...integration,
    ...data
  };
}

export async function prepareIntegrationForUse(integration) {
  if (!integration) return integration;

  assertIntegrationTokenEncryptionReady();

  const upgraded = await upgradeLegacyPlaintextTokens(integration);

  return {
    ...upgraded,
    accessToken: decryptIntegrationToken(upgraded.accessToken),
    refreshToken: decryptIntegrationToken(upgraded.refreshToken)
  };
}

export async function backfillIntegrationTokenEncryption() {
  if (!hasIntegrationTokenEncryptionKey()) {
    logger.warn('INTEGRATION_TOKEN_ENCRYPTION_KEY is not set; OAuth token encryption backfill skipped');
    return { skipped: true, updated: 0 };
  }

  const integrations = await prisma.platformIntegration.findMany({
    select: {
      id: true,
      accessToken: true,
      refreshToken: true
    }
  });

  let updated = 0;

  for (const integration of integrations) {
    const needsAccess = integration.accessToken && !isEncryptedIntegrationToken(integration.accessToken);
    const needsRefresh = integration.refreshToken && !isEncryptedIntegrationToken(integration.refreshToken);
    if (!needsAccess && !needsRefresh) continue;

    const data = {};
    if (needsAccess) data.accessToken = encryptIntegrationToken(integration.accessToken);
    if (needsRefresh) data.refreshToken = encryptIntegrationToken(integration.refreshToken);

    await prisma.platformIntegration.update({
      where: { id: integration.id },
      data
    });
    updated += 1;
  }

  logger.info({ updated }, 'OAuth token encryption backfill complete');
  return { skipped: false, updated };
}
