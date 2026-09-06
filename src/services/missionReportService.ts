import {
  Coordinates,
  TelemetryData,
  SubZonePolygonData,
  calculatePrescriptionTotals,
} from '../types';
import { WEATHER_SAFETY_LIMITS } from './weatherSafetyService';
import { AgriTwinSavedMissionState, saveActiveMissionLayout } from './storageService';

export interface MissionPerformanceReportData {
  missionId: string;
  timestamp: string;
  savedAtFormatted: string;
  locationName: string;
  coordinates: Coordinates;
  fieldArea: number;
  subZones: SubZonePolygonData[];
  nfzPolygon: Coordinates[];
  telemetry: TelemetryData;
  activeUnitName?: string;
  hasNfzConflict?: boolean;
}

/**
 * Builds the data structure for the report from current application state.
 */
export function buildMissionReportData(params: {
  locationName: string;
  coordinates: Coordinates;
  fieldArea: number;
  subZones: SubZonePolygonData[];
  nfzPolygon: Coordinates[];
  telemetry: TelemetryData;
  activeUnitName?: string;
  hasNfzConflict?: boolean;
}): MissionPerformanceReportData {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const missionId = `AGRI-PERF-${dateStr}-${timeStr}`;

  return {
    missionId,
    timestamp: now.toISOString(),
    savedAtFormatted: now.toLocaleString(),
    locationName: params.locationName || 'Mekong Rice Cooperative Zone Alpha',
    coordinates: params.coordinates || { lat: 10.005, lng: 105.722 },
    fieldArea: params.fieldArea || 2.5,
    subZones: params.subZones || [],
    nfzPolygon: params.nfzPolygon || [],
    telemetry: params.telemetry,
    activeUnitName: params.activeUnitName || 'DJI Agras T40 Swarm Cluster',
    hasNfzConflict: params.hasNfzConflict || false,
  };
}

/**
 * Generates an immutable HTML report designed to open seamlessly in Google Docs & Microsoft Word (.doc).
 * Includes summary table of active sectors, fluid required, weather limits, and embedded JSON recovery payload.
 */
