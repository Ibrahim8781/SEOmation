import { UserService } from '../services/user.service.js';


export const UserController = {
async me(req, res, next) {
try {
const user = await UserService.getById(req.user.id);
const { passwordHash, ...safe } = user;
res.json(safe);
} catch (e) { next(e); }
},
async updateMe(req, res, next) {
try {
const payload = req.validated?.body ?? req.body;
const user = await UserService.updateProfile(req.user.id, payload);
const { passwordHash, ...safe } = user;
res.json(safe);
} catch (e) { next(e); }
}
};
