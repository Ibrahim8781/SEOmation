/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';


const prisma = new PrismaClient();


async function main() {
const passwordHash = await bcrypt.hash('Passw0rd!', 12);


await prisma.user.upsert({
where: { email: 'admin@seomation.local' },
update: {},
create: {
email: 'admin@seomation.local',
passwordHash,
name: 'Admin',
role: 'ADMIN',
company: 'SEOmation',
niche: 'SaaS SEO',
timezone: 'Asia/Karachi',
language: 'EN'
}
});


await prisma.user.upsert({
where: { email: 'user@seomation.local' },
update: {},
create: {
email: 'user@seomation.local',
passwordHash,
name: 'Demo User',
role: 'USER',
company: 'SEOmation',
niche: 'SaaS SEO',
timezone: 'Asia/Karachi',
language: 'EN'
}
});


console.log('Seed complete. Admin: admin@seomation.local / Passw0rd!');
}


main()
.catch((e) => {
console.error(e);
process.exit(1);
})
.finally(async () => {
await prisma.$disconnect();
});