
import { prisma } from '../lib/prisma.js';


export const UserService = {
async getById(id) {
return prisma.user.findUnique({ where: { id } });
},


async updateProfile(id, data) {
// ownership is enforced in controller via req.user
return prisma.user.update({
where: { id },
data: {
name: data.name ?? undefined,
company: data.company ?? undefined,
niche: data.niche ?? undefined,
timezone: data.timezone ?? undefined,
language: data.language ?? undefined
}
});
}
};