-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('WEIGHT', 'HEIGHT', 'BMI', 'BLOOD_PRESSURE_SYSTOLIC', 'BLOOD_PRESSURE_DIASTOLIC', 'HEART_RATE', 'TEMPERATURE', 'OXYGEN_SATURATION', 'BLOOD_GLUCOSE_FASTING', 'BLOOD_GLUCOSE_RANDOM', 'HBA1C', 'CHOLESTEROL_TOTAL', 'CHOLESTEROL_LDL', 'CHOLESTEROL_HDL', 'TRIGLYCERIDES', 'RESPIRATORY_RATE', 'BLOOD_GLUCOSE_POST_MEAL');

-- CreateTable
CREATE TABLE "patient_health_metrics" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    "notes" TEXT,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_health_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_health_metrics_patientId_metricType_recordedAt_idx" ON "patient_health_metrics"("patientId", "metricType", "recordedAt");

-- CreateIndex
CREATE INDEX "patient_health_metrics_patientId_recordedAt_idx" ON "patient_health_metrics"("patientId", "recordedAt");

-- CreateIndex
CREATE INDEX "patient_health_metrics_isAbnormal_patientId_idx" ON "patient_health_metrics"("isAbnormal", "patientId");

-- AddForeignKey
ALTER TABLE "patient_health_metrics" ADD CONSTRAINT "patient_health_metrics_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_health_metrics" ADD CONSTRAINT "patient_health_metrics_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
