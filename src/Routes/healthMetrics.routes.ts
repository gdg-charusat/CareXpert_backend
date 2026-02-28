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
  createHealthMetric
);

// GET - Get all health metrics for a patient (with filters)
router.get(
  '/patient/:patientId/health-metrics',
  globalRateLimiter,
  getHealthMetrics
);

// GET - Get trend analysis for specific metrics
router.get(
  '/patient/:patientId/health-metrics/trends',
  globalRateLimiter,
  getMetricTrends
);

// GET - Get latest reading for each metric type
router.get(
  '/patient/:patientId/health-metrics/latest',
  globalRateLimiter,
  getLatestMetrics
);

// GET - Get abnormal metrics requiring attention
router.get(
  '/patient/:patientId/health-metrics/alerts',
  globalRateLimiter,
  getAbnormalAlerts
);

// GET - Get a specific health metric by ID
router.get(
  '/patient/:patientId/health-metrics/:metricId',
  globalRateLimiter,
  getHealthMetricById
);

// PUT - Update a health metric entry
router.put(
  '/patient/:patientId/health-metrics/:metricId',
  globalRateLimiter,
  updateHealthMetric
);

// DELETE - Delete a health metric entry
router.delete(
  '/patient/:patientId/health-metrics/:metricId',
  globalRateLimiter,
  deleteHealthMetric
);

export default router;
