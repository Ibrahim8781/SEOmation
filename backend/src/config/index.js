import dotenv from 'dotenv';
dotenv.config();


export const config = {
env: process.env.NODE_ENV || 'development',
port: Number(process.env.PORT || 3000),
databaseUrl: process.env.DATABASE_URL,
jwt: {
accessSecret: process.env.JWT_ACCESS_SECRET,
refreshSecret: process.env.JWT_REFRESH_SECRET,
accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d'
},
ai: {
url: process.env.AI_SERVICE_URL || '',
mock: String(process.env.AI_MOCK).toLowerCase() === 'true'
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
}
};
