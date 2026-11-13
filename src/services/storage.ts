import {
  AmbulanceVehicle,
  GoogleSheetsConfig,
  InspectionRecord,
  UserProfile,
  VehicleDamageItem,
  FuelLogRecord,
} from '../types';
import { createFreshChecklist } from '../data/defaultChecklist';

const VEHICLES_STORAGE_KEY = 'bls_vehicles_fleet_v1';
const INSPECTIONS_STORAGE_KEY = 'bls_inspections_history_v1';
const CURRENT_USER_KEY = 'bls_current_user_v1';
const GSHEETS_CONFIG_KEY = 'bls_gsheets_config_v1';

// Clean SVG ambulance illustration placeholder
export function generateSvgCarPlaceholder(label: string, angle: string, color = '#2563eb'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="#0f172a" />
    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1e293b" stroke-width="1"/>
    </pattern>
    <rect width="600" height="400" fill="url(#grid)" />
    
    <!-- Vehicle Body -->
    <rect x="90" y="140" width="420" height="150" rx="20" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/>
    <rect x="130" y="160" width="100" height="50" rx="8" fill="#38bdf8" opacity="0.3"/>
    <rect x="250" y="160" width="110" height="50" rx="8" fill="#38bdf8" opacity="0.3"/>
    <rect x="380" y="160" width="100" height="50" rx="8" fill="#38bdf8" opacity="0.3"/>
    
    <!-- Emergency Light Bar -->
    <rect x="230" y="120" width="140" height="20" rx="6" fill="#ef4444"/>
    <rect x="290" y="120" width="80" height="20" rx="6" fill="#3b82f6"/>
    <circle cx="260" cy="130" r="4" fill="#ffffff" opacity="0.8"/>
    <circle cx="330" cy="130" r="4" fill="#ffffff" opacity="0.8"/>
    
    <!-- Star of Life / Cross -->
    <circle cx="300" cy="225" r="28" fill="${color}" opacity="0.9"/>
    <rect x="293" y="205" width="14" height="40" fill="#ffffff" rx="2"/>
    <rect x="280" y="218" width="40" height="14" fill="#ffffff" rx="2"/>
    
    <!-- Wheels -->
    <circle cx="170" cy="290" r="34" fill="#1e293b" stroke="#475569" stroke-width="6"/>
    <circle cx="170" cy="290" r="14" fill="#94a3b8"/>
    <circle cx="430" cy="290" r="34" fill="#1e293b" stroke="#475569" stroke-width="6"/>
    <circle cx="430" cy="290" r="14" fill="#94a3b8"/>
    
    <!-- Label Banner -->
    <rect x="150" y="335" width="300" height="36" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>
    <text x="300" y="358" font-family="sans-serif" font-size="15" font-weight="bold" fill="#38bdf8" text-anchor="middle">
      ${label} · ${angle}
    </text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Single Source of Truth: All vehicles and inspections originate strictly from Google Drive & Sheets (No Mock Demo Data)
export const INITIAL_VEHICLES: AmbulanceVehicle[] = [];

export const INITIAL_INSPECTIONS: InspectionRecord[] = [];

const STAFF_STORAGE_KEY = 'bls_staff_members_v1';

export const INITIAL_STAFF: UserProfile[] = [];

export const DEFAULT_USER: UserProfile = {
  id: 'current-operator',
  name: 'เจ้าหน้าที่กู้ชีพ',
  role: 'staff',
  employeeId: 'EMT-001',
  status: 'active',
  email: '',
};

export const DEMO_USERS: Record<string, UserProfile> = {
  staff: DEFAULT_USER,
  admin: {
    ...DEFAULT_USER,
    id: 'current-admin',
    name: 'ผู้ดูแลระบบ (Admin)',
    role: 'admin',
    employeeId: 'ADM-001',
  },
};

export function deduplicateStaff(list: UserProfile[]): UserProfile[] {
  const map = new Map<string, UserProfile>();
  for (const item of list) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export function getStoredStaff(): UserProfile[] {
  try {
    const data = localStorage.getItem(STAFF_STORAGE_KEY);
    if (!data) {
      return [];
    }
    const parsed: UserProfile[] = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    const clean = deduplicateStaff(parsed);
    if (clean.length !== parsed.length) {
      localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(clean));
    }
    return clean;
  } catch (e) {
    console.error('Error loading staff from localStorage', e);
    return [];
  }
}

export function saveStaff(staffList: UserProfile[]) {
  try {
    const clean = deduplicateStaff(staffList);
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(clean));
  } catch (e) {
    console.error('Error saving staff to localStorage', e);
  }
}

