import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import prisma from "../utils/prismClient";
import { isValidUUID } from "../utils/helper";

const VALID_ROLES: string[] = [Role.PATIENT, Role.DOCTOR, Role.ADMIN];

const listAllUsers = async (req: Request, res: Response): Promise<any> => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
        const roleFilter = req.query.role as string | undefined;
        const skip = (page - 1) * limit;

        if (roleFilter && VALID_ROLES.indexOf(roleFilter) === -1) {
            res
                .status(400)
                .json(new ApiError(400, "Invalid role filter. Must be one of: PATIENT, DOCTOR, ADMIN"));
            return;
        }

        const where: any = {
            deletedAt: null,
        };

        if (roleFilter) {
            where.role = roleFilter as Role;
        }

        const [users, totalCount] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    profilePicture: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                    doctor: {
                        select: {
                            id: true,
                            specialty: true,
                            clinicLocation: true,
                            isVerified: true,
                        },
                    },
                    patient: {
                        select: {
                            id: true,
                            location: true,
                        },
                    },
                },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.user.count({ where }),
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        return res.status(200).json(
            new ApiResponse(200, {
                users,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                },
            }, "Users fetched successfully")
        );
    } catch (error) {
        return res
            .status(500)
            .json(new ApiError(500, "Failed to fetch users", [error]));
    }
};

const verifyDoctor = async (req: Request, res: Response): Promise<any> => {
    const doctorUserId = req.params.doctorUserId as string;

    if (!doctorUserId || !isValidUUID(doctorUserId)) {
        res.status(400).json(new ApiError(400, "Valid doctor user ID is required"));
        return;
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: doctorUserId, deletedAt: null },
            include: { doctor: true },
        });

        if (!user) {
            res.status(404).json(new ApiError(404, "User not found"));
            return;
        }

        if (user.role !== Role.DOCTOR || !user.doctor) {
            res.status(400).json(new ApiError(400, "User is not a doctor"));
            return;
        }

        if (user.doctor.isVerified) {
            res.status(400).json(new ApiError(400, "Doctor is already verified"));
            return;
        }

        const updatedDoctor = await prisma.doctor.update({
            where: { id: user.doctor.id },
            data: { isVerified: true },
            select: {
                id: true,
                specialty: true,
                clinicLocation: true,
                isVerified: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return res
            .status(200)
            .json(new ApiResponse(200, updatedDoctor, "Doctor verified successfully"));
    } catch (error) {
        return res
            .status(500)
            .json(new ApiError(500, "Failed to verify doctor", [error]));
    }
};

const getDashboardStats = async (
    req: Request,
    res: Response
): Promise<any> => {
    try {
        const [
            totalUsers,
            totalPatients,
            totalDoctors,
            totalAdmins,
            totalAppointments,
            pendingAppointments,
            completedAppointments,
            cancelledAppointments,
            totalReports,
            verifiedDoctors,
            unverifiedDoctors,
        ] = await Promise.all([
            prisma.user.count({ where: { deletedAt: null } }),
            prisma.user.count({ where: { role: Role.PATIENT, deletedAt: null } }),
            prisma.user.count({ where: { role: Role.DOCTOR, deletedAt: null } }),
            prisma.user.count({ where: { role: Role.ADMIN, deletedAt: null } }),
            prisma.appointment.count(),
            prisma.appointment.count({ where: { status: "PENDING" } }),
            prisma.appointment.count({ where: { status: "COMPLETED" } }),
            prisma.appointment.count({ where: { status: "CANCELLED" } }),
            prisma.report.count(),
            prisma.doctor.count({ where: { isVerified: true } }),
            prisma.doctor.count({ where: { isVerified: false } }),
        ]);

        const stats = {
            users: {
                total: totalUsers,
                patients: totalPatients,
                doctors: totalDoctors,
                admins: totalAdmins,
            },
            appointments: {
                total: totalAppointments,
                pending: pendingAppointments,
                completed: completedAppointments,
                cancelled: cancelledAppointments,
            },
            reports: {
                total: totalReports,
            },
            doctors: {
                verified: verifiedDoctors,
                unverified: unverifiedDoctors,
            },
        };

        return res
            .status(200)
            .json(new ApiResponse(200, stats, "Dashboard statistics fetched successfully"));
    } catch (error) {
        return res
            .status(500)
            .json(new ApiError(500, "Failed to fetch dashboard statistics", [error]));
    }
};

const softDeleteUser = async (req: Request, res: Response): Promise<any> => {
    const userId = req.params.userId as string;
    const adminUserId = (req as any).user?.id;

    if (!userId || !isValidUUID(userId)) {
        res.status(400).json(new ApiError(400, "Valid user ID is required"));
        return;
    }

    if (userId === adminUserId) {
        res.status(400).json(new ApiError(400, "Cannot delete your own account"));
        return;
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            res.status(404).json(new ApiError(404, "User not found"));
            return;
        }

        if (user.deletedAt) {
            res.status(400).json(new ApiError(400, "User is already deleted"));
            return;
        }

        const deletedUser = await prisma.user.update({
            where: { id: userId },
            data: { deletedAt: new Date() },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                deletedAt: true,
            },
        });

        return res
            .status(200)
            .json(new ApiResponse(200, deletedUser, "User soft deleted successfully"));
    } catch (error) {
        return res
            .status(500)
            .json(new ApiError(500, "Failed to delete user", [error]));
    }
};

