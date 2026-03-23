import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');
const appBaseUrl = process.env.APP_BASE_URL || '';
const assetPublicPath = process.env.ASSET_PUBLIC_PATH || '/media';

export const config = {
env: process.env.NODE_ENV || 'development',
port: Number(process.env.PORT || 3000),
appBaseUrl,
databaseUrl: process.env.DATABASE_URL,
jwt: {
accessSecret: process.env.JWT_ACCESS_SECRET,
refreshSecret: process.env.JWT_REFRESH_SECRET,
accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d'
},
http: {
jsonLimit: process.env.JSON_BODY_LIMIT || '15mb'
},
ai: {
url: process.env.AI_SERVICE_URL || '',
mock: String(process.env.AI_MOCK).toLowerCase() === 'true',
timeouts: {
topicsMs: Number(process.env.AI_TOPIC_TIMEOUT_MS || 60000),
contentMs: Number(process.env.AI_CONTENT_TIMEOUT_MS || 360000),
imageMs: Number(process.env.AI_IMAGE_TIMEOUT_MS || 450000),
seoMs: Number(process.env.AI_SEO_TIMEOUT_MS || 30000)
}
},
integrations: {
callbackBase: process.env.INTEGRATION_CALLBACK_BASE || process.env.APP_BASE_URL || '',
wordpress: {
authUrl: process.env.WP_AUTH_URL || '',
clientId: process.env.WP_CLIENT_ID || '',
clientSecret: process.env.WP_CLIENT_SECRET || '',
redirectUri: process.env.WP_REDIRECT_URI || '',
scope: process.env.WP_SCOPE || 'global'
},
linkedin: {
authUrl: process.env.LI_AUTH_URL || '',
clientId: process.env.LI_CLIENT_ID || '',
clientSecret: process.env.LI_CLIENT_SECRET || '',
redirectUri: process.env.LI_REDIRECT_URI || '',
 scope: process.env.LI_SCOPE || 'openid profile email w_member_social'
},
instagram: {
authUrl: process.env.IG_AUTH_URL || '',
clientId: process.env.IG_CLIENT_ID || '',
redirectUri: process.env.IG_REDIRECT_URI || '',
scope: process.env.IG_SCOPE || ''
}
},
publisher: {
intervalMs: Number(process.env.PUBLISHER_INTERVAL_MS || 60000)
},
assets: {
publicPath: assetPublicPath.startsWith('/') ? assetPublicPath : `/${assetPublicPath}`,
publicBaseUrl: process.env.PUBLIC_ASSET_BASE_URL || appBaseUrl || '',
storageDir: process.env.ASSET_STORAGE_DIR || path.resolve(backendRoot, 'storage', 'media'),
maxAge: process.env.ASSET_CACHE_MAX_AGE || '365d'
}
};
