export type UserRole = 'admin' | 'staff';

export type UserStatus = 'active' | 'on_leave' | 'inactive';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  employeeId: string;
  position?: string;
  department?: string;
  phone?: string;
  status?: UserStatus;
  email?: string;
  avatarUrl?: string;
}

export type VehicleStatus = 'available' | 'issue_found' | 'maintenance';

export interface AmbulanceVehicle {
  id: string;
  code: string;            // เช่น 'BLS-01'
  plateNumber: string;     // เช่น '1กข 4589 กรุงเทพมหานคร'
  brandModel: string;      // เช่น 'Toyota Commuter 3.0 D4D'
  year: string;            // เช่น '2023'
  status: VehicleStatus;
  currentOdometer: number;
  imageUrl?: string;
  drivePhotoUrl?: string;
  driveFolderUrl?: string;
  lastInspectionDate?: string;
  lastInspector?: string;
  notes?: string;
}

export type ItemStatus = 'pass' | 'warning' | 'fail';

export interface VehicleChecklistItem {
  id: string;
  categoryId: number;
  categoryTitle: string;
  subTitle: string;
  standard: string;
  status: ItemStatus;
  issueNotes: string;
}

export interface FourSidePhotos {
  front: string;
  rear: string;
  left: string;
  right: string;
}

export interface DocumentAttachment {
  name: string;
  type: 'pdf' | 'image';
  dataUrl: string;
  size?: string;
}

export type ShiftType = '24hr' | 'morning' | 'afternoon' | 'night';

export interface GoogleDriveLinks {
  folderId?: string;
  folderUrl?: string;
  frontPhotoUrl?: string;
  rearPhotoUrl?: string;
  leftPhotoUrl?: string;
  rightPhotoUrl?: string;
  documentUrl?: string;
}

export interface InspectionRecord {
  id: string;
  vehicleId: string;
  vehicleCode: string;
  plateNumber: string;
  inspectorName: string;
  inspectorRole: UserRole;
  uploadTimestamp: string;
  shift: ShiftType;
  shiftLabel: string;
  odometerReading: number;
  photos: FourSidePhotos;
  vehicleChecklist: VehicleChecklistItem[];
  documentAttachment?: DocumentAttachment;
  overallStatus: 'normal' | 'issue_found' | 'needs_repair';
  summaryNotes: string;
  googleSheetsSyncStatus: 'synced' | 'pending' | 'failed' | 'not_connected';
  googleSheetsRowIndex?: number;
  driveLinks?: GoogleDriveLinks;
  damageItems?: VehicleDamageItem[];
  createdAt: number;
}

export interface GoogleSheetsConfig {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  sheetName?: string;
  lastSyncedAt?: string;
  autoSync: boolean;
}

export interface SystemAuditLogEntry {
  id: string;
  timestamp: string;
  action: string;      // เช่น 'เพิ่มข้อมูล', 'แก้ไขข้อมูล', 'ลบข้อมูล', 'ตรวจสภาพรถ', 'ดึงข้อมูลคืน'
  module: string;      // เช่น 'รถกู้ชีพ BLS', 'เจ้าหน้าที่', 'ตรวจสภาพรถ', 'ระบบภาพรวม'
  targetItem: string;  // เช่น 'BLS-01 (1กข 4589)', 'สมนึก มีพร้อม'
  operator: string;    // เช่น 'พ.ต.ต. ธนกร มั่นคง (Admin)'
  details: string;     // รายละเอียดการเปลี่ยนแปลง
}

// ============================================
// รอยรอบตัวรถ (Vehicle Scratch & Damage Tracking)
// ============================================
export type DamageSeverity = 'minor_scratch' | 'deep_scratch' | 'dent' | 'crack' | 'rust' | 'paint_chip';

