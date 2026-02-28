import { MetricType } from '@prisma/client';
import { getExpectedUnit, isValueInRealisticRange, NORMAL_RANGES } from './healthMetricRanges';

export interface HealthMetricInput {
  metricType: MetricType;
  value: number;
  unit: string;
  recordedAt?: Date | string;
  notes?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export class HealthMetricValidator {
  private errors: ValidationError[] = [];

  validate(input: HealthMetricInput): { isValid: boolean; errors: ValidationError[] } {
    this.errors = [];

    this.validateMetricType(input.metricType);
    this.validateValue(input.value, input.metricType);
    this.validateUnit(input.unit, input.metricType);
    this.validateRecordedAt(input.recordedAt);
    this.validateNotes(input.notes);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
    };
  }

  private validateMetricType(metricType: MetricType): void {
    if (!metricType) {
      this.errors.push({ field: 'metricType', message: 'Metric type is required' });
      return;
    }

    const validMetricTypes = Object.values(MetricType);
    if (!validMetricTypes.includes(metricType)) {
      this.errors.push({ field: 'metricType', message: `Invalid metric type. Must be one of: ${validMetricTypes.join(', ')}` });
    }
  }

  private validateValue(value: number, metricType: MetricType): void {
    if (value === undefined || value === null) {
      this.errors.push({ field: 'value', message: 'Value is required' });
      return;
    }

    if (typeof value !== 'number' || isNaN(value)) {
      this.errors.push({ field: 'value', message: 'Value must be a valid number' });
      return;
    }

    if (value < 0) {
      this.errors.push({ field: 'value', message: 'Value cannot be negative' });
      return;
    }

    // Check if value is in realistic range
    if (!isValueInRealisticRange(metricType, value)) {
      const range = NORMAL_RANGES[metricType];
      if (range) {
        this.errors.push({ 
          field: 'value', 
          message: `Value ${value} ${range.unit} is outside realistic range for ${metricType}` 
        });
      }
    }
  }

  private validateUnit(unit: string, metricType: MetricType): void {
    if (!unit) {
      this.errors.push({ field: 'unit', message: 'Unit is required' });
      return;
    }

    const expectedUnit = getExpectedUnit(metricType);
    if (expectedUnit && unit !== expectedUnit) {
      this.errors.push({ 
        field: 'unit', 
        message: `Invalid unit for ${metricType}. Expected: ${expectedUnit}, Got: ${unit}` 
      });
    }
  }

  private validateRecordedAt(recordedAt?: Date | string): void {
    if (!recordedAt) return; // Optional field

    const date = recordedAt instanceof Date ? recordedAt : new Date(recordedAt);
    
    if (isNaN(date.getTime())) {
      this.errors.push({ field: 'recordedAt', message: 'Invalid date format' });
      return;
    }

    const now = new Date();
    if (date > now) {
      this.errors.push({ field: 'recordedAt', message: 'Recorded date cannot be in the future' });
    }

    // Check if date is too far in the past (more than 100 years)
    const hundredYearsAgo = new Date();
    hundredYearsAgo.setFullYear(hundredYearsAgo.getFullYear() - 100);
    if (date < hundredYearsAgo) {
      this.errors.push({ field: 'recordedAt', message: 'Recorded date is too far in the past' });
    }
  }

  private validateNotes(notes?: string): void {
    if (!notes) return; // Optional field

    if (notes.length > 1000) {
      this.errors.push({ field: 'notes', message: 'Notes must be less than 1000 characters' });
    }

    // Basic XSS prevention - check for suspicious HTML/script tags
    const suspiciousPatterns = [/<script/i, /<iframe/i, /javascript:/i, /onerror=/i, /onclick=/i];
    if (suspiciousPatterns.some(pattern => pattern.test(notes))) {
      this.errors.push({ field: 'notes', message: 'Notes contain invalid characters' });
    }
  }
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    throw new Error('Invalid weight or height values for BMI calculation');
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 100) / 100; // Round to 2 decimal places
}

export function validateHealthMetric(input: HealthMetricInput): { isValid: boolean; errors: ValidationError[] } {
  const validator = new HealthMetricValidator();
  return validator.validate(input);
}
