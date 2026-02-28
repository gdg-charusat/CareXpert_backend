import express from 'express';
import {
  createHealthMetric,
  getHealthMetrics,
  getMetricTrends,
  getLatestMetrics,
  getAbnormalAlerts,
  getHealthMetricById,
  updateHealthMetric,
  deleteHealthMetric,
} from '../controllers/healthMetrics.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { globalRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated);

// POST - Create a new health metric entry
router.post(
  '/patient/:patientId/health-metrics',
  globalRateLimiter,
  createHealthMetric as any
);

// GET - Get all health metrics for a patient (with filters)
router.get(
  '/patient/:patientId/health-metrics',
  globalRateLimiter,
  getHealthMetrics as any
);

// GET - Get trend analysis for specific metrics
router.get(
  '/patient/:patientId/health-metrics/trends',
  globalRateLimiter,
  getMetricTrends as any
);

// GET - Get latest reading for each metric type
router.get(
  '/patient/:patientId/health-metrics/latest',
  globalRateLimiter,
  getLatestMetrics as any
);

// GET - Get abnormal metrics requiring attention
router.get(
  '/patient/:patientId/health-metrics/alerts',
  globalRateLimiter,
  getAbnormalAlerts as any
);

// GET - Get a specific health metric by ID
router.get(
  '/patient/:patientId/health-metrics/:metricId',
  globalRateLimiter,
  getHealthMetricById as any
);

// PUT - Update a health metric entry
router.put(
  '/patient/:patientId/health-metrics/:metricId',
  globalRateLimiter,
  updateHealthMetric as any
);

// DELETE - Delete a health metric entry
router.delete(
  '/patient/:patientId/health-metrics/:metricId',
  globalRateLimiter,
  deleteHealthMetric as any
);

export default router;
