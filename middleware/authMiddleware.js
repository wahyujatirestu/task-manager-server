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

const isAdminRoute = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id, groupId } = req.params; // `id` bisa merujuk pada Task, Group, atau User ID

        // Jika hanya User ID yang tersedia, lewati validasi tambahan
        if (!groupId && req.baseUrl.includes('/api/user')) {
            console.log(
                'Operation is user-related. Skipping admin validation.'
            );
            return next();
        }

        // Validasi berdasarkan Task ID
        if (id) {
            console.log('Checking task access for Task ID:', id);

            const task = await prisma.task.findUnique({
                where: { id },
                select: {
                    team: { select: { id: true } },
                    groupId: true,
                },
            });

            if (!task) {
                console.log('Task not found for Task ID:', id);
                return res
                    .status(404)
                    .json({ status: false, message: 'Task not found.' });
            }

            if (task.groupId) {
                console.log(
                    'Task belongs to a group. Checking admin rights...'
                );
                const isAdminGroup = await prisma.group.findFirst({
                    where: { id: task.groupId, adminId: userId },
                });

                if (isAdminGroup) {
                    console.log('User is group admin. Access granted.');
                    return next();
                }

                console.log('Access denied. User is not a group admin.');
                return res.status(403).json({
                    status: false,
                    message:
                        'Access denied. Only group admins can access group tasks.',
                });
            }

            const isOwnTask =
                task.team && task.team.some((user) => user.id === userId);

            if (isOwnTask) {
                console.log('User owns the task. Access granted.');
                return next();
            }

            console.log('Access denied. User does not own the task.');
            return res.status(403).json({
                status: false,
                message: 'Access denied. You can only access your own tasks.',
            });
        }

        // Validasi berdasarkan Group ID
        if (groupId) {
            console.log('Checking group access for Group ID:', groupId);

            const isAdminGroup = await prisma.group.findFirst({
                where: { id: groupId, adminId: userId },
            });

            if (isAdminGroup) {
                console.log('User is group admin. Access granted.');
                return next();
            }

            console.log('Access denied. User is not a group admin.');
            return res.status(403).json({
                status: false,
                message:
                    'Access denied. Only group admins can perform this action.',
            });
        }
    } catch (error) {
        console.error('Error in isAdminRoute middleware:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export { isAdminRoute, protectRoute };
