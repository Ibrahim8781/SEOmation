import './config/index.js';
import { app } from './app.js';
import logger from './lib/logger.js';


const port = process.env.PORT || 3000;
app.listen(port, () => {
logger.info({ port }, 'SEOmation API listening');
});