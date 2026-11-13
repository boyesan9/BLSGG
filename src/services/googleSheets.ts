import {
  AmbulanceVehicle,
  InspectionRecord,
  SystemAuditLogEntry,
  UserProfile,
  VehicleDamageItem,
  DamageSeverity,
  FuelLogRecord,
} from '../types';
import { createFreshChecklist } from '../data/defaultChecklist';
import { generateSvgDamagePlaceholder, toDisplayableDriveImageUrl } from './storage';

export interface SheetCreationResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

export const INSPECTION_SHEET_TITLE = 'บันทึกการตรวจรถกู้ชีพ_BLS';
export const VEHICLES_SHEET_TITLE = 'รายการรถกู้ชีพ_BLS';
export const STAFF_SHEET_TITLE = 'รายชื่อเจ้าหน้าที่_BLS';
export const AUDIT_LOG_SHEET_TITLE = 'บันทึกกิจกรรมระบบ_AuditLog';
export const DAMAGE_SHEET_TITLE = 'รอยรอบตัวรถ_BLS';
export const FUEL_SHEET_TITLE = 'ประวัติการเติมน้ำมัน_BLS';

export const INSPECTION_HEADERS = [
  'วัน-เวลาที่ตรวจ',
  'รอบเวร',
  'รหัสรถ',
  'เลขทะเบียน',
  'ผู้ตรวจเช็ค',
  'สถานะรวม',
  'เลขไมล์ (กม.)',
  'ไฟตัวรถ (8 รายการ)',
  'ไฟฉุกเฉิน (7 รายการ)',
  'กระจกมองหลัง/ข้าง',
  'ระบบของเหลว (3 รายการ)',
  'สภาพแบตเตอรี่',
  'สัญญาณเสียง',
  'สภาพยางรถ',
  'ปัญหาที่พบ / หมายเหตุ',
  'เอกสารแนบ',
  'รูป 4 ด้าน',
  'รหัสบันทึก (ID)',
];

export const VEHICLE_HEADERS = [
  'รหัสรถ',
  'เลขทะเบียน',
  'ยี่ห้อ/รุ่น',
  'ปี',
  'สถานะความพร้อม',
  'เลขไมล์ล่าสุด (กม.)',
  'วันที่ตรวจล่าสุด',
  'ผู้ตรวจล่าสุด',
  'หมายเหตุ',
  'รหัสอ้างอิง (ID)',
  'อัปเดตล่าสุด',
  'ลิงก์รูปรถ (Google Drive)',
  'โฟลเดอร์ Drive',
];

export const STAFF_HEADERS = [
  'รหัสพนักงาน',
  'ชื่อ-นามสกุล',
  'ระดับสิทธิ์',
  'ตำแหน่ง',
  'ฝ่าย/สังกัด',
  'เบอร์โทรศัพท์',
  'สถานะเข้าเวร',
  'อีเมล',
  'รหัสอ้างอิง (ID)',
  'อัปเดตล่าสุด',
];

export const AUDIT_LOG_HEADERS = [
  'วัน-เวลาที่เกิดกิจกรรม',
  'ประเภทกิจกรรม',
  'หมวดหมู่ข้อมูล',
  'รายการที่เปลี่ยนแปลง',
  'ผู้ดำเนินการ (ชื่อ/บทบาท)',
  'รายละเอียด',
  'รหัสกิจกรรม (Log ID)',
];

export const DAMAGE_HEADERS = [
  'วัน-เวลาที่ตรวจพบ',
  'รหัสรถ',
  'เลขทะเบียน',
  'ตำแหน่งที่เกิดรอย',
  'ระดับความเสียหาย',
  'รายละเอียดลักษณะรอย',
  'เลขไมล์ขณะพบรอย (กม.)',
  'ผู้ตรวจพบ',
  'สิทธิ์ผู้ตรวจ',
  'ลิงก์รูปถ่าย Google Drive',
  'รูปมุมอื่นๆ (Google Drive)',
  'โฟลเดอร์ Drive',
  'สถานะซ่อมสี/แก้ไข',
  'รหัสรายการ (ID)',
];

