export interface MetricRange {
  min: number;
  max: number;
  unit: string;
  criticalMin?: number;
  criticalMax?: number;
}

export const NORMAL_RANGES: Record<string, MetricRange> = {
  BLOOD_PRESSURE_SYSTOLIC: { min: 90, max: 120, unit: 'mmHg', criticalMin: 90, criticalMax: 140 },
  BLOOD_PRESSURE_DIASTOLIC: { min: 60, max: 80, unit: 'mmHg', criticalMin: 60, criticalMax: 90 },
  HEART_RATE: { min: 60, max: 100, unit: 'bpm', criticalMin: 50, criticalMax: 120 },
  TEMPERATURE: { min: 36.1, max: 37.2, unit: '°C', criticalMin: 35, criticalMax: 38.5 },
  OXYGEN_SATURATION: { min: 95, max: 100, unit: '%', criticalMin: 90, criticalMax: 100 },
  BLOOD_GLUCOSE_FASTING: { min: 70, max: 100, unit: 'mg/dL', criticalMin: 70, criticalMax: 126 },
  BLOOD_GLUCOSE_RANDOM: { min: 70, max: 140, unit: 'mg/dL', criticalMax: 200 },
  BLOOD_GLUCOSE_POST_MEAL: { min: 70, max: 140, unit: 'mg/dL', criticalMax: 180 },
  HBA1C: { min: 4, max: 5.7, unit: '%', criticalMax: 6.5 },
  BMI: { min: 18.5, max: 24.9, unit: 'kg/m²', criticalMin: 16, criticalMax: 30 },
  RESPIRATORY_RATE: { min: 12, max: 20, unit: 'breaths/min', criticalMin: 10, criticalMax: 30 },
  WEIGHT: { min: 2, max: 300, unit: 'kg' },
  HEIGHT: { min: 20, max: 300, unit: 'cm' },
  CHOLESTEROL_TOTAL: { min: 125, max: 200, unit: 'mg/dL', criticalMax: 240 },
  CHOLESTEROL_LDL: { min: 0, max: 100, unit: 'mg/dL', criticalMax: 160 },
  CHOLESTEROL_HDL: { min: 40, max: 100, unit: 'mg/dL', criticalMin: 40 },
  TRIGLYCERIDES: { min: 0, max: 150, unit: 'mg/dL', criticalMax: 200 },
};

export function isMetricAbnormal(metricType: string, value: number): boolean {
  const range = NORMAL_RANGES[metricType];
  if (!range) return false;
  
  const criticalMin = range.criticalMin ?? range.min;
  const criticalMax = range.criticalMax ?? range.max;
  
  return value < criticalMin || value > criticalMax;
}

export function getMetricStatus(metricType: string, value: number): 'normal' | 'abnormal' | 'critical' {
  const range = NORMAL_RANGES[metricType];
  if (!range) return 'normal';
  
  const criticalMin = range.criticalMin ?? range.min;
  const criticalMax = range.criticalMax ?? range.max;
  
  if (value < criticalMin || value > criticalMax) return 'critical';
  if (value < range.min || value > range.max) return 'abnormal';
  return 'normal';
}

export function getExpectedUnit(metricType: string): string | null {
  const range = NORMAL_RANGES[metricType];
  return range ? range.unit : null;
}

export function isValueInRealisticRange(metricType: string, value: number): boolean {
  const range = NORMAL_RANGES[metricType];
  if (!range) return true; // If no range defined, accept any value
  
  // Use much broader ranges for realistic validation
  const realisticMin = range.criticalMin ? range.criticalMin * 0.5 : range.min * 0.5;
  const realisticMax = range.criticalMax ? range.criticalMax * 2 : range.max * 2;
  
  return value >= realisticMin && value <= realisticMax;
}
