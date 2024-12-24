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
    searchUsers,
    createGroup,
    getUserGroups,
    addUserToGroup,
    getGroupMembers,
    removeUserFromGroup,
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

router.post('/create', protectRoute, createGroup);
router.get('/my-groups', protectRoute, getUserGroups);
router.post(
    '/group/:groupId/add-user',
    protectRoute,
    isAdminRoute,
    addUserToGroup
);
router.get('/group-members/:groupId', protectRoute, getGroupMembers);

router.get('/search-users', protectRoute, searchUsers);
router.get('/get-team', protectRoute, getTeamList);
router.get('/notifications', protectRoute, getNotificationsList);

router.put('/profile', protectRoute, updateUserProfile);
router.put('/read-noti', protectRoute, markNotificationRead);
router.put('/change-password', protectRoute, changeUserPassword);
router.put('/:id', protectRoute, isAdminRoute, activateUserProfile);

// //   FOR ADMIN ONLY - ADMIN ROUTES
router.route('/:id').delete(protectRoute, isAdminRoute, deleteUserProfile);
router.delete(
    '/group/:groupId/remove-user',
    protectRoute,
    isAdminRoute,
    removeUserFromGroup
);

export default router;
