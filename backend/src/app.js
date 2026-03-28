import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import routes from './routes/index.js';
import errorHandler from './middleware/error.js';
import ApiError from './utils/ApiError.js';
import { config } from './config/index.js';


export const app = express();

const allowedCorsOrigins = new Set(config.http.corsAllowedOrigins);
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedCorsOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new ApiError(403, 'CORS origin not allowed'));
  },
  optionsSuccessStatus: 204
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: config.http.jsonLimit }));


app.use(
  config.assets.publicPath,
  express.static(path.resolve(config.assets.storageDir), {
    maxAge: config.assets.maxAge,
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  })
);


app.get('/health', (_req, res) => res.json({ ok: true }));


app.use('/api', routes);


app.use((req, _res, next) => {
  next(new ApiError(404, 'Route not found'));
});


app.use(errorHandler);
