import {
  AuditLogEntry,
  Coordinates,
  TelemetryData,
  BreakpointMemory,
  SubZonePolygonData,
  UserCustomizedPlotsStore,
  ZoneHealthType,
  ChemicalPayloadType,
  subZonesToCustomizedPlotsStore,
} from '../types';

const STORAGE_KEYS = {
  AUDIT_LOGS: 'agritwin_audit_logs_v1',
  LAST_COORDS: 'agritwin_last_coords_v1',
  TELEMETRY: 'agritwin_telemetry_v1',
  BREAKPOINT: 'agritwin_breakpoint_v1',
  LANGUAGE: 'agritwin_lang_v1',
  HARDWARE: 'agritwin_hardware_v1',
  SAVED_MISSION: 'agriTwin_saved_mission',
  MISSION_SNAPSHOTS: 'agriTwin_mission_snapshots_v1',
  LAST_COMMITTED_MISSION: 'agriTwin_last_committed_mission_v1',
};

export interface SpatialHistoryState {
  subZones: SubZonePolygonData[];
  userCustomizedPlots: UserCustomizedPlotsStore;
  nfzPolygon: Coordinates[];
  fieldArea: number;
}

export interface AgriTwinSavedMissionState {
  version: string;
  timestamp: string;
  savedAtFormatted: string;
  locationName?: string;
  currentCoords?: Coordinates;
  fieldArea: number;
  subZones: SubZonePolygonData[];
  plotGeometryState: UserCustomizedPlotsStore;
  activeNFZGeometry: Coordinates[];
  sectorConfig: Array<{
    id: string;
    index: number;
    name: string;
    enabled: boolean;
    healthType: ZoneHealthType;
    chemicalType: ChemicalPayloadType;
    areaHa: number;
    rotationAngle: number;
    rotationDeg: number;
    dosageRateLPerHa: number;
    targetNozzleMicrons: number;
  }>;
}

/**
 * Saves the active mission layout to browser storage (localStorage).
 * Key: "agriTwin_saved_mission"
 */
export function saveActiveMissionLayout(params: {
  subZones: SubZonePolygonData[];
  nfzPolygon: Coordinates[];
  fieldArea: number;
  locationName?: string;
  currentCoords?: Coordinates;
  isExplicitCommit?: boolean;
}): AgriTwinSavedMissionState {
  const { subZones, nfzPolygon, fieldArea, locationName, currentCoords, isExplicitCommit } = params;
  const now = new Date();
  const plotGeometryState = subZonesToCustomizedPlotsStore(subZones);

  const sectorConfig = (subZones || []).map((z, idx) => ({
    id: z.id || `sector_${idx + 1}`,
    index: z.index ?? idx,
    name: z.name || `Sector ${idx + 1}`,
    enabled: z.enabled !== false,
    healthType: z.healthType || 'HEALTHY',
    chemicalType: z.chemicalType || 'water_mist',
    areaHa: typeof z.areaHa === 'number' ? z.areaHa : 0.42,
    rotationAngle: typeof z.rotationAngle === 'number' ? z.rotationAngle : (z.rotationDeg || 0),
    rotationDeg: typeof z.rotationDeg === 'number' ? z.rotationDeg : (z.rotationAngle || 0),
    dosageRateLPerHa: typeof z.dosageRateLPerHa === 'number' ? z.dosageRateLPerHa : 15,
    targetNozzleMicrons: typeof z.targetNozzleMicrons === 'number' ? z.targetNozzleMicrons : 180,
  }));

  const state: AgriTwinSavedMissionState = {
    version: '1.0',
    timestamp: now.toISOString(),
    savedAtFormatted: now.toLocaleString(),
    locationName,
    currentCoords,
    fieldArea,
    subZones,
    plotGeometryState,
    activeNFZGeometry: nfzPolygon || [],
    sectorConfig,
  };

  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_MISSION, JSON.stringify(state));
    if (isExplicitCommit) {
      localStorage.setItem(STORAGE_KEYS.LAST_COMMITTED_MISSION, JSON.stringify(state));
      addMissionSnapshot(state);
    }
  } catch (err) {
    console.warn('Failed to save mission to localStorage:', err);
  }

  return state;
}

/**
 * Retrieves the last confirmed/committed mission snapshot (Google Doc / Accept & Save snapshot).
 */
export function getCommittedMissionSnapshot(): AgriTwinSavedMissionState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_COMMITTED_MISSION);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.subZones) && parsed.subZones.length > 0) {
        return parsed;
      }
    }
    // Fallback to latest historical snapshot if available
    const snapshots = getMissionSnapshots();
    if (snapshots.length > 0 && snapshots[0].subZones?.length > 0) {
      return snapshots[0];
    }
    // Fallback to active saved mission
    return getSavedMissionLayout();
  } catch (err) {
    console.warn('Failed to read committed mission from localStorage:', err);
    return null;
  }
}

/**
 * Retrieves the saved mission layout from localStorage if it exists.
 */
export function getSavedMissionLayout(): AgriTwinSavedMissionState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_MISSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.subZones) && parsed.subZones.length > 0) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('Failed to read saved mission from localStorage:', err);
    return null;
  }
}

/**
 * Clears the saved mission layout from localStorage (used on Reset).
 */
export function clearSavedMissionLayout(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SAVED_MISSION);
  } catch (err) {
    console.warn('Failed to clear saved mission:', err);
  }
}

/**
 * Retrieves historical mission snapshots.
 */
export function getMissionSnapshots(): AgriTwinSavedMissionState[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MISSION_SNAPSHOTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Adds a committed snapshot to history (keeps latest 10).
 */
export function addMissionSnapshot(state: AgriTwinSavedMissionState): void {
  try {
    const current = getMissionSnapshots();
    const updated = [state, ...current.filter((s) => s.timestamp !== state.timestamp)].slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.MISSION_SNAPSHOTS, JSON.stringify(updated));
  } catch {}
}

