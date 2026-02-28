import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import prisma from '../utils/prismClient';
import { isValidUUID } from '../utils/helper';
import { MetricType, Role } from '@prisma/client';
import { validateHealthMetric, calculateBMI } from '../utils/healthMetricValidation';
import { isMetricAbnormal, getMetricStatus } from '../utils/healthMetricRanges';

// Helper function to check patient access
async function checkPatientAccess(userId: string, userRole: Role, patientId: string): Promise<boolean> {
  if (userRole === Role.ADMIN) return true;
  
  if (userRole === Role.PATIENT) {
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    return patient?.userId === userId;
  }
  
  if (userRole === Role.DOCTOR) {
    // Check if doctor has any appointments with this patient
    const doctor = await prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) return false;
    
    const appointment = await prisma.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        patientId: patientId,
      },
    });
    return !!appointment;
  }
  
  return false;
}

// POST - Create a new health metric
export const createHealthMetric = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { patientId } = req.params as { patientId: string };
    const { metricType, value, unit, recordedAt, notes } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Validate patient ID
    if (!patientId || !isValidUUID(patientId)) {
      throw new AppError('Invalid Patient ID', 400);
    }

    // Check if patient exists
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    // Check access permissions
    const hasAccess = await checkPatientAccess(userId!, userRole!, patientId);
    if (!hasAccess) {
      throw new AppError('Unauthorized to add metrics for this patient', 403);
    }

    // Validate input
    const validation = validateHealthMetric({ metricType, value, unit, recordedAt, notes });
    if (!validation.isValid) {
      throw new AppError(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`, 400);
    }

    // Check if metric is abnormal
    const abnormal = isMetricAbnormal(metricType, value);

    // Create the metric
    const metric = await prisma.patientHealthMetric.create({
      data: {
        patientId,
        metricType,
        value,
        unit,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        recordedBy: userId,
        notes,
        isAbnormal: abnormal,
      },
      include: {
        recordedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // Auto-calculate BMI if weight and height are available
    if (metricType === MetricType.WEIGHT || metricType === MetricType.HEIGHT) {
      await autoCalculateBMI(patientId);
    }

    return res.status(201).json(
      new ApiResponse(201, metric, `Health metric created successfully. Status: ${getMetricStatus(metricType, value)}`)
    );
  } catch (error) {
    return next(error);
  }
};

// Helper function to auto-calculate BMI
async function autoCalculateBMI(patientId: string): Promise<void> {
  // Get latest weight and height
  const latestWeight = await prisma.patientHealthMetric.findFirst({
    where: { patientId, metricType: MetricType.WEIGHT },
    orderBy: { recordedAt: 'desc' },
  });

  const latestHeight = await prisma.patientHealthMetric.findFirst({
    where: { patientId, metricType: MetricType.HEIGHT },
    orderBy: { recordedAt: 'desc' },
  });

  if (latestWeight && latestHeight) {
    const bmi = calculateBMI(latestWeight.value, latestHeight.value);
    const abnormal = isMetricAbnormal(MetricType.BMI, bmi);

    await prisma.patientHealthMetric.create({
      data: {
        patientId,
        metricType: MetricType.BMI,
        value: bmi,
        unit: 'kg/m²',
        recordedBy: latestWeight.recordedBy,
        notes: 'Auto-calculated from weight and height',
        isAbnormal: abnormal,
      },
    });
  }
}

// GET - Get all health metrics for a patient
export const getHealthMetrics = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { patientId } = req.params as { patientId: string };
    const { metricType, startDate, endDate, limit = '100', offset = '0', abnormalOnly } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Validate patient ID
    if (!patientId || !isValidUUID(patientId)) {
      throw new AppError('Invalid Patient ID', 400);
    }

    // Check access permissions
    const hasAccess = await checkPatientAccess(userId!, userRole!, patientId);
    if (!hasAccess) {
      throw new AppError('Unauthorized to view metrics for this patient', 403);
    }

    // Build where clause
    const where: any = { patientId };

    if (metricType) {
      if (Array.isArray(metricType)) {
        where.metricType = { in: metricType };
      } else {
        where.metricType = metricType;
      }
    }

    if (startDate || endDate) {
      where.recordedAt = {};
      if (startDate) where.recordedAt.gte = new Date(startDate as string);
      if (endDate) where.recordedAt.lte = new Date(endDate as string);
    }

    if (abnormalOnly === 'true') {
      where.isAbnormal = true;
    }

    // Get total count
    const total = await prisma.patientHealthMetric.count({ where });

    // Get metrics with pagination
    const metrics = await prisma.patientHealthMetric.findMany({
      where,
      include: {
        recordedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    return res.status(200).json(
      new ApiResponse(200, {
        metrics,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: total > parseInt(offset as string) + parseInt(limit as string),
        },
      })
    );
  } catch (error) {
    return next(error);
  }
};

// GET - Get trend analysis
export const getMetricTrends = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { patientId } = req.params as { patientId: string };
    const { metricTypes, period = '30d' } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Validate patient ID
    if (!patientId || !isValidUUID(patientId)) {
      throw new AppError('Invalid Patient ID', 400);
    }

    // Check access permissions
    const hasAccess = await checkPatientAccess(userId!, userRole!, patientId);
    if (!hasAccess) {
      throw new AppError('Unauthorized to view metrics for this patient', 403);
    }

    // Parse metric types
    const types = Array.isArray(metricTypes) ? metricTypes : [metricTypes];
    if (!types || types.length === 0) {
      throw new AppError('At least one metric type is required', 400);
    }

    // Calculate date range based on period
    const periodMap: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '180d': 180,
      '1y': 365,
    };

    const days = periodMap[period as string] || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get metrics for each type
    const trends: Record<string, any> = {};

    for (const metricType of types) {
      const metrics = await prisma.patientHealthMetric.findMany({
        where: {
          patientId,
          metricType: metricType as MetricType,
          recordedAt: { gte: startDate },
        },
        orderBy: { recordedAt: 'asc' },
        select: {
          value: true,
          recordedAt: true,
        },
      });

      if (metrics.length === 0) {
        trends[metricType as string] = null;
        continue;
      }

      // Calculate statistics
      const values = metrics.map(m => m.value);
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const latest = values[values.length - 1];
      const first = values[0];

      // Calculate trend
      const percentageChange = first !== 0 ? ((latest - first) / first) * 100 : 0;
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (Math.abs(percentageChange) > 5) {
        trend = percentageChange > 0 ? 'increasing' : 'decreasing';
      }

      trends[metricType as string] = {
        average: Math.round(average * 100) / 100,
        min,
        max,
        latest,
        trend,
        percentageChange: Math.round(percentageChange * 100) / 100,
        dataPoints: metrics.map(m => ({
          date: m.recordedAt.toISOString(),
          value: m.value,
        })),
      };
    }

    return res.status(200).json(new ApiResponse(200, trends));
  } catch (error) {
    return next(error);
  }
};

// GET - Get latest metrics
export const getLatestMetrics = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { patientId } = req.params as { patientId: string };
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Validate patient ID
    if (!patientId || !isValidUUID(patientId)) {
      throw new AppError('Invalid Patient ID', 400);
    }

    // Check access permissions
    const hasAccess = await checkPatientAccess(userId!, userRole!, patientId);
    if (!hasAccess) {
      throw new AppError('Unauthorized to view metrics for this patient', 403);
    }

    // Get latest metric for each type
    const metricTypes = Object.values(MetricType);
    const latestMetrics: Record<string, any> = {};

    for (const metricType of metricTypes) {
      const metric = await prisma.patientHealthMetric.findFirst({
        where: { patientId, metricType },
        orderBy: { recordedAt: 'desc' },
        include: {
          recordedByUser: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });

      if (metric) {
        latestMetrics[metricType] = metric;
      }
    }

    return res.status(200).json(new ApiResponse(200, latestMetrics));
  } catch (error) {
    return next(error);
  }
};

// GET - Get abnormal alerts
export const getAbnormalAlerts = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { patientId } = req.params as { patientId: string };
    const { period = '7d' } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Validate patient ID
    if (!patientId || !isValidUUID(patientId)) {
      throw new AppError('Invalid Patient ID', 400);
    }

    // Check access permissions (only doctors and admins can view alerts)
    if (userRole !== Role.DOCTOR && userRole !== Role.ADMIN) {
      throw new AppError('Unauthorized to view alerts', 403);
    }

    // Calculate date range
    const periodMap: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };

    const days = periodMap[period as string] || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get abnormal metrics
    const abnormalMetrics = await prisma.patientHealthMetric.findMany({
      where: {
        patientId,
        isAbnormal: true,
        recordedAt: { gte: startDate },
      },
      include: {
        recordedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
    });

    // Add severity to each metric
    const alertsWithSeverity = abnormalMetrics.map(metric => ({
      ...metric,
      severity: getMetricStatus(metric.metricType, metric.value),
    }));

    return res.status(200).json(new ApiResponse(200, alertsWithSeverity));
  } catch (error) {
    return next(error);
  }
};

// GET - Get specific health metric by ID
export const getHealthMetricById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { patientId, metricId } = req.params as { patientId: string; metricId: string };
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Validate IDs
    if (!patientId || !isValidUUID(patientId)) {
      throw new AppError('Invalid Patient ID', 400);
    }
    if (!metricId || !isValidUUID(metricId)) {
      throw new AppError('Invalid Metric ID', 400);
    }

    // Check access permissions
    const hasAccess = await checkPatientAccess(userId!, userRole!, patientId);
    if (!hasAccess) {
      throw new AppError('Unauthorized to view metrics for this patient', 403);
    }

    // Get metric
    const metric = await prisma.patientHealthMetric.findFirst({
      where: {
        id: metricId,
        patientId,
      },
      include: {
        recordedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!metric) {
      throw new AppError('Health metric not found', 404);
    }

    return res.status(200).json(new ApiResponse(200, metric));
  } catch (error) {
    return next(error);
  }
};

// PUT - Update health metric
export const updateHealthMetric = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { patientId, metricId } = req.params as { patientId: string; metricId: string };
    const { value, unit, recordedAt, notes } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Validate IDs
    if (!patientId || !isValidUUID(patientId)) {
      throw new AppError('Invalid Patient ID', 400);
    }
    if (!metricId || !isValidUUID(metricId)) {
      throw new AppError('Invalid Metric ID', 400);
    }

    // Get existing metric
    const existingMetric = await prisma.patientHealthMetric.findFirst({
      where: {
        id: metricId,
        patientId,
      },
    });

    if (!existingMetric) {
      throw new AppError('Health metric not found', 404);
    }

    // Check if user has permission to update (only recorder or admin)
    if (userRole !== Role.ADMIN && existingMetric.recordedBy !== userId) {
      throw new AppError('Unauthorized to update this metric', 403);
    }

    // Validate updated data
    const updateData: any = {};
    
    if (value !== undefined) {
      const validation = validateHealthMetric({
        metricType: existingMetric.metricType,
        value,
        unit: unit || existingMetric.unit,
      });
      if (!validation.isValid) {
        throw new AppError(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`, 400);
      }
      updateData.value = value;
      updateData.isAbnormal = isMetricAbnormal(existingMetric.metricType, value);
    }

    if (unit !== undefined) updateData.unit = unit;
    if (recordedAt !== undefined) updateData.recordedAt = new Date(recordedAt);
    if (notes !== undefined) updateData.notes = notes;

    // Update metric
    const updatedMetric = await prisma.patientHealthMetric.update({
      where: { id: metricId },
      data: updateData,
      include: {
        recordedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return res.status(200).json(new ApiResponse(200, updatedMetric, 'Health metric updated successfully'));
  } catch (error) {
    return next(error);
  }
};

// DELETE - Delete health metric
export const deleteHealthMetric = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { patientId, metricId } = req.params as { patientId: string; metricId: string };
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Validate IDs
    if (!patientId || !isValidUUID(patientId)) {
      throw new AppError('Invalid Patient ID', 400);
    }
    if (!metricId || !isValidUUID(metricId)) {
      throw new AppError('Invalid Metric ID', 400);
    }

    // Get existing metric
    const existingMetric = await prisma.patientHealthMetric.findFirst({
      where: {
        id: metricId,
        patientId,
      },
    });

    if (!existingMetric) {
      throw new AppError('Health metric not found', 404);
    }

    // Check if user has permission to delete (only recorder or admin)
    if (userRole !== Role.ADMIN && existingMetric.recordedBy !== userId) {
      throw new AppError('Unauthorized to delete this metric', 403);
    }

    // Delete metric
    await prisma.patientHealthMetric.delete({
      where: { id: metricId },
    });

    return res.status(200).json(new ApiResponse(200, null, 'Health metric deleted successfully'));
  } catch (error) {
    return next(error);
  }
};