export interface VehicleDamageItem {
  id: string;
  vehicleId: string;
  vehicleCode: string;
  plateNumber: string;
  positionArea: string;   // เช่น 'กันชนหน้าขวา', 'ฝากระโปรงหน้า', 'ประตูด้านหน้าซ้าย', 'ซุ้มล้อหลังขวา'
  description: string;    // รายละเอียดว่ารอยเกิดขึ้นตรงไหน มีลักษณะอย่างไร
  severity: DamageSeverity;
  photoUrl: string;       // รูปถ่ายรอยแผล (บีบอัดแล้ว)
  additionalPhotos?: string[]; // รูปถ่ายมุมอื่นๆ เพิ่มเติม
  createdAt: string;      // วัน-เวลาที่ตรวจพบบันทึก
  inspectorName: string;  // เจ้าหน้าที่ผู้ตรวจบันทึก
  inspectorRole: UserRole;
  odometerAtReport?: number; // เลขไมล์ขณะพบรอย
  resolved?: boolean;     // แก้ไข/ซ่อมสีเรียบร้อยแล้วหรือไม่
  resolvedAt?: string;

  // Google Drive & Sheets Integration
  drivePhotoUrl?: string;            // ลิงก์รูปภาพใน Google Drive
  driveAdditionalPhotoUrls?: string[]; // ลิงก์รูปมุมอื่นๆ ใน Google Drive
  driveFolderUrl?: string;           // ลิงก์โฟลเดอร์ Google Drive
  googleSheetsSyncStatus?: 'synced' | 'pending' | 'failed' | 'not_connected';
}

// ============================================
// ประวัติการเติมน้ำมัน (Fuel Log & Consumption Tracking)
// ============================================
export interface FuelLogRecord {
  id: string;
  vehicleId: string;
  vehicleCode: string;
  plateNumber: string;
  fuelDate: string;          // วันที่เติม เช่น '10/11/2569' หรือ '2026-11-10 14:30'
  odometer: number;          // เลขไมล์ขณะเติมน้ำมัน (กม.)
  liters: number;            // จำนวนลิตรที่เติม
  totalCost: number;         // ยอดเงินที่เติม (บาท)
  pricePerLiter?: number;    // ราคาต่อลิตร (บาท/ลิตร)
  fuelType: string;          // ชนิดน้ำมัน เช่น 'ดีเซล B7', 'ดีเซลพรีเมียม', 'แก๊สโซฮอล์ 95'
  gasStation?: string;       // ปั๊มน้ำมัน เช่น 'ปตท. ปั๊มหลัก', 'บางจาก'
  receiptPhotoUrl?: string;  // ภาพถ่ายใบเสร็จ / สลิปค่าน้ำมัน
  driverName: string;        // ผู้ขับขี่ / ผู้เติมน้ำมัน
  notes?: string;            // หมายเหตุ

  // คำนวณสรุปการใช้น้ำมันเปรียบเทียบครั้งก่อน (วิ่งได้กี่กิโลเมตร)
  previousOdometer?: number; // เลขไมล์ครั้งก่อนหน้า
  distanceDriven?: number;   // วิ่งได้กี่กิโลเมตร = odometer - previousOdometer
  kmPerLiter?: number;       // อัตราสิ้นเปลือง (กม./ลิตร) = distanceDriven / liters
  costPerKm?: number;        // ค่าน้ำมันต่อกิโลเมตร (บาท/กม.) = totalCost / distanceDriven
  createdAt: number;

  // Google Drive & Sheets Integration
  receiptDriveUrl?: string;  // ลิงก์สลิป/ใบเสร็จใน Google Drive
  driveFolderUrl?: string;   // ลิงก์โฟลเดอร์ Google Drive
  googleSheetsSyncStatus?: 'synced' | 'pending' | 'failed' | 'not_connected';
}

// Master Cloud Database Snapshot for Google Drive Persistence
export interface MasterDatabasePayload {
  inspections: InspectionRecord[];
  vehicles: AmbulanceVehicle[];
  staffList: UserProfile[];
  damageRecords: VehicleDamageItem[];
  fuelLogs: FuelLogRecord[];
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  lastSyncedAt: string;
  version: number;
}