const changeUserRole = async (req: Request, res: Response): Promise<any> => {
    const userId = req.params.userId as string;
    const { role, specialty, clinicLocation, location } = req.body;
    const adminUserId = (req as any).user?.id;

    if (!userId || !isValidUUID(userId)) {
        res.status(400).json(new ApiError(400, "Valid user ID is required"));
        return;
    }

    if (!role || VALID_ROLES.indexOf(role) === -1) {
        res
            .status(400)
            .json(new ApiError(400, "Invalid role. Must be one of: PATIENT, DOCTOR, ADMIN"));
        return;
    }

    if (userId === adminUserId) {
        res.status(400).json(new ApiError(400, "Cannot change your own role"));
        return;
    }

    if (role === Role.DOCTOR) {
        if (!specialty || !clinicLocation || specialty.trim() === "" || clinicLocation.trim() === "") {
            res.status(400).json(
                new ApiError(400, "specialty and clinicLocation are required when changing role to DOCTOR")
            );
            return;
        }
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId, deletedAt: null },
            include: { doctor: true, patient: true, admin: true },
        });

        if (!user) {
            res.status(404).json(new ApiError(404, "User not found"));
            return;
        }

        if (user.role === role) {
            res.status(400).json(new ApiError(400, "User already has the role " + role));
            return;
        }

        const updatedUser = await prisma.$transaction(async (tx) => {

            const updated = await tx.user.update({
                where: { id: userId },
                data: { role: role as Role },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                },
            });

            if (role === Role.DOCTOR && !user.doctor) {
                await tx.doctor.create({
                    data: {
                        userId: user.id,
                        specialty,
                        clinicLocation,
                    },
                });
            } else if (role === Role.PATIENT && !user.patient) {
                await tx.patient.create({
                    data: {
                        userId: user.id,
                        location: location || null,
                    },
                });
            } else if (role === Role.ADMIN && !user.admin) {
                await tx.admin.create({
                    data: {
                        userId: user.id,
                        permissions: {
                            canManageUsers: true,
                            canManageDoctors: true,
                            canManagePatients: true,
                            canViewAnalytics: true,
                            canManageSystem: true,
                        },
                    },
                });
            }

            return updated;
        });

        return res
            .status(200)
            .json(new ApiResponse(200, updatedUser, "User role updated successfully"));
    } catch (error) {
        return res
            .status(500)
            .json(new ApiError(500, "Failed to change user role", [error]));
    }
};

export {
    listAllUsers,
    verifyDoctor,
    getDashboardStats,
    softDeleteUser,
    changeUserRole,
};
