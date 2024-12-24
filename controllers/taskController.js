import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createTask = async (req, res) => {
    try {
        const userId = req.user.id; // ID dari user saat ini
        const { title, stage, date, priority, assets, groupId } = req.body;

        // Validasi input
        if (!title) {
            return res.status(400).json({
                status: false,
                message: 'Task title is required.',
            });
        }

        const validStage =
            stage?.toUpperCase() === 'IN-PROGRESS'
                ? 'IN_PROGRESS'
                : stage?.toUpperCase();

        if (!['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(validStage)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid stage value.',
            });
        }

        // Data dasar untuk task
        const taskData = {
            title,
            stage: validStage,
            date: date ? new Date(date) : new Date(),
            priority: priority ? priority.toUpperCase() : 'NORMAL',
            assets,
            team: { connect: [{ id: userId }] }, // Default: hanya pembuat
        };

        let assignedTeam = [{ id: userId }];

        if (groupId) {
            // Jika tugas dibuat untuk grup
            const group = await prisma.group.findUnique({
                where: { id: groupId },
                include: { members: true, admin: true },
            });

            if (!group) {
                return res.status(404).json({
                    status: false,
                    message: 'Group not found.',
                });
            }

            // Pastikan pembuat adalah anggota grup
            const isMember = group.members.some(
                (member) => member.userId === userId
            );
            if (!isMember && group.adminId !== userId) {
                return res.status(403).json({
                    status: false,
                    message:
                        'You are not authorized to create tasks in this group.',
                });
            }

            taskData.groupId = groupId;

            // Hanya admin yang bisa menetapkan anggota tim
            if (group.adminId === userId) {
                assignedTeam = group.members.map((member) => ({
                    id: member.userId,
                }));
                taskData.team = {
                    connect: assignedTeam,
                };
            }
        }

        const task = await prisma.task.create({
            data: taskData,
            include: { team: true, group: true },
        });

        // Kirim notifikasi kepada semua anggota tim
        await Promise.all(
            assignedTeam.map(async (member) => {
                await prisma.notice.create({
                    data: {
                        text: `You have been assigned a new task: "${task.title}"`,
                        notiType: 'TaskAssigned',
                        task: { connect: { id: task.id } },
                        isRead: {
                            create: {
                                user: { connect: { id: member.id } },
                            },
                        },
                    },
                });
            })
        );

        res.status(201).json({
            status: true,
            task,
            message: 'Task created successfully, and notifications sent.',
        });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error.',
        });
    }
};

