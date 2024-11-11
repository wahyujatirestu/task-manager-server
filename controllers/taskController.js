import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createTask = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, team, stage, date, priority, assets } = req.body;

        // Normalize and validate stage input
        const validStage =
            stage?.toUpperCase() === 'IN-PROGRESS'
                ? 'IN_PROGRESS'
                : stage?.toUpperCase();

        if (!['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(validStage)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid stage value',
            });
        }

        const task = await prisma.task.create({
            data: {
                title,
                team: { connect: team.map((userId) => ({ id: userId })) },
                stage: validStage,
                date: new Date(date),
                priority: priority.toUpperCase(),
                assets,
                activities: {
                    create: {
                        type: 'Assigned',
                        activity: `New task assigned: ${title}`,
                        by: { connect: { id: userId } },
                    },
                },
            },
            include: { activities: true },
        });

        res.status(200).json({
            status: true,
            task,
            message: 'Task created successfully.',
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: false, message: error.message });
    }
};

export const duplicateTask = async (req, res) => {
    try {
        const { id } = req.params;

        // Find the original task by ID
        const task = await prisma.task.findUnique({
            where: { id },
            include: {
                subTasks: true,
                team: true,
                activities: true,
            },
        });

        if (!task) {
            return res
                .status(404)
                .json({ status: false, message: 'Task not found' });
        }

        // Create a new task (duplicate) without including activities and notices initially
        const newTask = await prisma.task.create({
            data: {
                title: `${task.title} - Duplicate`,
                team: { connect: task.team.map((user) => ({ id: user.id })) },
                subTasks: {
                    create: task.subTasks.map((subTask) => ({
                        title: subTask.title, // Ensure to include the title and other fields
                        date: subTask.date,
                        tag: subTask.tag,
                    })),
                },
                assets: task.assets,
                priority: task.priority,
                stage: task.stage,
                date: task.date,
            },
        });

        // Create activities for the new task, including the correct field for the user who performed the activity
        await prisma.activity.createMany({
            data: task.activities.map((activity) => ({
                type: activity.type, // Ensure to include the type
                activity: activity.activity,
                date: activity.date,
                taskId: newTask.id, // Use the new task ID
                byId: activity.byId, // Correctly reference the byId field
            })),
        });

        // Create text notice for the team
        let text = 'New task has been assigned to you';
        if (task.team.length > 1) {
            text += ` and ${task.team.length - 1} others.`;
        }

        text += ` The task priority is set to ${
            task.priority
        } priority, so check and act accordingly. The task date is ${task.date.toDateString()}. Thank you!!!`;

        // Create notice for the new task
        const notice = await prisma.notice.create({
            data: {
                text,
                task: { connect: { id: newTask.id } },
            },
        });

        // Create NoticeIsRead entries for each team member
        await Promise.all(
            task.team.map((user) =>
                prisma.noticeIsRead.create({
                    data: {
                        notice: { connect: { id: notice.id } },
                        user: { connect: { id: user.id } },
                    },
                })
            )
        );

        // Successful response
        res.status(200).json({
            status: true,
            message: 'Task duplicated successfully.',
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ status: false, message: error.message });
    }
};

export const postTaskActivity = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        let { type, activity } = req.body;

        // Enum mapping to handle case-insensitive matching
        const enumMapping = {
            assigned: 'Assigned',
            started: 'Started',
            'in progress': 'IN_PROGRESS',
            bug: 'Bug',
            completed: 'Completed',
            commented: 'Commented',
        };

        // Normalize the type to match enum values
        type = enumMapping[type.toLowerCase()];
        if (!type) {
            return res
                .status(400)
                .json({ status: false, message: 'Invalid activity type.' });
        }

        const task = await prisma.task.findUnique({ where: { id } });

        if (!task) {
            return res.status(404).json({
                status: false,
                message: `Task with ID ${id} not found`,
            });
        }

        await prisma.activity.create({
            data: {
                type,
                activity,
                by: { connect: { id: userId } },
                task: { connect: { id: task.id } },
            },
        });

        res.status(200).json({
            status: true,
            message: 'Activity posted successfully.',
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ status: false, message: error.message });
    }
};

