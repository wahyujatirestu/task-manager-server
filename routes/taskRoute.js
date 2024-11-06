import express from 'express';
import {
    createSubTask,
    createTask,
    dashboardStatistics,
    deleteRestoreTask,
    duplicateTask,
    getAllSubTask,
    getTask,
    getTasks,
    postTaskActivity,
    trashTask,
    updateTask,
} from '../controllers/taskController.js';
import { isAdminRoute, protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create', protectRoute, isAdminRoute, createTask);
router.post('/duplicate/:id', protectRoute, isAdminRoute, duplicateTask);
router.post('/activity/:id', protectRoute, postTaskActivity);

router.get('/dashboard', protectRoute, dashboardStatistics);
router.get('/', protectRoute, getTasks);
router.get('/:id', protectRoute, getTask);

router.put('/create-subtask/:id', protectRoute, isAdminRoute, createSubTask);
router.get('/get-subtask/:id', protectRoute, isAdminRoute, getAllSubTask);
router.put('/update/:id', protectRoute, isAdminRoute, updateTask);
router.put('/:id', protectRoute, isAdminRoute, trashTask);

router.delete(
    '/delete-restore/:id?',
    protectRoute,
    isAdminRoute,
    deleteRestoreTask
);

export default router;
