import ApiError from '../utils/ApiError.js';

export const validate = (schema) => (req, _res, next) => {
try {
const parsed = schema.parse({
body: req.body,
query: req.query,
params: req.params
});
req.validated = parsed;
next();
} catch (e) {
const message = e.errors?.map(err => err.message).join('; ') || e.message;
next(new ApiError(400, message));
}
};