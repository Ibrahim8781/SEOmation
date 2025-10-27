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
}
};