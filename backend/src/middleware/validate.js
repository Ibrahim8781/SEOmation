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
next(e);
}
};