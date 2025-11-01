
import { prisma } from '../lib/prisma.js';


export const UserService = {
async getById(id) {
return prisma.user.findUnique({ where: { id } });
},


async updateProfile(id, data) {
// ownership is enforced in controller via req.user
const updateData = {
name: data.name ?? undefined,
company: data.company ?? undefined,
niche: data.niche ?? undefined,
timezone: data.timezone ?? undefined,
language: data.language ?? undefined,
tone: data.tone ?? undefined
};

if (Object.prototype.hasOwnProperty.call(data, 'preferences')) {
updateData.preferences = data.preferences;
}

return prisma.user.update({
where: { id },
data: updateData
});
}
};
