import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createTask = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, team, stage, date, priority, assets } = req.body;

        let text = 'New task has been assigned to you';
        if (team?.length > 1) {
            text = text + ` and ${team.length - 1} others.`;
        }

        text += ` The task priority is set to ${priority} priority, so check and act accordingly. The task date is ${new Date(
            date
        ).toDateString()}. Thank you!!!`;

        // Create the task
        const task = await prisma.task.create({
            data: {
                title,
                team: {
                    connect: team.map((userId) => ({ id: userId })),
                },
                stage: stage.toLowerCase(),
                date: new Date(date),
                priority: priority.toLowerCase(),
                assets,
                activities: {
                    create: {
                        type: 'assigned',
                        activity: text,
                        by: { connect: { id: userId } },
                    },
                },
            },
            include: {
                activities: true,
            },
        });

        // Create the notice for the task
        const notice = await prisma.notice.create({
            data: {
                text,
                task: { connect: { id: task.id } },
            },
        });

        // Create NoticeIsRead entries for each team member
        await Promise.all(
            team.map((userId) => {
                return prisma.noticeIsRead.create({
                    data: {
                        notice: { connect: { id: notice.id } },
                        user: { connect: { id: userId } },
                    },
                });
            })
        );

        res.status(200).json({
            status: true,
            task,
            message: 'Task created successfully.',
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ status: false, message: error.message });
    }
};

export const duplicateTask = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await prisma.task.findUnique({
            where: { id },
            include: {
                subTasks: true,
                team: true,
                activities: true,
                assets: true,
            },
        });

        if (!task) {
            return res
                .status(404)
                .json({ status: false, message: 'Task not found' });
        }

        const newTask = await prisma.task.create({
            data: {
                title: `${task.title} - Duplicate`,
                team: { connect: task.team.map((user) => ({ id: user.id })) },
                subTasks: {
                    create: task.subTasks.map((subTask) => ({ ...subTask })),
                },
                assets: task.assets,
                priority: task.priority,
                stage: task.stage,
                activities: {
                    create: task.activities.map((activity) => ({
                        ...activity,
                    })),
                },
                date: task.date,
            },
        });

        let text = 'New task has been assigned to you';
        if (task.team.length > 1) {
            text += ` and ${task.team.length - 1} others.`;
        }

        text += ` The task priority is set to ${
            task.priority
        } priority, so check and act accordingly. The task date is ${task.date.toDateString()}. Thank you!!!`;

        await prisma.notice.create({
            data: {
                team: { connect: task.team.map((user) => ({ id: user.id })) },
                text,
                task: { connect: { id: newTask.id } },
            },
        });

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
        const { type, activity } = req.body;

        const task = await prisma.task.findUnique({ where: { id } });

        if (!task) {
            return res
                .status(404)
                .json({ status: false, message: 'Task not found' });
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

        const tasks = await prisma.task.findMany({
            where: {
                isTrashed: isTrashed === 'true',
                ...(stage && { stage }),
            },
            include: {
                team: { select: { name: true, title: true, email: true } },
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
                        name: true,
                        title: true,
                        role: true,
                        email: true,
                    },
                },
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
        const { id } = req.params;

        const task = await prisma.task.findUnique({ where: { id } });

        if (!task) {
            return res
                .status(404)
                .json({ status: false, message: 'Task not found' });
        }

        await prisma.subTask.create({
            data: {
                title,
                date: new Date(date),
                tag,
                task: { connect: { id: task.id } },
            },
        });

        res.status(200).json({
            status: true,
            message: 'SubTask added successfully.',
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

        const task = await prisma.task.findUnique({ where: { id } });

        if (!task) {
            return res
                .status(404)
                .json({ status: false, message: 'Task not found' });
        }

        const updatedTask = await prisma.task.update({
            where: { id },
            data: {
                title,
                date: new Date(date),
                priority: priority.toLowerCase(),
                assets,
                stage: stage.toLowerCase(),
                team: { set: team.map((userId) => ({ id: userId })) },
            },
        });

        res.status(200).json({
            status: true,
            message: 'Task updated successfully.',
            task: updatedTask,
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ status: false, message: error.message });
    }
};

export const trashTask = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await prisma.task.update({
            where: { id },
            data: { isTrashed: true },
        });

        res.status(200).json({
            status: true,
            message: `Task trashed successfully.`,
            task,
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