export function getCachedAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (!raw) return getInitialAuditLogs();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getInitialAuditLogs();
  } catch {
    return getInitialAuditLogs();
  }
}

export function saveAuditLogs(logs: AuditLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
  } catch (err) {
    console.warn('Failed to save audit logs to localStorage:', err);
  }
}

export function addAuditLog(entry: Omit<AuditLogEntry, 'id'>): AuditLogEntry[] {
  const current = getCachedAuditLogs();
  const newEntry: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...entry,
  };
  const updated = [newEntry, ...current];
  saveAuditLogs(updated);
  return updated;
}

export function syncOfflineLogsToOnline(): AuditLogEntry[] {
  const logs = getCachedAuditLogs();
  const updated = logs.map((log) => {
    if (log.syncStatus === 'CACHED_OFFLINE') {
      return {
        ...log,
        syncStatus: 'SYNCED_ONLINE' as const,
      };
    }
    return log;
  });
  saveAuditLogs(updated);
  return updated;
}

export function getCachedLanguage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LANGUAGE);
  } catch {
    return null;
  }
}

export function setCachedLanguage(lang: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  } catch {}
}

export function getCachedBreakpoint(): BreakpointMemory | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BREAKPOINT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.coordinates &&
      typeof parsed.coordinates.lat === 'number' &&
      typeof parsed.coordinates.lng === 'number' &&
      !isNaN(parsed.coordinates.lat) &&
      !isNaN(parsed.coordinates.lng)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCachedBreakpoint(bp: BreakpointMemory | null): void {
  try {
    if (!bp) {
      localStorage.removeItem(STORAGE_KEYS.BREAKPOINT);
    } else {
      localStorage.setItem(STORAGE_KEYS.BREAKPOINT, JSON.stringify(bp));
    }
  } catch {}
}

export function exportLogsToCSV(logs: AuditLogEntry[], filename = 'agritwin_b2b_audit_log.csv'): void {
  if (!logs.length) return;

  const headers = [
    'Log ID',
    'Timestamp (UTC)',
    'Location Name',
    'Latitude',
    'Longitude',
    'Field Area (ha)',
    'Weather Captured',
    'Machinery Type',
    'Mission Type',
    'Tank Volume',
    'Action Approved',
    'CO2 / Energy Saved (kg CO2)',
    'Network Sync Status',
  ];

  const csvRows = logs.map((log) => [
    `"${log.id}"`,
    `"${log.timestamp}"`,
    `"${(log.locationName || '').replace(/"/g, '""')}"`,
    (log.coordinates?.lat ?? 10.005).toFixed(6),
    (log.coordinates?.lng ?? 105.722).toFixed(6),
    (log.fieldArea ?? 2.5).toFixed(1),
    `"${(log.weatherSummary || '').replace(/"/g, '""')}"`,
    `"${(log.machinery || '').replace(/"/g, '""')}"`,
    `"${(log.mission || '').replace(/"/g, '""')}"`,
    `"${(log.tankLevel || '36.5 L').replace(/"/g, '""')}"`,
    `"${(log.actionApproved || '').replace(/"/g, '""')}"`,
    (log.energySavedKgCo2 ?? 0).toFixed(2),
    `"${log.syncStatus}"`,
  ]);

  const csvContent = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getInitialAuditLogs(): AuditLogEntry[] {
  const now = new Date();
  return [
    {
      id: 'log_init_01',
      timestamp: new Date(now.getTime() - 14 * 60000).toISOString().replace('T', ' ').substring(0, 19),
      locationName: 'Cần Thơ Field Zone Alpha (Mekong Delta, VN)',
      coordinates: { lat: 10.005, lng: 105.722 },
      weatherSummary: '28°C • Wind: 11.2 km/h • Precip: 0.0 mm/h',
      machinery: 'DJI Agras T40 Sprayer Drone',
      mission: 'Precision Bio-Spraying',
      tankLevel: '36.5 L / 40L',
      actionApproved: 'Autonomous Waypoint Dispatch (Swath 6.0m)',
      energySavedKgCo2: 14.8,
      syncStatus: 'SYNCED_ONLINE',
    },
    {
      id: 'log_init_02',
      timestamp: new Date(now.getTime() - 48 * 60000).toISOString().replace('T', ' ').substring(0, 19),
      locationName: 'Mato Grosso Sector 4, Brazil',
      coordinates: { lat: -12.6819, lng: -56.9211 },
      weatherSummary: '31°C • Wind: 14.5 km/h • Precip: 0.0 mm/h',
      machinery: 'John Deere 8R Autonomous Tractor',
      mission: 'Soil Aeration & Subsoiling',
      tankLevel: '95.0 L / 120L',
      actionApproved: 'Autonomous Row Aeration Completed',
      energySavedKgCo2: 32.4,
      syncStatus: 'SYNCED_ONLINE',
    },
    {
      id: 'log_init_03',
      timestamp: new Date(now.getTime() - 110 * 60000).toISOString().replace('T', ' ').substring(0, 19),
      locationName: 'Beauceron Plain Parcel 9, France',
      coordinates: { lat: 48.35, lng: 1.6 },
      weatherSummary: '19°C • Wind: 8.4 km/h • Precip: 0.2 mm/h',
      machinery: 'XAG P100 Pro Heavy Sprayer',
      mission: 'Multispectral Crop Survey',
      tankLevel: '48.0 L / 50L',
      actionApproved: 'NDVI Spectral Mapping Matrix Cached',
      energySavedKgCo2: 8.6,
      syncStatus: 'CACHED_OFFLINE',
    },
  ];
}