export const dashboardStatistics = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.isAdmin;

        if (!userId) {
            return res.status(401).json({
                status: false,
                message: 'Unauthorized: User ID is missing.',
            });
        }

        const allTasks = await prisma.task.findMany({
            where: {
                isTrashed: false,
                ...(isAdmin ? {} : { team: { some: { id: userId } } }),
            },
            include: {
                team: {
                    select: {
                        name: true,
                        role: true,
                        title: true,
                        email: true,
                    },
                },
                subTasks: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const users = isAdmin
            ? await prisma.user.findMany({
                  where: { isActive: true },
                  select: {
                      id: true,
                      name: true,
                      title: true,
                      role: true,
                      isAdmin: true,
                      createdAt: true,
                  },
                  take: 10,
                  orderBy: { createdAt: 'desc' },
              })
            : [];

        const groupTasks = allTasks.reduce((result, task) => {
            const stage = task.stage;
            result[stage] = (result[stage] || 0) + 1;
            return result;
        }, {});

        const groupData = Object.entries(
            allTasks.reduce((result, task) => {
                const { priority } = task;
                result[priority] = (result[priority] || 0) + 1;
                return result;
            }, {})
        ).map(([name, total]) => ({ name, total }));

        const totalTasks = allTasks.length;
        const last10Task = allTasks.slice(0, 10);

        const summary = {
            totalTasks,
            last10Task,
            users,
            tasks: groupTasks,
            graphData: groupData,
        };
        console.log(summary);

        res.status(200).json({
            status: true,
            message: 'Successfully fetched dashboard statistics.',
            data: summary,
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ status: false, message: error.message });
    }
};

export const getTasks = async (req, res) => {
    try {
        const { stage, isTrashed } = req.query;

        const mapStageToEnum = (stage) => {
            switch (stage?.toLowerCase()) {
                case 'todo':
                    return 'TODO';
                case 'in_progress':
                    return 'IN_PROGRESS';
                case 'completed':
                    return 'COMPLETED';
                default:
                    return undefined;
            }
        };

        const prismaStage = mapStageToEnum(stage); // Convert to enum

        const tasks = await prisma.task.findMany({
            where: {
                isTrashed: isTrashed === 'true',
                ...(prismaStage && { stage: prismaStage }), // Apply only if stage is valid
            },
            include: {
                team: {
                    select: { id: true, name: true, title: true, email: true },
                },
                subTasks: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        res.status(200).json({ status: true, tasks });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ status: false, message: error.message });
    }
};

export const getTask = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await prisma.task.findUnique({
            where: { id },
            include: {
                team: {
                    select: {
                        id: true,
                        name: true,
                        title: true,
                        role: true,
                        email: true,
                    },
                },
                subTasks: true,
                activities: {
                    include: { by: { select: { name: true } } },
                },
            },
        });

        if (!task) {
            return res
                .status(404)
                .json({ status: false, message: 'Task not found' });
        }

        res.status(200).json({ status: true, task });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ status: false, message: error.message });
    }
};

export const createSubTask = async (req, res) => {
    try {
        const { title, tag, date } = req.body;
        const { id } = req.params; // Pastikan ID task diambil dari req.params

        // Cek apakah ID task ada dan tidak undefined
        if (!id) {
            return res.status(400).json({
                status: false,
                message: 'Task ID is missing in the request parameters.',
            });
        }

        // Cek apakah task ada di database
        const task = await prisma.task.findUnique({ where: { id } });

        if (!task) {
            return res.status(404).json({
                status: false,
                message: `Task with ID ${id} not found`,
            });
        }

        // Buat subtask baru yang terhubung ke task
        const newSubTask = await prisma.subTask.create({
            data: {
                title,
                date: date ? new Date(date) : null, // Jika date tidak ada, gunakan null
                tag,
                task: { connect: { id } }, // Hubungkan subtask ke task dengan ID task yang benar
            },
        });

        // Kirim response sukses
        res.status(201).json({
            status: true,
            message: 'SubTask added successfully.',
            newSubTask,
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ status: false, message: error.message });
    }
};

