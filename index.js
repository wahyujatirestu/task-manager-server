import dotenv from 'dotenv';
dotenv.config();

import morgan from 'morgan';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import userRoute from './routes/userRoute.js';
import taskRoute from './routes/taskRoute.js';
import { errorHandler, routeNotFound } from './middleware/errorMiddleware.js';

const app = express();

const allowedOrigins = [process.env.ORIGIN, process.env.ORIGIN1];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use('/api/user', userRoute);
app.use('/api/task', taskRoute);

app.use(routeNotFound);
app.use(errorHandler);
app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
