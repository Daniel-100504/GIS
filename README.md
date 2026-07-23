# Mapping System and Health Assessment for Mangrove Monitoring in Calatagan, Batangas

A web-based GIS dashboard that combines satellite NDVI (Copernicus Sentinel-2), field survey data (KoboToolbox), and a mangrove zone registry into one system for MENRO-Calatagan.

## Group Members

| Team Member | Assigned Module |
|-------------|-----------------|
| **Daniel J. Magarao** | Software Engineer |
| **Kaye M. Macalalad** | System Analyst |
| **Rome Dyanne S. Salvid** | System Tester |

---

## 1. Overview

- **Purpose:** Give MENRO officers a single dashboard to track mangrove health across Calatagan's barangay zones, cross-referencing satellite data with ranger field surveys.
- **Scope:** Role-based login, interactive zone map, satellite NDVI sync, KoboToolbox survey integration, analytics dashboard, PDF report export.
- **Not yet implemented:** Forest Ranger landing page, production auth backend, persistent zone database.

## 2. Architecture

```
Browser Client (Login.html, satellite.html, script.js, satellite.js, Dashboard.js, export.js)
        │  HTTPS
        ▼
PHP Proxy Layer  ── sentinel-proxy.php  ──▶  Copernicus Data Space Ecosystem (Sentinel Hub)
                 └─ kobo-proxy.php      ──▶  KoboToolbox API
```

The proxy layer exists so third-party API credentials never reach the browser.

**Stack:** Leaflet.js (map) · jsPDF (PDF export) · vanilla JS/CSS client · PHP proxies · Copernicus Sentinel Hub API · KoboToolbox REST API v2 · browser `localStorage`.

## 3. Use Cases

| Use Case | Actor | Description |
|---|---|---|
| Log In | Officer / Ranger | Select role, sign in |
| View Map & Layers | Officer | View zones; toggle NDVI, imagery, boundary layers |
| Search/Filter/Sort Zones | Officer | Locate zones by name, status, NDVI, or area |
| Sync Satellite NDVI | Officer | Pull mean NDVI per zone for a chosen date/cloud threshold |
| View Dashboard | Officer | Health breakdown, NDVI trend, threats, survey log |
| Export PDF Report | Officer | Generate a paginated field-survey report |
| Auto-sync Submissions | KoboToolbox (system) | Pull new field surveys into zone records |
| Provide Imagery/NDVI | CDSE (system) | Authenticate proxy, serve WMS/NDVI/catalog data |

## 4. Features & Requirements

### 4.1 Authentication & Roles
- Role selector (MENRO Officer / Forest Ranger), username/password validation
- MENRO login → map dashboard; Ranger login → placeholder (planned)
- Remember-me, password visibility toggle, sign-out

### 4.2 Map, Layers & Zone List
- Interactive Leaflet map with zone markers color-coded by health status
- Layer toggles: NDVI overlay, Sentinel-2 imagery, zone boundaries
- Search by name, filter by status, sort by name/NDVI/area
- Zone popup: area, partner org, NDVI, status, survey summary

### 4.3 Satellite NDVI Sync
- Scene date + cloud-coverage threshold picker (calendar/slider)
- "Sync Satellite NDVI" computes mean NDVI per zone (Sentinel-2 bands, 10-day window)
- Satellite NDVI shown alongside field-survey NDVI, not replacing it

### 4.4 Field Survey Integration (KoboToolbox)
- Auto-retrieves and merges submissions into matching zones
- Derives zone health status from survey data when satellite NDVI is absent
- Retains ranger name, date, canopy cover, species, threats, notes per zone

### 4.5 Dashboard & Reporting
- Zone counts, health breakdown, NDVI trend, threat/canopy breakdowns
- Survey activity log + calendar widget
- PDF export: scene summary, zone table, per-zone survey detail
- In-app guided walkthrough

## 5. Interface Requirements

- **UI:** login screen, map dashboard (top bar, layers control, side panel), analytics dashboard, guide/survey-detail modals
- **Hardware:** standard desktop/tablet/browser (officers); GPS-enabled mobile device (rangers, via KoboToolbox)
- **Software:** Leaflet.js, jsPDF, CDSE/Sentinel Hub APIs (OAuth2, WMS, Statistics, Catalog), KoboToolbox REST API v2
- **Communication:** HTTPS everywhere; proxies set CORS headers and return clear error codes on failure

## 6. Non-Functional Requirements

- **Performance:** map/zone list interactive within ~3s; visible progress during NDVI sync
- **Security:** ⚠️ move hard-coded CDSE/KoboToolbox credentials and the token cache out of source files before production; replace demo/localStorage login with a real auth backend; restrict CORS to the deployed origin
- **Reliability:** clear proxy error codes; Online/Offline indicator; last-good data stays visible on sync failure
- **Usability:** status shown via color + text; key actions within two clicks; in-app guide
- **Maintainability:** logic split by concern (auth/map/dashboard/export); CSS design tokens
- **Scalability:** review sequential NDVI sync as zone count grows; respect API rate limits
- **Data:** NDVI to ≥2 decimals; survey field names kept in sync with the KoboToolbox form schema

## 7. Other Requirements

- **Compliance:** PDF reports attributed to MENRO-Calatagan; ranger personal data handled per the Data Privacy Act (R.A. 10173); Copernicus data attribution on publication
- **Assumptions:** active CDSE/KoboToolbox accounts; rangers have periodic (not continuous) connectivity; zone set is relatively stable
- **Future work:** Ranger landing page, real auth backend + zone database, credentials moved to environment variables, scheduled/automatic NDVI sync
