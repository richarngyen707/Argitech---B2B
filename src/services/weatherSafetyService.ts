import { TelemetryData } from '../types';

export const WEATHER_SAFETY_LIMITS = {
  MAX_WIND_SPEED_KMH: 15.0, // Limit >= 15.0 km/h blocks takeoff / triggers RTH
  MAX_RAIN_RATE_MMH: 1.0, // Limit >= 1.0 mm/h blocks takeoff / triggers RTH
  MAX_HUMIDITY_PERCENT: 90, // Limit > 90% blocks takeoff / triggers RTH
  MIN_TEMPERATURE_CELSIUS: 5.0, // Limit < 5.0°C blocks takeoff / triggers RTH
  MAX_TEMPERATURE_CELSIUS: 40.0, // Limit > 40.0°C blocks takeoff / triggers RTH
} as const;

export const CRITICAL_WEATHER_HAZARD_BANNER =
  'CRITICAL WEATHER HAZARD: Takeoff blocked to prevent hardware damage. Current conditions exceed safety thresholds (Wind >= 15 km/h, Rain >= 1 mm/h, or Temp outside 5-40°C).';

export const WEATHER_ABORT_VOICE_ALERT =
  'Warning: Severe weather detected. Aborting mission to prevent hardware failure.';

export const WEATHER_TAKEOFF_BLOCKED_VOICE_ALERT =
  'Critical weather hazard: Takeoff blocked to prevent hardware damage.';

export interface WeatherSafetyEvaluation {
  isSafe: boolean;
  isHazardous: boolean;
  violations: string[];
  summary: string;
}

/**
 * Evaluates whether current telemetry violates strict operational weather safety limits.
 * Strict Operational Limits:
 * 1. Rain Rate >= 1.0 mm/h OR Humidity > 90%
 * 2. Wind Speed >= 15.0 km/h
 * 3. Ambient Temp < 5.0°C OR > 40.0°C
 */
export function evaluateWeatherSafety(telemetry: TelemetryData): WeatherSafetyEvaluation {
  const violations: string[] = [];

  // 1. Rain & Humidity Thresholds
  if (telemetry.precipitation >= WEATHER_SAFETY_LIMITS.MAX_RAIN_RATE_MMH) {
    violations.push(`Rain Rate ${telemetry.precipitation.toFixed(1)} mm/h (limit < 1.0 mm/h)`);
  }
  if (telemetry.humidity > WEATHER_SAFETY_LIMITS.MAX_HUMIDITY_PERCENT) {
    violations.push(`Humidity ${telemetry.humidity.toFixed(0)}% (limit ≤ 90%)`);
  }

  // 2. Wind Speed Threshold
  if (telemetry.windSpeed >= WEATHER_SAFETY_LIMITS.MAX_WIND_SPEED_KMH) {
    violations.push(`Wind Speed ${telemetry.windSpeed.toFixed(1)} km/h (limit < 15.0 km/h)`);
  }

  // 3. Ambient Temperature Threshold
  if (telemetry.temp < WEATHER_SAFETY_LIMITS.MIN_TEMPERATURE_CELSIUS) {
    violations.push(`Cold Temp ${telemetry.temp.toFixed(1)}°C (min 5.0°C)`);
  } else if (telemetry.temp > WEATHER_SAFETY_LIMITS.MAX_TEMPERATURE_CELSIUS) {
    violations.push(`Hot Temp ${telemetry.temp.toFixed(1)}°C (max 40.0°C)`);
  }

  const isSafe = violations.length === 0;
  const isHazardous = !isSafe;
  const summary = isSafe
    ? 'Weather conditions within safe operational envelope'
    : violations.join(' • ');

  return {
    isSafe,
    isHazardous,
    violations,
    summary,
  };
}

/**
 * Fast Boolean check for weather hazard status (< 1ms execution time).
 */
export function isWeatherHazardous(telemetry: TelemetryData): boolean {
  return (
    telemetry.precipitation >= WEATHER_SAFETY_LIMITS.MAX_RAIN_RATE_MMH ||
    telemetry.humidity > WEATHER_SAFETY_LIMITS.MAX_HUMIDITY_PERCENT ||
    telemetry.windSpeed >= WEATHER_SAFETY_LIMITS.MAX_WIND_SPEED_KMH ||
    telemetry.temp < WEATHER_SAFETY_LIMITS.MIN_TEMPERATURE_CELSIUS ||
    telemetry.temp > WEATHER_SAFETY_LIMITS.MAX_TEMPERATURE_CELSIUS
  );
}