// Storage Access Functions
export function getStoredVehicles(): AmbulanceVehicle[] {
  try {
    const data = localStorage.getItem(VEHICLES_STORAGE_KEY);
    if (!data) {
      return [];
    }
    const parsed: AmbulanceVehicle[] = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    // Single Source of Truth: Purge mock demo vehicles
    const realVehicles = parsed.filter(
      (v) => v.id !== 'veh-01' && v.id !== 'veh-02' && v.id !== 'veh-03' && v.id !== 'veh-04'
    );
    if (realVehicles.length !== parsed.length) {
      localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(realVehicles));
    }
    return realVehicles;
  } catch (e) {
    console.error('Error loading vehicles from localStorage', e);
    return [];
  }
}

export function saveVehicles(vehicles: AmbulanceVehicle[]) {
  try {
    localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(vehicles));
  } catch (e) {
    console.error('Error saving vehicles to localStorage', e);
  }
}

import {
  idbSaveInspection,
  idbGetAllInspections,
  idbDeleteInspection,
  idbClearAllInspections,
} from './indexedDb';

export function safelyPersistInspections(records: InspectionRecord[]) {
  try {
    localStorage.setItem(INSPECTIONS_STORAGE_KEY, JSON.stringify(records));
  } catch (quotaErr) {
    console.warn('LocalStorage quota warning, compressing storage payload...', quotaErr);
    try {
      // Keep full data in IndexedDB, but in localStorage strip inline base64 for records beyond the first one
      const compacted = records.slice(0, 15).map((r, idx) => {
        if (idx === 0) return r; // keep the newest one
        return {
          ...r,
          photos: {
            front: r.photos.front?.length > 4000 ? r.driveLinks?.frontPhotoUrl || '' : r.photos.front,
            rear: r.photos.rear?.length > 4000 ? r.driveLinks?.rearPhotoUrl || '' : r.photos.rear,
            left: r.photos.left?.length > 4000 ? r.driveLinks?.leftPhotoUrl || '' : r.photos.left,
            right: r.photos.right?.length > 4000 ? r.driveLinks?.rightPhotoUrl || '' : r.photos.right,
          },
          documentAttachment: r.documentAttachment
            ? { ...r.documentAttachment, dataUrl: r.driveLinks?.documentUrl || '' }
            : undefined,
        };
      });
      localStorage.setItem(INSPECTIONS_STORAGE_KEY, JSON.stringify(compacted));
    } catch (err2) {
      console.warn('LocalStorage still full, storing lightweight metadata only', err2);
      try {
        const lightweight = records.slice(0, 8).map((r) => ({
          ...r,
          photos: { front: '', rear: '', left: '', right: '' },
          documentAttachment: r.documentAttachment
            ? { name: r.documentAttachment.name, type: r.documentAttachment.type, dataUrl: '' }
            : undefined,
        }));
        localStorage.setItem(INSPECTIONS_STORAGE_KEY, JSON.stringify(lightweight));
      } catch (err3) {
        console.error('LocalStorage quota fully exceeded, records remain safely saved in IndexedDB', err3);
      }
    }
  }
}

export function getStoredInspections(): InspectionRecord[] {
  try {
    const data = localStorage.getItem(INSPECTIONS_STORAGE_KEY);
    if (!data) {
      return [];
    }
    const parsed: InspectionRecord[] = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    // Single Source of Truth: Purge mock demo inspections
    const realInspections = parsed.filter(
      (i) => i.id !== 'insp-20261107-001' && i.id !== 'insp-20261106-002'
    );
    if (realInspections.length !== parsed.length) {
      safelyPersistInspections(realInspections);
    }
    return realInspections;
  } catch (e) {
    console.error('Error loading inspections from localStorage', e);
    return [];
  }
}

export function saveInspectionRecord(record: InspectionRecord): InspectionRecord[] {
  const current = getStoredInspections();
  const updated = [record, ...current.filter((r) => r.id !== record.id)];

  // Always save to IndexedDB (safe from quota limitations)
  idbSaveInspection(record).catch((err) => console.warn('IDB save warning:', err));

  // Safely persist to localStorage with quota protection
  safelyPersistInspections(updated);

  // Update vehicle's last inspection date and status
  const vehicles = getStoredVehicles();
  const targetVeh = vehicles.find((v) => v.id === record.vehicleId);
  if (targetVeh) {
    targetVeh.lastInspectionDate = record.uploadTimestamp;
    targetVeh.lastInspector = `${record.inspectorName} (${record.inspectorRole === 'admin' ? 'Admin' : 'Staff'})`;
    targetVeh.currentOdometer = record.odometerReading;
    if (record.overallStatus === 'needs_repair') {
      targetVeh.status = 'maintenance';
    } else if (record.overallStatus === 'issue_found') {
      targetVeh.status = 'issue_found';
    } else {
      targetVeh.status = 'available';
    }
    saveVehicles(vehicles);
  }

  return updated;
}