export const FUEL_HEADERS = [
  'วันที่-เวลาเติม',
  'รหัสรถ',
  'เลขทะเบียน',
  'เลขไมล์ขณะเติม (กม.)',
  'เลขไมล์ครั้งก่อน (กม.)',
  'ระยะทางที่วิ่งได้ (กม.)',
  'จำนวนลิตร',
  'ยอดเงินรวม (บาท)',
  'ราคาต่อลิตร (บาท/ลิตร)',
  'อัตราสิ้นเปลือง (กม./ลิตร)',
  'ค่าใช้จ่ายต่อกิโลเมตร (บาท/กม.)',
  'ชนิดน้ำมัน',
  'ปั๊มน้ำมัน / สถานี',
  'ผู้เติม / พนักงานขับรถ',
  'ลิงก์สลิป/ใบเสร็จ Google Drive',
  'โฟลเดอร์ Drive',
  'หมายเหตุ',
  'รหัสบันทึก (ID)',
];

/**
 * Ensure all 6 required sheets exist in the spreadsheet and have proper headers.
 */
export async function ensureAllSpreadsheetTabs(
  spreadsheetId: string,
  accessToken: string
): Promise<void> {
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const res = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return;

  const data = await res.json();
  const existingTitles = new Set(
    (data.sheets || []).map((s: any) => s.properties?.title)
  );

  const neededSheets = [
    { title: INSPECTION_SHEET_TITLE, headers: INSPECTION_HEADERS },
    { title: VEHICLES_SHEET_TITLE, headers: VEHICLE_HEADERS },
    { title: STAFF_SHEET_TITLE, headers: STAFF_HEADERS },
    { title: AUDIT_LOG_SHEET_TITLE, headers: AUDIT_LOG_HEADERS },
    { title: DAMAGE_SHEET_TITLE, headers: DAMAGE_HEADERS },
    { title: FUEL_SHEET_TITLE, headers: FUEL_HEADERS },
  ];

  const requestsToAdd: any[] = [];
  for (const item of neededSheets) {
    if (!existingTitles.has(item.title)) {
      requestsToAdd.push({
        addSheet: {
          properties: {
            title: item.title,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      });
    }
  }

  if (requestsToAdd.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: requestsToAdd }),
    });
  }

  // Populate headers for any newly added sheets
  for (const item of neededSheets) {
    if (!existingTitles.has(item.title)) {
      const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        item.title
      )}!A1:Z1?valueInputOption=USER_ENTERED`;
      await fetch(putUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [item.headers] }),
      });
    }
  }
}

/**
 * Create a new spreadsheet with all 6 BLS management sheets pre-configured.
 */
export async function createInspectionSpreadsheet(
  accessToken: string,
  title = 'ระบบตรวจสภาพรถกู้ชีพ BLS - บันทึกส่วนกลาง'
): Promise<SheetCreationResult> {
  const neededSheets = [
    { title: INSPECTION_SHEET_TITLE, headers: INSPECTION_HEADERS },
    { title: VEHICLES_SHEET_TITLE, headers: VEHICLE_HEADERS },
    { title: STAFF_SHEET_TITLE, headers: STAFF_HEADERS },
    { title: AUDIT_LOG_SHEET_TITLE, headers: AUDIT_LOG_HEADERS },
    { title: DAMAGE_SHEET_TITLE, headers: DAMAGE_HEADERS },
    { title: FUEL_SHEET_TITLE, headers: FUEL_HEADERS },
  ];

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: neededSheets.map((item) => ({
        properties: {
          title: item.title,
          gridProperties: { frozenRowCount: 1 },
        },
      })),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'ไม่สามารถสร้าง Google Spreadsheet ได้');
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl =
    data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Write header rows to all 6 tabs in parallel
  for (const item of neededSheets) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        item.title
      )}!A1:Z1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [item.headers] }),
      }
    );
  }

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Format an inspection record into a single row for Tab 1
 */
export function formatRecordForSheet(record: InspectionRecord): (string | number)[] {
  const getCatSummary = (catId: number) => {
    const items = record.vehicleChecklist.filter((c) => c.categoryId === catId);
    if (!items.length) return '-';
    const fails = items.filter((i) => i.status === 'fail');
    const warns = items.filter((i) => i.status === 'warning');
    if (fails.length > 0) {
      return `❌ ไม่ผ่าน (${fails.map((f) => f.subTitle).join(', ')})`;
    }
    if (warns.length > 0) {
      return `⚠️ เฝ้าระวัง (${warns.map((w) => w.subTitle).join(', ')})`;
    }
    return `✅ ปกติ (${items.length}/${items.length})`;
  };

  const lights = getCatSummary(1);
  const emergency = getCatSummary(2);
  const mirrors = getCatSummary(3);
  const fluids = getCatSummary(4);
  const battery = getCatSummary(5);
  const sound = getCatSummary(6);
  const tires = getCatSummary(7);

  const statusLabel =
    record.overallStatus === 'normal'
      ? 'ปกติ (พร้อมปฏิบัติการ)'
      : record.overallStatus === 'issue_found'
      ? 'พบข้อบกพร่อง (เฝ้าระวัง)'
      : 'งดใช้งาน (ส่งซ่อมบำรุง)';

  const issuesList = record.vehicleChecklist
    .filter((i) => i.status !== 'pass' || (i.issueNotes && i.issueNotes.trim() !== ''))
    .map((i) => `[${i.subTitle}: ${i.status.toUpperCase()}] ${i.issueNotes || 'ไม่ได้ระบุหมายเหตุ'}`)
    .join(' | ');

  const fullNotes = [issuesList, record.summaryNotes].filter(Boolean).join(' --- ');

  let docInfo = record.documentAttachment
    ? `แนบเอกสาร: ${record.documentAttachment.name} (${record.documentAttachment.type.toUpperCase()})`
    : 'ไม่มีเอกสารแนบ';
  if (record.driveLinks?.documentUrl) {
    docInfo += ` | ลิงก์ Drive: ${record.driveLinks.documentUrl}`;
  }

  const photosCount = [
    record.photos.front,
    record.photos.rear,
    record.photos.left,
    record.photos.right,
  ].filter(Boolean).length;

  let photosSummary = photosCount ? `ถ่ายครบ 4 ด้าน (${photosCount}/4)` : 'ไม่ครบ';
  if (record.driveLinks?.folderUrl) {
    photosSummary += ` | ลิงก์ Drive: ${record.driveLinks.folderUrl}`;
  }

  return [
    record.uploadTimestamp,
    record.shiftLabel,
    record.vehicleCode,
    record.plateNumber,
    record.inspectorName,
    statusLabel,
    record.odometerReading || 0,
    lights,
    emergency,
    mirrors,
    fluids,
    battery,
    sound,
    tires,
    fullNotes || 'ไม่มีปัญหาที่พบ',
    docInfo,
    photosSummary,
    record.id,
  ];
}

/**
 * Append inspection record to Tab 1
 */
export async function appendInspectionToSheet(
  spreadsheetId: string,
  record: InspectionRecord,
  accessToken: string
): Promise<{ success: boolean; updatedRange?: string }> {
  await ensureAllSpreadsheetTabs(spreadsheetId, accessToken);
  const rowValues = formatRecordForSheet(record);

  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    INSPECTION_SHEET_TITLE
  )}!A:R:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [rowValues] }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || `เกิดข้อผิดพลาดในการบันทึกตรวจสภาพลงชีต (${response.status})`);
  }

  const result = await response.json();
  return {
    success: true,
    updatedRange: result.updates?.updatedRange,
  };
}

/**
 * Sync entire Fleet list to Tab 2 (รายการรถกู้ชีพ_BLS)
 */
export async function syncVehiclesToSheet(
  spreadsheetId: string,
  vehicles: AmbulanceVehicle[],
  accessToken: string
): Promise<void> {
  await ensureAllSpreadsheetTabs(spreadsheetId, accessToken);
  const nowStr = new Date().toLocaleString('th-TH');

  // Ensure header row includes Drive photo columns (A1:M1)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      VEHICLES_SHEET_TITLE
    )}!A1:M1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [VEHICLE_HEADERS] }),
    }
  );

  const rows = vehicles.map((v) => {
    const photoLink =
      v.drivePhotoUrl ||
      (v.imageUrl && !v.imageUrl.startsWith('data:') ? v.imageUrl : '') ||
      '';
    return [
      v.code,
      v.plateNumber,
      v.brandModel || 'Toyota Commuter BLS',
      v.year || '2024',
      v.status === 'available'
        ? 'พร้อมปฏิบัติการ'
        : v.status === 'issue_found'
        ? 'พบข้อบกพร่อง'
        : 'งดใช้-ส่งซ่อมบำรุง',
      v.currentOdometer || 0,
      v.lastInspectionDate || '-',
      v.lastInspector || '-',
      v.notes || '',
      v.id,
      nowStr,
      photoLink,
      v.driveFolderUrl || '',
    ];
  });

  // Pad empty rows to overwrite if fleet count decreased
  const paddedRows = [...rows];
  while (paddedRows.length < 50) {
    paddedRows.push(new Array(13).fill(''));
  }

  const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    VEHICLES_SHEET_TITLE
  )}!A2:M52?valueInputOption=USER_ENTERED`;

  const response = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: paddedRows }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `เกิดข้อผิดพลาดในการบันทึกรายการรถลง Google Sheets (${response.status})`);
  }
}

