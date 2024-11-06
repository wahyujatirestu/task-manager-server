import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            email: user.email,
        },
        process.env.JWT_ACCESS_TOKEN,
        {
            expiresIn: '3d',
        }
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            email: user.email,
        },
        process.env.JWT_REFRESH_TOKEN,
        {
            expiresIn: '7d',
        }
    );
};

export const registerUser = async (req, res) => {
    try {
        const {
            name,
            email,
            username,
            password,
            confirmPassword,
            isAdmin,
            role,
            title,
        } = req.body;

        if (!confirmPassword) {
            return res
                .status(400)
                .json({ error: 'Confirm password is required' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }
        const userExist = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }],
            },
        });

        if (userExist) {
            return res.status(400).json({
                status: false,
                message: 'Email or username already exists',
            });
        }

        const hashedPassword = await argon2.hash(password);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                username,
                password: hashedPassword,
                isAdmin,
                role,
                title,
            },
        });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });

        res.status(201).json({ accessToken, refreshToken });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        const user = await prisma.user.findFirst({
            where: {
                OR: [{ email: identifier }, { username: identifier }],
            },
        });

        if (!user) {
            return res.status(401).json({
                status: false,
                message: 'Invalid email/username or password.',
            });
        }

        if (!user.isActive) {
            return res.status(401).json({
                status: false,
                message:
                    'User account has been deactivated, contact the administrator',
            });
        }

        if (!(await argon2.verify(user.password, password))) {
            return res.status(401).json({
                status: false,
                message: 'Invalid email/username or password.',
            });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });

        // Set refresh token in cookie
        res.cookie('jwt', refreshToken, {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        // Respond with access token
        res.json({ user, accessToken, refreshToken });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                isActive: true,
                role: true,
                title: true,
            },
        });

        res.status(200).json({
            status: true,
            message: 'Users fetched successfully',
            data: users,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

export const getMe = async (req, res) => {
    try {
        const authorizationHeader = req.headers.authorization;
        if (
            !authorizationHeader ||
            !authorizationHeader.startsWith('Bearer ')
        ) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = authorizationHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN);
        } catch (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const userId = decoded.id;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { id, name, username, email } = user;
        res.status(200).json({ id, name, username, email });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const logoutUser = async (req, res) => {
    try {
        const token = req.cookies?.jwt;

        if (!token) {
            return res.status(400).json({ message: 'User not authenticated' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_REFRESH_TOKEN);

        // Clear the refresh token in the database
        await prisma.user.update({
            where: { id: decodedToken.id },
            data: { refreshToken: null },
        });

        // Clear the cookie
        res.clearCookie('jwt', '', {
            httpOnly: true,
            maxAge: 1,
            sameSite: 'none',
            secure: process.env.NODE_ENV !== 'development',
        });

        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};

export const getTeamList = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                title: true,
                role: true,
                email: true,
                username: true,
                isActive: true,
            },
        });

        res.status(200).json(users);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

export const getNotificationsList = async (req, res) => {
    try {
        const userId = req.user.id;

        const notices = await prisma.notice.findMany({
            where: {
                isRead: {
                    none: {
                        userId,
                    },
                },
            },
            include: {
                task: {
                    select: {
                        title: true,
                    },
                },
            },
        });

        res.status(200).json(notices);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

export const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.isAdmin;
        const { id: requestedId } = req.body;

        const id = isAdmin && requestedId ? requestedId : userId;

        const user = await prisma.user.findUnique({
            where: { id },
        });

        if (user) {
            const updatedUser = await prisma.user.update({
                where: { id },
                data: {
                    name: req.body.name || user.name,
                    title: req.body.title || user.title,
                    role: req.body.role || user.role,
                },
            });

            res.status(200).json({
                status: true,
                message: 'Profile Updated Successfully.',
                user: {
                    id: updatedUser.id,
                    name: updatedUser.name,
                    title: updatedUser.title,
                    role: updatedUser.role,
                    email: updatedUser.email,
                    username: updatedUser.username,
                    isActive: updatedUser.isActive,
                },
            });
        } else {
            res.status(404).json({ status: false, message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

export const markNotificationRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { isReadType, id } = req.query; // Ubah dari isRead ke isReadType

        if (isReadType === 'all') {
            // Mark all notifications as read for the user
            const unreadNotices = await prisma.notice.findMany({
                where: {
                    isRead: {
                        none: {
                            userId,
                        },
                    },
                },
                select: {
                    id: true,
                },
            });

            const unreadNoticeIds = unreadNotices.map((notice) => notice.id);

            await Promise.all(
                unreadNoticeIds.map((noticeId) => {
                    return prisma.noticeIsRead.upsert({
                        where: {
                            noticeId_userId: {
                                noticeId,
                                userId,
                            },
                        },
                        update: {},
                        create: {
                            notice: { connect: { id: noticeId } },
                            user: { connect: { id: userId } },
                        },
                    });
                })
            );
        } else {
            const notice = await prisma.notice.findUnique({
                where: { id },
            });

            if (!notice) {
                return res.status(404).json({
                    status: false,
                    message: 'Notification not found',
                });
            }

            // Mark the specific notification as read
            await prisma.noticeIsRead.upsert({
                where: {
                    noticeId_userId: {
                        noticeId: id,
                        userId,
                    },
                },
                update: {},
                create: {
                    notice: { connect: { id } },
                    user: { connect: { id: userId } },
                },
            });
        }

        res.status(200).json({
            status: true,
            message: 'Notifications marked as read',
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

export const changeUserPassword = async (req, res) => {
    try {
        const userId = req.user.id;

        const { newPassword, confirmNewPassword } = req.body;
        if (!newPassword || !confirmNewPassword) {
            return res.status(400).json({
                status: false,
                message: 'Please enter new password and confirm password',
            });
        }
        if (newPassword !== confirmNewPassword) {
            return res
                .status(400)
                .json({ status: false, message: 'Passwords do not match' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (user) {
            const hashedPassword = await argon2.hash(newPassword);

            await prisma.user.update({
                where: { id: userId },
                data: {
                    password: hashedPassword,
                },
            });

            res.status(200).json({
                status: true,
                message: 'Password changed successfully.',
            });
        } else {
            res.status(404).json({ status: false, message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

export const activateUserProfile = async (req, res) => {
    try {
        const id = req.params.id;

        const user = await prisma.user.findUnique({
            where: { id: id },
        });

        if (user) {
            const updatedUser = await prisma.user.update({
                where: { id },
                data: {
                    isActive: req.body.isActive,
                },
            });

            res.status(200).json({
                status: true,
                message: `User account has been ${
                    updatedUser.isActive ? 'activated' : 'disabled'
                }`,
            });
        } else {
            res.status(404).json({ status: false, message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

export const deleteUserProfile = async (req, res) => {
    try {
        const id = req.params.id;

        await prisma.user.delete({
            where: { id: id },
        });

        res.status(200).json({
            status: true,
            message: 'User deleted successfully',
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

export const refreshToken = async (req, res) => {
    const cookie = req.cookies.jwt;
    if (!cookie) return res.sendStatus(401);

    try {
        const payload = jwt.verify(cookie, process.env.JWT_REFRESH_TOKEN);
        const user = await prisma.user.findUnique({
            where: { id: payload.id },
        });

        if (!user || user.refreshToken !== cookie) return res.sendStatus(403);

        const accessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: newRefreshToken },
        });

        res.cookie('jwt', newRefreshToken, {
            httpOnly: true,
            sameSite: 'none',
            maxAge: 24 * 60 * 60 * 1000,
            secure: true,
        });

        res.status(200).json({ accessToken });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
