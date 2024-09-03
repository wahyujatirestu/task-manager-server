import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dbConnection = async () => {
    try {
        await prisma.$connect(); // Connect to the PostgreSQL database using Prisma

        console.log('DB connection established');
    } catch (error) {
        console.log('DB Error: ' + error);
    }
};

export const createJWT = (res, userId) => {
    const token = jwt.sign({ userId }, process.env.JWT_ACCESS_TOKEN, {
        expiresIn: '1d',
    });

    // Change sameSite from strict to none when you deploy your app
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'none', // Prevent CSRF attack
        maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
    });
};