/**
 * Sync entire Staff roster to Tab 3 (รายชื่อเจ้าหน้าที่_BLS)
 */
export async function syncStaffToSheet(
  spreadsheetId: string,
  staffList: UserProfile[],
  accessToken: string
): Promise<void> {
  await ensureAllSpreadsheetTabs(spreadsheetId, accessToken);
  const nowStr = new Date().toLocaleString('th-TH');

  const rows = staffList.map((s) => [
    s.employeeId,
    s.name,
    s.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงานทั่วไป (Staff)',
    s.position || 'เจ้าหน้าที่กู้ชีพ',
    s.department || 'ฝ่ายปฏิบัติการกู้ชีพ BLS',
    s.phone || '-',
    s.status === 'on_leave' ? 'พักเวร' : s.status === 'inactive' ? 'ไม่ได้ปฏิบัติงาน' : 'พร้อมปฏิบัติงาน',
    s.email || '-',
    s.id,
    nowStr,
  ]);

  // Pad empty rows to overwrite if staff count decreased
  const paddedRows = [...rows];
  while (paddedRows.length < 50) {
    paddedRows.push(new Array(10).fill(''));
  }

  const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    STAFF_SHEET_TITLE
  )}!A2:J52?valueInputOption=USER_ENTERED`;

  const response = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: paddedRows }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `เกิดข้อผิดพลาดในการบันทึกรายชื่อเจ้าหน้าที่ลง Google Sheets (${response.status})`);
  }
}

/**
 * Append audit log entry to Tab 4 (บันทึกกิจกรรมระบบ_AuditLog)
 */
export async function appendAuditLogToSheet(
  spreadsheetId: string,
  entry: SystemAuditLogEntry,
  accessToken: string
): Promise<void> {
  try {
    await ensureAllSpreadsheetTabs(spreadsheetId, accessToken);

    const row = [
      entry.timestamp,
      entry.action,
      entry.module,
      entry.targetItem,
      entry.operator,
      entry.details,
      entry.id,
    ];

    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      AUDIT_LOG_SHEET_TITLE
    )}!A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    });
  } catch (e) {
    console.warn('Audit log write warning:', e);
  }
}

/**
 * Pull all system data from Google Sheets back into the application (Sync Back / Restore)
 */
export async function pullAllDataFromGoogleSheets(
  spreadsheetId: string,
  accessToken: string
): Promise<{
  vehicles: AmbulanceVehicle[];
  staffList: UserProfile[];
  inspectionsCount: number;
  damageRecords: VehicleDamageItem[];
  fuelLogs: FuelLogRecord[];
  pulledAt: string;
}> {
  const pulledAt = new Date().toLocaleString('th-TH');

  // 1. Pull Vehicles
  const vehiclesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    VEHICLES_SHEET_TITLE
  )}!A2:M100`;
  const vehRes = await fetch(vehiclesUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const vehicles: AmbulanceVehicle[] = [];
  if (vehRes.ok) {
    const data = await vehRes.json();
    const rows: string[][] = data.values || [];
    for (const r of rows) {
      if (r[0] && r[1]) {
        // Has code and plateNumber
        const statusStr = r[4] || '';
        const status =
          statusStr.includes('ซ่อม') || statusStr.includes('งดใช้')
            ? 'maintenance'
            : statusStr.includes('ปัญหา') || statusStr.includes('บกพร่อง')
            ? 'issue_found'
            : 'available';

        const drivePhotoUrl = r[11]?.startsWith('http') ? r[11] : undefined;
        const driveFolderUrl = r[12]?.startsWith('http') ? r[12] : undefined;

        vehicles.push({
          id: r[9] || `veh-${r[0]}`,
          code: r[0],
          plateNumber: r[1],
          brandModel: r[2] || 'Toyota Commuter BLS',
          year: r[3] || '2024',
          status,
          currentOdometer: Number(r[5]) || 0,
          lastInspectionDate: r[6] || '-',
          lastInspector: r[7] || '-',
          notes: r[8] || '',
          imageUrl: toDisplayableDriveImageUrl(undefined, drivePhotoUrl),
          drivePhotoUrl,
          driveFolderUrl,
        });
      }
    }
  }

  // 2. Pull Staff
  const staffUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    STAFF_SHEET_TITLE
  )}!A2:J100`;
  const staffRes = await fetch(staffUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const staffList: UserProfile[] = [];
  if (staffRes.ok) {
    const data = await staffRes.json();
    const rows: string[][] = data.values || [];
    for (const r of rows) {
      if (r[0] && r[1]) {
        // Has employeeId and name
        const roleStr = (r[2] || '').toLowerCase();
        const role =
          roleStr.includes('admin') || roleStr.includes('ผู้ดูแล') || (r[8] || '').includes('admin')
            ? 'admin'
            : 'staff';
        const status = (r[6] || '').includes('พักเวร')
          ? 'on_leave'
          : (r[6] || '').includes('ไม่ได้ปฏิบัติงาน')
          ? 'inactive'
          : 'active';

        staffList.push({
          id: (r[8] || '').trim() || `user-${r[0].trim()}`,
          employeeId: r[0].trim(),
          name: r[1].trim(),
          role,
          position: (r[3] || '').trim() || 'เจ้าหน้าที่กู้ชีพ',
          department: (r[4] || '').trim() || 'ฝ่ายปฏิบัติการกู้ชีพ BLS',
          phone: (r[5] || '').trim() || '-',
          status,
          email: (r[7] || '').trim() === '-' ? '' : (r[7] || '').trim(),
        });
      }
    }
  }

  // 3. Count Inspections
  const inspUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    INSPECTION_SHEET_TITLE
  )}!A2:A1000`;
  const inspRes = await fetch(inspUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let inspectionsCount = 0;
  if (inspRes.ok) {
    const data = await inspRes.json();
    inspectionsCount = (data.values || []).filter((r: any) => r && r[0]).length;
  }

  // 4. Pull Damage Records
  const damageUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    DAMAGE_SHEET_TITLE
  )}!A2:N200`;
  const damageRes = await fetch(damageUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const damageRecords: VehicleDamageItem[] = [];
  if (damageRes.ok) {
    const data = await damageRes.json();
    const rows: string[][] = data.values || [];
    for (const r of rows) {
      if (r[1] && r[3]) {
        // Has vehicleCode and positionArea
        const rawSev = r[4] || '';
        let severity: DamageSeverity = 'minor_scratch';
        if (rawSev.includes('ลึก')) severity = 'deep_scratch';
        else if (rawSev.includes('บุบ')) severity = 'dent';
        else if (rawSev.includes('แตก') || rawSev.includes('หัก')) severity = 'crack';
        else if (rawSev.includes('สะเก็ด') || rawSev.includes('หลุด')) severity = 'paint_chip';
        else if (rawSev.includes('สนิม')) severity = 'rust';

        const driveUrl = r[9]?.startsWith('http') ? r[9] : undefined;
        const fallbackSvg = generateSvgDamagePlaceholder(r[3], r[5] || r[1]);

        const matchedVeh = vehicles.find(
          (v) => v.code === r[1].trim() || (r[2] && v.plateNumber === r[2].trim())
        );

        damageRecords.push({
          id: r[13] || `dmg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          vehicleId: matchedVeh?.id || `veh-${r[1].trim()}`,
          vehicleCode: r[1].trim(),
          plateNumber: (r[2] || '').trim(),
          positionArea: r[3],
          severity,
          description: r[5] || '',
          odometerAtReport: Number(r[6]) || undefined,
          inspectorName: r[7] || 'เจ้าหน้าที่',
          inspectorRole: (r[8] || '').includes('Admin') ? 'admin' : 'staff',
          photoUrl: driveUrl || fallbackSvg,
          drivePhotoUrl: driveUrl,
          driveFolderUrl: r[11]?.startsWith('http') ? r[11] : undefined,
          resolved: (r[12] || '').includes('ซ่อมสีแล้ว'),
          createdAt: r[0] || '',
          googleSheetsSyncStatus: 'synced',
        });
      }
    }
  }

  // 5. Pull Fuel Logs
  const fuelUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    FUEL_SHEET_TITLE
  )}!A2:R200`;
  const fuelRes = await fetch(fuelUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const fuelLogs: FuelLogRecord[] = [];
  if (fuelRes.ok) {
    const data = await fuelRes.json();
    const rows: string[][] = data.values || [];
    for (const r of rows) {
      if (r[0] && r[1]) {
        const matchedVeh = vehicles.find(
          (v) => v.code === r[1].trim() || (r[2] && v.plateNumber === r[2].trim())
        );
        fuelLogs.push({
          id: r[17] || `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          vehicleId: matchedVeh?.id || `veh-${r[1].trim()}`,
          vehicleCode: r[1].trim(),
          plateNumber: (r[2] || '').trim(),
          fuelDate: r[0],
          odometer: Number(r[3]) || 0,
          previousOdometer: Number(r[4]) || undefined,
          distanceDriven: Number(String(r[5] || '').replace(/[^0-9.]/g, '')) || undefined,
          liters: Number(r[6]) || 0,
          totalCost: Number(r[7]) || 0,
          pricePerLiter: Number(String(r[8] || '').replace(/[^0-9.]/g, '')) || undefined,
          kmPerLiter: Number(String(r[9] || '').replace(/[^0-9.]/g, '')) || undefined,
          costPerKm: Number(String(r[10] || '').replace(/[^0-9.]/g, '')) || undefined,
          fuelType: r[11] || 'ดีเซล B7',
          gasStation: r[12] || '',
          driverName: r[13] || 'เจ้าหน้าที่',
          receiptDriveUrl: r[14]?.startsWith('http') ? r[14] : undefined,
          driveFolderUrl: r[15]?.startsWith('http') ? r[15] : undefined,
          notes: r[16] || '',
          createdAt: Date.now(),
          googleSheetsSyncStatus: 'synced',
        });
      }
    }
  }

  return {
    vehicles,
    staffList,
    inspectionsCount,
    damageRecords,
    fuelLogs,
    pulledAt,
  };
}

