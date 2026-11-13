import React, { useState } from 'react';
import {
  AmbulanceVehicle,
  GoogleSheetsConfig,
  InspectionRecord,
  UserProfile,
  VehicleDamageItem,
  FuelLogRecord,
} from '../types';
import {
  X,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  LogIn,
  DownloadCloud,
  Layers,
  Activity,
  Truck,
  Users,
  Car,
  Fuel,
} from 'lucide-react';
import {
  createInspectionSpreadsheet,
  syncInspectionsToSheet,
  syncVehiclesToSheet,
  syncStaffToSheet,
  appendAuditLogToSheet,
  pullAllDataFromGoogleSheets,
  ensureAllSpreadsheetTabs,
  syncDamageToSheet,
  syncFuelLogsToSheet,
  INSPECTION_SHEET_TITLE,
  VEHICLES_SHEET_TITLE,
  STAFF_SHEET_TITLE,
  AUDIT_LOG_SHEET_TITLE,
  DAMAGE_SHEET_TITLE,
  FUEL_SHEET_TITLE,
} from '../services/googleSheets';
import { uploadInspectionMediaToDrive, saveMasterDatabaseToDrive } from '../services/googleDrive';
import { googleSignIn, getAccessToken } from '../services/firebaseAuth';
import { getStoredDamageRecords, getStoredFuelLogs } from '../services/storage';
import { User } from 'firebase/auth';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoogleSheetsConfig;
  onSaveConfig: (config: GoogleSheetsConfig) => void;
  inspections: InspectionRecord[];
  onUpdateInspection: (record: InspectionRecord) => void;
  googleUser: User | null;
  onGoogleLoginSuccess: (user: User) => void;
  vehicles: AmbulanceVehicle[];
  staffList: UserProfile[];
  currentUser: UserProfile;
  damageRecords?: VehicleDamageItem[];
  fuelLogs?: FuelLogRecord[];
  onSyncBackData?: (data: {
    vehicles: AmbulanceVehicle[];
    staffList: UserProfile[];
    inspections?: InspectionRecord[];
    inspectionsCount: number;
    damageRecords?: VehicleDamageItem[];
    fuelLogs?: FuelLogRecord[];
  }) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  inspections,
  onUpdateInspection,
  googleUser,
  onGoogleLoginSuccess,
  vehicles,
  staffList,
  currentUser,
  damageRecords,
  fuelLogs,
  onSyncBackData,
}) => {
  const [spreadsheetId, setSpreadsheetId] = useState(config.spreadsheetId || '');
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isPullingData, setIsPullingData] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setStatusMessage(null);
    try {
      const res = await googleSignIn({ intent: { type: 'sheets_modal' } });
      if (res?.redirected) return;
      if (res?.user) {
        onGoogleLoginSuccess(res.user);
        setStatusMessage({
          type: 'success',
          text: `เชื่อมต่อกับบัญชี Google: ${res.user.email} สำเร็จ!`,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'ไม่สามารถเข้าสู่ระบบ Google ได้',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCreateNewSheet = async () => {
    setIsCreating(true);
    setStatusMessage(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        const res = await googleSignIn({ intent: { type: 'sheets_modal' } });
        if (res?.redirected) return;
        if (res?.accessToken && res.user) {
          token = res.accessToken;
          onGoogleLoginSuccess(res.user);
        }
      }

      if (!token) {
        throw new Error('กรุณาลงชื่อเข้าใช้ Google เพื่อสร้างสเปรดชีต');
      }

      const res = await createInspectionSpreadsheet(
        token,
        'ระบบตรวจสภาพรถกู้ชีพ BLS - บันทึกส่วนกลาง'
      );

      const newConfig: GoogleSheetsConfig = {
        ...config,
        spreadsheetId: res.spreadsheetId,
        spreadsheetUrl: res.spreadsheetUrl,
        sheetName: INSPECTION_SHEET_TITLE,
        lastSyncedAt: new Date().toLocaleTimeString('th-TH'),
      };

      setSpreadsheetId(res.spreadsheetId);
      onSaveConfig(newConfig);

      // Immediately sync current Inspections, Fleet, Staff, Damage Records, and Fuel Logs across all 6 tabs
      await syncInspectionsToSheet(res.spreadsheetId, inspections, token);
      await syncVehiclesToSheet(res.spreadsheetId, vehicles, token);
      await syncStaffToSheet(res.spreadsheetId, staffList, token);

      const currentDamage = damageRecords || getStoredDamageRecords();
      await syncDamageToSheet(res.spreadsheetId, currentDamage, token);

      const currentFuel = fuelLogs || getStoredFuelLogs();
      await syncFuelLogsToSheet(res.spreadsheetId, currentFuel, token);

      await appendAuditLogToSheet(
        res.spreadsheetId,
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleString('th-TH'),
          action: 'สร้างสเปรดชีตใหม่',
          module: 'ระบบภาพรวม',
          targetItem: res.spreadsheetId,
          operator: `${currentUser.name} (${currentUser.role === 'admin' ? 'Admin' : 'Staff'})`,
          details: `สร้างชีตครบทั้ง 6 หมวด: ตรวจสภาพรถ, กองรถ (${vehicles.length} คัน), เจ้าหน้าที่ (${staffList.length} คน), รอยรอบคัน (${currentDamage.length} จุด), น้ำมัน (${currentFuel.length} รายการ) และ Audit Log`,
        },
        token
      );

      setStatusMessage({
        type: 'success',
        text: 'สร้าง Google Spreadsheet ครบถ้วนทั้ง 6 แท็บ และซิงค์ข้อมูลเริ่มต้นเรียบร้อยแล้ว!',
      });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'เกิดข้อผิดพลาดในการสร้างสเปรดชีต',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSyncAllPending = async () => {
    if (!spreadsheetId) {
      setStatusMessage({
        type: 'error',
        text: 'กรุณาระบุหรือสร้าง Google Spreadsheet ID ก่อน',
      });
      return;
    }

    setIsSyncingAll(true);
    setStatusMessage(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        const res = await googleSignIn({ intent: { type: 'sheets_modal' } });
        if (res?.redirected) return;
        if (res?.accessToken && res.user) {
          token = res.accessToken;
          onGoogleLoginSuccess(res.user);
        }
      }

      if (!token) {
        throw new Error('กรุณาลงชื่อเข้าใช้ Google เพื่อซิงค์ข้อมูล');
      }

      await ensureAllSpreadsheetTabs(spreadsheetId, token);

      const syncedInspectionsList: InspectionRecord[] = [];
      for (const rec of inspections) {
        let updatedRec = { ...rec };

        // Upload media to Google Drive if not uploaded yet
        if (!updatedRec.driveLinks?.folderUrl) {
          try {
            const driveLinks = await uploadInspectionMediaToDrive(token, updatedRec);
            updatedRec.driveLinks = driveLinks;
          } catch (dErr) {
            console.warn('Google Drive upload error for record:', updatedRec.id, dErr);
          }
        }

        updatedRec.googleSheetsSyncStatus = 'synced';
        onUpdateInspection(updatedRec);
        syncedInspectionsList.push(updatedRec);
      }

      // Sync exact 1:1 tables across all tabs (Inspections, Fleet, Staff, Damage, Fuel)
      await syncInspectionsToSheet(spreadsheetId, syncedInspectionsList, token);
      await syncVehiclesToSheet(spreadsheetId, vehicles, token);
      await syncStaffToSheet(spreadsheetId, staffList, token);

      const currentDamage = damageRecords || getStoredDamageRecords();
      await syncDamageToSheet(spreadsheetId, currentDamage, token);

      const currentFuel = fuelLogs || getStoredFuelLogs();
      await syncFuelLogsToSheet(spreadsheetId, currentFuel, token);

      // Update Google Drive Master DB Snapshot to match Google Sheets 100%
      await saveMasterDatabaseToDrive(token, {
        inspections: syncedInspectionsList,
        vehicles,
        staffList,
        damageRecords: currentDamage,
        fuelLogs: currentFuel,
        spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        lastSyncedAt: new Date().toLocaleString('th-TH'),
        version: 1,
      }).catch((err) => console.warn('Drive master snapshot warning:', err));

      const count = syncedInspectionsList.length;
      await appendAuditLogToSheet(
        spreadsheetId,
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleString('th-TH'),
          action: 'ซิงค์ข้อมูลทั้งหมด',
          module: 'ระบบภาพรวม',
          targetItem: `สเปรดชีต ${spreadsheetId.slice(0, 10)}...`,
          operator: `${currentUser.name} (${currentUser.role === 'admin' ? 'Admin' : 'Staff'})`,
          details: `ซิงค์ตรวจสภาพ ${count} รายการ, กองรถ ${vehicles.length} คัน, เจ้าหน้าที่ ${staffList.length} คน, รอยรอบคัน ${currentDamage.length} จุด, เติมน้ำมัน ${currentFuel.length} ครั้ง`,
        },
        token
      );

      onSaveConfig({
        ...config,
        spreadsheetId,
        lastSyncedAt: new Date().toLocaleTimeString('th-TH'),
      });

      setStatusMessage({
        type: 'success',
        text: `ซิงค์ข้อมูลลง Google Sheets & Drive ครบถ้วนทั้ง 6 หมวด (ตรวจสภาพ ${count}, กองรถ ${vehicles.length}, เจ้าหน้าที่ ${staffList.length}, รอยรอบคัน ${currentDamage.length}, น้ำมัน ${currentFuel.length})!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'เกิดข้อผิดพลาดในการซิงค์ข้อมูล',
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handlePullDataFromSheets = async () => {
    if (!spreadsheetId) {
      setStatusMessage({
        type: 'error',
        text: 'กรุณาระบุหรือสร้าง Google Spreadsheet ID ก่อนดึงข้อมูลคืน',
      });
      return;
    }

    setIsPullingData(true);
    setStatusMessage(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        const res = await googleSignIn({ intent: { type: 'sheets_modal' } });
        if (res?.redirected) return;
        if (res?.accessToken && res.user) {
          token = res.accessToken;
          onGoogleLoginSuccess(res.user);
        }
      }

      if (!token) {
        throw new Error('กรุณาลงชื่อเข้าใช้ Google เพื่อดึงข้อมูล');
      }

      const pulled = await pullAllDataFromGoogleSheets(spreadsheetId, token);

      if (onSyncBackData) {
        onSyncBackData(pulled);
      }

      // Append audit log for restore
      await appendAuditLogToSheet(
        spreadsheetId,
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleString('th-TH'),
          action: 'ดึงข้อมูลคืน (Sync Back)',
          module: 'ระบบภาพรวม',
          targetItem: 'ฐานข้อมูลระบบส่วนกลาง',
          operator: `${currentUser.name} (${currentUser.role === 'admin' ? 'Admin' : 'Staff'})`,
          details: `ดึงข้อมูลคืนจากชีต: รถ ${pulled.vehicles.length} คัน, เจ้าหน้าที่ ${pulled.staffList.length} คน`,
        },
        token
      );

      setStatusMessage({
        type: 'success',
        text: `ดึงข้อมูลคืนสำเร็จ! อัปเดตรถ ${pulled.vehicles.length} คัน และเจ้าหน้าที่ ${pulled.staffList.length} คนในระบบเรียบร้อย`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Sheets',
      });
    } finally {
      setIsPullingData(false);
    }
  };

  const handleSaveCustomId = () => {
    if (!spreadsheetId) return;
    const cleanId = spreadsheetId.includes('/d/')
      ? spreadsheetId.split('/d/')[1].split('/')[0]
      : spreadsheetId.trim();

    onSaveConfig({
      ...config,
      spreadsheetId: cleanId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
    });

    setStatusMessage({
      type: 'success',
      text: 'บันทึก Spreadsheet ID เรียบร้อยแล้ว',
    });
  };

  const currentSheetUrl =
    config.spreadsheetUrl ||
    (config.spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`
      : null);

  const pendingCount = inspections.filter((i) => i.googleSheetsSyncStatus !== 'synced').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                การเชื่อมต่อ Google Sheets & Auto-Sync
              </h3>
              <p className="text-[11px] text-slate-400">
                ซิงค์อัตโนมัติ 4 หมวด (ผลตรวจ, กองรถ, เจ้าหน้าที่, Audit Log) และดึงข้อมูลคืน
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Google Account Status */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-850">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  บัญชี Google ที่เชื่อมต่อ:
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {googleUser ? googleUser.email : 'ยังไม่ได้เชื่อมต่อบัญชี Google'}
                </p>
              </div>

              {!googleUser ? (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoggingIn}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <LogIn className="h-3.5 w-3.5 text-sky-600" />
                  {isLoggingIn ? 'กำลังเชื่อมต่อ...' : 'ลงชื่อเข้าใช้ Google'}
                </button>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> เชื่อมต่อแล้ว
                </span>
              )}
            </div>
          </div>

          {/* Current Sheet Connection */}
          {currentSheetUrl ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> เชื่อมต่อกับ Spreadsheet แล้ว
                  </span>
                  <p className="mt-0.5 line-clamp-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                    ID: {config.spreadsheetId}
                  </p>
                </div>
                <a
                  href={currentSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> เปิดดูใน Sheets
                </a>
              </div>

              {/* 6 Tabs Indicator Grid */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 rounded-lg bg-white/70 p-2 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{INSPECTION_SHEET_TITLE}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-white/70 p-2 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300">
                  <Truck className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                  <span className="truncate">{VEHICLES_SHEET_TITLE}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-white/70 p-2 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300">
                  <Users className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">{STAFF_SHEET_TITLE}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-white/70 p-2 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300">
                  <Car className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">{DAMAGE_SHEET_TITLE}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-white/70 p-2 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300">
                  <Fuel className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{FUEL_SHEET_TITLE}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-white/70 p-2 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300">
                  <Activity className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  <span className="truncate">{AUDIT_LOG_SHEET_TITLE}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center dark:border-slate-700">
              <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 text-slate-400" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ยังไม่มีการเชื่อมต่อกับ Google Spreadsheet
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                สร้างสเปรดชีตใหม่ 6 หมวด (ตรวจสภาพ, กองรถ, เจ้าหน้าที่, รอยตัวรถ, น้ำมัน, Audit Log) ได้ในคลิกเดียว
              </p>
              <button
                type="button"
                onClick={handleCreateNewSheet}
                disabled={isCreating}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
              >
                {isCreating ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>สร้าง Google Sheets อัตโนมัติ (ครบ 6 หมวด)</span>
              </button>
            </div>
          )}

          {/* Manual ID Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              หรือระบุ Google Spreadsheet ID ด้วยตนเอง:
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="เช่น 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={handleSaveCustomId}
                className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                บันทึก ID
              </button>
            </div>
          </div>

          {/* Sync Actions Grid */}
          <div className="border-t border-slate-200 pt-3 dark:border-slate-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  ผลตรวจรอซิงค์: {pendingCount} รายการ · กองรถ: {vehicles.length} คัน · เจ้าหน้าที่: {staffList.length} ท่าน
                </p>
                <p className="text-[11px] text-slate-400">
                  ซิงค์ประวัติและสถานะล่าสุดขึ้น Sheets หรือดึงข้อมูลคืนสู่ระบบ
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isPullingData || !spreadsheetId}
                  onClick={handlePullDataFromSheets}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                  title="ดึงข้อมูลกองรถและเจ้าหน้าที่จาก Google Sheets คืนสู่ระบบ"
                >
                  <DownloadCloud className={`h-3.5 w-3.5 ${isPullingData ? 'animate-bounce' : ''}`} />
                  <span>{isPullingData ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลคืน (Sync Back)'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSyncingAll || !spreadsheetId}
                  onClick={handleSyncAllPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
                  title="อัปโหลดผลตรวจ กองรถ และเจ้าหน้าที่ขึ้น Sheets ทั้งหมด"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                  <span>{isSyncingAll ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลขึ้นชีต'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`flex items-center gap-2 rounded-xl p-3 text-xs font-medium ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