export function updateInspectionRecord(updatedRecord: InspectionRecord) {
  const list = getStoredInspections();
  const idx = list.findIndex((r) => r.id === updatedRecord.id);
  if (idx >= 0) {
    list[idx] = updatedRecord;
    safelyPersistInspections(list);
    idbSaveInspection(updatedRecord).catch((err) => console.warn('IDB update warning:', err));
  }
}

export function deleteInspectionRecord(recordId: string): InspectionRecord[] {
  const list = getStoredInspections().filter((r) => r.id !== recordId);
  safelyPersistInspections(list);
  idbDeleteInspection(recordId).catch((err) => console.warn('IDB delete warning:', err));
  return list;
}

export function clearAllInspectionRecords(): InspectionRecord[] {
  safelyPersistInspections([]);
  idbClearAllInspections().catch((err) => console.warn('IDB clear warning:', err));
  return [];
}

export function replaceAllInspections(records: InspectionRecord[]): InspectionRecord[] {
  safelyPersistInspections(records);
  idbClearAllInspections()
    .then(() => Promise.all(records.map((rec) => idbSaveInspection(rec))))
    .catch((err) => console.warn('IDB replaceAll warning:', err));
  return records;
}

export async function syncInspectionsFromIndexedDb(): Promise<InspectionRecord[]> {
  try {
    const idbRecords = await idbGetAllInspections();
    if (idbRecords && idbRecords.length > 0) {
      return idbRecords;
    }
  } catch (e) {
    console.warn('Sync from IDB error:', e);
  }
  return getStoredInspections();
}

export function clearAllSystemData(clearVehiclesAndStaff = false) {
  try {
    localStorage.setItem(INSPECTIONS_STORAGE_KEY, JSON.stringify([]));
    idbClearAllInspections().catch(() => {});
    if (clearVehiclesAndStaff) {
      localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify([]));
    }
  } catch (e) {
    console.error(e);
  }
}

export function resetToInitialDemoData() {
  try {
    localStorage.removeItem(VEHICLES_STORAGE_KEY);
    localStorage.removeItem(INSPECTIONS_STORAGE_KEY);
    localStorage.removeItem(STAFF_STORAGE_KEY);
    localStorage.removeItem(DAMAGE_RECORDS_KEY);
    localStorage.removeItem(FUEL_LOGS_KEY);
    idbClearAllInspections().catch(() => {});
  } catch (e) {
    console.error(e);
  }
}

export function getCurrentUser(): UserProfile {
  try {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    if (!data) {
      return DEMO_USERS.staff;
    }
    return JSON.parse(data);
  } catch (e) {
    return DEMO_USERS.staff;
  }
}

export function setCurrentUser(user: UserProfile) {
  try {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error(e);
  }
}

export function getGoogleSheetsConfig(): GoogleSheetsConfig {
  try {
    const data = localStorage.getItem(GSHEETS_CONFIG_KEY);
    if (!data) {
      return { autoSync: true };
    }
    return JSON.parse(data);
  } catch (e) {
    return { autoSync: true };
  }
}