export const duplicateTask = async (req, res) => {
    try {
        const { id } = req.params;

        // Temukan tugas asli
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

        // Proses duplikasi tugas
        const newTask = await prisma.task.create({
            data: {
                title: `${task.title} - Duplicate`,
                team: { connect: task.team.map((user) => ({ id: user.id })) },
                subTasks: {
                    create: task.subTasks.map((subTask) => ({
                        title: subTask.title,
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

        // Tambahkan aktivitas baru ke tugas duplikasi
        await prisma.activity.createMany({
            data: task.activities.map((activity) => ({
                type: activity.type,
                activity: activity.activity,
                date: activity.date,
                taskId: newTask.id,
                byId: activity.byId,
            })),
        });

        res.status(200).json({
            status: true,
            message: 'Task duplicated successfully.',
            data: newTask,
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

        // Check if type matches the allowed Prisma enums
        const validTypes = [
            'Assigned',
            'Started',
            'IN_PROGRESS',
            'Bug',
            'Completed',
            'Commented',
        ];
        if (!validTypes.includes(type)) {
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

        // Ambil semua task yang dimiliki user (baik individu maupun dari grup)
        const allTasks = await prisma.task.findMany({
            where: {
                OR: [
                    { team: { some: { id: userId } } }, // Tugas di mana user adalah anggota tim
                    { group: { members: { some: { userId } } } }, // Tugas dari grup di mana user adalah anggota
                ],
                isTrashed: false,
            },
            include: {
                group: {
                    select: {
                        name: true, // Ambil nama grup untuk ditampilkan sebagai "team"
                    },
                },
                team: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                subTasks: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // Kelompokkan task berdasarkan stage
        const groupTasks = allTasks.reduce((result, task) => {
            const stage = task.stage;
            result[stage] = (result[stage] || 0) + 1;
            return result;
        }, {});

        // Kelompokkan task berdasarkan priority untuk grafik
        const groupData = Object.entries(
            allTasks.reduce((result, task) => {
                const { priority } = task;
                result[priority] = (result[priority] || 0) + 1;
                return result;
            }, {})
        ).map(([name, total]) => ({ name, total }));

        // Ambil hanya 10 tugas terbaru untuk tabel
        const last10Task = allTasks.slice(0, 10).map((task) => ({
            ...task,
            team: task.group ? task.group.name : null, // Nama grup sebagai "team" jika ada
        }));

        const summary = {
            totalTasks: allTasks.length,
            tasks: groupTasks,
            graphData: groupData,
            last10Task, // Tugas terbaru untuk tabel
        };

        res.status(200).json({
            status: true,
            message: 'Successfully fetched dashboard statistics.',
            data: summary,
        });
    } catch (error) {
        console.error('Error in dashboardStatistics:', error.message);
        res.status(500).json({ status: false, message: error.message });
    }
};

export const getTasks = async (req, res) => {
    try {
        const userId = req.user.id; // Ambil user ID dari token
        const { stage, isTrashed } = req.query;

        // Konversi stage ke enum yang valid
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

        const prismaStage = mapStageToEnum(stage);

        // Query task berdasarkan user dan filter
        const tasks = await prisma.task.findMany({
            where: {
                isTrashed: isTrashed === 'true',
                ...(prismaStage && { stage: prismaStage }),
                team: {
                    some: {
                        id: userId, // Pastikan hanya task yang melibatkan user
                    },
                },
            },
            include: {
                team: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                subTasks: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        res.status(200).json({
            status: true,
            message: 'Tasks fetched successfully.',
            tasks,
        });
    } catch (error) {
        console.error('Error in getTasks:', error.message);
        return res.status(500).json({ status: false, message: error.message });
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
                        email: true,
                        memberGroups: {
                            select: {
                                role: true, // Ambil role dari GroupMember
                                group: {
                                    select: {
                                        name: true, // Ambil nama grup jika diperlukan
                                    },
                                },
                            },
                        },
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

export const searchTasks = async (req, res) => {
    try {
        const { query } = req.query; // Ambil query dari parameter request

        // Validasi input
        if (!query) {
            console.log('No search query provided');
            return res.status(400).json({
                status: false,
                message: 'Search query is required.',
            });
        }

        console.log('Search query received:', query); // Log input query

        // Cari tugas berdasarkan query
        const tasks = await prisma.task.findMany({
            where: {
                title: {
                    contains: query, // Bersihkan spasi
                    mode: 'insensitive', // Case-insensitive search
                },
            },
            select: { id: true, title: true },
            take: 5,
        });

        console.log('Tasks found:', tasks); // Log hasil pencarian

        if (tasks.length === 0) {
            console.log('No tasks match the search query');
            return res.status(404).json({
                status: false,
                message: 'No tasks found matching the query.',
            });
        }

        res.status(200).json({
            status: true,
            tasks,
        });
    } catch (error) {
        console.error('Error searching tasks:', error.message);
        return res.status(500).json({ status: false, message: error.message });
    }
};

export const getSuggestions = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res
                .status(400)
                .json({ status: false, message: 'Query is required' });
        }

        const tasks = await prisma.task.findMany({
            where: {
                title: {
                    contains: query,
                    mode: 'insensitive',
                },
            },
            select: {
                id: true,
                title: true,
                priority: true,
                stage: true,
            },
            take: 10,
        });

        res.status(200).json({ status: true, tasks });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: error.message });
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
        const { id } = req.params; // ID task
        const { title, date, stage, priority, assets, assignee } = req.body;
        const userId = req.user.id; // ID user dari token

        // Cek apakah task ada di database
        const task = await prisma.task.findUnique({
            where: { id },
            include: { team: true },
        });

        if (!task) {
            return res.status(404).json({
                status: false,
                message: 'Task not found.',
            });
        }

        // Cek apakah user adalah admin grup jika task ini milik grup
        if (task.groupId) {
            const isAdmin = await prisma.group.findFirst({
                where: { id: task.groupId, adminId: userId },
            });

            if (!isAdmin) {
                return res.status(403).json({
                    status: false,
                    message: 'Only group admins can update tasks.',
                });
            }
        } else {
            // Jika bukan task grup, cek apakah user adalah pemilik task
            const isOwner = task.team.some((member) => member.id === userId);

            if (!isOwner) {
                return res.status(403).json({
                    status: false,
                    message: 'You can only update your own tasks.',
                });
            }
        }

        // Validasi stage
        const validStage =
            stage?.toUpperCase() === 'IN-PROGRESS'
                ? 'IN_PROGRESS'
                : stage?.toUpperCase();
        if (
            stage &&
            !['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(validStage)
        ) {
            return res.status(400).json({
                status: false,
                message: `Invalid stage value: ${stage}`,
            });
        }

        // Update task dengan data baru
        const updatedTask = await prisma.task.update({
            where: { id },
            data: {
                ...(title && { title }),
                ...(date && { date: new Date(date) }),
                ...(priority && { priority: priority.toUpperCase() }),
                ...(assets && { assets }),
                ...(stage && { stage: validStage }),
                ...(assignee && {
                    team: {
                        set: assignee.map((userId) => ({ id: userId })), // Ganti tim yang lama dengan tim baru
                    },
                }),
            },
            include: { team: true }, // Sertakan informasi tim yang diperbarui
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
        const { id } = req.params; // Task ID (optional for deleteAll/restoreAll)
        const { actionType } = req.query; // Action type (delete, deleteAll, restore, restoreAll)

        if (actionType === 'delete') {
            // Handle deleting a single task
            const task = await prisma.task.findUnique({ where: { id } });

            if (!task) {
                return res
                    .status(404)
                    .json({ status: false, message: 'Task not found' });
            }

            // Delete related activities and subtasks
            await prisma.activity.deleteMany({ where: { taskId: id } });
            await prisma.subTask.deleteMany({ where: { taskId: id } });

            // Delete the task
            await prisma.task.delete({ where: { id } });
        } else if (actionType === 'deleteAll') {
            // Handle deleting all trashed tasks
            const trashedTasks = await prisma.task.findMany({
                where: { isTrashed: true },
            });

            if (trashedTasks.length === 0) {
                return res
                    .status(404)
                    .json({ status: false, message: 'No tasks in the trash' });
            }

            // Delete related activities and subtasks
            await prisma.activity.deleteMany({
                where: { taskId: { in: trashedTasks.map((task) => task.id) } },
            });
            await prisma.subTask.deleteMany({
                where: { taskId: { in: trashedTasks.map((task) => task.id) } },
            });

            // Delete all trashed tasks
            await prisma.task.deleteMany({ where: { isTrashed: true } });
        } else if (actionType === 'restore') {
            // Handle restoring a single task
            const task = await prisma.task.findUnique({ where: { id } });

            if (!task) {
                return res
                    .status(404)
                    .json({ status: false, message: 'Task not found' });
            }

            await prisma.task.update({
                where: { id },
                data: { isTrashed: false },
            });
        } else if (actionType === 'restoreAll') {
            // Handle restoring all trashed tasks
            const trashedTasks = await prisma.task.findMany({
                where: { isTrashed: true },
            });

            if (trashedTasks.length === 0) {
                return res
                    .status(404)
                    .json({ status: false, message: 'No tasks in the trash' });
            }

            // Restore all trashed tasks
            await prisma.task.updateMany({
                where: { isTrashed: true },
                data: { isTrashed: false },
            });
        } else {
            return res.status(400).json({
                status: false,
                message: 'Invalid action type',
            });
        }

        res.status(200).json({
            status: true,
            message: `Operation performed successfully.`,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: error.message });
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
