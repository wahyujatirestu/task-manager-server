import express from 'express';
import { isAdminRoute, protectRoute } from '../middleware/authMiddleware.js';
import {
    activateUserProfile,
    changeUserPassword,
    deleteUserProfile,
    getNotificationsList,
    getTeamList,
    loginUser,
    logoutUser,
    markNotificationRead,
    forgetPassword,
    resetPassword,
    registerUser,
    verifyEmail,
    resendVerificationEmail,
    updateUserProfile,
    getMe,
    refreshToken,
    getAllUsers,
} from '../controllers/userController.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/verify-email', verifyEmail);
router.get('/me', protectRoute, getMe);
router.post('/logout', logoutUser);
router.get('/refresh-token', refreshToken);
router.get('/get-users', protectRoute, getAllUsers);
router.post('/forget-password', forgetPassword);
router.post('/reset-password', resetPassword);
router.post('/resend-verification', resendVerificationEmail);

router.get('/get-team', protectRoute, getTeamList);
router.get('/notifications', protectRoute, getNotificationsList);

router.put('/profile', protectRoute, updateUserProfile);
router.put('/read-noti', protectRoute, markNotificationRead);
router.put('/change-password', protectRoute, changeUserPassword);

// //   FOR ADMIN ONLY - ADMIN ROUTES
router
    .route('/:id')
    .put(protectRoute, isAdminRoute, activateUserProfile)
    .delete(protectRoute, isAdminRoute, deleteUserProfile);

export default router;
