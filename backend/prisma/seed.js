/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';


const prisma = new PrismaClient();


async function main() {
const passwordHash = await bcrypt.hash('admin123', 12);


await prisma.user.upsert({
where: { email: 'admin123@seomation.com' },
update: {},
create: {
email: 'admin123@seomation.com',
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
where: { email: 'user@seomation.com' },
update: {},
create: {
email: 'user@seomation.com',
passwordHash,
name: 'Demo User',
role: 'USER',
company: 'SEOmation',
niche: 'SaaS SEO',
timezone: 'Asia/Karachi',
language: 'EN'
}
});



console.log('Seed complete. Admin: admin123@seomation.com / admin123');
}


main()
.catch((e) => {
console.error(e);
process.exit(1);
})
.finally(async () => {
await prisma.$disconnect();
});