/**
 * Format damage record for sheet
 */
export function formatDamageForSheet(item: VehicleDamageItem): any[] {
  const severityMap: Record<string, string> = {
    minor_scratch: 'รอยขูดขีดตื้น (ขนแมว/ผิวสี)',
    deep_scratch: 'รอยขูดขีดลึก (ถึงชั้นสีรองพื้น)',
    dent: 'รอยบุบ / ยุบตัว',
    crack: 'รอยแตกร้าว / แตกหัก',
    rust: 'สนิม / ผุกร่อน',
    paint_chip: 'สีหลุดร่อน / สะเก็ดหินกระเทาะ',
  };

  const addDrivePhotos = (item.driveAdditionalPhotoUrls || []).join(' | ');

  return [
    item.createdAt,
    item.vehicleCode,
    item.plateNumber,
    item.positionArea,
    severityMap[item.severity] || item.severity,
    item.description || '-',
    item.odometerAtReport || 0,
    item.inspectorName,
    item.inspectorRole === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงานทั่วไป (Staff)',
    item.drivePhotoUrl || (item.photoUrl ? 'มีภาพบันทึกในระบบ' : '-'),
    addDrivePhotos || '-',
    item.driveFolderUrl || '-',
    item.resolved ? `ซ่อมสีแล้ว (${item.resolvedAt || '-'})` : 'ยังไม่ซ่อมสี/มีรอยอยู่',
    item.id,
  ];
}

