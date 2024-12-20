import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const protectRoute = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token is missing' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN);
        console.log('Decoded token:', decoded); // Log token decoded

        const dbUser = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                name: true,
                email: true,
                title: true,
                role: true,
                isActive: true,
            },
        });

        if (!dbUser) {
            console.log('User not found in database');
            return res.status(403).json({ error: 'User not found' });
        }

        if (!dbUser.isActive) {
            console.log('User is deactivated');
            return res.status(403).json({ error: 'User is deactivated' });
        }

        console.log('Authenticated User:', dbUser); // Log user details
        req.user = dbUser; // Attach user data to the request
        next();
    } catch (err) {
        console.error('Error verifying token:', err.message);
        if (err.name === 'JsonWebTokenError') {
            return res.status(403).json({ error: 'Invalid token' });
        }
        if (err.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Token expired' });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const isAdminRoute = (req, res, next) => {
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        return res.status(401).json({
            status: false,
            message: 'Not authorized as admin. Try login as admin.',
        });
    }
};

export { isAdminRoute, protectRoute };
