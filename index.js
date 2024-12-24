import dotenv from 'dotenv';

import morgan from 'morgan';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import userRoute from './routes/userRoute.js';
import taskRoute from './routes/taskRoute.js';
import { errorHandler, routeNotFound } from './middleware/errorMiddleware.js';
dotenv.config();

const app = express();

app.use(
    cors({
        origin: 'https://jastrate-task-manager.vercel.app',
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