export function saveGoogleSheetsConfig(config: GoogleSheetsConfig) {
  try {
    localStorage.setItem(GSHEETS_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error(e);
  }
}

// ============================================
// รอยรอบตัวรถ (Damage Records) Persistence
// ============================================
const DAMAGE_RECORDS_KEY = 'bls_vehicle_damages_v1';

export function generateSvgDamagePlaceholder(area: string, description: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450">
    <rect width="600" height="450" fill="#1e293b" />
    <circle cx="300" cy="190" r="100" fill="#334155" stroke="#f59e0b" stroke-width="4" stroke-dasharray="8 6"/>
    <path d="M 240 170 Q 290 220 360 180 M 270 150 L 330 230" stroke="#ef4444" stroke-width="7" stroke-linecap="round"/>
    <text x="300" y="330" fill="#f8fafc" font-size="20" font-family="sans-serif" font-weight="bold" text-anchor="middle">
      ตำแหน่ง: ${area}
    </text>
    <text x="300" y="365" fill="#94a3b8" font-size="14" font-family="sans-serif" text-anchor="middle">
      ${description}
    </text>
    <rect x="20" y="20" width="130" height="32" rx="6" fill="#ef4444" opacity="0.9"/>
    <text x="85" y="41" fill="#ffffff" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">
      รอยแผลตัวรถ
    </text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Single Source of Truth: All damage records originate strictly from Google Drive & Sheets
export const INITIAL_DAMAGE_ITEMS: VehicleDamageItem[] = [];

export function getStoredDamageRecords(): VehicleDamageItem[] {
  try {
    const data = localStorage.getItem(DAMAGE_RECORDS_KEY);
    if (!data) {
      return [];
    }
    const parsed: VehicleDamageItem[] = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    // Purge mock demo items ('dmg-01', 'dmg-02', 'dmg-03') so data matches Google Drive & Sheets exactly
    const realItems = parsed.filter(
      (d) => d.id !== 'dmg-01' && d.id !== 'dmg-02' && d.id !== 'dmg-03'
    );
    if (realItems.length !== parsed.length) {
      localStorage.setItem(DAMAGE_RECORDS_KEY, JSON.stringify(realItems));
    }
    return realItems;
  } catch (e) {
    console.error('Error loading damage records', e);
    return [];
  }
}

export function saveDamageRecord(item: VehicleDamageItem): VehicleDamageItem[] {
  try {
    const list = getStoredDamageRecords();
    const idx = list.findIndex((d) => d.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    localStorage.setItem(DAMAGE_RECORDS_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error('Error saving damage record', e);
    return getStoredDamageRecords();
  }
}

export function saveAllDamageRecords(records: VehicleDamageItem[]) {
  try {
    localStorage.setItem(DAMAGE_RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving all damage records', e);
  }
}

export function deleteDamageRecord(id: string): VehicleDamageItem[] {
  try {
    const list = getStoredDamageRecords().filter((d) => d.id !== id);
    localStorage.setItem(DAMAGE_RECORDS_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error('Error deleting damage record', e);
    return getStoredDamageRecords();
  }
}

// ============================================
// ประวัติการเติมน้ำมัน (Fuel Log) Persistence
// ============================================
const FUEL_LOGS_KEY = 'bls_fuel_logs_v1';

// Single Source of Truth: All fuel logs originate strictly from Google Drive & Sheets
export const INITIAL_FUEL_LOGS: FuelLogRecord[] = [];

export function getStoredFuelLogs(): FuelLogRecord[] {
  try {
    const data = localStorage.getItem(FUEL_LOGS_KEY);
    if (!data) {
      return [];
    }
    const parsed: FuelLogRecord[] = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    // Single Source of Truth: Purge mock demo fuel logs
    const realLogs = parsed.filter(
      (f) =>
        f.id !== 'fuel-01' &&
        f.id !== 'fuel-02' &&
        f.id !== 'fuel-03' &&
        f.id !== 'fuel-04' &&
        f.id !== 'fuel-05'
    );
    if (realLogs.length !== parsed.length) {
      localStorage.setItem(FUEL_LOGS_KEY, JSON.stringify(realLogs));
    }
    return realLogs;
  } catch (e) {
    console.error('Error loading fuel logs', e);
    return [];
  }
}

/**
 * Get the latest recorded fuel odometer for a given vehicle
 */
export function getLatestFuelOdometer(vehicleId: string): number | null {
  const logs = getStoredFuelLogs().filter((l) => l.vehicleId === vehicleId);
  if (logs.length === 0) return null;
  // Sort descending by odometer
  logs.sort((a, b) => b.odometer - a.odometer);
  return logs[0].odometer;
}

export function saveFuelLog(record: FuelLogRecord): FuelLogRecord[] {
  try {
    const list = getStoredFuelLogs();
    const idx = list.findIndex((f) => f.id === record.id);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.unshift(record);
    }
    localStorage.setItem(FUEL_LOGS_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error('Error saving fuel log', e);
    return getStoredFuelLogs();
  }
}

export function deleteFuelLog(id: string): FuelLogRecord[] {
  try {
    const list = getStoredFuelLogs().filter((f) => f.id !== id);
    localStorage.setItem(FUEL_LOGS_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error('Error deleting fuel log', e);
    return getStoredFuelLogs();
  }
}

export function saveAllFuelLogs(logs: FuelLogRecord[]) {
  try {
    localStorage.setItem(FUEL_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Error saving all fuel logs', e);
  }
}

/**
 * Converts a Google Drive webViewLink or raw image URL into a displayable <img> src
 */
export function toDisplayableDriveImageUrl(rawUrl?: string, driveUrl?: string): string | undefined {
  const isSvg = (u?: string) => Boolean(u && u.startsWith('data:image/svg+xml'));
  if (rawUrl && !isSvg(rawUrl)) {
    if (
      rawUrl.startsWith('data:image/') ||
      rawUrl.startsWith('blob:') ||
      (rawUrl.startsWith('http') && !rawUrl.includes('drive.google.com/file/d/') && !rawUrl.includes('drive.google.com/open'))
    ) {
      return rawUrl;
    }
  }
  const target = (rawUrl && !isSvg(rawUrl) ? rawUrl : undefined) || driveUrl;
  if (target) {
    const match = target.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || target.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}=w1000`;
    }
    if (target.startsWith('http') || target.startsWith('data:')) {
      return target;
    }
  }
  return rawUrl;
}
