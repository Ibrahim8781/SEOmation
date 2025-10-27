import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes/index.js';
import errorHandler from './middleware/error.js';
import logger from './lib/logger.js';


export const app = express();


app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));


app.get('/health', (_req, res) => res.json({ ok: true }));


app.use('/api', routes);


app.use((req, _res, next) => {
logger.warn({ path: req.path }, 'Route not found');
next();
});


app.use(errorHandler);