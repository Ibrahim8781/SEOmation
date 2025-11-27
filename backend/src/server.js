import './config/index.js';
import { app } from './app.js';
import logger from './lib/logger.js';
import { startPublisherWorker } from './services/publisher.worker.js';


const port = process.env.PORT || 3000;
startPublisherWorker();
app.listen(port, () => {
logger.info({ port }, 'SEOmation API listening');
});
