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
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN); // Use the same secret used to generate the token
        const dbUser = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                name: true,
                email: true,
                title: true,
                role: true,
                isAdmin: true,
                isActive: true,
            },
        });

        if (!dbUser) {
            return res.status(403).json({ error: 'User not found' });
        }

        req.user = dbUser;
        next();
    } catch (err) {
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
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        return res.status(401).json({
            status: false,
            message: 'Not authorized as admin. Try login as admin.',
        });
    }
};

export { isAdminRoute, protectRoute };