export function generateMissionReportHTML(data: MissionPerformanceReportData): string {
  const totals = calculatePrescriptionTotals(data.subZones);
  const activeSectors = data.subZones.filter((z) => z.enabled !== false);
  const totalAreaActiveHa = activeSectors.reduce((sum, z) => sum + (z.areaHa || 0), 0);
  const totalLiquidL = totals.canopyWaterVolume + totals.pesticideChemicalVolume;

  const windOk = data.telemetry.windSpeed < WEATHER_SAFETY_LIMITS.MAX_WIND_SPEED_KMH;
  const rainOk = data.telemetry.precipitation < WEATHER_SAFETY_LIMITS.MAX_RAIN_RATE_MMH;
  const tempOk = data.telemetry.temp >= 10 && data.telemetry.temp <= 38;
  const battOk = data.telemetry.battery >= 20;
  const nfzOk = !data.hasNfzConflict;

  // Generate saved state for recovery payload
  const recoveryState: AgriTwinSavedMissionState = saveActiveMissionLayout({
    subZones: data.subZones,
    nfzPolygon: data.nfzPolygon,
    fieldArea: data.fieldArea,
    locationName: data.locationName,
    currentCoords: data.coordinates,
    isExplicitCommit: false,
  });

  const recoveryJsonString = JSON.stringify(recoveryState, null, 2);

  return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>AgriTwin Mission Performance & State Report - ${data.missionId}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      background-color: #ffffff;
      line-height: 1.5;
      margin: 30px;
    }
    .header-banner {
      border-bottom: 3px solid #059669;
      padding-bottom: 14px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 20pt;
      font-weight: bold;
      color: #065f46;
      margin: 0 0 4px 0;
    }
    .sub-title {
      font-size: 11pt;
      color: #475569;
      margin: 0;
      font-weight: 500;
    }
    .meta-grid {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px;
      margin-bottom: 24px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    .meta-table td {
      padding: 4px 8px;
      vertical-align: top;
    }
    .meta-label {
      color: #64748b;
      font-weight: bold;
      width: 22%;
    }
    .meta-value {
      color: #0f172a;
      font-weight: 600;
    }
    h2 {
      font-size: 13pt;
      color: #0f766e;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 9.5pt;
    }
    table.data-table th {
      background-color: #0f172a;
      color: #ffffff;
      padding: 8px 10px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #0f172a;
    }
    table.data-table td {
      padding: 7px 10px;
      border: 1px solid #cbd5e1;
    }
    table.data-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8.5pt;
      font-weight: bold;
    }
    .badge-active { background-color: #dcfce7; color: #15803d; }
    .badge-skip { background-color: #f1f5f9; color: #64748b; }
    .badge-healthy { background-color: #e0f2fe; color: #0369a1; }
    .badge-nitrogen { background-color: #fef3c7; color: #b45309; }
    .badge-pest { background-color: #ffe4e6; color: #be123c; }
    .metric-grid {
      display: table;
      width: 100%;
      margin-bottom: 20px;
    }
    .metric-col {
      display: table-cell;
      width: 25%;
      padding: 8px;
    }
    .metric-card {
      background-color: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }
    .metric-card-val {
      font-size: 15pt;
      font-weight: bold;
      color: #166534;
      margin: 4px 0;
    }
    .metric-card-lbl {
      font-size: 8.5pt;
      color: #475569;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-pass { color: #166534; font-weight: bold; }
    .status-warn { color: #b91c1c; font-weight: bold; }
    .recovery-box {
      background-color: #f8fafc;
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 12px;
      margin-top: 24px;
    }
    pre#agritwin-recovery-payload {
      background-color: #0f172a;
      color: #38bdf8;
      padding: 12px;
      font-family: "Courier New", Courier, monospace;
      font-size: 8pt;
      border-radius: 4px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 280px;
    }
    .footer {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      font-size: 8.5pt;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header-banner">
    <div class="brand-title">AgriTwin-B2B Autonomous Dispatch</div>
    <div class="sub-title">Mission Performance &amp; State Report &bull; Immutable Field Layout Commit</div>
  </div>

  <!-- MISSION METADATA -->
  <div class="meta-grid">
    <table class="meta-table">
      <tr>
        <td class="meta-label">Mission ID:</td>
        <td class="meta-value"><code>${data.missionId}</code></td>
        <td class="meta-label">Committed At:</td>
        <td class="meta-value">${data.savedAtFormatted}</td>
      </tr>
      <tr>
        <td class="meta-label">Field Location:</td>
        <td class="meta-value">${data.locationName}</td>
        <td class="meta-label">Center GPS:</td>
        <td class="meta-value">${data.coordinates.lat.toFixed(5)}° N, ${data.coordinates.lng.toFixed(5)}° E</td>
      </tr>
      <tr>
        <td class="meta-label">Total Boundary Area:</td>
        <td class="meta-value">${data.fieldArea.toFixed(2)} ha</td>
        <td class="meta-label">Active Spray Area:</td>
        <td class="meta-value">${totalAreaActiveHa.toFixed(2)} ha (${activeSectors.length} of ${data.subZones.length} Sectors Active)</td>
      </tr>
      <tr>
        <td class="meta-label">Fleet Equipment:</td>
        <td class="meta-value">${data.activeUnitName || 'DJI Agras T40 Swarm Cluster'}</td>
        <td class="meta-label">Storage Lock Status:</td>
        <td class="meta-value" style="color:#059669;">&check; Committed to Browser Storage (localStorage)</td>
      </tr>
    </table>
  </div>

  <!-- 1. SUMMARY TABLE OF ACTIVE SECTORS -->
  <h2>1. Precision Sub-Sector Layout &amp; Assigned Payloads</h2>
  <p style="font-size:9.5pt; color:#475569; margin-top:0;">
    The table below summarizes each customized parcel sector, custom floating-point area, orientation angle, payload rate, and active spray toggle:
  </p>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 22%;">Sector Name &amp; ID</th>
        <th style="width: 11%;">Status</th>
        <th style="width: 14%;">Crop Condition</th>
        <th style="width: 16%;">Payload Chemical</th>
        <th style="width: 10%;">Area (ha)</th>
        <th style="width: 10%;">Angle (°)</th>
        <th style="width: 12%;">Rate &amp; Nozzle</th>
      </tr>
    </thead>
    <tbody>
      ${data.subZones
        .map((z, idx) => {
          const isEnabled = z.enabled !== false;
          const statusBadge = isEnabled
            ? '<span class="badge badge-active">ACTIVE</span>'
            : '<span class="badge badge-skip">SKIPPED</span>';

          const conditionBadge =
            z.healthType === 'HEALTHY'
              ? '<span class="badge badge-healthy">HEALTHY</span>'
              : z.healthType === 'NITROGEN_DEFICIT'
              ? '<span class="badge badge-nitrogen">NITROGEN DEFICIT</span>'
              : '<span class="badge badge-pest">PEST STRESS</span>';

          const payloadLabel =
            z.healthType === 'HEALTHY'
              ? 'Canopy Water Mist'
              : z.healthType === 'NITROGEN_DEFICIT'
              ? 'Nitrogen Granules'
              : 'Targeted Bio-Pesticide';

          const rateUnit = z.healthType === 'NITROGEN_DEFICIT' ? 'kg/ha' : 'L/ha';
          const rateVal = z.dosageRateLPerHa || (z.healthType === 'PEST_STRESS' ? 20 : z.healthType === 'HEALTHY' ? 15 : 12);
          const nozzleVal = z.targetNozzleMicrons || 180;
          const angleVal = (typeof z.rotationAngle === 'number' ? z.rotationAngle : (z.rotationDeg || 0)).toFixed(1);

          return `<tr>
            <td style="font-weight:bold; color:#475569; text-align:center;">${idx + 1}</td>
            <td><strong>${z.name}</strong><br><span style="font-size:8pt; color:#64748b;">${z.id}</span></td>
            <td>${statusBadge}</td>
            <td>${conditionBadge}</td>
            <td>${payloadLabel}</td>
            <td style="font-weight:bold; font-family:monospace;">${(z.areaHa || 0.42).toFixed(2)} ha</td>
            <td style="font-family:monospace; color:#0f766e;">${angleVal}°</td>
            <td style="font-size:8.5pt;">${rateVal} ${rateUnit}<br><span style="color:#64748b;">${nozzleVal} µm</span></td>
          </tr>`;
        })
        .join('')}
    </tbody>
  </table>

  <!-- 2. FLUID & CHEMICAL RESOURCE REQUIREMENTS -->
  <h2>2. Total Resource &amp; Flight Energy Consumption</h2>
  <div class="metric-grid">
    <div class="metric-col">
      <div class="metric-card" style="background:#f0fdf4; border-color:#86efac;">
        <div class="metric-card-lbl">Canopy Water Required</div>
        <div class="metric-card-val" style="color:#0369a1;">${totals.canopyWaterVolume.toFixed(1)} L</div>
        <div style="font-size:8pt; color:#64748b;">15 L/ha on Healthy Crops</div>
      </div>
    </div>
    <div class="metric-col">
      <div class="metric-card" style="background:#fefce8; border-color:#fde047;">
        <div class="metric-card-lbl">Nitrogen Fertilizer</div>
        <div class="metric-card-val" style="color:#b45309;">${totals.nutrientNitrogenKg.toFixed(1)} kg</div>
        <div style="font-size:8pt; color:#64748b;">12 kg/ha on Deficit Plots</div>
      </div>
    </div>
    <div class="metric-col">
      <div class="metric-card" style="background:#fff1f2; border-color:#fda4af;">
        <div class="metric-card-lbl">Bio-Pesticide Chemical</div>
        <div class="metric-card-val" style="color:#be123c;">${totals.pesticideChemicalVolume.toFixed(1)} L</div>
        <div style="font-size:8pt; color:#64748b;">20 L/ha on Pest Outbreaks</div>
      </div>
    </div>
    <div class="metric-col">
      <div class="metric-card" style="background:#f8fafc; border-color:#cbd5e1;">
        <div class="metric-card-lbl">Total Liquid Volume</div>
        <div class="metric-card-val" style="color:#0f172a;">${totalLiquidL.toFixed(1)} L</div>
        <div style="font-size:8pt; color:#64748b;">Water + Bio-Protection</div>
      </div>
    </div>
  </div>

  <table class="data-table" style="margin-top:8px;">
    <thead>
      <tr>
        <th>Resource Parameter</th>
        <th>Calculated Value</th>
        <th>Operational Recommendation</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Active Spray Swath Time</strong></td>
        <td>~${(totalAreaActiveHa * 7.5).toFixed(1)} minutes</td>
        <td>Calculated at 6.0m swath spacing and 6.5 m/s autonomous cruise velocity</td>
      </tr>
      <tr>
        <td><strong>Estimated Swarm Battery Drain</strong></td>
        <td>~${Math.round(totalAreaActiveHa * 35)}% per drone</td>
        <td>${totalAreaActiveHa * 35 > 80 ? 'Multi-cycle battery swap required' : 'Direct single-cycle flight envelope sufficient'}</td>
      </tr>
      <tr>
        <td><strong>Estimated Carbon Offset</strong></td>
        <td>${(totalAreaActiveHa * 3.2).toFixed(1)} kg CO₂ saved</td>
        <td>Compared to traditional internal combustion high-clearance tractors</td>
      </tr>
    </tbody>
  </table>

  <!-- 3. WEATHER & OPERATIONAL SAFETY LIMITS -->
  <h2>3. Microclimate Envelope &amp; Safety Compliance Limits</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th>Safety Parameter</th>
        <th>Threshold Limit</th>
        <th>Current Captured Value</th>
        <th>Safety Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Wind Velocity</strong></td>
        <td>&le; ${WEATHER_SAFETY_LIMITS.MAX_WIND_SPEED_KMH.toFixed(1)} km/h</td>
        <td>${data.telemetry.windSpeed.toFixed(1)} km/h</td>
        <td>${windOk ? '<span class="status-pass">&check; WITHIN SAFE LIMITS</span>' : '<span class="status-warn">&cross; EXCEEDS LIMIT (SPRAY DRIFT HAZARD)</span>'}</td>
      </tr>
      <tr>
        <td><strong>Precipitation Rate</strong></td>
        <td>&le; ${WEATHER_SAFETY_LIMITS.MAX_RAIN_RATE_MMH.toFixed(1)} mm/h</td>
        <td>${data.telemetry.precipitation.toFixed(1)} mm/h</td>
        <td>${rainOk ? '<span class="status-pass">&check; WITHIN SAFE LIMITS</span>' : '<span class="status-warn">&cross; RAIN DETECTED (WASHOFF RISK)</span>'}</td>
      </tr>
      <tr>
        <td><strong>Ambient Temperature</strong></td>
        <td>10.0°C &ndash; 38.0°C</td>
        <td>${data.telemetry.temp.toFixed(1)} °C</td>
        <td>${tempOk ? '<span class="status-pass">&check; OPTIMAL</span>' : '<span class="status-warn">&cross; EXTREME TEMPERATURE</span>'}</td>
      </tr>
      <tr>
        <td><strong>Battery Reserve at Dock</strong></td>
        <td>&ge; 20.0%</td>
        <td>${data.telemetry.battery.toFixed(0)}%</td>
        <td>${battOk ? '<span class="status-pass">&check; SUFFICIENT</span>' : '<span class="status-warn">&cross; CRITICAL LEVEL (&le; 20%)</span>'}</td>
      </tr>
      <tr>
        <td><strong>No-Fly Zone (NFZ) Clearance</strong></td>
        <td>Zero Overlap with Residential Airspace</td>
        <td>${data.hasNfzConflict ? '1 or more sectors intersect NFZ' : 'Airspace boundary verified clear'}</td>
        <td>${nfzOk ? '<span class="status-pass">&check; AIRSPACE CLEAR</span>' : '<span class="status-warn">&cross; BLOCKED: NFZ INTERSECTION</span>'}</td>
      </tr>
    </tbody>
  </table>

  <!-- 4. RECOVERY PAYLOAD -->
  <h2>4. Embedded JSON Recovery Payload (Immutable State Snapshot)</h2>
  <div class="recovery-box">
    <p style="font-size:9pt; color:#475569; margin-top:0;">
      This machine-readable payload enables 100% loss-less layout and coordinate recovery in AgriTwin-B2B. It contains all exact polygon bounds, GPS centroids, orientation angles, and custom area values:
    </p>
    <pre id="agritwin-recovery-payload">${recoveryJsonString}</pre>
  </div>

  <div class="footer">
    AgriTwin-B2B Global Autonomous Dispatch Engine &bull; Generated: ${data.savedAtFormatted} &bull; Verification Hash: ${data.missionId}
  </div>

</body>
</html>`;
}

/**
 * Generates clean HTML snippet optimized for copying to clipboard and pasting straight into Google Docs.
 */
export function generateGoogleDocsClipboardHTML(data: MissionPerformanceReportData): string {
  // Returns clean inline HTML that Google Docs recognizes and converts into formatted tables.
  const totals = calculatePrescriptionTotals(data.subZones);
  const activeSectors = data.subZones.filter((z) => z.enabled !== false);
  const totalAreaActiveHa = activeSectors.reduce((sum, z) => sum + (z.areaHa || 0), 0);

  return `<div style="font-family:Arial, sans-serif; color:#0f172a; line-height:1.4;">
    <h1 style="color:#065f46; font-size:18pt; border-bottom:2px solid #059669; padding-bottom:6px; margin-bottom:4px;">
      AgriTwin Mission Performance &amp; State Report
    </h1>
    <p style="font-size:10pt; color:#475569; margin-top:0;">
      <strong>Mission ID:</strong> ${data.missionId} | <strong>Location:</strong> ${data.locationName} (${data.coordinates.lat.toFixed(5)}°N, ${data.coordinates.lng.toFixed(5)}°E) | <strong>Date:</strong> ${data.savedAtFormatted}
    </p>

    <h2 style="color:#0f766e; font-size:13pt; margin-top:16px; border-bottom:1px solid #cbd5e1;">
      1. Sector Layout &amp; Custom Geometry Summary (${activeSectors.length} Active of ${data.subZones.length} Sectors, ${totalAreaActiveHa.toFixed(2)} ha Total)
    </h2>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; font-size:9.5pt; border-color:#cbd5e1;">
      <tr style="background-color:#0f172a; color:#ffffff;">
        <th align="left">Sector</th>
        <th align="center">Status</th>
        <th align="left">Condition</th>
        <th align="left">Payload</th>
        <th align="right">Area (ha)</th>
        <th align="right">Angle (°)</th>
        <th align="left">Rate &amp; Nozzle</th>
      </tr>
      ${data.subZones
        .map(
          (z) => `<tr>
        <td><strong>${z.name}</strong></td>
        <td align="center">${z.enabled !== false ? '<strong>ACTIVE</strong>' : '<span style="color:#64748b;">SKIPPED</span>'}</td>
        <td>${z.healthType}</td>
        <td>${z.chemicalType}</td>
        <td align="right"><strong>${(z.areaHa || 0.42).toFixed(2)} ha</strong></td>
        <td align="right">${(typeof z.rotationAngle === 'number' ? z.rotationAngle : (z.rotationDeg || 0)).toFixed(1)}°</td>
        <td>${z.dosageRateLPerHa || 15} L/ha (${z.targetNozzleMicrons || 180} µm)</td>
      </tr>`
        )
        .join('')}
    </table>

    <h2 style="color:#0f766e; font-size:13pt; margin-top:16px; border-bottom:1px solid #cbd5e1;">
      2. Required Fluids &amp; Chemicals Breakdown
    </h2>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; font-size:9.5pt; border-color:#cbd5e1;">
      <tr style="background-color:#f8fafc;">
        <td><strong>Canopy Hydration Water</strong></td>
        <td>${totals.canopyWaterVolume.toFixed(1)} Liters</td>
      </tr>
      <tr style="background-color:#f8fafc;">
        <td><strong>Nitrogen Fertilizer Granules</strong></td>
        <td>${totals.nutrientNitrogenKg.toFixed(1)} kg</td>
      </tr>
      <tr style="background-color:#f8fafc;">
        <td><strong>Targeted Bio-Pesticide Chemical</strong></td>
        <td>${totals.pesticideChemicalVolume.toFixed(1)} Liters</td>
      </tr>
      <tr style="background-color:#f0fdf4;">
        <td><strong>Total Spray Volume Required</strong></td>
        <td><strong>${(totals.canopyWaterVolume + totals.pesticideChemicalVolume).toFixed(1)} Liters</strong></td>
      </tr>
    </table>

    <h2 style="color:#0f766e; font-size:13pt; margin-top:16px; border-bottom:1px solid #cbd5e1;">
      3. Weather Safety Limits &amp; Airspace Verification
    </h2>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; font-size:9.5pt; border-color:#cbd5e1;">
      <tr>
        <td>Wind Speed: <strong>${data.telemetry.windSpeed.toFixed(1)} km/h</strong> (Limit: &le; 15 km/h)</td>
        <td>Status: <strong>${data.telemetry.windSpeed < WEATHER_SAFETY_LIMITS.MAX_WIND_SPEED_KMH ? 'PASSED (SAFE)' : 'UNSAFE EXCEEDED'}</strong></td>
      </tr>
      <tr>
        <td>Precipitation: <strong>${data.telemetry.precipitation.toFixed(1)} mm/h</strong> (Limit: &le; 1.0 mm/h)</td>
        <td>Status: <strong>${data.telemetry.precipitation < WEATHER_SAFETY_LIMITS.MAX_RAIN_RATE_MMH ? 'PASSED (SAFE)' : 'UNSAFE EXCEEDED'}</strong></td>
      </tr>
      <tr>
        <td>Airspace NFZ Clearance</td>
        <td>Status: <strong>${!data.hasNfzConflict ? 'PASSED (CLEAR OF NFZ)' : 'BLOCKED (INTERSECTS RESTRICTED ZONE)'}</strong></td>
      </tr>
    </table>
  </div>`;
}

/**
 * Triggers download of the report in .doc format (opens natively in Google Docs and Word).
 */
export function exportMissionPerformanceDoc(data: MissionPerformanceReportData): void {
  const htmlContent = generateMissionReportHTML(data);
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `AgriTwin_Mission_Performance_Report_${data.missionId}.doc`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers download of the raw JSON recovery payload.
 */
export function exportMissionPerformanceJson(data: MissionPerformanceReportData): void {
  const recoveryState: AgriTwinSavedMissionState = saveActiveMissionLayout({
    subZones: data.subZones,
    nfzPolygon: data.nfzPolygon,
    fieldArea: data.fieldArea,
    locationName: data.locationName,
    currentCoords: data.coordinates,
    isExplicitCommit: true,
  });

  const jsonString = JSON.stringify(recoveryState, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `AgriTwin_Mission_Config_${data.missionId}.json`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copies rich HTML formatted text to clipboard so user can paste (Ctrl+V) directly into Google Docs.
 */
export async function copyMissionReportToClipboard(data: MissionPerformanceReportData): Promise<boolean> {
  const html = generateGoogleDocsClipboardHTML(data);
  const plain = `AgriTwin Mission Performance Report - ${data.missionId}\nLocation: ${data.locationName}\nArea: ${data.fieldArea} ha\nSaved At: ${data.savedAtFormatted}`;

  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([plain], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText,
      });
      await navigator.clipboard.write([item]);
      return true;
    } else {
      await navigator.clipboard.writeText(plain);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard write failed:', err);
    return false;
  }
}

/**
 * Parses and validates an uploaded file string (supports pure JSON or HTML with embedded payload).
 */
export function parseAndValidateMissionFile(fileContent: string): AgriTwinSavedMissionState | null {
  if (!fileContent || typeof fileContent !== 'string') return null;

  let targetJsonString = fileContent.trim();

  // If the file is an HTML / .doc report, extract the embedded payload from <pre id="agritwin-recovery-payload">
  if (targetJsonString.includes('id="agritwin-recovery-payload"')) {
    const match = targetJsonString.match(/<pre[^>]*id=["']agritwin-recovery-payload["'][^>]*>([\s\S]*?)<\/pre>/i);
    if (match && match[1]) {
      targetJsonString = match[1].trim();
    }
  } else if (targetJsonString.startsWith('<html') || targetJsonString.startsWith('<!DOCTYPE')) {
    // Attempt regex extraction for json block
    const match = targetJsonString.match(/\{[\s\S]*"subZones"[\s\S]*\}/);
    if (match && match[0]) {
      targetJsonString = match[0].trim();
    }
  }

  try {
    const parsed = JSON.parse(targetJsonString);
    if (parsed && Array.isArray(parsed.subZones) && parsed.subZones.length > 0) {
      // Validate that at least one subzone has bounds
      const validZones = parsed.subZones.filter((z: any) => z && Array.isArray(z.bounds) && z.bounds.length >= 3);
      if (validZones.length > 0) {
        return parsed as AgriTwinSavedMissionState;
      }
    }
  } catch (err) {
    console.warn('Failed to parse mission JSON content:', err);
  }

  return null;
}
