import { AuthService } from '../src/services/auth.service.js';
import { prisma } from '../src/lib/prisma.js';


// These are unit-ish tests; DB is real. You can also mock prisma for pure unit tests.


describe('AuthService basics', () => {
const email = 'test+' + Date.now() + '@mail.local';


afterAll(async () => {
await prisma.$disconnect();
});


it('registers and logs in a user', async () => {
const { user, accessToken, refreshToken } = await AuthService.register({
email,
password: 'Passw0rd!',
name: 'Test',
role: 'USER',
company: 'ACME',
niche: 'SEO',
timezone: 'Asia/Karachi',
language: 'EN'
});
expect(user.email).toBe(email);
expect(accessToken).toBeTruthy();
expect(refreshToken).toBeTruthy();


const login = await AuthService.login({ email, password: 'Passw0rd!' });
expect(login.user.id).toBe(user.id);
});
});