import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            email: user.email,
            isVerified: user.isVerified,
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
            isVerified: user.isVerified,
        },
        process.env.JWT_REFRESH_TOKEN,
        {
            expiresIn: '7d',
        }
    );
};

const generateResetToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_RESET_PASSWORD,
        { expiresIn: '15m' }
    );
};

const sendVerificationEmail = async (email, id, token) => {
    if (!token || !id) {
        console.error('Missing token or id when sending verification email.');
        return;
    }

    const queryString = `id=${id}&token=${token}`;

    const verificationUrl = `${process.env.ORIGIN}/verify-email?${queryString}`;
    console.log('Verification URL:', verificationUrl);

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASSWORD,
        },
    });

    await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Verify Your Email',
        html: `
            <h4>Welcome to Jastrate Task Manager!</h4>
            <p>Please click the link below to verify your email address and activate your account:</p>
            <a href="${verificationUrl}">${verificationUrl}</a>
            <p>If you did not request this, please ignore this email.</p>
        `,
    });
};

export const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res
                .status(400)
                .json({ message: 'Email is already verified.' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');

        await prisma.user.update({
            where: { id: user.id },
            data: { verificationToken },
        });

        await sendVerificationEmail(email, verificationToken);

        res.status(200).json({
            message:
                'Verification email resent successfully. Please check your inbox.',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const registerUser = async (req, res) => {
    try {
        const { email, username, password, confirmPassword } = req.body;

        if (!confirmPassword) {
            return res
                .status(400)
                .json({ error: 'Confirm password is required' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        // Cek apakah pengguna sudah ada
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

        // Buat password hash
        const hashedPassword = await argon2.hash(password);

        // Buat token verifikasi
        const verificationToken = crypto.randomBytes(32).toString('hex');
        console.log('Generated Token:', verificationToken); // Debug log untuk token

        // Simpan pengguna baru di database
        const user = await prisma.user.create({
            data: {
                email,
                username,
                password: hashedPassword,
                verificationToken,
                isVerified: false,
            },
        });
        console.log('Saved User ID:', user.id); // Debug log untuk ID pengguna

        // Kirim email verifikasi
        await sendVerificationEmail(user.email, user.id, verificationToken);

        res.status(201).json({
            message:
                'Registration successful! Please check your email to verify your account.',
        });
    } catch (error) {
        console.error('Error in registerUser:', error.message);
        return res
            .status(500)
            .json({ status: false, message: 'Internal Server Error' });
    }
};

export const verifyEmail = async (req, res) => {
    try {
        const { id, token } = req.query;

        console.log('Received ID:', id); // Debug log
        console.log('Received Token:', token); // Debug log

        if (!id || !token) {
            return res
                .status(400)
                .json({ status: false, message: 'ID and token are required' });
        }

        const user = await prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            return res.status(400).json({
                status: false,
                message: 'Invalid user ID',
            });
        }

        if (user.verificationToken !== token) {
            return res.status(400).json({
                status: false,
                message: 'Invalid or expired verification token',
            });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verificationToken: null,
            },
        });

        res.status(200).json({
            status: true,
            message: 'Email verified successfully',
        });
    } catch (error) {
        console.error('Error in verifyEmail:', error.message);
        return res
            .status(500)
            .json({ status: false, message: 'Internal Server Error' });
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

        if (!user.isVerified) {
            return res.status(401).json({
                status: false,
                message: 'Email is not verified.',
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

export const forgetPassword = async (req, res) => {
    try {
        console.log('Received forget password request:', req.body); // Log untuk debugging

        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Find user by email
        const user = await prisma.user.findUnique({ where: { email } });
        console.log('User found:', user);

        if (!user) {
            console.log('User not found:', email); // Log untuk debugging
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('User found:', user); // Log untuk debugging

        // Generate reset token
        const resetToken = generateResetToken(user);

        console.log('Generated reset token:', resetToken); // Log untuk debugging

        // Create reset link
        const resetLink = `${process.env.ORIGIN}/reset-password/${resetToken}`;

        console.log('Generated reset link:', resetLink); // Log untuk debugging

        // Send email with reset link
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER, // Your email
                pass: process.env.GMAIL_PASSWORD, // Your app password
            },
        });

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: user.email,
            subject: 'Reset Your Password',
            html: `
                <h4>Password Reset Request</h4>
                <p>Click the link below to reset your password. This link is valid for 15 minutes:</p>
                <a href="${resetLink}">${resetLink}</a>
                <p>If you did not request a password reset, please ignore this email.</p>
            `,
        };

        console.log('Sending email with reset link:', mailOptions); // Log untuk debugging

        await transporter.sendMail(mailOptions);

        console.log('Email sent successfully:', user.email); // Log untuk debugging

        res.status(200).json({ message: 'Password reset email sent' });
    } catch (error) {
        console.error('Error in forgetPassword:', error); // Log untuk debugging
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword, confirmNewPassword } = req.body;

        console.log('Reset password request received.');

        // Validasi input
        if (!token || !newPassword || !confirmNewPassword) {
            console.log('Validation failed: Missing fields.');
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (newPassword !== confirmNewPassword) {
            console.log('Validation failed: Passwords do not match.');
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        // Verifikasi token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_RESET_PASSWORD);
        } catch (err) {
            console.log('Token validation failed: Invalid or expired token.');
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        console.log('Token verified successfully:', decoded);

        // Cari user berdasarkan token
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
        });

        if (!user) {
            console.log('User not found for token:', decoded.id);
            return res.status(404).json({ message: 'User not found' });
        }

        // Hash password baru
        const hashedPassword = await argon2.hash(newPassword);

        // Update password user dan hapus semua token terkait
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        await prisma.token.deleteMany({
            where: { userId: user.id },
        });

        console.log('Password reset successfully for user:', user.id);

        // Kirimkan respons sukses
        return res.status(200).json({
            message: 'Password has been reset successfully',
        });
    } catch (error) {
        console.error('Unexpected error during password reset:', error.message);
        return res.status(500).json({ message: 'Internal server error' });
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

export const createGroup = async (req, res) => {
    try {
        const { name, members = [] } = req.body;
        const { id: adminId } = req.user;

        console.log('Creating group with name:', name, 'and members:', members);

        if (!name) {
            return res.status(400).json({ message: 'Group name is required' });
        }

        if (!Array.isArray(members)) {
            return res
                .status(400)
                .json({ message: 'Members must be an array' });
        }

        const allMembers = [...members, adminId];

        const group = await prisma.group.create({
            data: {
                name,
                adminId,
                members: {
                    create: allMembers.map((memberId) => ({
                        userId: memberId,
                        role: memberId === adminId ? 'Admin' : 'Member',
                    })),
                },
            },
            include: {
                members: { include: { user: true } },
            },
        });

        console.log('Group created successfully:', group);

        res.status(201).json({ group });
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUserGroups = async (req, res) => {
    try {
        const { id: userId } = req.user;

        console.log('Fetching groups for user ID:', userId);

        const groups = await prisma.group.findMany({
            where: {
                OR: [{ adminId: userId }, { members: { some: { userId } } }],
            },
            include: {
                members: { include: { user: true } },
            },
        });

        console.log('Groups fetched successfully for user ID:', userId, groups);

        res.status(200).json({ groups });
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const addUserToGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;

        if (!groupId || !userId) {
            return res
                .status(400)
                .json({ message: 'Group ID and User ID are required.' });
        }

        const existingMember = await prisma.groupMember.findFirst({
            where: { groupId, userId },
        });

        if (existingMember) {
            return res.status(200).json({
                status: false,
                message: 'User is already a member of the group.',
            });
        }

        const groupMember = await prisma.groupMember.create({
            data: { groupId, userId },
        });

        console.log('User added to group successfully:', groupMember);

        res.status(201).json({
            status: true,
            message: 'User added successfully.',
        });
    } catch (error) {
        console.error('Error adding user to group:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const removeUserFromGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;

        if (!groupId || !userId) {
            return res.status(400).json({
                message: 'Group ID and User ID are required.',
            });
        }

        // Hapus user dari grup
        const deletedMember = await prisma.groupMember.deleteMany({
            where: {
                groupId,
                userId,
            },
        });

        if (deletedMember.count === 0) {
            return res.status(404).json({
                message: 'User not found in this group.',
            });
        }

        console.log(`User ${userId} removed from group ${groupId}.`);
        res.status(200).json({ message: 'User removed successfully.' });
    } catch (error) {
        console.error('Error removing user from group:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getGroupMembers = async (req, res) => {
    try {
        const { groupId } = req.params;

        if (!groupId) {
            return res.status(400).json({ message: 'Group ID is required' });
        }

        const members = await prisma.groupMember.findMany({
            where: { groupId },
            include: {
                user: true,
                group: true,
            },
        });

        res.status(200).json(members);
    } catch (error) {
        console.error('Error fetching group members:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getTeamList = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                title: true,
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

export const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ message: 'Query is required' });
        }

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                ],
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
            },
        });

        res.status(200).json({
            status: true,
            message: 'Users fetched successfully',
            data: users,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: error.message });
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
                isRead: {
                    some: {
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
            orderBy: { createdAt: 'desc' }, // Urutkan berdasarkan waktu terbaru
        });

        res.status(200).json({
            status: true,
            message: 'Notifications fetched successfully.',
            data: notices,
        });
    } catch (error) {
        console.error('Error in getNotificationsList:', error.message);
        res.status(500).json({ status: false, message: error.message });
    }
};

export const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: requestedId } = req.body;
        const id = requestedId ? requestedId : userId;

        const user = await prisma.user.findUnique({ where: { id } });

        if (user) {
            const updatedUser = await prisma.user.update({
                where: { id },
                data: {
                    name: req.body.name || user.name,
                    email: req.body.email || user.email,
                    username: req.body.username || user.username,
                    title: req.body.title || user.title,
                    role: req.body.role || user.role,
                },
            });

            // Generate new token with updated user data
            const token = jwt.sign(
                { id: updatedUser.id, role: updatedUser.role },
                process.env.JWT_ACCESS_TOKEN,
                { expiresIn: '1h' } // Adjust expiration as needed
            );

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
                token, // Send new token to frontend
            });
        } else {
            res.status(404).json({ status: false, message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: error.message });
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
        const userId = req.params.id;

        console.log(`Deleting user with ID: ${userId}`);

        // Hapus semua entri terkait di NoticeIsRead
        await prisma.noticeIsRead.deleteMany({
            where: { userId },
        });

        // Hapus pengguna
        await prisma.user.delete({
            where: { id: userId },
        });

        res.status(200).json({
            status: true,
            message: 'User deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// Updated refreshToken Controller
export const refreshToken = async (req, res) => {
    const refreshToken = req.cookies.jwt;
    if (!refreshToken)
        return res.status(401).json({ message: 'Refresh token not provided' });

    try {
        const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN);
        const user = await prisma.user.findUnique({
            where: { id: payload.id },
        });

        if (!user || user.refreshToken !== refreshToken)
            return res.sendStatus(403);

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: newRefreshToken },
        });

        res.cookie('jwt', newRefreshToken, {
            httpOnly: true,
            sameSite: 'none',
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        return res.status(200).json({ accessToken: newAccessToken });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: error.message });
    }
};
