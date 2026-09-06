export type SupportedLanguage = 'en' | 'vi' | 'es' | 'fr' | 'zh' | 'pt';

export type FleetUnitId = 'drone_alpha' | 'drone_beta' | 'drone_gamma' | 'tractor_yanmar' | 'swarm_fleet_all' | string;

export type MachineryType =
  | 'DJI Agras T40 Sprayer Drone'
  | 'XAG P100 Pro Heavy Sprayer'
  | 'Yanmar YK1200 Autonomous Tractor'
  | 'John Deere 8R Autonomous Tractor'
  | 'DJI Agras T40 Swarm Fleet (6 Units)'
  | string;

export type MissionType =
  | 'Precision Bio-Spraying'
  | 'Soil Aeration & Subsoiling'
  | 'Multispectral Crop Survey'
  | 'Ultra-Low Volume (ULV) Seeding'
  | 'Variable Rate Nitrogen Top-Dressing'
  | 'SWARM_WATER_DISPERSION'
  | string;

export type HardwareConnectionProtocol = 'DJI_CLOUD' | 'WEB_BLUETOOTH' | 'MAVLINK_SERIAL';

export type RtkFixStatus = 'NO_FIX' | '3D_FIX' | 'RTK_FLOAT' | 'RTK_FIX_CENTIMETER';