export const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, date, team, stage, priority, assets } = req.body;

        // Normalize and validate stage input
        const validStage =
            stage?.toUpperCase() === 'IN-PROGRESS'
                ? 'IN_PROGRESS'
                : stage?.toUpperCase();
        if (!['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(validStage)) {
            return res.status(400).json({
                status: false,
                message: `Invalid stage value: ${stage}`,
            });
        }

        // Filter out any team members with undefined IDs
        const validTeam = team
            ? team.filter((user) => user?.id !== undefined)
            : [];

        // Update the task with the validated data
        const updatedTask = await prisma.task.update({
            where: { id },
            data: {
                title,
                date: new Date(date),
                priority: priority.toUpperCase(),
                assets,
                stage: validStage,
                team: {
                    // set: validTeam.map((user) => ({ id: user.id })), // Only include valid IDs
                    connect: validTeam.map((user) => ({ id: user.id })),
                    disconnect: [],
                },
            },
        });

        res.status(200).json({
            status: true,
            message: 'Task updated successfully.',
            task: updatedTask,
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: false, message: error.message });
    }
};

export const trashTask = async (req, res) => {
    try {
        const { id } = req.params;

        // Cek apakah task dengan id yang diberikan ada atau tidak
        const task = await prisma.task.findUnique({ where: { id } });
        if (!task) {
            return res
                .status(404)
                .json({ status: false, message: 'Task not found' });
        }

        // Jika task ada, maka lakukan update
        const updatedTask = await prisma.task.update({
            where: { id },
            data: { isTrashed: true },
        });

        res.status(200).json({
            status: true,
            message: `Task trashed successfully.`,
            task: updatedTask,
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ status: false, message: error.message });
    }
};

export const deleteRestoreTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { actionType } = req.query;

        // Check if the task exists before proceeding
        const task = await prisma.task.findUnique({
            where: { id },
        });

        if (!task) {
            return res
                .status(404)
                .json({ status: false, message: 'Task not found' });
        }

        if (actionType === 'delete') {
            await prisma.task.delete({
                where: { id },
            });
        } else if (actionType === 'deleteAll') {
            await prisma.task.deleteMany({
                where: { isTrashed: true },
            });
        } else if (actionType === 'restore') {
            await prisma.task.update({
                where: { id },
                data: { isTrashed: false },
            });
        } else if (actionType === 'restoreAll') {
            await prisma.task.updateMany({
                where: { isTrashed: true },
                data: { isTrashed: false },
            });
        }

        res.status(200).json({
            status: true,
            message: `Operation performed successfully.`,
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ status: false, message: error.message });
    }
};

export const getAllSubTask = async (req, res) => {
    try {
        const { id } = req.params; // Ambil ID task dari parameter request

        // Cek apakah ID task ada dan valid
        if (!id) {
            return res.status(400).json({
                status: false,
                message: 'Task ID is missing in the request parameters.',
            });
        }

        // Cek apakah task dengan ID tersebut ada di database
        const task = await prisma.task.findUnique({
            where: { id },
            include: {
                subTasks: true, // Ambil semua subtasks yang terkait dengan task ini
            },
        });

        if (!task) {
            return res.status(404).json({
                status: false,
                message: `Task with ID ${id} not found`,
            });
        }

        // Kirimkan subtasks yang terkait dengan task tersebut
        res.status(200).json({
            status: true,
            subTasks: task.subTasks, // Kirimkan array subTasks
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ status: false, message: error.message });
    }
};