/**
 * Append single damage record to Sheet
 */
export async function appendDamageToSheet(
  spreadsheetId: string,
  item: VehicleDamageItem,
  accessToken: string
): Promise<{ success: boolean }> {
  await ensureAllSpreadsheetTabs(spreadsheetId, accessToken);
  const rowValues = formatDamageForSheet(item);

  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    DAMAGE_SHEET_TITLE
  )}!A:N:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [rowValues] }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || `เกิดข้อผิดพลาดในการบันทึกรอยตัวรถลง Google Sheets (${response.status})`);
  }

  return { success: true };
}

/**
 * Mirror / Sync entire Damage Records list to Sheet Tab
 */
export async function syncDamageToSheet(
  spreadsheetId: string,
  items: VehicleDamageItem[],
  accessToken: string
): Promise<void> {
  await ensureAllSpreadsheetTabs(spreadsheetId, accessToken);
  const rows = items.map(formatDamageForSheet);

  const padded = [...rows];
  while (padded.length < 50) {
    padded.push(new Array(DAMAGE_HEADERS.length).fill(''));
  }

  const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    DAMAGE_SHEET_TITLE
  )}!A2:N52?valueInputOption=USER_ENTERED`;

  const response = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: padded }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || `เกิดข้อผิดพลาดในการอัปเดตตารางรอยตัวรถลง Google Sheets (${response.status})`);
  }
}

/**
 * Format fuel log record for sheet
 */
export function formatFuelLogForSheet(log: FuelLogRecord): any[] {
  return [
    log.fuelDate,
    log.vehicleCode,
    log.plateNumber,
    log.odometer,
    log.previousOdometer || '-',
    log.distanceDriven ? `${log.distanceDriven} กม.` : '-',
    log.liters,
    log.totalCost,
    log.pricePerLiter ? `${log.pricePerLiter} บ./ล.` : '-',
    log.kmPerLiter ? `${log.kmPerLiter} กม./ลิตร` : '-',
    log.costPerKm ? `${log.costPerKm} บ./กม.` : '-',
    log.fuelType,
    log.gasStation || '-',
    log.driverName,
    log.receiptDriveUrl || (log.receiptPhotoUrl ? 'มีภาพสลิปในระบบ' : '-'),
    log.driveFolderUrl || '-',
    log.notes || '-',
    log.id,
  ];
}

/**
 * Append single fuel log to Sheet
 */
export async function appendFuelLogToSheet(
  spreadsheetId: string,
  log: FuelLogRecord,
  accessToken: string
): Promise<{ success: boolean }> {
  await ensureAllSpreadsheetTabs(spreadsheetId, accessToken);
  const rowValues = formatFuelLogForSheet(log);

  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    FUEL_SHEET_TITLE
  )}!A:R:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [rowValues] }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || `เกิดข้อผิดพลาดในการบันทึกประวัติน้ำมันลง Google Sheets (${response.status})`);
  }

  return { success: true };
}

/**
 * Mirror / Sync entire Fuel Logs list to Sheet Tab
 */
export async function syncFuelLogsToSheet(
  spreadsheetId: string,
  logs: FuelLogRecord[],
  accessToken: string
): Promise<void> {
  await ensureAllSpreadsheetTabs(spreadsheetId, accessToken);
  const rows = logs.map(formatFuelLogForSheet);

  const padded = [...rows];
  while (padded.length < 50) {
    padded.push(new Array(FUEL_HEADERS.length).fill(''));
  }

  const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    FUEL_SHEET_TITLE
  )}!A2:R52?valueInputOption=USER_ENTERED`;

  const response = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: padded }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || `เกิดข้อผิดพลาดในการอัปเดตตารางประวัติน้ำมันลง Google Sheets (${response.status})`);
  }
}
