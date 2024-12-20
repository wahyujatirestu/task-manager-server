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
    searchTasks,
    getSuggestions,
} from '../controllers/taskController.js';
import { isAdminRoute, protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create', protectRoute, createTask);
router.post('/duplicate/:id', protectRoute, isAdminRoute, duplicateTask);
router.post('/activity/:id', protectRoute, postTaskActivity);

router.get('/dashboard', protectRoute, dashboardStatistics);
router.get('/', protectRoute, getTasks);
router.get('/:id', protectRoute, getTask);
router.get('/search', protectRoute, searchTasks);
router.get('/suggestions', protectRoute, getSuggestions);

router.put('/create-subtask/:id', protectRoute, createSubTask);
router.get('/get-subtask/:id', protectRoute, getAllSubTask);
router.put('/update/:id', protectRoute, updateTask);
router.put('/:id', protectRoute, isAdminRoute, trashTask);

router.delete(
    '/delete-restore/:id?',
    protectRoute,
    isAdminRoute,
    deleteRestoreTask
);

export default router;