export interface TelemetryData {
  temp: number; // Celsius
  windSpeed: number; // km/h
  precipitation: number; // mm/h
  humidity: number; // %
  battery: number; // 0 - 100%
  tankLevel: number; // Liters (0 - 50L)
  workingHours: number; // hours
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface FleetUnit {
  id: FleetUnitId;
  name: string;
  model: string;
  machineryType: MachineryType;
  category: 'drone' | 'tractor';
  battery: number;
  tankLevel: number;
  maxTankCapacity: number;
  rssiPercent: number;
  voltage: number;
  rtkStatus: RtkFixStatus;
  satellites: number;
  status: 'IDLE' | 'ACTIVE' | 'RTH' | 'CHARGING' | 'OFFLINE' | 'PARKED_READY' | 'MISSION_COMPLETED';
}

export interface FieldZone {
  id: string;
  name: string;
  coordinates: Coordinates;
  cropType: string;
  areaHectares: number;
  dockCoordinates: Coordinates;
}

export type FailSafeReason =
  | 'LOW_BATTERY'
  | 'EMPTY_TANK'
  | 'SIGNAL_LOSS'
  | 'MANUAL_ABORT'
  | 'MANUAL_EMERGENCY'
  | 'MANUAL_EMERGENCY_HOLD'
  | 'CRITICAL_WEATHER'
  | 'CRITICAL_WEATHER_GROUND_LOCK'
  | 'WEATHER_EMERGENCY_ABORT'
  | 'WEATHER_GROUND_LOCK'
  | 'WEATHER_HOLD'
  | 'NETWORK_LOSS_HOLD';

export interface BreakpointMemory {
  waypointIndex: number;
  coordinates: Coordinates;
  batteryAtBreakpoint: number;
  tankAtBreakpoint: number;
  unitId: FleetUnitId;
  machineryType: MachineryType;
  missionType: MissionType;
  reason: FailSafeReason;
  timestamp: string;
  progressPercent: number;
}

export interface HardwareState {
  isLiveHardware: boolean;
  isConnected: boolean;
  protocol: HardwareConnectionProtocol;
  deviceModel: string;
  rssiPercent: number;
  voltage: number;
  rtkStatus: RtkFixStatus;
  satellites: number;
  serialPortOrDeviceId?: string;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type ZoneHealthType = 'HEALTHY' | 'NITROGEN_DEFICIT' | 'PEST_STRESS';

export type ChemicalPayloadType = 'water_mist' | 'nitrogen_fertilizer' | 'bio_pesticide';

export interface FieldSubZone {
  id: string;
  index: number;
  name: string;
  healthType: ZoneHealthType;
  chemicalType: ChemicalPayloadType;
  areaHa: number;
  dosageRateLPerHa: number;
  targetNozzleMicrons: number;
  enabled?: boolean; // Default true (ON)
}

export interface PrescriptionPlan {
  subZones: FieldSubZone[];
  activePaintMode: ZoneHealthType | null;
  totalWaterLiters: number;
  totalNitrogenLiters: number;
  totalPesticideLiters: number;
  totalLiquidVolumeLiters: number;
  healthyAreaHa: number;
  nitrogenAreaHa: number;
  pestAreaHa: number;
}

export type SwarmTaskType = 'PESTICIDE' | 'WATER' | 'NITROGEN';

export interface SwarmDroneFlight {
  id: string;
  codeName: string; // e.g. "Unit-01", "Unit-02"
  name: string;
  model: string;
  role: string;
  taskType: SwarmTaskType;
  color: string;
  swathColor: string;
  coords: Coordinates;
  dockCoords?: Coordinates;
  battery: number;
  tankLevel: number;
  maxTank: number;
  unitRateLabel: string; // e.g. "20 L/ha Water"
  unitConsumed: number;
  dosageRate: number;
  sprayTrail: Coordinates[];
  targetSectorId?: string;
  targetSectorIndex?: number;
  targetSectorName?: string;
  plotAreaHa?: number;
  status:
    | 'IDLE'
    | 'STANDBY'
    | 'STANDBY / SECTOR_SKIPPED'
    | 'TRANSIT_OUT'
    | 'SPRAYING'
    | 'RETURNING_HOME'
    | 'RECHARGING_REFILLING'
    | 'RESUMING_FROM_BREAKPOINT'
    | 'WEATHER_WAIT'
    | 'DOCKED_COMPLETED';
  progress: number; // 0 to 100%
  altitudeMeters: number;
  chemicalType?: ChemicalPayloadType;
  assignedAction?: string;
  transitOutPath?: Coordinates[];
  gridCoveragePath?: Coordinates[];
  transitReturnPath?: Coordinates[];
  savedBreakpointCoords?: Coordinates;
  savedBreakpointProgress?: number;
  microclimate?: {
    temp: number;
    windSpeed: number;
    precipitation: number;
  };
}

export interface SwarmMissionSummary {
  totalDeployed: number;
  totalSkipped?: number;
  pesticideCount: number;
  waterCount: number;
  nitrogenCount: number;
  totalPlots: number;
  totalActiveAreaHa?: number;
  totalPesticideLiters: number;
  totalWaterLiters: number;
  totalNitrogenKg: number;
  allUnitsReturned: boolean;
}

export interface SwarmMissionState {
  isSwarmActive: boolean;
  drones: SwarmDroneFlight[];
  // Legacy / convenience properties for backward compatibility
  droneAlpha?: SwarmDroneFlight;
  droneBeta?: SwarmDroneFlight;
  droneGamma?: SwarmDroneFlight;
  status: 'IDLE' | 'DEPLOYING_SWARM' | 'SPRAYING_PARALLEL' | 'RETURNING_HOME' | 'MANUAL_EMERGENCY_HOLD' | 'COMPLETED';
  isManualEmergencyHold?: boolean;
  isNetworkLossHold?: boolean;
  isWeatherEmergencyHold?: boolean;
  failSafeReason?: FailSafeReason;
  summary?: SwarmMissionSummary;
}

export interface AIAdvisoryReport {
  loading: boolean;
  riskLevel: RiskLevel;
  summary: string;
  bullets: string[];
  source: 'gemini_ai' | 'rule_engine' | 'offline_cache';
  lastUpdated: string;
  error?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  locationName: string;
  coordinates: Coordinates;
  fieldArea?: number;
  weatherSummary: string;
  machinery: string;
  mission: string;
  tankLevel: string;
  actionApproved: string;
  energySavedKgCo2: number;
  syncStatus: 'SYNCED_ONLINE' | 'CACHED_OFFLINE';
}

export interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  speedMultiplier: number;
  progress: number; // 0 - 100%
  currentPos: Coordinates;
  activePath: Coordinates[];
  sprayTrail?: Coordinates[];
  rthOrigin?: Coordinates | null;
  isRTHActive: boolean;
  isRecharging: boolean;
  isAutoResuming: boolean;
  isGroundLocked?: boolean;
  isNetworkLossHold?: boolean;
  isManualEmergencyHold?: boolean;
  isWeatherEmergencyInFlight?: boolean;
  weatherAlertBanner?: string | null;
  failSafeReason?: FailSafeReason;
  statusMessage: string;
}

export interface CustomizedPlotData {
  sectorId: string;
  centroid: [number, number]; // [lat, lng]
  vertices: Array<[number, number]>; // Array of [lat, lng]
  areaHa: number;
  rotationAngle: number; // numeric value (0°-360°)
}

export type UserCustomizedPlotsStore = Record<string, CustomizedPlotData>;

export interface SubZonePolygonData extends FieldSubZone {
  bounds: [Coordinates, Coordinates, Coordinates, Coordinates];
  center: Coordinates;
  centroid?: [number, number];
  vertices?: Array<[number, number]>;
  rotationAngle?: number;
  hasNfzConflict?: boolean;
  rotationDeg?: number;
  maxAreaHa?: number;
  sizeScale?: number;
}

// Calculate polygon area in Hectares using geodesic polygon calculation (L.GeometryUtil.geodesicArea or geodesic excess)
export function calculatePolygonAreaHa(bounds: Coordinates[]): number {
  if (!bounds || !Array.isArray(bounds) || bounds.length < 3) return 0;
  const valid = bounds.filter((b) => b && typeof b.lat === 'number' && typeof b.lng === 'number' && !isNaN(b.lat) && !isNaN(b.lng));
  if (valid.length < 3) return 0;

  // 1. Direct Leaflet GeometryUtil geodesicArea calculation if available on global window.L
  try {
    const LObj = typeof window !== 'undefined' ? (window as any).L : null;
    if (LObj?.GeometryUtil?.geodesicArea) {
      const latLngs = valid.map((p) => ({ lat: p.lat, lng: p.lng }));
      const m2 = LObj.GeometryUtil.geodesicArea(latLngs);
      if (typeof m2 === 'number' && !isNaN(m2) && m2 > 0) {
        return parseFloat((m2 / 10000).toFixed(2));
      }
    }
  } catch (_) {}

  // 2. High-precision Geodesic Spherical Excess polygon area (WGS84 Earth Radius = 6,378,137m)
  const RADIUS = 6378137;
  const len = valid.length;
  let totalAreaM2 = 0;

  if (len > 2) {
    for (let i = 0; i < len; i++) {
      const p1 = valid[i];
      const p2 = valid[(i + 1) % len];
      const lat1 = (p1.lat * Math.PI) / 180;
      const lat2 = (p2.lat * Math.PI) / 180;
      const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
      totalAreaM2 += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    totalAreaM2 = Math.abs((totalAreaM2 * RADIUS * RADIUS) / 2.0);
  }

  // 3. Robust projected coordinates fallback
  if (!totalAreaM2 || isNaN(totalAreaM2) || totalAreaM2 <= 0) {
    const center = calculatePolygonCenter(valid);
    const cosLat = Math.cos((center.lat * Math.PI) / 180);
    const points = valid.map((p) => ({
      x: (p.lng - center.lng) * 111319.49 * cosLat,
      y: (p.lat - center.lat) * 110574.0,
    }));
    let m2 = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      m2 += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    totalAreaM2 = Math.abs(m2) / 2;
  }

  return parseFloat((totalAreaM2 / 10000).toFixed(2)); // 10,000 m² = 1 ha
}

// Rotate polygon vertices around centroid (or custom pivot) by angleDegrees
export function rotatePolygon(
  bounds: Coordinates[],
  angleDegrees: number,
  customCenter?: Coordinates
): Coordinates[] {
  if (!bounds || !Array.isArray(bounds) || bounds.length === 0) return [];
  const valid = bounds.filter((b) => b && typeof b.lat === 'number' && typeof b.lng === 'number' && !isNaN(b.lat) && !isNaN(b.lng));
  if (valid.length === 0) return [];
  const center = (customCenter && typeof customCenter.lat === 'number' && typeof customCenter.lng === 'number')
    ? customCenter
    : calculatePolygonCenter(valid);
  const rad = (angleDegrees * Math.PI) / 180;
  const cosRad = Math.cos(rad);
  const sinRad = Math.sin(rad);
  const latCos = Math.cos((center.lat * Math.PI) / 180);

  return valid.map((pt) => {
    const dy = pt.lat - center.lat;
    const dx = (pt.lng - center.lng) * latCos;

    // Rotate in 2D
    const rotDx = dx * cosRad - dy * sinRad;
    const rotDy = dx * sinRad + dy * cosRad;

    return {
      lat: center.lat + rotDy,
      lng: center.lng + (latCos !== 0 ? rotDx / latCos : rotDx),
    };
  });
}

// Scale polygon vertices from centroid (or custom pivot) by scale factor
export function scalePolygon(
  bounds: Coordinates[],
  scaleFactor: number,
  customCenter?: Coordinates
): Coordinates[] {
  if (!bounds || !Array.isArray(bounds) || bounds.length === 0) return [];
  const valid = bounds.filter((b) => b && typeof b.lat === 'number' && typeof b.lng === 'number' && !isNaN(b.lat) && !isNaN(b.lng));
  if (valid.length === 0) return [];
  const center = (customCenter && typeof customCenter.lat === 'number' && typeof customCenter.lng === 'number')
    ? customCenter
    : calculatePolygonCenter(valid);
  return valid.map((pt) => ({
    lat: center.lat + (pt.lat - center.lat) * scaleFactor,
    lng: center.lng + (pt.lng - center.lng) * scaleFactor,
  }));
}

// Resize polygon to target maximum area in Hectares
export function resizePolygonToTargetArea(
  bounds: Coordinates[],
  targetAreaHa: number
): Coordinates[] {
  const currentArea = calculatePolygonAreaHa(bounds);
  if (currentArea <= 0.001 || targetAreaHa <= 0.001) return bounds;
  const scale = Math.sqrt(targetAreaHa / currentArea);
  return scalePolygon(bounds, scale);
}

// Rotate & scale polygon in a single transformation step
export function rotateAndScalePolygon(
  bounds: Coordinates[],
  deltaRotationDeg: number,
  scaleFactor: number,
  customCenter?: Coordinates
): Coordinates[] {
  const scaled = scalePolygon(bounds, scaleFactor, customCenter);
  return rotatePolygon(scaled, deltaRotationDeg, customCenter);
}

// Check if a 2D point is inside a polygon using ray casting
export function isPointInPolygon(point: Coordinates, polygon: Coordinates[]): boolean {
  if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') return false;
  if (!polygon || !Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const p1 = polygon[i];
    const p2 = polygon[j];
    if (!p1 || !p2 || typeof p1.lat !== 'number' || typeof p2.lat !== 'number') continue;
    const xi = p1.lng;
    const yi = p1.lat;
    const xj = p2.lng;
    const yj = p2.lat;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Check if two line segments (p1-p2 and p3-p4) intersect
export function doLineSegmentsIntersect(
  p1: Coordinates,
  p2: Coordinates,
  p3: Coordinates,
  p4: Coordinates
): boolean {
  if (!p1 || !p2 || !p3 || !p4) return false;
  if (
    typeof p1.lat !== 'number' || typeof p1.lng !== 'number' ||
    typeof p2.lat !== 'number' || typeof p2.lng !== 'number' ||
    typeof p3.lat !== 'number' || typeof p3.lng !== 'number' ||
    typeof p4.lat !== 'number' || typeof p4.lng !== 'number'
  ) {
    return false;
  }
  function ccw(A: Coordinates, B: Coordinates, C: Coordinates): boolean {
    return (C.lat - A.lat) * (B.lng - A.lng) > (B.lat - A.lat) * (C.lng - A.lng);
  }
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

// Check if two polygons overlap or intersect
export function isPolygonOverlappingPolygon(poly1: Coordinates[], poly2: Coordinates[]): boolean {
  if (!poly1 || !poly2 || !Array.isArray(poly1) || !Array.isArray(poly2) || poly1.length < 3 || poly2.length < 3) {
    return false;
  }

  // 1. Any vertex of poly1 inside poly2
  for (const pt of poly1) {
    if (pt && isPointInPolygon(pt, poly2)) return true;
  }

  // 2. Any vertex of poly2 inside poly1
  for (const pt of poly2) {
    if (pt && isPointInPolygon(pt, poly1)) return true;
  }

  // 3. Any edge of poly1 intersecting any edge of poly2
  for (let i = 0; i < poly1.length; i++) {
    const a1 = poly1[i];
    const a2 = poly1[(i + 1) % poly1.length];
    if (!a1 || !a2) continue;
    for (let j = 0; j < poly2.length; j++) {
      const b1 = poly2[j];
      const b2 = poly2[(j + 1) % poly2.length];
      if (!b1 || !b2) continue;
      if (doLineSegmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }

  return false;
}

// Compute standard NFZ (No-Fly Zone) polygon for the given coordinate region
export function getNfzRestrictedZone(center: Coordinates): Coordinates[] {
  const safeLat = center && typeof center.lat === 'number' ? center.lat : 10.7769;
  const safeLng = center && typeof center.lng === 'number' ? center.lng : 106.7009;
  return [
    { lat: safeLat + 0.0022, lng: safeLng - 0.0028 },
    { lat: safeLat + 0.0042, lng: safeLng - 0.0028 },
    { lat: safeLat + 0.0042, lng: safeLng + 0.0028 },
    { lat: safeLat + 0.0022, lng: safeLng + 0.0028 },
  ];
}

// Calculate centroid of a polygon
export function calculatePolygonCenter(bounds: Coordinates[]): Coordinates {
  if (!bounds || !Array.isArray(bounds) || bounds.length === 0) return { lat: 10.7769, lng: 106.7009 };
  const valid = bounds.filter((b) => b && typeof b.lat === 'number' && typeof b.lng === 'number');
  if (valid.length === 0) return { lat: 10.7769, lng: 106.7009 };
  const total = valid.reduce(
    (acc, cur) => ({ lat: acc.lat + cur.lat, lng: acc.lng + cur.lng }),
    { lat: 0, lng: 0 }
  );
  return {
    lat: total.lat / valid.length,
    lng: total.lng / valid.length,
  };
}

// Calculate distance in meters between two coordinates
export function calculateGeoDistanceMeters(c1: Coordinates, c2: Coordinates): number {
  if (!c1 || !c2 || typeof c1.lat !== 'number' || typeof c1.lng !== 'number' || typeof c2.lat !== 'number' || typeof c2.lng !== 'number') {
    return 0;
  }
  const dLat = (c1.lat - c2.lat) * 111320;
  const meanLatRad = (((c1.lat + c2.lat) / 2) * Math.PI) / 180;
  const dLng = (c1.lng - c2.lng) * (111320 * Math.cos(meanLatRad));
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function generateFieldSubZones(center: Coordinates, totalAreaHa: number = 2.5): SubZonePolygonData[] {
  const scale = Math.sqrt(Math.max(0.1, Math.min(100, totalAreaHa)) / 2.5);
  const latSpan = 0.0035 * scale;
  const lngSpan = 0.0055 * scale;
  const subArea = totalAreaHa / 6;

  const defaultHealthTypes: ZoneHealthType[] = [
    'HEALTHY',
    'NITROGEN_DEFICIT',
    'HEALTHY',
    'PEST_STRESS',
    'NITROGEN_DEFICIT',
    'HEALTHY',
  ];

  const zoneNames = [
    'Sector N-1 (West Canopy)',
    'Sector N-2 (Center Ridge)',
    'Sector N-3 (East Basin)',
    'Sector S-1 (Outbreak Hotspot)',
    'Sector S-2 (Nitrogen Testbed)',
    'Sector S-3 (Delta Terraces)',
  ];

  const sectorIds = [
    'sector_n1',
    'sector_n2',
    'sector_n3',
    'sector_s1',
    'sector_s2',
    'sector_s3',
  ];

  const zones: SubZonePolygonData[] = [];
  const rows = 2;
  const cols = 3;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const minLat = center.lat + (latSpan / 2) - ((r + 1) / rows) * latSpan;
      const maxLat = center.lat + (latSpan / 2) - (r / rows) * latSpan;
      const minLng = center.lng - (lngSpan / 2) + (c / cols) * lngSpan;
      const maxLng = center.lng - (lngSpan / 2) + ((c + 1) / cols) * lngSpan;

      const healthType = defaultHealthTypes[idx] || 'HEALTHY';
      const chemicalType: ChemicalPayloadType =
        healthType === 'HEALTHY'
          ? 'water_mist'
          : healthType === 'NITROGEN_DEFICIT'
          ? 'nitrogen_fertilizer'
          : 'bio_pesticide';

      const dosageRate = healthType === 'HEALTHY' ? 20 : healthType === 'NITROGEN_DEFICIT' ? 15 : 12;
      const nozzleMicrons = healthType === 'HEALTHY' ? 200 : healthType === 'NITROGEN_DEFICIT' ? 180 : 135;
      const sectorId = sectorIds[idx] || `sector_${idx + 1}`;
      const centerCoord = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
      const boundsCoords: [Coordinates, Coordinates, Coordinates, Coordinates] = [
        { lat: maxLat, lng: minLng },
        { lat: maxLat, lng: maxLng },
        { lat: minLat, lng: maxLng },
        { lat: minLat, lng: minLng },
      ];

      zones.push({
        id: sectorId,
        index: idx,
        name: zoneNames[idx] || `Sector ${idx + 1}`,
        healthType,
        chemicalType,
        areaHa: parseFloat(subArea.toFixed(2)),
        maxAreaHa: parseFloat(subArea.toFixed(2)),
        rotationDeg: 0,
        rotationAngle: 0,
        sizeScale: 1.0,
        dosageRateLPerHa: dosageRate,
        targetNozzleMicrons: nozzleMicrons,
        enabled: true,
        center: centerCoord,
        centroid: [centerCoord.lat, centerCoord.lng],
        bounds: boundsCoords,
        vertices: boundsCoords.map((b) => [b.lat, b.lng]),
      });
    }
  }

  return zones;
}

export function subZonesToCustomizedPlotsStore(zones: SubZonePolygonData[]): UserCustomizedPlotsStore {
  const store: UserCustomizedPlotsStore = {};
  if (!zones || !Array.isArray(zones)) return store;
  zones.forEach((z) => {
    if (!z || !z.id || !z.bounds) return;
    const c = z.center || calculatePolygonCenter(z.bounds);
    store[z.id] = {
      sectorId: z.id,
      centroid: [c.lat, c.lng],
      vertices: z.bounds.map((b) => [b.lat, b.lng]),
      areaHa: z.areaHa,
      rotationAngle: z.rotationDeg || z.rotationAngle || 0,
    };
  });
  return store;
}

export function applyCustomizedPlotsToSubZones(
  baseZones: SubZonePolygonData[],
  customizedPlots: UserCustomizedPlotsStore
): SubZonePolygonData[] {
  if (!baseZones || !Array.isArray(baseZones)) return [];
  if (!customizedPlots || Object.keys(customizedPlots).length === 0) return baseZones;

  return baseZones.map((z) => {
    const custom = customizedPlots[z.id];
    if (!custom) return z;

    const bounds: [Coordinates, Coordinates, Coordinates, Coordinates] = custom.vertices.map((v) => ({
      lat: v[0],
      lng: v[1],
    })) as any;

    const center: Coordinates = {
      lat: custom.centroid[0],
      lng: custom.centroid[1],
    };

    return {
      ...z,
      center,
      centroid: custom.centroid,
      bounds,
      vertices: custom.vertices,
      areaHa: custom.areaHa,
      maxAreaHa: custom.areaHa,
      rotationDeg: custom.rotationAngle,
      rotationAngle: custom.rotationAngle,
    };
  });
}

export function calculatePrescriptionTotals(subZones: FieldSubZone[]) {
  let healthyAreaHa = 0;
  let nitrogenAreaHa = 0;
  let pestAreaHa = 0;

  subZones.forEach((zone) => {
    if (zone.enabled === false) return; // Skip disabled sectors
    if (zone.healthType === 'HEALTHY') {
      healthyAreaHa += zone.areaHa;
    } else if (zone.healthType === 'NITROGEN_DEFICIT') {
      nitrogenAreaHa += zone.areaHa;
    } else if (zone.healthType === 'PEST_STRESS') {
      pestAreaHa += zone.areaHa;
    }
  });

  // Task-Based Precision Resource Calculations for Dynamic Plot Assignment:
  // - Canopy Hydration Water Required = Healthy Area (ha) * 15 L/ha
  // - Nitrogen Fertilizer Granules = Nitrogen Deficit Area (ha) * 12 kg/ha
  // - Targeted Bio-Pesticide Chemical = Pest/Stress Area (ha) * 20 L/ha
  const canopyWaterVolume = healthyAreaHa * 15; // 15 L/ha Water for Healthy Plots
  const nutrientNitrogenKg = nitrogenAreaHa * 12; // 12 kg/ha Nitrogen for Deficit Plots
  const pesticideChemicalVolume = pestAreaHa * 20; // 20 L/ha Bio-Pesticide for Pest Plots
  const totalLiquidVolumeLiters = canopyWaterVolume + pesticideChemicalVolume;

  return {
    healthyAreaHa,
    nitrogenAreaHa,
    pestAreaHa,
    canopyWaterVolume,
    nutrientNitrogenKg,
    pesticideChemicalVolume,
    nutrientWaterVolume: nutrientNitrogenKg,
    protectionWaterVolume: pesticideChemicalVolume,
    waterVolumeLiters: canopyWaterVolume,
    nutrientWaterVolumeLiters: nutrientNitrogenKg,
    totalWaterVolumeLiters: canopyWaterVolume,
    totalLiquidVolumeLiters,
    // Backwards compatibility aliases
    chemicalVolumeRequired: pesticideChemicalVolume,
    waterFertilizerVolumeRequired: canopyWaterVolume,
    totalWaterLiters: canopyWaterVolume,
    totalNitrogenLiters: nutrientNitrogenKg,
    totalPesticideLiters: pesticideChemicalVolume,
  };
}

export function generateSwarmTriPaths(
  center: Coordinates,
  areaHectares: number = 2.5,
  subZones?: SubZonePolygonData[]
): {
  pathAlpha: Coordinates[];
  pathBeta: Coordinates[];
  pathGamma: Coordinates[];
} {
  const scale = Math.sqrt(Math.max(0.1, Math.min(100, areaHectares)) / 2.5);
  const latSpan = 0.0035 * scale;
  const lngSpan = 0.0055 * scale;

  // Collision-Free Simultaneous 3-Drone Airspace Partitioning across 3 Field Sectors/Corridors:
  // - Drone Alpha (DJI Agras T40 #1): Operates in West Sector (Left 1/3 of Field) • 3.5m AGL
  // - Drone Beta (DJI Agras T40 #2): Operates in Central Sector (Center 1/3 of Field) • 4.2m AGL
  // - Drone Gamma (DJI Agras T40 #3): Operates in East Sector (Right 1/3 of Field) • 4.9m AGL
  // - Safe lateral buffer gap (>= 25m) + altitude separation ensures zero mid-air obstruction or wake turbulence
  const pathAlpha: Coordinates[] = [];
  const pathBeta: Coordinates[] = [];
  const pathGamma: Coordinates[] = [];

  const rows = Math.max(4, Math.min(8, Math.round(5 * Math.sqrt(scale))));

  // Corridor 1: Drone Alpha (West Sector: lng from center.lng - lngSpan/2 to center.lng - lngSpan/6 - 0.00015)
  const alphaMinLng = center.lng - lngSpan / 2;
  const alphaMaxLng = center.lng - lngSpan / 6 - 0.00015;

  for (let i = 0; i <= rows; i++) {
    const lat = center.lat - latSpan / 2 + (i / rows) * latSpan;
    if (i % 2 === 0) {
      pathAlpha.push({ lat, lng: alphaMinLng });
      pathAlpha.push({ lat, lng: alphaMaxLng });
    } else {
      pathAlpha.push({ lat, lng: alphaMaxLng });
      pathAlpha.push({ lat, lng: alphaMinLng });
    }
  }

  // Corridor 2: Drone Beta (Center Sector: lng from center.lng - lngSpan/6 + 0.00015 to center.lng + lngSpan/6 - 0.00015)
  const betaMinLng = center.lng - lngSpan / 6 + 0.00015;
  const betaMaxLng = center.lng + lngSpan / 6 - 0.00015;

  for (let i = 0; i <= rows; i++) {
    const lat = center.lat - latSpan / 2 + (i / rows) * latSpan;
    if (i % 2 === 0) {
      pathBeta.push({ lat, lng: betaMinLng });
      pathBeta.push({ lat, lng: betaMaxLng });
    } else {
      pathBeta.push({ lat, lng: betaMaxLng });
      pathBeta.push({ lat, lng: betaMinLng });
    }
  }

  // Corridor 3: Drone Gamma (East Sector: lng from center.lng + lngSpan/6 + 0.00015 to center.lng + lngSpan/2)
  const gammaMinLng = center.lng + lngSpan / 6 + 0.00015;
  const gammaMaxLng = center.lng + lngSpan / 2;

  for (let i = 0; i <= rows; i++) {
    const lat = center.lat - latSpan / 2 + (i / rows) * latSpan;
    if (i % 2 === 0) {
      pathGamma.push({ lat, lng: gammaMinLng });
      pathGamma.push({ lat, lng: gammaMaxLng });
    } else {
      pathGamma.push({ lat, lng: gammaMaxLng });
      pathGamma.push({ lat, lng: gammaMinLng });
    }
  }

  // Ensure all paths have at least 2 points
  if (pathAlpha.length < 2) {
    pathAlpha.push({ lat: center.lat - 0.001, lng: alphaMinLng });
    pathAlpha.push({ lat: center.lat + 0.001, lng: alphaMaxLng });
  }
  if (pathBeta.length < 2) {
    pathBeta.push({ lat: center.lat - 0.001, lng: betaMinLng });
    pathBeta.push({ lat: center.lat + 0.001, lng: betaMaxLng });
  }
  if (pathGamma.length < 2) {
    pathGamma.push({ lat: center.lat - 0.001, lng: gammaMinLng });
    pathGamma.push({ lat: center.lat + 0.001, lng: gammaMaxLng });
  }

  return { pathAlpha, pathBeta, pathGamma };
}

export function generateSwarmDualPaths(
  center: Coordinates,
  areaHectares: number = 2.5,
  subZones?: SubZonePolygonData[]
): {
  pathAlpha: Coordinates[];
  pathBeta: Coordinates[];
} {
  const tri = generateSwarmTriPaths(center, areaHectares, subZones);
  return { pathAlpha: tri.pathAlpha, pathBeta: tri.pathBeta };
}

export function generateFlightPathWaypoints(
  center: Coordinates,
  areaHectares: number = 2.5,
  subZones?: SubZonePolygonData[]
): Coordinates[] {
  if (subZones && subZones.length > 0) {
    const enabled = subZones.filter((z) => z.enabled !== false);
    const zonesToUse = enabled.length > 0 ? enabled : subZones;
    const allPts: Coordinates[] = [];
    zonesToUse.forEach((z) => {
      if (z.bounds && Array.isArray(z.bounds)) {
        z.bounds.forEach((b) => {
          if (b && typeof b.lat === 'number' && typeof b.lng === 'number') {
            allPts.push(b);
          }
        });
      }
    });
    if (allPts.length >= 3) {
      const minLat = Math.min(...allPts.map((p) => p.lat));
      const maxLat = Math.max(...allPts.map((p) => p.lat));
      const minLng = Math.min(...allPts.map((p) => p.lng));
      const maxLng = Math.max(...allPts.map((p) => p.lng));
      const rows = Math.max(4, Math.min(10, Math.round(6 * Math.sqrt(areaHectares / 2.5))));
      const path: Coordinates[] = [];
      for (let i = 0; i <= rows; i++) {
        const lat = minLat + (i / rows) * (maxLat - minLat);
        if (i % 2 === 0) {
          path.push({ lat, lng: minLng });
          path.push({ lat, lng: maxLng });
        } else {
          path.push({ lat, lng: maxLng });
          path.push({ lat, lng: minLng });
        }
      }
      return path;
    }
  }

  const scale = Math.sqrt(Math.max(0.1, Math.min(100, areaHectares)) / 2.5);
  const latSpan = 0.0035 * scale;
  const lngSpan = 0.0055 * scale;
  const rows = Math.max(4, Math.min(10, Math.round(6 * Math.sqrt(scale))));
  const path: Coordinates[] = [];

  for (let i = 0; i <= rows; i++) {
    const lat = center.lat - latSpan / 2 + (i / rows) * latSpan;
    if (i % 2 === 0) {
      path.push({ lat, lng: center.lng - lngSpan / 2 });
      path.push({ lat, lng: center.lng + lngSpan / 2 });
    } else {
      path.push({ lat, lng: center.lng + lngSpan / 2 });
      path.push({ lat, lng: center.lng - lngSpan / 2 });
    }
  }
  return path;
}

export function interpolateFlightPath(waypoints: Coordinates[], progressPercent: number): Coordinates {
  if (!waypoints || !Array.isArray(waypoints) || waypoints.length === 0) {
    return { lat: 10.7769, lng: 106.7009 };
  }
  const valid = waypoints.filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng));
  if (valid.length === 0) {
    return { lat: 10.7769, lng: 106.7009 };
  }
  if (valid.length === 1 || progressPercent <= 0) {
    return valid[0];
  }
  if (progressPercent >= 100) {
    return valid[valid.length - 1];
  }

  const numSegments = valid.length - 1;
  const totalRatio = (progressPercent / 100) * numSegments;
  const segIndex = Math.max(0, Math.min(numSegments - 1, Math.floor(totalRatio)));
  const segT = totalRatio - segIndex;

  const p1 = valid[segIndex] || valid[0];
  const p2 = valid[segIndex + 1] || p1;

  return {
    lat: p1.lat + (p2.lat - p1.lat) * segT,
    lng: p1.lng + (p2.lng - p1.lng) * segT,
  };
}

export function generateSubZoneGridPath(zone: SubZonePolygonData, rows: number = 4): Coordinates[] {
  if (!zone || !zone.bounds || !Array.isArray(zone.bounds) || (zone.bounds as Coordinates[]).length === 0) {
    return [];
  }
  const validBounds = zone.bounds.filter((b) => b && typeof b.lat === 'number' && typeof b.lng === 'number' && !isNaN(b.lat) && !isNaN(b.lng));
  if (validBounds.length < 3) {
    const fallback = (zone.center && typeof zone.center.lat === 'number' && typeof zone.center.lng === 'number')
      ? zone.center
      : { lat: 10.7769, lng: 106.7009 };
    return [fallback];
  }
  const rotation = zone.rotationDeg || 0;
  const center = (zone.center && typeof zone.center.lat === 'number' && typeof zone.center.lng === 'number')
    ? zone.center
    : calculatePolygonCenter(validBounds);

  // Un-rotate bounds into axis-aligned space
  const unrotatedBounds = rotation !== 0 ? rotatePolygon(validBounds, -rotation, center) : validBounds;

  const lats = unrotatedBounds.map((b) => b.lat);
  const lngs = unrotatedBounds.map((b) => b.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latMargin = (maxLat - minLat) * 0.12;
  const lngMargin = (maxLng - minLng) * 0.12;
  const effectiveMinLat = minLat + latMargin;
  const effectiveMaxLat = maxLat - latMargin;
  const effectiveMinLng = minLng + lngMargin;
  const effectiveMaxLng = maxLng - lngMargin;

  const rawPath: Coordinates[] = [];
  for (let i = 0; i <= rows; i++) {
    const lat = effectiveMaxLat - (i / rows) * (effectiveMaxLat - effectiveMinLat);
    if (i % 2 === 0) {
      rawPath.push({ lat, lng: effectiveMinLng });
      rawPath.push({ lat, lng: effectiveMaxLng });
    } else {
      rawPath.push({ lat, lng: effectiveMaxLng });
      rawPath.push({ lat, lng: effectiveMinLng });
    }
  }

  // Rotate raster path back to match the zone's custom orientation
  return rotation !== 0 ? rotatePolygon(rawPath, rotation, center) : rawPath;
}

export function generateDynamicPlotSwarmPlan(
  dockCoords: Coordinates,
  subZones: SubZonePolygonData[]
): {
  drones: SwarmDroneFlight[];
  summary: SwarmMissionSummary;
} {
  let totalPesticideLiters = 0;
  let totalWaterLiters = 0;
  let totalNitrogenKg = 0;

  let pesticideCount = 0;
  let waterCount = 0;
  let nitrogenCount = 0;
  let totalDeployed = 0;
  let totalSkipped = 0;
  let totalActiveAreaHa = 0;

  const altitudePresets = [3.5, 4.0, 4.5, 3.8, 4.2, 4.7];

  const drones: SwarmDroneFlight[] = subZones.map((zone, idx) => {
    const unitNum = idx + 1;
    const numStr = String(unitNum).padStart(2, '0');
    const altitudeMeters = altitudePresets[idx % altitudePresets.length];
    const isSectorEnabled = zone.enabled !== false;

    let taskType: SwarmTaskType = 'WATER';
    let chemicalType: ChemicalPayloadType = 'water_mist';
    let color = '#0ea5e9'; // Cyan/Water Blue
    let swathColor = '#0ea5e9';
    let role = `Canopy Water Hydration • ${zone.name}`;
    let unitRateLabel = '15 L/ha Water';
    let dosageRate = zone.dosageRateLPerHa || 15;
    let unitReq = isSectorEnabled ? zone.areaHa * dosageRate : 0;
    let codeName = `Unit-${numStr}`;
    let name = `DJI Agras T40 • Unit #${unitNum}`;

    if (zone.healthType === 'PEST_STRESS' || zone.chemicalType === 'bio_pesticide') {
      taskType = 'PESTICIDE';
      chemicalType = 'bio_pesticide';
      color = '#ef4444'; // Red
      swathColor = '#ef4444';
      dosageRate = zone.dosageRateLPerHa || 20;
      unitRateLabel = `${dosageRate} L/ha Bio-Pesticide`;
      unitReq = isSectorEnabled ? zone.areaHa * dosageRate : 0;
      role = isSectorEnabled
        ? `Targeted Bio-Pesticide Shield • ${zone.name}`
        : `Standby (Docked) • ${zone.name} Skipped`;
      if (isSectorEnabled) {
        pesticideCount++;
        totalPesticideLiters += unitReq;
      }
      codeName = `Alpha-${String(pesticideCount || idx + 1).padStart(2, '0')}`;
      name = `DJI Agras T40 • Bio-Pesticide Unit #${unitNum} (${codeName})`;
    } else if (zone.healthType === 'NITROGEN_DEFICIT' || zone.chemicalType === 'nitrogen_fertilizer') {
      taskType = 'NITROGEN';
      chemicalType = 'nitrogen_fertilizer';
      color = '#eab308'; // Amber/Gold
      swathColor = '#eab308';
      dosageRate = zone.dosageRateLPerHa || 12;
      unitRateLabel = `${dosageRate} kg/ha Nitrogen`;
      unitReq = isSectorEnabled ? zone.areaHa * dosageRate : 0;
      role = isSectorEnabled
        ? `Liquid Nitrogen Nutrient Top-Dressing • ${zone.name}`
        : `Standby (Docked) • ${zone.name} Skipped`;
      if (isSectorEnabled) {
        nitrogenCount++;
        totalNitrogenKg += unitReq;
      }
      codeName = `Gamma-${String(nitrogenCount || idx + 1).padStart(2, '0')}`;
      name = `DJI Agras T40 • Nitrogen Spreader Unit #${unitNum} (${codeName})`;
    } else {
      taskType = 'WATER';
      chemicalType = 'water_mist';
      color = '#0ea5e9'; // Sky Blue / Cyan
      swathColor = '#0ea5e9';
      dosageRate = zone.dosageRateLPerHa || 15;
      unitRateLabel = `${dosageRate} L/ha Water Mist`;
      unitReq = isSectorEnabled ? zone.areaHa * dosageRate : 0;
      role = isSectorEnabled
        ? `Canopy Water Hydration • ${zone.name}`
        : `Standby (Docked) • ${zone.name} Skipped`;
      if (isSectorEnabled) {
        waterCount++;
        totalWaterLiters += unitReq;
      }
      codeName = `Beta-${String(waterCount || idx + 1).padStart(2, '0')}`;
      name = `DJI Agras T40 • Water Hydration Unit #${unitNum} (${codeName})`;
    }

    if (isSectorEnabled) {
      totalDeployed++;
      totalActiveAreaHa += zone.areaHa;
    } else {
      totalSkipped++;
    }

    const gridCoveragePath = isSectorEnabled ? generateSubZoneGridPath(zone, 4) : [];
    const startPoint = gridCoveragePath[0] || zone.center;
    const endPoint = gridCoveragePath[gridCoveragePath.length - 1] || zone.center;

    // Staggered staging radial offset from dock to avoid collision on initial takeoff
    const angleRad = (idx / Math.max(1, subZones.length)) * Math.PI * 2;
    const stagingPoint: Coordinates = {
      lat: dockCoords.lat + 0.0004 * Math.sin(angleRad),
      lng: dockCoords.lng + 0.0006 * Math.cos(angleRad),
    };

    const transitOutPath: Coordinates[] = isSectorEnabled
      ? [dockCoords, stagingPoint, startPoint]
      : [dockCoords];

    const transitReturnPath: Coordinates[] = isSectorEnabled
      ? [endPoint, stagingPoint, dockCoords]
      : [dockCoords];

    return {
      id: `swarm_drone_${zone.id || idx}`,
      codeName,
      name,
      model: 'DJI Agras T40',
      role,
      taskType,
      color: isSectorEnabled ? color : '#64748b',
      swathColor: isSectorEnabled ? swathColor : '#64748b',
      coords: dockCoords,
      dockCoords,
      battery: 100,
      tankLevel: 40.0,
      maxTank: 40.0,
      unitRateLabel: isSectorEnabled ? unitRateLabel : 'SKIPPED / STANDBY',
      unitConsumed: parseFloat(unitReq.toFixed(1)),
      dosageRate,
      sprayTrail: [],
      targetSectorId: zone.id,
      targetSectorIndex: idx,
      targetSectorName: zone.name,
      plotAreaHa: zone.areaHa,
      status: isSectorEnabled ? 'IDLE' : 'STANDBY / SECTOR_SKIPPED',
      progress: 0,
      altitudeMeters,
      chemicalType,
      assignedAction: isSectorEnabled
        ? `${unitRateLabel} across ${zone.areaHa.toFixed(2)} ha`
        : 'SKIPPED - DOCKED (Sector Inactive)',
      transitOutPath,
      gridCoveragePath,
      transitReturnPath,
      microclimate: {
        temp: 28.5 + (idx * 0.4 - 1.0),
        windSpeed: 7.2 + (idx * 0.3 - 0.7),
        precipitation: 0.0,
      },
    };
  });

  const summary: SwarmMissionSummary = {
    totalDeployed,
    totalSkipped,
    pesticideCount,
    waterCount,
    nitrogenCount,
    totalPlots: totalDeployed,
    totalActiveAreaHa: parseFloat(totalActiveAreaHa.toFixed(2)),
    totalPesticideLiters: parseFloat(totalPesticideLiters.toFixed(1)),
    totalWaterLiters: parseFloat(totalWaterLiters.toFixed(1)),
    totalNitrogenKg: parseFloat(totalNitrogenKg.toFixed(1)),
    allUnitsReturned: false,
  };

  return { drones, summary };
}

