# AgriTwin-B2B — Autonomous Multi-Fleet Swarm & Microclimate Fail-Safe Platform

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Google Gemini 1.5 Flash](https://img.shields.io/badge/Google_Gemini-1.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![#AIRiserVietnam2026](https://img.shields.io/badge/%23AIRiserVietnam2026-Innovator_Cohort-10B981?style=for-the-badge&logo=leaf)](https://github.com)

---

## 🌾 Overview

**AgriTwin-B2B** is an industrial-grade Digital Twin operating system designed for precision agriculture, autonomous multi-UAV swarm management, and microclimate fail-safe flight operations. Built specifically for high-throughput commercial farming and VietGAP standard compliance, the platform couples real-time geodetic telemetry with Google Gemini 1.5 Flash AI agronomic intelligence to dynamically calculate prescription rates, schedule multi-payload missions, and enforce hard atmospheric safety interlocks.

---

## 🚀 Core Features

### 1. 📐 Dynamic Spatial Control & Precision Geometries
- **Independent 4-Corner Polygon Resizing**: Interactive polygon boundary handles allowing granular geometric expansion and contraction from `0.5 ha` up to `100.0 ha` with sub-meter coordinate precision.
- **Continuous 0°–360° Polygon Orientation**: Real-time planar rotation about the sector centroid with exact floating-point decimal precision (`0.1°` angular resolution) preserved without integer rounding.
- **Centroid Drag-and-Drop Relocation**: Move individual sectors or entire field mosaics across terrain while preserving exact internal swath spacing and corner vertex geometry.
- **Direct Numerical Parameter Inputs**: Bi-directional synchronized inputs for Plot Width, Length, Area, Centroid Lat/Lng, and Swath Line Offset.

### 2. 🚁 Smart Fleet Tracking & Multi-Payload Swarm
- **Parallel Multi-Payload Dispatch**: Orchestrates heterogeneous multi-drone fleets with specialized tank configurations:
  - **Alpha Fleet**: Targeted Crop Protection & Chemical Sprayers (`16.0 L` tank, micron atomizers).
  - **Beta Fleet**: High-Volume Micro-Irrigation & Foliar Hydration (`40.0 L` tank, high-flow boom).
  - **Delta Fleet**: Granular Fertilizer & Liquid Bio-Stimulants (`25.0 L` tank, pneumatic spreader).
- **Relocated Coordinate Synchronization**: Swarm flight trajectories automatically retarget and recalculate paths when parcels are repositioned, resized, or rotated.
- **Intelligent Plot Skipping**: Disabled/skipped plots are immediately bypassed by the swarm controller, dynamically reallocating flight paths and payloads to active zones without mission pauses.

### 3. ⚡ Telemetry & Hard Weather Interlocks
- **Real-Time Machine Telemetry**: High-frequency monitoring of battery SoC (`%`), discharge rate (`V/A`), fluid tank capacity (`L`), nozzle pressure, and flight speed.
- **Atmospheric Safety Thresholds (Hard Interlocks)**:
  - **Wind Speed**: $\ge 15.0\text{ km/h}$ triggers automated spray drift warning and high-wind RTL.
  - **Precipitation**: $\ge 1.0\text{ mm/h}$ triggers rain sensor interlock to prevent chemical runoff and drone short-circuit.
  - **Temperature Range**: Outside $5.0^\circ\text{C} - 40.0^\circ\text{C}$ locks discharge pumps to protect crop foliage and battery chemistry.
- **Auto-RTH (Return-To-Home)**: Triggers immediate abort and fly-back to automated dock whenever safety interlocks trip, battery drops below critical reserve ($<20\%$), or tank runs empty ($<0.5\text{ L}$).
- **Mission Breakpoint Memory**: Exact 3D waypoint coordinates, active sector indices, and remaining fluid requirements are saved upon RTH. Swarm can resume spraying exactly where it left off with zero overlapping overspray.

### 4. 🛡️ Dynamic No-Fly Zone (NFZ) & Airspace Safeguards
- **Draggable & Resizable Restricted Airspace**: Operators can position and adjust restricted polygons (e.g., cell towers, power lines, residential boundaries).
- **Geometric Overlap Intersection Detection**: Real-time polygon-polygon SAT (Separating Axis Theorem) and ray-casting algorithms calculate spatial conflicts.
- **Launch Invalidation**: Swarm dispatch is automatically disabled and visual alerts trigger whenever any enabled sector or transit vector intersects active NFZ boundaries.

### 5. 💾 State Persistence & Audit Trail
- **Local Storage Auto-Persistence**: Full mission state (all parcel coordinates, corner offsets, rotation angles, active sector toggles, NFZ geometry, and field area) is automatically serialized to browser `localStorage`. Survives tab refreshes and offline disconnects.
- **"Accept & Save Mission Performance"**: One-click confirmation that commits field geometry, logs an immutable entry to the VietGAP compliance ledger, and caches snapshot backups.
- **Google Docs & Multi-Format Export**:
  - **Google Docs / Word XML**: Download clean `.doc` formatted performance summaries with executive metrics, weather conditions, and sector prescription breakdowns ready to open directly in Google Docs or MS 365.
  - **JSON Telemetry Schema**: Export and import complete raw configuration packages (`.json`) across operators.
  - **VietGAP Compliance PDF**: Comprehensive certification log including GPS coordinates, chemical formulations, wind drift risk assessments, and carbon offset calculations ($\text{kg CO}_2\text{e}$).

---

## 🧠 AI Agronomic Engine (Google Gemini 1.5 Flash)

AgriTwin-B2B integrates Google Gemini 1.5 Flash to provide real-time prescription intelligence:
- Analyzes soil moisture, ambient temperature, humidity, wind drift risk, and NDVI canopy health.
- Automatically calculates Variable Rate Application (VRA) dosages for N-P-K fertilizer and crop protection agents.
- Generates localized advisory briefings in English, Vietnamese, and Japanese.

---

## 📁 Repository & File Structure

```text
agritwin-b2b/
├── .env.example                         # Environment variable definitions
├── metadata.json                        # App metadata & permission requirements
├── package.json                         # Dependencies & project scripts
├── server.ts                            # Express API proxy & Gemini AI integration
├── index.html                           # Single-page application entry point
├── vite.config.ts                       # Vite bundler configuration
└── src/
    ├── main.tsx                         # React 19 application mount
    ├── App.tsx                          # Primary state coordinator & digital twin layout
    ├── index.css                        # Tailwind CSS imports & custom styles
    ├── types.ts                         # Universal TypeScript interfaces & enums
    ├── components/
    │   ├── Navbar.tsx                   # Top navigation, status indicator, action triggers
    │   ├── MapCanvas.tsx                # Leaflet geodetic canvas, drone flight paths, NFZ
    │   ├── PrescriptionZonePainter.tsx  # Dynamic spatial controls, 4-corner sizing, rotation
    │   ├── HardwareFleetPanel.tsx       # Drone specifications, battery, tank telemetry
    │   ├── AIAdvisoryPanel.tsx          # Gemini 1.5 Flash agronomic insights & VRA advice
    │   ├── AuditTrailLog.tsx            # VietGAP compliance ledger & log export
    │   ├── MissionPerformanceReportModal.tsx # Google Doc & audit summary modal
    │   ├── OpenSavedMissionModal.tsx    # File-drop & browser cache mission loader
    │   └── WeatherCard.tsx              # Microclimate telemetry & safety interlock badges
    ├── services/
    │   ├── storageService.ts            # localStorage persistence & mission state serialization
    │   ├── missionReportService.ts      # Google Doc XML, JSON export & clipboard formatting
    │   ├── weatherSafetyService.ts      # Hard atmospheric interlock evaluator
    │   ├── geminiService.ts             # Google GenAI client-to-server dispatch
    │   ├── pdfService.ts                # VietGAP compliance report generator (jsPDF)
    │   └── voiceAlertService.ts         # Audio and speech synthesis alerts
    └── i18n/
        └── translations.ts              # Multilingual support (EN, VI, JA)
```

---

## ⚡ Quick Start & Installation Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/agritwin-b2b.git
cd agritwin-b2b
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory (refer to `.env.example`):
```bash
cp .env.example .env
```

Add your Google Gemini API key:
```env
REACT_APP_GEMINI_API_KEY=your_google_gemini_api_key_here
GEMINI_API_KEY=your_google_gemini_api_key_here
```

### 4. Run the Development Server
```bash
npm run dev
```
Open your browser and navigate to:
```text
http://localhost:3000
```

### 5. Production Build & Start
To compile the TypeScript bundle and run the production server:
```bash
# Compile client and server bundles
npm run build

# Start production server
npm start
```

---

## 📊 Telemetry & Safety Matrix Reference

| Telemetry Parameter | Safe Operating Window | Warning Trigger | Auto-RTH Interlock Action |
|:---|:---|:---|:---|
| **Wind Speed** | $0.0 - 12.0\text{ km/h}$ | $12.1 - 14.9\text{ km/h}$ | $\ge 15.0\text{ km/h}$ (Immediate Abort & RTH) |
| **Precipitation** | $0.0\text{ mm/h}$ (Dry) | Trace moisture | $\ge 1.0\text{ mm/h}$ (Rain Interlock Abort) |
| **Ambient Temperature**| $15.0^\circ\text{C} - 32.0^\circ\text{C}$ | $<10.0^\circ\text{C}$ or $>35.0^\circ\text{C}$ | $<5.0^\circ\text{C}$ or $>40.0^\circ\text{C}$ (Thermal Abort) |
| **Battery Level (SoC)**| $30\% - 100\%$ | $20\% - 29\%$ | $< 20\%$ (Low Battery Failsafe) |
| **Fluid Tank Level** | $2.0\text{ L} - 40.0\text{ L}$ | $0.6\text{ L} - 1.9\text{ L}$ | $\le 0.5\text{ L}$ (Dry Run Protection RTL) |
| **Airspace Conflict** | $0\text{ NFZ Intersections}$ | Peripheral Proximity | Boundary Breach (Launch Blocked / Auto-RTH) |

---

## 📜 VietGAP Compliance & Certifications
AgriTwin-B2B satisfies the tracking and auditing guidelines set by the Vietnam Good Agricultural Practices (VietGAP) framework:
- **Zero Chemical Drift Record**: Automated logging of wind velocities during every dispersal cycle.
- **Accredited Dosage Adherence**: Continuous tracking of applied active ingredients per hectare ($\text{L/ha}$ or $\text{kg/ha}$).
- **Immutable Timestamp Ledger**: Mission coordinates, machinery IDs, operator confirmations, and environmental factors recorded with ISO 8601 timestamps.

---

## 👥 Contributors & Acknowledgements
- Developed for precision agriculture operations and fleet telemetry automation.
- Proudly presented as part of the **#AIRiserVietnam2026** cohort initiative.
