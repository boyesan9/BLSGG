import React, { useState, useEffect } from 'react';
import {
  AmbulanceVehicle,
  GoogleSheetsConfig,
  InspectionRecord,
  UserProfile,
  UserRole,
  VehicleStatus,
  VehicleDamageItem,
  FuelLogRecord,
  MasterDatabasePayload,
} from './types';
import {
  getStoredVehicles,
  saveVehicles,
  getStoredInspections,
  saveInspectionRecord,
  updateInspectionRecord,
  getCurrentUser,
  setCurrentUser,
  getGoogleSheetsConfig,
  saveGoogleSheetsConfig,
  getStoredStaff,
  saveStaff,
  deduplicateStaff,
  deleteInspectionRecord,
  clearAllInspectionRecords,
  safelyPersistInspections,
  clearAllSystemData,
  resetToInitialDemoData,
  DEMO_USERS,
  getStoredDamageRecords,
  saveDamageRecord,
  saveAllDamageRecords,
  deleteDamageRecord,
  getStoredFuelLogs,
  saveFuelLog,
  saveAllFuelLogs,
  deleteFuelLog,
} from './services/storage';
import { Navbar, AppViewMode } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { InspectionForm } from './components/InspectionForm';
import { AdminDashboard } from './components/AdminDashboard';
import { VehicleDamageView } from './components/VehicleDamageView';
import { FuelLogView } from './components/FuelLogView';
import { InspectionDetailModal } from './components/InspectionDetailModal';
import { VehicleModal } from './components/VehicleModal';
import { StaffModal } from './components/StaffModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { PrintReportView } from './components/PrintReportView';
import { AdminAuthModal } from './components/AdminAuthModal';
import {
  auth,
  initAuth,
  googleSignIn,
  getAccessToken,
  logoutGoogle,
  consumeRedirectIntent,
  setLoggedOutFlag,
  getLoggedOutFlag,
  RedirectLoginIntent,
} from './services/firebaseAuth';
import {
  appendInspectionToSheet,
  formatRecordForSheet,
  syncVehiclesToSheet,
  syncStaffToSheet,
  appendAuditLogToSheet,
  pullAllDataFromGoogleSheets,
  appendDamageToSheet,
  syncDamageToSheet,
  appendFuelLogToSheet,
  syncFuelLogsToSheet,
} from './services/googleSheets';
import {
  uploadInspectionMediaToDrive,
  uploadDamagePhotosToDrive,
  uploadFuelReceiptToDrive,
  uploadVehiclePhotoToDrive,
  findExistingInspectionSpreadsheet,
  saveMasterDatabaseToDrive,
  loadMasterDatabaseFromDrive,
  formatGoogleApiError,
} from './services/googleDrive';
import {
  syncInspectionsFromIndexedDb,
  toDisplayableDriveImageUrl,
} from './services/storage';
import { User } from 'firebase/auth';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUserState] = useState<UserProfile | null>(() => getCurrentUser());
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => !getLoggedOutFlag());
  const [currentView, setCurrentView] = useState<AppViewMode>('form');

  const [vehicles, setVehicles] = useState<AmbulanceVehicle[]>(() => getStoredVehicles());
  const [inspections, setInspections] = useState<InspectionRecord[]>(() => getStoredInspections());
  const [damageRecords, setDamageRecords] = useState<VehicleDamageItem[]>(() => {
    const list = getStoredDamageRecords();
    return list.filter((d) => d.id !== 'dmg-01' && d.id !== 'dmg-02' && d.id !== 'dmg-03');
  });
  const [fuelLogs, setFuelLogs] = useState<FuelLogRecord[]>(() => getStoredFuelLogs());

  const [selectedRecordDetail, setSelectedRecordDetail] = useState<InspectionRecord | null>(null);
  const [recordToPrint, setRecordToPrint] = useState<InspectionRecord | null>(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleToEdit, setVehicleToEdit] = useState<AmbulanceVehicle | null>(null);

  const [staffList, setStaffList] = useState<UserProfile[]>(() => getStoredStaff());
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<UserProfile | null>(null);

  const [googleSheetsModalOpen, setGoogleSheetsModalOpen] = useState(false);
  const [googleSheetsConfig, setGoogleSheetsConfig] = useState<GoogleSheetsConfig>(() => getGoogleSheetsConfig());
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Admin authentication state
  const [adminAuthModalOpen, setAdminAuthModalOpen] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  const [isSubmittingInspection, setIsSubmittingInspection] = useState(false);
  const [isSyncingGSheets, setIsSyncingGSheets] = useState(false);
  const [toastNotification, setToastNotification] = useState<{
    type: 'success' | 'info' | 'error';
    title: string;
    message: string;
    linkUrl?: string;
    linkText?: string;
  } | null>(null);

  // Initialize Firebase Auth listener (including getRedirectResult recovery)
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token, isFromRedirect) => {
        setGoogleUser(user);
        if (user) {
          setIsAdminVerified(true);
        }

        if (isFromRedirect) {
          const intent = consumeRedirectIntent();
          if (intent?.type === 'admin_auth') {
            setLoggedOutFlag(false);
            const activeUser = getCurrentUser();
            const targetProfile: UserProfile = intent.targetUser
              ? {
                  ...intent.targetUser,
                  email: intent.targetUser.email || user.email || '',
                  role: 'admin',
                }
              : {
                  ...(activeUser || DEMO_USERS.admin),
                  name: activeUser?.name || user.displayName || 'ผู้ดูแลระบบ (Admin)',
                  email: activeUser?.email || user.email || '',
                  role: 'admin',
                };
            await handleLogin(targetProfile);
            setCurrentView('dashboard');
            setToastNotification({
              type: 'success',
              title: 'เข้าสู่ระบบผู้ดูแลด้วย Google สำเร็จ',
              message: `เชื่อมต่อบัญชี ${user.email} และดึงข้อมูลล่าสุดจาก Drive & Sheets แล้ว`,
            });
            return;
          }

          if (intent?.type === 'login_view') {
            await loadDataFromDriveBeforeSheets(true);
            return;
          }

          if (intent?.type === 'sheets_modal') {
            setGoogleSheetsModalOpen(true);
            await loadDataFromDriveBeforeSheets(true);
            return;
          }
        }

        if (token) {
          loadDataFromDriveBeforeSheets(Boolean(isFromRedirect));
        }
      },
      (err) => {
        if (err) {
          setToastNotification({
            type: 'error',
            title: 'การเข้าสู่ระบบ Google ไม่สำเร็จ',
            message: err.message || 'ไม่สามารถดำเนินการเข้าสู่ระบบผ่าน Google Redirect ได้',
          });
        } else {
          setGoogleUser(null);
        }
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Hydrate inspections from IndexedDB on startup to safeguard full photo history
  useEffect(() => {
    syncInspectionsFromIndexedDb()
      .then((records) => {
        if (records && records.length > 0) {
          setInspections(records);
        }
      })
      .catch((err) => {
        console.warn('IndexedDB initial sync warning:', err);
      });
  }, []);

  // Toast Auto-dismiss
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Centralized audit logger and automated Google Sheets sync
  const logSystemActivityAndSyncSheets = async (
    action: string,
    module: string,
    targetItem: string,
    details: string
  ) => {
    try {
      const spreadsheetId = googleSheetsConfig.spreadsheetId;
      if (!spreadsheetId) return;

      const token = await getAccessToken();
      if (!token) return;

      const operatorName = googleUser?.email
        ? `${currentUser?.name || 'Admin'} (${googleUser.email})`
        : `${currentUser?.name || 'Admin'} (${currentUser?.role === 'admin' ? 'Admin' : 'Staff'})`;

      await appendAuditLogToSheet(
        spreadsheetId,
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleString('th-TH'),
          action,
          module,
          targetItem,
          operator: operatorName,
          details,
        },
        token
      );
    } catch (err) {
      console.warn('Audit logging warning:', err);
    }
  };

  // Reconcile current active user's profile (position, department, name, etc.) from synced Google Sheets staff
  const reconcileCurrentUserWithStaff = (syncedStaff: UserProfile[]) => {
    if (!syncedStaff || syncedStaff.length === 0) return;
    const activeFbEmail = (auth.currentUser?.email || googleUser?.email || '').toLowerCase();
    setCurrentUserState((prevUser) => {
      if (!prevUser) return prevUser;
      const userEmail = (prevUser.email || activeFbEmail || '').toLowerCase();
      const isDefaultPlaceholder =
        prevUser.id === 'current-operator' || prevUser.id === 'current-admin';

      const matched =
        syncedStaff.find((s) => s.id === prevUser.id) ||
        (userEmail
          ? syncedStaff.find((s) => s.email && s.email.toLowerCase() === userEmail && s.role === prevUser.role) ||
            syncedStaff.find((s) => s.email && s.email.toLowerCase() === userEmail)
          : undefined) ||
        syncedStaff.find((s) => s.name === prevUser.name && s.role === prevUser.role) ||
        (isDefaultPlaceholder ? syncedStaff.find((s) => s.role === prevUser.role) : undefined);

      if (!matched) return prevUser;

      const updated: UserProfile = {
        ...prevUser,
        ...matched,
        role: isDefaultPlaceholder ? matched.role : prevUser.role,
      };
      setCurrentUser(updated);
      return updated;
    });
  };

  // Two-way Sync Back handler from Google Sheets (Single Source of Truth)
  const handleSyncBackData = (data: {
    vehicles: AmbulanceVehicle[];
    staffList: UserProfile[];
    inspectionsCount: number;
    damageRecords?: VehicleDamageItem[];
    fuelLogs?: FuelLogRecord[];
  }) => {
    if (data.vehicles) {
      const cleanVehicles = data.vehicles.filter(
        (v) => v.id !== 'veh-01' && v.id !== 'veh-02' && v.id !== 'veh-03' && v.id !== 'veh-04'
      );
      const currentVehs = getStoredVehicles();
      const localVehMap = new Map(currentVehs.map((v) => [v.id, v]));
      const reconciledVehicles = cleanVehicles.map((pv) => {
        const local = localVehMap.get(pv.id);
        const driveUrl = pv.drivePhotoUrl || local?.drivePhotoUrl;
        const localImg = local?.imageUrl && !local.imageUrl.startsWith('data:image/svg+xml') ? local.imageUrl : undefined;
        const sheetImg = pv.imageUrl && !pv.imageUrl.startsWith('data:image/svg+xml') ? pv.imageUrl : undefined;
        return {
          ...pv,
          imageUrl: localImg || sheetImg || toDisplayableDriveImageUrl(undefined, driveUrl),
          drivePhotoUrl: driveUrl,
          driveFolderUrl: pv.driveFolderUrl || local?.driveFolderUrl,
        };
      });
      setVehicles(reconciledVehicles);
      saveVehicles(reconciledVehicles);
    }
    if (data.staffList) {
      const cleanStaff = deduplicateStaff(data.staffList);
      setStaffList(cleanStaff);
      saveStaff(cleanStaff);
      reconcileCurrentUserWithStaff(cleanStaff);
    }
    if (data.damageRecords) {
      const cleanDamages = data.damageRecords.filter(
        (d) => d.id !== 'dmg-01' && d.id !== 'dmg-02' && d.id !== 'dmg-03'
      );
      setDamageRecords(cleanDamages);
      saveAllDamageRecords(cleanDamages);
    }
    if (data.fuelLogs) {
      const cleanFuel = data.fuelLogs.filter(
        (f) =>
          f.id !== 'fuel-01' &&
          f.id !== 'fuel-02' &&
          f.id !== 'fuel-03' &&
          f.id !== 'fuel-04' &&
          f.id !== 'fuel-05'
      );
      setFuelLogs(cleanFuel);
      saveAllFuelLogs(cleanFuel);
    }
    // Re-hydrate inspections from storage
    const storedInspections = getStoredInspections();
    setInspections(storedInspections);

    setToastNotification({
      type: 'success',
      title: 'ดึงข้อมูลคืน (Sync Back) สำเร็จทุกฟังก์ชัน',
      message: `กู้คืนข้อมูลครบถ้วนจาก Google Sheets (รถ ${data.vehicles?.length || 0} คัน, เจ้าหน้าที่ ${data.staffList?.length || 0} คน, รอยรอบตัวรถ ${data.damageRecords?.length || 0} จุด, ประวัติน้ำมัน ${data.fuelLogs?.length || 0} รายการ)`,
    });
  };

  // Helper to persist current system snapshot into Google Drive master database
  const saveCurrentDatabaseSnapshotToDrive = async (token?: string | null) => {
    try {
      const activeToken = token || (await getAccessToken());
      if (!activeToken) return;

      const payload: MasterDatabasePayload = {
        inspections: getStoredInspections(),
        vehicles: getStoredVehicles(),
        staffList: getStoredStaff(),
        damageRecords: getStoredDamageRecords(),
        fuelLogs: getStoredFuelLogs(),
        spreadsheetId: googleSheetsConfig.spreadsheetId,
        spreadsheetUrl: googleSheetsConfig.spreadsheetUrl,
        lastSyncedAt: new Date().toLocaleString('th-TH'),
        version: 1,
      };

      await saveMasterDatabaseToDrive(activeToken, payload);
    } catch (err) {
      console.warn('Google Drive master database backup warning:', err);
    }
  };

  // Master Sync: โหลดข้อมูลจาก Google Drive ก่อน Google Sheets เพื่อให้ข้อมูลถูกต้องและตรงกัน 100%
  const loadDataFromDriveBeforeSheets = async (
    showNotification = false
  ): Promise<{ token: string | null; spreadsheetId: string | null; staffList: UserProfile[] } | null> => {
    setIsSyncingGSheets(true);
    let latestStaffList: UserProfile[] = getStoredStaff();
    try {
      let token = await getAccessToken();
      if (!token && showNotification) {
        const signRes = await googleSignIn({ intent: { type: 'sync' } });
        if (signRes?.redirected) {
          return null;
        }
        if (signRes?.accessToken && signRes.user) {
          token = signRes.accessToken;
          setGoogleUser(signRes.user);
        }
      }

      if (!token) {
        if (showNotification) {
          setToastNotification({
            type: 'error',
            title: 'ยังไม่ได้เชื่อมต่อบัญชี Google',
            message: 'กรุณาลงชื่อเข้าใช้ Google เพื่อโหลดข้อมูลจาก Google Drive และ Google Sheets',
          });
        }
        return null;
      }

      // ========================================================
      // ขั้นตอนที่ 1: โหลดข้อมูลจาก Google Drive ก่อน (Drive First)
      // ========================================================
      let driveLoaded = false;
      let driveStats = '';
      let resolvedSheetId = googleSheetsConfig.spreadsheetId;

      try {
        const driveData = await loadMasterDatabaseFromDrive(token);
        if (driveData) {
          driveLoaded = true;
          if (driveData.vehicles) {
            const cleanDriveVehicles = driveData.vehicles.filter(
              (v) => v.id !== 'veh-01' && v.id !== 'veh-02' && v.id !== 'veh-03' && v.id !== 'veh-04'
            );
            setVehicles(cleanDriveVehicles);
            saveVehicles(cleanDriveVehicles);
          }
          if (driveData.staffList) {
            const cleanDriveStaff = deduplicateStaff(driveData.staffList);
            latestStaffList = cleanDriveStaff;
            setStaffList(cleanDriveStaff);
            saveStaff(cleanDriveStaff);
            reconcileCurrentUserWithStaff(cleanDriveStaff);
          }
          if (driveData.damageRecords) {
            const cleanDriveDamages = driveData.damageRecords.filter(
              (d) => d.id !== 'dmg-01' && d.id !== 'dmg-02' && d.id !== 'dmg-03'
            );
            setDamageRecords(cleanDriveDamages);
            saveAllDamageRecords(cleanDriveDamages);
          }
          if (driveData.fuelLogs) {
            const cleanDriveFuel = driveData.fuelLogs.filter(
              (f) =>
                f.id !== 'fuel-01' &&
                f.id !== 'fuel-02' &&
                f.id !== 'fuel-03' &&
                f.id !== 'fuel-04' &&
                f.id !== 'fuel-05'
            );
            setFuelLogs(cleanDriveFuel);
            saveAllFuelLogs(cleanDriveFuel);
          }
          if (driveData.inspections) {
            const cleanDriveInspections = driveData.inspections.filter(
              (i) => i.id !== 'insp-20261107-001' && i.id !== 'insp-20261106-002'
            );
            setInspections(cleanDriveInspections);
            safelyPersistInspections(cleanDriveInspections);
          }
          if (driveData.spreadsheetId && !resolvedSheetId) {
            resolvedSheetId = driveData.spreadsheetId;
          }
          driveStats = `(รถ ${driveData.vehicles?.length || 0} คัน, รอยตัวรถ ${driveData.damageRecords?.length || 0} จุด, น้ำมัน ${driveData.fuelLogs?.length || 0} รายการ)`;
        }
      } catch (driveErr) {
        console.warn('Phase 1 (Google Drive Load) warning:', driveErr);
      }

      // ตรวจสอบ Google Spreadsheet ใน Drive หากยังไม่มีในอุปกรณ์นี้
      if (!resolvedSheetId) {
        try {
          const found = await findExistingInspectionSpreadsheet(token);
          if (found) {
            resolvedSheetId = found.spreadsheetId;
            const updatedConfig = {
              ...googleSheetsConfig,
              spreadsheetId: found.spreadsheetId,
              spreadsheetUrl: found.spreadsheetUrl,
              lastSyncedAt: new Date().toLocaleTimeString('th-TH'),
            };
            setGoogleSheetsConfig(updatedConfig);
            saveGoogleSheetsConfig(updatedConfig);
          }
        } catch (findErr) {
          console.warn('Google Drive spreadsheet discovery warning:', findErr);
        }
      }

      // ========================================================
      // ขั้นตอนที่ 2: โหลดข้อมูลจาก Google Sheets ตรวจเช็คให้ตรงกัน (Single Source of Truth)
      // ========================================================
      let sheetsLoaded = false;
      if (resolvedSheetId) {
        try {
          const pulled = await pullAllDataFromGoogleSheets(resolvedSheetId, token);
          sheetsLoaded = true;

          // Reconcile Vehicles: Google Sheets is the Single Source of Truth
          if (pulled.vehicles) {
            const cleanSheetVehicles = pulled.vehicles.filter(
              (v) => v.id !== 'veh-01' && v.id !== 'veh-02' && v.id !== 'veh-03' && v.id !== 'veh-04'
            );
            const currentVehs = getStoredVehicles();
            const localVehMap = new Map(currentVehs.map((v) => [v.id, v]));
            const reconciledVehicles = cleanSheetVehicles.map((pv) => {
              const local = localVehMap.get(pv.id);
              const driveUrl = pv.drivePhotoUrl || local?.drivePhotoUrl;
              const localImg = local?.imageUrl && !local.imageUrl.startsWith('data:image/svg+xml') ? local.imageUrl : undefined;
              const sheetImg = pv.imageUrl && !pv.imageUrl.startsWith('data:image/svg+xml') ? pv.imageUrl : undefined;
              return {
                ...pv,
                imageUrl: localImg || sheetImg || toDisplayableDriveImageUrl(undefined, driveUrl),
                drivePhotoUrl: driveUrl,
                driveFolderUrl: pv.driveFolderUrl || local?.driveFolderUrl,
              };
            });
            setVehicles(reconciledVehicles);
            saveVehicles(reconciledVehicles);
          }

          // Reconcile Staff: Google Sheets is the Single Source of Truth
          if (pulled.staffList) {
            const cleanSheetStaff = deduplicateStaff(pulled.staffList);
            latestStaffList = cleanSheetStaff;
            setStaffList(cleanSheetStaff);
            saveStaff(cleanSheetStaff);
            reconcileCurrentUserWithStaff(cleanSheetStaff);
          }

          // Reconcile Damage Records: Google Sheets is the Single Source of Truth!
          if (pulled.damageRecords) {
            const cleanSheetDamages = pulled.damageRecords.filter(
              (d) => d.id !== 'dmg-01' && d.id !== 'dmg-02' && d.id !== 'dmg-03'
            );
            const currentDamages = getStoredDamageRecords();
            const localMap = new Map(currentDamages.map((d) => [d.id, d]));
            const reconciledDamages = cleanSheetDamages.map((pd) => {
              const local = localMap.get(pd.id);
              return {
                ...pd,
                photoUrl: (local?.photoUrl && local.photoUrl.startsWith('data:')) ? local.photoUrl : pd.photoUrl,
                additionalPhotos: (local?.additionalPhotos && local.additionalPhotos.length > 0) ? local.additionalPhotos : (pd.additionalPhotos || []),
                drivePhotoUrl: pd.drivePhotoUrl || local?.drivePhotoUrl,
                driveFolderUrl: pd.driveFolderUrl || local?.driveFolderUrl,
              };
            });
            setDamageRecords(reconciledDamages);
            saveAllDamageRecords(reconciledDamages);
          }

          // Reconcile Fuel Logs: Google Sheets is the Single Source of Truth!
          if (pulled.fuelLogs) {
            const cleanSheetFuel = pulled.fuelLogs.filter(
              (f) =>
                f.id !== 'fuel-01' &&
                f.id !== 'fuel-02' &&
                f.id !== 'fuel-03' &&
                f.id !== 'fuel-04' &&
                f.id !== 'fuel-05'
            );
            const currentFuel = getStoredFuelLogs();
            const localMap = new Map(currentFuel.map((f) => [f.id, f]));
            const reconciledFuel = cleanSheetFuel.map((pf) => {
              const local = localMap.get(pf.id);
              return {
                ...pf,
                receiptPhotoUrl: local?.receiptPhotoUrl || pf.receiptPhotoUrl || pf.receiptDriveUrl || '',
                receiptDriveUrl: pf.receiptDriveUrl || local?.receiptDriveUrl,
                driveFolderUrl: pf.driveFolderUrl || local?.driveFolderUrl,
              };
            });
            setFuelLogs(reconciledFuel);
            saveAllFuelLogs(reconciledFuel);
          }

          // อัปเดตสถานะ Google Sheets Config
          const updatedConf = {
            ...googleSheetsConfig,
            spreadsheetId: resolvedSheetId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${resolvedSheetId}/edit`,
            lastSyncedAt: new Date().toLocaleTimeString('th-TH'),
          };
          setGoogleSheetsConfig(updatedConf);
          saveGoogleSheetsConfig(updatedConf);

          // ซิงค์บันทึก Snapshot คืนสู่ Google Drive เพื่อให้ตรงกัน 100%
          const snapshotPayload: MasterDatabasePayload = {
            inspections: getStoredInspections(),
            vehicles: getStoredVehicles(),
            staffList: getStoredStaff(),
            damageRecords: getStoredDamageRecords(),
            fuelLogs: getStoredFuelLogs(),
            spreadsheetId: resolvedSheetId,
            spreadsheetUrl: updatedConf.spreadsheetUrl,
            lastSyncedAt: new Date().toLocaleString('th-TH'),
            version: 1,
          };
          saveMasterDatabaseToDrive(token, snapshotPayload).catch(console.warn);
        } catch (sheetErr) {
          console.warn('Phase 2 (Google Sheets Load) warning:', sheetErr);
        }
      }

      if (showNotification || driveLoaded || sheetsLoaded) {
        setToastNotification({
          type: 'success',
          title: 'ดึงข้อมูลคืน (Sync Back) สำเร็จ',
          message: `ดึงข้อมูลล่าสุดจาก Google Drive & Google Sheets ตรงกัน 100% เรียบร้อย ${driveStats}`,
        });
      }
      return { token, spreadsheetId: resolvedSheetId || null, staffList: latestStaffList };
    } catch (err: any) {
      console.warn('loadDataFromDriveBeforeSheets warning:', err?.code || err?.message || err);
      if (showNotification) {
        setToastNotification({
          type: 'error',
          title: 'การโหลดข้อมูล Cloud ขัดข้อง',
          message: err.message || 'ไม่สามารถโหลดข้อมูลจาก Google Drive หรือ Google Sheets ได้',
        });
      }
      return null;
    } finally {
      setIsSyncingGSheets(false);
    }
  };

  // ดึงข้อมูลคืน (Sync Back) ทันทีเมื่อเปิดเว็บครั้งแรก
  useEffect(() => {
    loadDataFromDriveBeforeSheets(false);
  }, []);

  // ดึงข้อมูลคืน (Sync Back) ทันทีเมื่อสถานะ Google พร้อม
  useEffect(() => {
    if (googleUser) {
      loadDataFromDriveBeforeSheets(false);
    }
  }, [googleUser]);

  // Manual trigger function for Sync-Back from Navbar / Drawer
  const handleTriggerSyncBack = async () => {
    await loadDataFromDriveBeforeSheets(true);
  };

  // Login handler: ดึงข้อมูลคืน (Sync Back) ทันทีเมื่อเข้าระบบครั้งแรก และบันทึกผู้ใช้งานลง Cloud หากยังไม่มี
  const handleLogin = async (user: UserProfile) => {
    const activeFbUser = auth.currentUser || googleUser;
    const enrichedUser: UserProfile = {
      ...user,
      name:
        user.role === 'admin' &&
        (!user.name || user.name === 'ผู้ดูแลระบบ (Admin)') &&
        activeFbUser?.displayName
          ? activeFbUser.displayName
          : user.name,
      email: user.email || activeFbUser?.email || '',
    };

    setLoggedOutFlag(false);
    setCurrentUserState(enrichedUser);
    setCurrentUser(enrichedUser);
    setIsLoggedIn(true);
    if (enrichedUser.role === 'admin') {
      setIsAdminVerified(true);
      setCurrentView('dashboard');
    } else {
      setCurrentView('form');
    }

    // ดึงข้อมูลคืน Sync Back ทันทีเมื่อเข้าระบบครั้งแรก
    const syncRes = await loadDataFromDriveBeforeSheets(true);
    const syncedStaff = syncRes?.staffList || getStoredStaff();

    // ตรวจสอบว่าผู้ที่เข้าสู่ระบบมีรายชื่อในฐานข้อมูลแล้วหรือไม่ หากยังไม่มีให้บันทึกและซิงค์ลง Google Sheets & Drive
    const alreadyExists = syncedStaff.some(
      (s) =>
        s.id === enrichedUser.id ||
        (enrichedUser.email &&
          s.email &&
          s.email.toLowerCase() === enrichedUser.email.toLowerCase() &&
          s.role === enrichedUser.role) ||
        (s.name === enrichedUser.name && s.role === enrichedUser.role)
    );

    if (!alreadyExists) {
      const updatedStaff = deduplicateStaff([...syncedStaff, enrichedUser]);
      setStaffList(updatedStaff);
      saveStaff(updatedStaff);

      const token = syncRes?.token || (await getAccessToken());
      const spreadsheetId = syncRes?.spreadsheetId || googleSheetsConfig.spreadsheetId;
      if (token) {
        try {
          if (spreadsheetId) {
            await syncStaffToSheet(spreadsheetId, updatedStaff, token);
          }
          await saveCurrentDatabaseSnapshotToDrive(token);
        } catch (err) {
          console.warn('Auto-register user to Cloud warning:', err);
        }
      }
    }
  };

  // Switch role handler (Admin <-> Staff) with security passcode or Gmail verification
  const handleSwitchRole = (role: UserRole) => {
    if (role === 'admin') {
      // Admin requires Google login or security passcode verification
      if (!googleUser && !isAdminVerified) {
        setAdminAuthModalOpen(true);
        return;
      }
      const updated: UserProfile = {
        ...(currentUser || DEMO_USERS.admin),
        role: 'admin',
      };
      setCurrentUserState(updated);
      setCurrentUser(updated);
      setCurrentView('dashboard');
    } else {
      const updated: UserProfile = {
        ...(currentUser || DEMO_USERS.staff),
        role: 'staff',
      };
      setCurrentUserState(updated);
      setCurrentUser(updated);
      setCurrentView('form');
    }
  };

  // Logout handler
  const handleLogout = () => {
    setLoggedOutFlag(true);
    setIsLoggedIn(false);
  };

  // Google Login Trigger
  const handleGoogleLogin = async (
    intent?: Omit<RedirectLoginIntent, 'timestamp'>
  ): Promise<'success' | 'redirected' | false> => {
    setIsGoogleLoading(true);
    let wasRedirected = false;
    try {
      const res = await googleSignIn({ intent });
      if (res?.redirected) {
        wasRedirected = true;
        return 'redirected';
      }
      if (res?.user) {
        setGoogleUser(res.user);
        // โหลดข้อมูลจาก Google Drive ก่อน Google Sheets ทันทีที่เชื่อมต่อ Google
        await loadDataFromDriveBeforeSheets(true);
        return 'success';
      }
      return false;
    } catch (err: any) {
      setToastNotification({
        type: 'error',
        title: 'การเชื่อมต่อ Google ไม่สำเร็จ',
        message: err.message || 'โปรดตรวจสอบการอนุญาตสิทธิ์',
      });
      return false;
    } finally {
      if (!wasRedirected) {
        setIsGoogleLoading(false);
      }
    }
  };

  // Helper to ensure valid access token and spreadsheet across devices
  const ensureTokenAndSheet = async (
    autoPrompt = false
  ): Promise<{ token: string | null; spreadsheetId: string | null; redirected?: boolean }> => {
    let token = await getAccessToken();
    if (!token && autoPrompt) {
      try {
        const signRes = await googleSignIn({ intent: { type: 'sync' } });
        if (signRes?.redirected) {
          return { token: null, spreadsheetId: googleSheetsConfig.spreadsheetId || null, redirected: true };
        }
        if (signRes?.accessToken && signRes.user) {
          token = signRes.accessToken;
          setGoogleUser(signRes.user);
        }
      } catch (_) {}
    }

    let spreadsheetId = googleSheetsConfig.spreadsheetId;
    if (!spreadsheetId && token) {
      try {
        const found = await findExistingInspectionSpreadsheet(token);
        if (found) {
          spreadsheetId = found.spreadsheetId;
          const newConf = {
            ...googleSheetsConfig,
            spreadsheetId: found.spreadsheetId,
            spreadsheetUrl: found.spreadsheetUrl,
            lastSyncedAt: new Date().toLocaleTimeString('th-TH'),
          };
          setGoogleSheetsConfig(newConf);
          saveGoogleSheetsConfig(newConf);
        }
      } catch (e) {
        console.warn('Auto search spreadsheet error:', e);
      }
    }

    return { token, spreadsheetId: spreadsheetId || null };
  };

  // Submit Inspection Record
  const handleSubmitInspection = async (record: InspectionRecord) => {
    setIsSubmittingInspection(true);
    try {
      // 1. Save locally first so data is never lost even if Google redirect happens
      let recordToSave = { ...record };
      const initialSaved = saveInspectionRecord(recordToSave);
      setInspections(initialSaved);
      setVehicles(getStoredVehicles());
      const syncErrors: string[] = [];

      // 2. Ensure Google Auth & Spreadsheet
      const { token, spreadsheetId, redirected } = await ensureTokenAndSheet(true);
      if (redirected) {
        return;
      }

      let apiActivationUrl: string | undefined;
      if (!token) {
        syncErrors.push('ยังไม่ได้ลงชื่อเข้าใช้ Google จึงไม่สามารถอัปโหลดรูปภาพลง Google Drive และบันทึกลง Google Sheets ได้');
      } else if (!spreadsheetId) {
        syncErrors.push('ยังไม่มี Google Spreadsheet รองรับ (กรุณากดเปิดเมนู Google Sheets เพื่อสร้างหรือเชื่อมต่อ)');
      } else {
        // Upload 4-side photos and attached document to Google Drive
        try {
          const driveLinks = await uploadInspectionMediaToDrive(token, record);
          recordToSave.driveLinks = driveLinks;
        } catch (driveErr: any) {
          const formatted = formatGoogleApiError(driveErr?.message || 'อัปโหลดภาพไม่สำเร็จ', 'Google Drive API');
          apiActivationUrl = apiActivationUrl || formatted.activationUrl;
          syncErrors.push(`Google Drive: ${formatted.message}`);
        }

        // Sync row with Google Drive links to Google Sheets
        try {
          await appendInspectionToSheet(spreadsheetId, recordToSave, token);
          recordToSave.googleSheetsSyncStatus = 'synced';
        } catch (sheetErr: any) {
          const formatted = formatGoogleApiError(sheetErr?.message || 'บันทึกแถวไม่สำเร็จ', 'Google Sheets API');
          apiActivationUrl = apiActivationUrl || formatted.activationUrl;
          syncErrors.push(`Google Sheets: ${formatted.message}`);
        }
      }

      const updatedList = saveInspectionRecord(recordToSave);
      setInspections(updatedList);
      const latestVehicles = getStoredVehicles();
      setVehicles(latestVehicles);

      // Automated background mirror of updated vehicle fleet & audit trail to Google Sheets & Drive
      if (token && spreadsheetId) {
        syncVehiclesToSheet(spreadsheetId, latestVehicles, token).catch((err) => {
          console.warn('Vehicle fleet sync warning:', err);
        });
        saveCurrentDatabaseSnapshotToDrive(token);
      }

      logSystemActivityAndSyncSheets(
        'ตรวจสภาพรถ',
        'ตรวจสภาพรถ',
        `${record.vehicleCode} (${record.plateNumber})`,
        `ผลตรวจ: ${record.overallStatus === 'normal' ? 'ปกติ/พร้อมใช้' : record.overallStatus === 'issue_found' ? 'พบปัญหาเล็กน้อย' : 'ส่งซ่อม/ไม่พร้อมใช้'} · ไมล์: ${record.odometerReading} กม.`
      );

      if (syncErrors.length > 0) {
        setToastNotification({
          type: 'error',
          title: 'บันทึกในเครื่องแล้ว แต่พบข้อผิดพลาดในการซิงค์ Cloud',
          message: `บันทึกข้อมูลรถ ${record.vehicleCode} (${record.plateNumber}) แล้ว แต่ ${syncErrors.join(' | ')}`,
          linkUrl: apiActivationUrl || googleSheetsConfig.spreadsheetUrl,
          linkText: apiActivationUrl ? 'เปิดหน้าเปิดใช้งาน API ใน Google Cloud' : 'ตรวจสอบการเชื่อมต่อ',
        });
      } else {
        setToastNotification({
          type: 'success',
          title: 'บันทึกการตรวจสภาพรถสำเร็จและซิงค์ครบถ้วน!',
          message: `บันทึกข้อมูลรถ ${record.vehicleCode} (${record.plateNumber}) พร้อมอัปโหลดภาพลง Google Drive และบันทึกข้อมูลลง Google Sheets เรียบร้อยแล้ว`,
          linkUrl: recordToSave.driveLinks?.folderUrl || googleSheetsConfig.spreadsheetUrl,
          linkText: recordToSave.driveLinks?.folderUrl ? 'เปิดดูรูปใน Google Drive' : 'เปิดดูใน Google Sheets',
        });
      }

      // Switch to dashboard to review history
      setCurrentView('dashboard');
    } catch (err: any) {
      console.warn('handleSubmitInspection warning:', err?.message || err);
      setToastNotification({
        type: 'error',
        title: 'เกิดข้อผิดพลาดในการบันทึก',
        message: err.message || 'ไม่สามารถบันทึกข้อมูลได้',
      });
    } finally {
      setIsSubmittingInspection(false);
    }
  };

  // Force single record sync to Google Drive & Sheets
  const handleSyncSingleRecord = async (record: InspectionRecord) => {
    setIsSyncingGSheets(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const res = await googleSignIn({ intent: { type: 'sync' } });
        if (res?.redirected) {
          return;
        }
        if (res?.accessToken && res.user) {
          token = res.accessToken;
          setGoogleUser(res.user);
        }
      }

      if (!token) throw new Error('ไม่พบ Access Token กรุณาลงชื่อเข้าใช้ Google');

      let updatedRecord = { ...record };

      // Upload media to Google Drive if not uploaded yet
      if (!updatedRecord.driveLinks?.folderUrl) {
        try {
          const driveLinks = await uploadInspectionMediaToDrive(token, updatedRecord);
          updatedRecord.driveLinks = driveLinks;
        } catch (dErr) {
          console.warn('Drive upload error:', dErr);
        }
      }

      const sheetId = googleSheetsConfig.spreadsheetId;
      if (sheetId) {
        await appendInspectionToSheet(sheetId, updatedRecord, token);
        updatedRecord.googleSheetsSyncStatus = 'synced';
      }

      updateInspectionRecord(updatedRecord);
      setInspections(getStoredInspections());
      setSelectedRecordDetail(updatedRecord);

      setToastNotification({
        type: 'success',
        title: 'ซิงค์ข้อมูลสำเร็จ',
        message: `อัปโหลดรูปภาพลง Google Drive และบันทึกผลลง Google Sheets เรียบร้อยแล้ว`,
        linkUrl: updatedRecord.driveLinks?.folderUrl || googleSheetsConfig.spreadsheetUrl,
        linkText: 'เปิดดูใน Google Drive',
      });
    } catch (err: any) {
      setToastNotification({
        type: 'error',
        title: 'ไม่สามารถซิงค์ข้อมูลได้',
        message: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
      });
    } finally {
      setIsSyncingGSheets(false);
    }
  };

  // Delete single inspection (Admin only)
  const handleDeleteInspection = async (recordId: string) => {
    if (currentUser?.role !== 'admin') {
      setToastNotification({
        type: 'error',
        title: 'ไม่มีสิทธิ์ดำเนินการ',
        message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์ลบประวัติการตรวจ',
      });
      return;
    }
    const targetRec = inspections.find((r) => r.id === recordId);
    const updated = deleteInspectionRecord(recordId);
    setInspections(updated);
    if (selectedRecordDetail?.id === recordId) {
      setSelectedRecordDetail(null);
    }

    const { token } = await ensureTokenAndSheet(false);
    if (token) {
      await saveCurrentDatabaseSnapshotToDrive(token);
    }

    logSystemActivityAndSyncSheets(
      'ลบข้อมูลการตรวจ',
      'ตรวจสภาพรถ',
      targetRec ? `${targetRec.vehicleCode} (${targetRec.plateNumber})` : recordId,
      `ลบรายการตรวจสภาพประจำวันที่ ${targetRec?.uploadTimestamp || '-'} ออกจากระบบ`
    );

    setToastNotification({
      type: 'info',
      title: 'ลบประวัติการตรวจแล้ว',
      message: 'ลบรายการบันทึกการตรวจสภาพรถออกจากระบบและอัปเดตสำรองข้อมูล Google Drive เรียบร้อยแล้ว',
    });
  };

  // Clear all inspections (Admin only)
  const handleClearAllInspections = async () => {
    if (currentUser?.role !== 'admin') {
      setToastNotification({
        type: 'error',
        title: 'ไม่มีสิทธิ์ดำเนินการ',
        message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์ล้างประวัติการตรวจ',
      });
      return;
    }
    const countBefore = inspections.length;
    const emptyList = clearAllInspectionRecords();
    setInspections(emptyList);
    setSelectedRecordDetail(null);

    const { token } = await ensureTokenAndSheet(false);
    if (token) {
      await saveCurrentDatabaseSnapshotToDrive(token);
    }

    logSystemActivityAndSyncSheets(
      'เคลียร์ตารางประวัติทั้งหมด',
      'ตรวจสภาพรถ',
      'ประวัติการตรวจสภาพทั้งหมด',
      `เคลียร์ประวัติการตรวจสภาพรถทั้งหมดจำนวน ${countBefore} รายการ เพื่อเตรียมทดสอบระบบ`
    );

    setToastNotification({
      type: 'info',
      title: 'ล้างประวัติการตรวจทั้งหมดแล้ว',
      message: 'เคลียร์ตารางประวัติการตรวจสภาพรถทั้งหมดเรียบร้อยแล้ว พร้อมสำหรับการทดสอบระบบใหม่',
    });
  };

  // Safe local cache reset & re-sync from Cloud (Single Source of Truth)
  const handleResetDemoData = async () => {
    resetToInitialDemoData();
    setVehicles([]);
    setInspections([]);
    setStaffList([]);
    setDamageRecords([]);
    setFuelLogs([]);
    setSelectedRecordDetail(null);

    await loadDataFromDriveBeforeSheets(true);
  };

  // Clear all data completely for fresh system testing
  const handleClearAllSystemData = async (clearFleetAndStaff = false) => {
    if (currentUser?.role !== 'admin') {
      setToastNotification({
        type: 'error',
        title: 'ไม่มีสิทธิ์ดำเนินการ',
        message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์ล้างข้อมูลทั้งหมด',
      });
      return;
    }
    clearAllSystemData(clearFleetAndStaff);
    setInspections([]);
    if (clearFleetAndStaff) {
      setVehicles([]);
    }
    setSelectedRecordDetail(null);
    setRecordToPrint(null);

    const { token, spreadsheetId } = await ensureTokenAndSheet(false);
    if (token) {
      if (clearFleetAndStaff && spreadsheetId) {
        await syncVehiclesToSheet(spreadsheetId, [], token).catch(console.warn);
      }
      await saveCurrentDatabaseSnapshotToDrive(token);
    }

    logSystemActivityAndSyncSheets(
      'ล้างข้อมูลระบบ',
      'ระบบภาพรวม',
      clearFleetAndStaff ? 'ข้อมูลตรวจ + กองรถ BLS' : 'ข้อมูลประวัติการตรวจ',
      clearFleetAndStaff
        ? 'ล้างข้อมูลประวัติการตรวจและรายชื่อรถทั้งหมด เพื่อเริ่มต้นทดสอบระบบจากศูนย์'
        : 'เคลียร์ประวัติการตรวจทั้งหมด พร้อมสำหรับการเริ่มบันทึกตรวจรถรอบใหม่'
    );

    setToastNotification({
      type: 'info',
      title: 'ล้างข้อมูลเพื่อทดสอบระบบแล้ว',
      message: clearFleetAndStaff
        ? 'ล้างประวัติการตรวจและรายชื่อรถทั้งหมดแล้ว พร้อมให้เริ่มทดสอบระบบตั้งแต่ศูนย์'
        : 'เคลียร์ประวัติการตรวจทั้งหมดแล้ว พร้อมสำหรับการเริ่มบันทึกตรวจรถรอบใหม่',
    });
  };

  // Vehicle CRUD with automated Google Drive & Google Sheets Auto-Sync & audit log
  const handleSaveVehicle = async (vehicle: AmbulanceVehicle) => {
    let vehicleToSave = { ...vehicle };
    const syncErrors: string[] = [];
    let driveSucceeded = false;
    const isNew = !vehicles.some((v) => v.id === vehicle.id);

    // Save locally first so data is never lost if Google signInWithRedirect happens
    const initialVehList = [...vehicles];
    const initialVehIdx = initialVehList.findIndex((v) => v.id === vehicleToSave.id);
    if (initialVehIdx >= 0) {
      initialVehList[initialVehIdx] = vehicleToSave;
    } else {
      initialVehList.push(vehicleToSave);
    }
    setVehicles(initialVehList);
    saveVehicles(initialVehList);

    // 1. Ensure Google Auth & Spreadsheet
    const { token, spreadsheetId, redirected } = await ensureTokenAndSheet(true);
    if (redirected) return;

    let apiActivationUrl: string | undefined;
    if (!token) {
      syncErrors.push('ยังไม่ได้ลงชื่อเข้าใช้ Google (กรุณาเชื่อมต่อบัญชี Google เพื่ออัปโหลดลง Drive และ Sheets)');
    } else {
      // 2. Upload real vehicle photo to Google Drive if it's a newly picked/captured data URL
      if (
        vehicleToSave.imageUrl &&
        vehicleToSave.imageUrl.startsWith('data:image/') &&
        !vehicleToSave.imageUrl.startsWith('data:image/svg+xml')
      ) {
        try {
          const driveRes = await uploadVehiclePhotoToDrive(token, vehicleToSave);
          vehicleToSave.drivePhotoUrl = driveRes.drivePhotoUrl || vehicleToSave.drivePhotoUrl;
          vehicleToSave.driveFolderUrl = driveRes.driveFolderUrl || vehicleToSave.driveFolderUrl;
          driveSucceeded = Boolean(driveRes.drivePhotoUrl);
        } catch (driveErr: any) {
          console.warn('Google Drive vehicle photo upload warning:', driveErr?.message || driveErr);
          const formatted = formatGoogleApiError(driveErr?.message || 'อัปโหลดรูปรถไม่สำเร็จ', 'Google Drive API');
          apiActivationUrl = apiActivationUrl || formatted.activationUrl;
          syncErrors.push(`Google Drive: ${formatted.message}`);
        }
      }
    }

    const list = [...vehicles];
    const idx = list.findIndex((v) => v.id === vehicleToSave.id);
    if (idx >= 0) {
      list[idx] = vehicleToSave;
    } else {
      list.push(vehicleToSave);
    }
    setVehicles(list);
    saveVehicles(list);

    // 3. Auto-sync fleet mirror to Google Sheets & Google Drive Master DB
    if (token) {
      if (spreadsheetId) {
        try {
          await syncVehiclesToSheet(spreadsheetId, list, token);
        } catch (sheetErr: any) {
          console.warn('Google Sheets vehicle sync warning:', sheetErr?.message || sheetErr);
          const formatted = formatGoogleApiError(sheetErr?.message || 'บันทึกรายการรถลงตารางไม่สำเร็จ', 'Google Sheets API');
          apiActivationUrl = apiActivationUrl || formatted.activationUrl;
          syncErrors.push(`Google Sheets: ${formatted.message}`);
        }
      } else {
        syncErrors.push('ยังไม่มี Google Spreadsheet รองรับ (กรุณากดเปิดเมนู Google Sheets เพื่อสร้างหรือเชื่อมต่อ)');
      }
      await saveCurrentDatabaseSnapshotToDrive(token);
    }

    logSystemActivityAndSyncSheets(
      isNew ? 'เพิ่มรถกู้ชีพ' : 'แก้ไขข้อมูลรถกู้ชีพ',
      'รถกู้ชีพ BLS',
      `${vehicleToSave.code} (${vehicleToSave.plateNumber})`,
      `${isNew ? 'เพิ่มรถใหม่เข้าสู่ระบบ' : 'อัปเดตข้อมูลรถ'} · ยี่ห้อ/รุ่น: ${vehicleToSave.brandModel} · สถานะ: ${vehicleToSave.status} · ไมล์: ${vehicleToSave.currentOdometer} กม.${driveSucceeded ? ' · อัปโหลดรูปรถลง Drive แล้ว' : ''}`
    );

    if (syncErrors.length > 0) {
      setToastNotification({
        type: 'error',
        title: 'บันทึกข้อมูลรถในเครื่องแล้ว แต่พบข้อผิดพลาดในการซิงค์ Cloud',
        message: `บันทึกข้อมูลรถ ${vehicleToSave.code} แล้ว แต่ ${syncErrors.join(' | ')}`,
        linkUrl: apiActivationUrl || googleSheetsConfig.spreadsheetUrl,
        linkText: apiActivationUrl ? 'เปิดหน้าเปิดใช้งาน API ใน Google Cloud' : 'ตรวจสอบการเชื่อมต่อ Google',
      });
    } else {
      setToastNotification({
        type: 'success',
        title: 'บันทึกข้อมูลรถและอัปโหลด Cloud สำเร็จ!',
        message: `บันทึกข้อมูลรถกู้ชีพ ${vehicleToSave.code} (${vehicleToSave.plateNumber})${driveSucceeded ? ' พร้อมอัปโหลดรูปรถลง Google Drive' : ''} และซิงค์ลง Google Sheets เรียบร้อยแล้ว`,
        linkUrl: vehicleToSave.driveFolderUrl || vehicleToSave.drivePhotoUrl || googleSheetsConfig.spreadsheetUrl,
        linkText: vehicleToSave.driveFolderUrl || vehicleToSave.drivePhotoUrl
          ? 'เปิดดูรูปใน Google Drive'
          : 'เปิดดูใน Google Sheets',
      });
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    const targetVeh = vehicles.find((v) => v.id === vehicleId);
    const filtered = vehicles.filter((v) => v.id !== vehicleId);
    setVehicles(filtered);
    saveVehicles(filtered);

    const { token, spreadsheetId } = await ensureTokenAndSheet(false);
    if (token) {
      try {
        if (spreadsheetId) {
          await syncVehiclesToSheet(spreadsheetId, filtered, token);
        }
        await saveCurrentDatabaseSnapshotToDrive(token);
      } catch (err: any) {
        console.warn('Delete vehicle cloud sync warning:', err?.message || err);
        const formatted = formatGoogleApiError(err?.message || 'ไม่สามารถลบข้อมูลรถจาก Google Sheets ได้', 'Google Sheets API');
        setToastNotification({
          type: 'error',
          title: 'ลบในเครื่องแล้ว แต่ซิงค์ Google Sheets/Drive ขัดข้อง',
          message: formatted.message,
          linkUrl: formatted.activationUrl,
          linkText: formatted.activationUrl ? 'เปิดหน้าเปิดใช้งาน API ใน Google Cloud' : undefined,
        });
        return;
      }
    }

    logSystemActivityAndSyncSheets(
      'ลบรถกู้ชีพ',
      'รถกู้ชีพ BLS',
      targetVeh ? `${targetVeh.code} (${targetVeh.plateNumber})` : vehicleId,
      `ลบรถกู้ชีพออกจากระบบเรียบร้อยแล้ว`
    );

    setToastNotification({
      type: 'info',
      title: 'ลบข้อมูลรถแล้ว',
      message: 'ลบรายการรถกู้ชีพออกจากระบบและอัปเดตลง Google Sheets & Drive เรียบร้อยแล้ว',
    });
  };

  const handleUpdateVehicleStatus = async (vehicleId: string, status: VehicleStatus) => {
    const list = vehicles.map((v) => (v.id === vehicleId ? { ...v, status } : v));
    const targetVeh = vehicles.find((v) => v.id === vehicleId);
    setVehicles(list);
    saveVehicles(list);

    const { token, spreadsheetId } = await ensureTokenAndSheet(false);
    if (token) {
      try {
        if (spreadsheetId) {
          await syncVehiclesToSheet(spreadsheetId, list, token);
        }
        await saveCurrentDatabaseSnapshotToDrive(token);
      } catch (err: any) {
        console.warn('Update vehicle status cloud sync warning:', err?.message || err);
        const formatted = formatGoogleApiError(err?.message || 'ไม่สามารถอัปเดต Google Sheets ได้', 'Google Sheets API');
        setToastNotification({
          type: 'error',
          title: 'อัปเดตสถานะในเครื่องแล้ว แต่ซิงค์ Google Sheets/Drive ขัดข้อง',
          message: formatted.message,
          linkUrl: formatted.activationUrl,
          linkText: formatted.activationUrl ? 'เปิดหน้าเปิดใช้งาน API ใน Google Cloud' : undefined,
        });
      }
    }

    logSystemActivityAndSyncSheets(
      'เปลี่ยนสถานะรถ',
      'รถกู้ชีพ BLS',
      targetVeh ? `${targetVeh.code} (${targetVeh.plateNumber})` : vehicleId,
      `เปลี่ยนสถานะความพร้อมของรถเป็น: ${status}`
    );
  };

  // Staff CRUD with automated Google Sheets & Drive sync & audit log
  const handleSaveStaff = async (staff: UserProfile) => {
    const list = [...staffList];
    const idx = list.findIndex((s) => s.id === staff.id);
    const isNew = idx < 0;
    if (!isNew) {
      list[idx] = staff;
    } else {
      list.push(staff);
    }
    const cleanList = deduplicateStaff(list);
    setStaffList(cleanList);
    saveStaff(cleanList);

    if (currentUser && currentUser.id === staff.id) {
      setCurrentUserState(staff);
      setCurrentUser(staff);
    }

    const syncErrors: string[] = [];
    const { token, spreadsheetId, redirected } = await ensureTokenAndSheet(true);
    if (redirected) return;
    if (!token) {
      syncErrors.push('ยังไม่ได้เชื่อมต่อบัญชี Google');
    } else {
      if (spreadsheetId) {
        try {
          await syncStaffToSheet(spreadsheetId, cleanList, token);
        } catch (err: any) {
          syncErrors.push(`Google Sheets: ${err.message || 'ซิงค์ไม่สำเร็จ'}`);
        }
      } else {
        syncErrors.push('ยังไม่มี Google Spreadsheet รองรับ');
      }
      await saveCurrentDatabaseSnapshotToDrive(token);
    }

    logSystemActivityAndSyncSheets(
      isNew ? 'เพิ่มเจ้าหน้าที่' : 'แก้ไขข้อมูลเจ้าหน้าที่',
      'เจ้าหน้าที่',
      `${staff.name} (${staff.employeeId})`,
      `${isNew ? 'ลงทะเบียนเจ้าหน้าที่ใหม่' : 'แก้ไขข้อมูลเจ้าหน้าที่'} · ตำแหน่ง: ${staff.position || '-'} · แผนก: ${staff.department || '-'} · บทบาท: ${staff.role}`
    );

    if (syncErrors.length > 0) {
      setToastNotification({
        type: 'error',
        title: 'บันทึกในเครื่องแล้ว แต่ซิงค์ Cloud ขัดข้อง',
        message: `บันทึกข้อมูล ${staff.name} แล้ว แต่ ${syncErrors.join(' | ')}`,
      });
    } else {
      setToastNotification({
        type: 'success',
        title: 'บันทึกข้อมูลพนักงานสำเร็จ',
        message: `บันทึกข้อมูล ${staff.name} (${staff.employeeId}) และซิงค์ลง Google Sheets & Google Drive เรียบร้อยแล้ว`,
      });
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    const targetStaff = staffList.find((s) => s.id === staffId);
    const filtered = staffList.filter((s) => s.id !== staffId);
    setStaffList(filtered);
    saveStaff(filtered);

    const { token, spreadsheetId } = await ensureTokenAndSheet(false);
    if (token) {
      try {
        if (spreadsheetId) {
          await syncStaffToSheet(spreadsheetId, filtered, token);
        }
        await saveCurrentDatabaseSnapshotToDrive(token);
      } catch (err: any) {
        console.warn('Delete staff cloud sync warning:', err?.message || err);
        const formatted = formatGoogleApiError(err?.message || 'ไม่สามารถอัปเดต Google Sheets ได้', 'Google Sheets API');
        setToastNotification({
          type: 'error',
          title: 'ลบในเครื่องแล้ว แต่ซิงค์ Google Sheets/Drive ขัดข้อง',
          message: formatted.message,
          linkUrl: formatted.activationUrl,
          linkText: formatted.activationUrl ? 'เปิดหน้าเปิดใช้งาน API ใน Google Cloud' : undefined,
        });
        return;
      }
    }

    logSystemActivityAndSyncSheets(
      'ลบเจ้าหน้าที่',
      'เจ้าหน้าที่',
      targetStaff ? `${targetStaff.name} (${targetStaff.employeeId})` : staffId,
      `ลบเจ้าหน้าที่ออกจากฐานข้อมูลระบบ`
    );

    setToastNotification({
      type: 'info',
      title: 'ลบข้อมูลพนักงานแล้ว',
      message: 'ลบรายชื่อพนักงานออกจากระบบและอัปเดต Google Sheets & Google Drive เรียบร้อยแล้ว',
    });
  };

  const handleUpdateStaffStatus = async (staffId: string, status: any) => {
    const list = staffList.map((s) => (s.id === staffId ? { ...s, status } : s));
    const targetStaff = staffList.find((s) => s.id === staffId);
    setStaffList(list);
    saveStaff(list);

    const { token, spreadsheetId } = await ensureTokenAndSheet(false);
    if (token) {
      try {
        if (spreadsheetId) {
          await syncStaffToSheet(spreadsheetId, list, token);
        }
        await saveCurrentDatabaseSnapshotToDrive(token);
      } catch (err: any) {
        console.warn('Update staff status cloud sync warning:', err?.message || err);
      }
    }

    logSystemActivityAndSyncSheets(
      'เปลี่ยนสถานะเจ้าหน้าที่',
      'เจ้าหน้าที่',
      targetStaff ? `${targetStaff.name} (${targetStaff.employeeId})` : staffId,
      `เปลี่ยนสถานะการปฏิบัติงานเป็น: ${status}`
    );
  };

  // Damage Records handlers with Google Drive & Sheets Auto-Sync
  const handleSaveDamage = async (item: VehicleDamageItem) => {
    let itemToSave = { ...item };
    const syncErrors: string[] = [];
    let driveSucceeded = false;
    let syncSucceeded = false;

    const isEditing = damageRecords.some((d) => d.id === item.id);

    // Save locally first so data is preserved if signInWithRedirect triggers
    const preSavedDamage = saveDamageRecord(itemToSave);
    setDamageRecords(preSavedDamage);

    // 1. Ensure Google Auth & Spreadsheet
    const { token, spreadsheetId, redirected } = await ensureTokenAndSheet(true);
    if (redirected) return;

    let apiActivationUrl: string | undefined;
    if (!token) {
      syncErrors.push('ยังไม่ได้ลงชื่อเข้าใช้ Google (กรุณากดเปิดเมนู Google Sheets เพื่อเชื่อมต่อบัญชี Google)');
    } else if (!spreadsheetId) {
      syncErrors.push('ยังไม่มี Google Spreadsheet รองรับ (กรุณากดเปิดเมนู Google Sheets เพื่อสร้างหรือเชื่อมต่อ)');
    } else {
      // Upload damage photos to Google Drive
      try {
        if (
          itemToSave.photoUrl.startsWith('data:image/') ||
          (itemToSave.additionalPhotos && itemToSave.additionalPhotos.some((p) => p.startsWith('data:image/')))
        ) {
          const driveRes = await uploadDamagePhotosToDrive(token, itemToSave);
          itemToSave.drivePhotoUrl = driveRes.drivePhotoUrl || itemToSave.drivePhotoUrl;
          itemToSave.driveAdditionalPhotoUrls = driveRes.driveAdditionalPhotoUrls || itemToSave.driveAdditionalPhotoUrls;
          itemToSave.driveFolderUrl = driveRes.driveFolderUrl || itemToSave.driveFolderUrl;
          driveSucceeded = Boolean(driveRes.drivePhotoUrl || (driveRes.driveAdditionalPhotoUrls && driveRes.driveAdditionalPhotoUrls.length > 0));
        } else {
          driveSucceeded = true;
        }
      } catch (driveErr: any) {
        console.warn('Google Drive damage photo upload warning:', driveErr?.message || driveErr);
        const formatted = formatGoogleApiError(driveErr?.message || 'อัปโหลดภาพไม่สำเร็จ', 'Google Drive API');
        apiActivationUrl = apiActivationUrl || formatted.activationUrl;
        syncErrors.push(`Google Drive: ${formatted.message}`);
      }
    }

    const updated = saveDamageRecord(itemToSave);
    setDamageRecords(updated);

    // Auto-sync entire damage records table to Google Sheets & Google Drive Master DB
    if (token && spreadsheetId) {
      try {
        await syncDamageToSheet(spreadsheetId, updated, token);
        await saveCurrentDatabaseSnapshotToDrive(token);
        syncSucceeded = true;
        itemToSave.googleSheetsSyncStatus = 'synced';
      } catch (sheetErr: any) {
        console.warn('Google Sheets damage sync warning:', sheetErr?.message || sheetErr);
        const formatted = formatGoogleApiError(sheetErr?.message || 'บันทึกลงตารางไม่สำเร็จ', 'Google Sheets API');
        apiActivationUrl = apiActivationUrl || formatted.activationUrl;
        syncErrors.push(`Google Sheets: ${formatted.message}`);
      }
    }

    const totalPhotos = 1 + (item.additionalPhotos?.length || 0);
    logSystemActivityAndSyncSheets(
      isEditing ? 'แก้ไขข้อมูลรอยตัวรถ' : 'บันทึกรอยรอบตัวรถ',
      'รอยรอบตัวรถ',
      `${item.vehicleCode} (${item.plateNumber})`,
      `ตำแหน่ง: ${item.positionArea} · ระดับ: ${item.severity} · รูปภาพ: ${totalPhotos} รูป · รายละเอียด: ${item.description || '-'} ${driveSucceeded ? '· อัปโหลดลง Drive แล้ว' : ''}`
    );

    if (syncErrors.length > 0) {
      setToastNotification({
        type: 'error',
        title: isEditing ? 'แก้ไขในเครื่องแล้ว แต่พบข้อผิดพลาดในการซิงค์ Cloud' : 'บันทึกในเครื่องแล้ว แต่พบข้อผิดพลาดในการซิงค์ Cloud',
        message: `${isEditing ? 'แก้ไขข้อมูลรอยตัวรถแล้ว' : 'บันทึกข้อมูลรอยตัวรถแล้ว'} แต่ ${syncErrors.join(' | ')}`,
        linkUrl: apiActivationUrl || googleSheetsConfig.spreadsheetUrl,
        linkText: apiActivationUrl ? 'เปิดหน้าเปิดใช้งาน API ใน Google Cloud' : 'ตรวจสอบการเชื่อมต่อ Google',
      });
    } else {
      setToastNotification({
        type: 'success',
        title: isEditing ? 'แก้ไขข้อมูลรอยตัวรถสำเร็จและซิงค์ครบถ้วน!' : 'บันทึกรอยตัวรถสำเร็จและซิงค์ครบถ้วน!',
        message: `${isEditing ? 'แก้ไขข้อมูลรอย' : 'บันทึกรอย'} "${item.positionArea}" ของรถ ${item.vehicleCode} (${totalPhotos} รูป) พร้อมอัปโหลดลง Google Drive และบันทึกลง Google Sheets เรียบร้อยแล้ว`,
        linkUrl: itemToSave.driveFolderUrl || itemToSave.drivePhotoUrl || googleSheetsConfig.spreadsheetUrl,
        linkText: itemToSave.driveFolderUrl || itemToSave.drivePhotoUrl
          ? 'เปิดดูรูปใน Google Drive'
          : 'เปิดดูใน Google Sheets',
      });
    }
  };

  const handleDeleteDamage = async (id: string) => {
    const target = damageRecords.find((d) => d.id === id);
    const updated = deleteDamageRecord(id);
    setDamageRecords(updated);

    const { token, spreadsheetId } = await ensureTokenAndSheet(false);
    if (token && spreadsheetId) {
      try {
        await syncDamageToSheet(spreadsheetId, updated, token);
        await saveCurrentDatabaseSnapshotToDrive(token);
      } catch (err: any) {
        console.warn('Delete damage sheet sync warning:', err?.message || err);
        const formatted = formatGoogleApiError(err?.message || 'ไม่สามารถลบข้อมูลจาก Google Sheets ได้', 'Google Sheets API');
        setToastNotification({
          type: 'error',
          title: 'ลบในเครื่องแล้ว แต่ซิงค์ Google Sheets/Drive ขัดข้อง',
          message: formatted.message,
          linkUrl: formatted.activationUrl,
          linkText: formatted.activationUrl ? 'เปิดหน้าเปิดใช้งาน API ใน Google Cloud' : undefined,
        });
        return;
      }
    }

    logSystemActivityAndSyncSheets(
      'ลบข้อมูลรอยตัวรถ',
      'รอยรอบตัวรถ',
      target ? `${target.vehicleCode} - ${target.positionArea}` : id,
      `ลบประวัติรอยตัวรถออกจากระบบและอัปเดตลง Google Sheets และ Google Drive`
    );
    setToastNotification({
      type: 'info',
      title: 'ลบข้อมูลรอยตัวรถแล้ว',
      message: 'ลบประวัติรอยตัวรถออกจากระบบและอัปเดตลง Google Sheets และ Google Drive เรียบร้อยแล้ว',
    });
  };

  const handleUpdateDamageStatus = async (id: string, resolved: boolean) => {
    const target = damageRecords.find((d) => d.id === id);
    if (!target) return;

    const updatedItem = { ...target, resolved };
    const updated = saveDamageRecord(updatedItem);
    setDamageRecords(updated);

    const { token, spreadsheetId } = await ensureTokenAndSheet(false);
    if (token && spreadsheetId) {
      try {
        await syncDamageToSheet(spreadsheetId, updated, token);
        await saveCurrentDatabaseSnapshotToDrive(token);
      } catch (err: any) {
        console.warn('Update damage status sheet sync warning:', err?.message || err);
        const formatted = formatGoogleApiError(err?.message || 'ไม่สามารถอัปเดต Google Sheets ได้', 'Google Sheets API');
        setToastNotification({
          type: 'error',
          title: 'อัปเดตสถานะในเครื่องแล้ว แต่ซิงค์ Google Sheets/Drive ขัดข้อง',
          message: formatted.message,
          linkUrl: formatted.activationUrl,
          linkText: formatted.activationUrl ? 'เปิดหน้าเปิดใช้งาน API ใน Google Cloud' : undefined,
        });
        return;
      }
    }

    logSystemActivityAndSyncSheets(
      'อัปเดตสถานะรอยตัวรถ',
      'รอยรอบตัวรถ',
      `${target.vehicleCode} - ${target.positionArea}`,
      `เปลี่ยนสถานะเป็น: ${resolved ? 'ซ่อมสี/แก้ไขเรียบร้อยแล้ว' : 'รอการซ่อมสี/แก้ไข'}`
    );

    setToastNotification({
      type: 'success',
      title: 'อัปเดตสถานะรอยตัวรถแล้ว',
      message: `เปลี่ยนสถานะเป็น "${resolved ? 'ซ่อมแล้ว' : 'รอซ่อม'}" และอัปเดตลง Google Sheets และ Google Drive เรียบร้อยแล้ว`,
    });
  };

  // Fuel Log handlers with Google Drive & Sheets Auto-Sync
  const handleSaveFuelLog = async (log: FuelLogRecord) => {
    let logToSave = { ...log };
    const syncErrors: string[] = [];
    let driveSucceeded = false;
    let syncSucceeded = false;
    let apiActivationUrl: string | undefined;

    // Save locally first so data is preserved if signInWithRedirect triggers
    const preSavedFuel = saveFuelLog(logToSave);
    setFuelLogs(preSavedFuel);

    // 1. Ensure Google Auth & Spreadsheet
    const { token, spreadsheetId, redirected } = await ensureTokenAndSheet(true);
    if (redirected) return;

    if (!token) {
      syncErrors.push('ยังไม่ได้ลงชื่อเข้าใช้ Google (กรุณากดเปิดเมนู Google Sheets เพื่อเชื่อมต่อบัญชี Google)');
    } else if (!spreadsheetId) {
      syncErrors.push('ยังไม่มี Google Spreadsheet รองรับ (กรุณากดเปิดเมนู Google Sheets เพื่อสร้างหรือเชื่อมต่อ)');
    } else {
      // 1. Upload receipt / slip photo to Google Drive
      if (logToSave.receiptPhotoUrl && logToSave.receiptPhotoUrl.startsWith('data:')) {
        try {
          const driveRes = await uploadFuelReceiptToDrive(token, logToSave);
          logToSave.receiptDriveUrl = driveRes.receiptDriveUrl;
          logToSave.driveFolderUrl = driveRes.driveFolderUrl;
          driveSucceeded = Boolean(driveRes.receiptDriveUrl);
        } catch (driveErr: any) {
          console.warn('Google Drive fuel receipt upload warning:', driveErr?.message || driveErr);
          const formatted = formatGoogleApiError(driveErr?.message || 'อัปโหลดสลิปไม่สำเร็จ', 'Google Drive API');
          apiActivationUrl = apiActivationUrl || formatted.activationUrl;
          syncErrors.push(`Google Drive: ${formatted.message}`);
        }
      }

      // 2. Append to Google Sheets Tab 'ประวัติการเติมน้ำมัน_BLS'
      try {
        await appendFuelLogToSheet(spreadsheetId, logToSave, token);
        syncSucceeded = true;
        logToSave.googleSheetsSyncStatus = 'synced';
      } catch (sheetErr: any) {
        console.warn('Google Sheets fuel append warning:', sheetErr?.message || sheetErr);
        const formatted = formatGoogleApiError(sheetErr?.message || 'บันทึกแถวไม่สำเร็จ', 'Google Sheets API');
        apiActivationUrl = apiActivationUrl || formatted.activationUrl;
        syncErrors.push(`Google Sheets: ${formatted.message}`);
      }
    }

    const updated = saveFuelLog(logToSave);
    setFuelLogs(updated);

    // Update vehicle's currentOdometer if fuel log odometer is higher
    const vehIdx = vehicles.findIndex((v) => v.id === log.vehicleId);
    if (vehIdx >= 0 && log.odometer > (vehicles[vehIdx].currentOdometer || 0)) {
      const updatedVehicles = [...vehicles];
      updatedVehicles[vehIdx] = {
        ...updatedVehicles[vehIdx],
        currentOdometer: log.odometer,
      };
      setVehicles(updatedVehicles);
      saveVehicles(updatedVehicles);

      if (token && spreadsheetId) {
        syncVehiclesToSheet(spreadsheetId, updatedVehicles, token).catch((err) => {
          console.warn('Vehicle fleet sync warning:', err);
        });
      }
    }

    // Auto-sync entire fuel logs list to Google Sheets & Drive Master DB
    if (token && spreadsheetId) {
      syncFuelLogsToSheet(spreadsheetId, updated, token).catch((err) => {
        console.warn('Fuel logs mirror sync warning:', err);
      });
      saveCurrentDatabaseSnapshotToDrive(token);
    }

    logSystemActivityAndSyncSheets(
      'บันทึกเติมน้ำมัน',
      'ประวัติเติมน้ำมัน',
      `${log.vehicleCode} (${log.plateNumber})`,
      `ไมล์: ${log.odometer.toLocaleString()} กม. · ${log.liters} ลิตร · วิ่งได้: ${log.distanceDriven ? `${log.distanceDriven.toLocaleString()} กม.` : '-'} ${driveSucceeded ? '· แนบสลิปใน Drive แล้ว' : ''}`
    );

    if (syncErrors.length > 0) {
      setToastNotification({
        type: 'error',
        title: 'บันทึกในเครื่องแล้ว แต่พบข้อผิดพลาดในการซิงค์ Cloud',
        message: `บันทึกประวัติเติมน้ำมันแล้ว แต่ ${syncErrors.join(' | ')}`,
        linkUrl: apiActivationUrl || googleSheetsConfig.spreadsheetUrl,
        linkText: apiActivationUrl ? 'เปิดหน้าเปิดใช้งาน API ใน Google Cloud' : 'ตรวจสอบการเชื่อมต่อ Google',
      });
    } else {
      setToastNotification({
        type: 'success',
        title: 'บันทึกประวัติเติมน้ำมันสำเร็จและซิงค์ครบถ้วน!',
        message: `บันทึกการเติมน้ำมันรถ ${log.vehicleCode} (${log.liters} ลิตร) พร้อมอัปเดต Google Sheets & Google Drive เรียบร้อยแล้ว`,
        linkUrl: logToSave.receiptDriveUrl || logToSave.driveFolderUrl || googleSheetsConfig.spreadsheetUrl,
        linkText: logToSave.receiptDriveUrl
          ? 'เปิดดูสลิปใน Google Drive'
          : 'เปิดดูใน Google Sheets',
      });
    }
  };

  const handleDeleteFuelLog = async (id: string) => {
    const target = fuelLogs.find((f) => f.id === id);
    const updated = deleteFuelLog(id);
    setFuelLogs(updated);

    const { token, spreadsheetId } = await ensureTokenAndSheet(false);
    if (token && spreadsheetId) {
      try {
        await syncFuelLogsToSheet(spreadsheetId, updated, token);
        await saveCurrentDatabaseSnapshotToDrive(token);
      } catch (err: any) {
        console.warn('Delete fuel log sheet sync warning:', err?.message || err);
        const formatted = formatGoogleApiError(err?.message || 'ไม่สามารถลบข้อมูลจาก Google Sheets ได้', 'Google Sheets API');
        setToastNotification({
          type: 'error',
          title: 'ลบในเครื่องแล้ว แต่ซิงค์ Google Sheets/Drive ขัดข้อง',
          message: formatted.message,
          linkUrl: formatted.activationUrl,
          linkText: formatted.activationUrl ? 'เปิดหน้าเปิดใช้งาน API ใน Google Cloud' : undefined,
        });
        return;
      }
    }

    logSystemActivityAndSyncSheets(
      'ลบประวัติเติมน้ำมัน',
      'ประวัติเติมน้ำมัน',
      target ? `${target.vehicleCode} (${target.fuelDate})` : id,
      `ลบข้อมูลการเติมน้ำมันออกจากระบบและอัปเดตลง Google Sheets`
    );
    setToastNotification({
      type: 'info',
      title: 'ลบข้อมูลเติมน้ำมันแล้ว',
      message: 'ลบรายการบันทึกการเติมน้ำมันและอัปเดต Google Sheets เรียบร้อยแล้ว',
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    if (!inspections.length) {
      setToastNotification({
        type: 'info',
        title: 'ไม่มีข้อมูล',
        message: 'ยังไม่มีข้อมูลการตรวจสภาพรถสำหรับส่งออก CSV',
      });
      return;
    }

    const headers = [
      'วัน-เวลาที่ตรวจ',
      'รอบเวร',
      'รหัสรถ',
      'เลขทะเบียน',
      'ผู้ตรวจเช็ค',
      'สถานะรวม',
      'เลขไมล์ (กม.)',
      'ไฟตัวรถ',
      'ไฟฉุกเฉิน',
      'กระจก',
      'ของเหลว',
      'แบตเตอรี่',
      'เสียง',
      'ยาง',
      'ปัญหาที่พบ/หมายเหตุ',
      'เอกสารแนบ',
      'รูป 4 ด้าน',
      'รหัสบันทึก',
    ];

    const rows = inspections.map((rec) =>
      formatRecordForSheet(rec).map((val) => `"${String(val).replace(/"/g, '""')}"`)
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BLS_Vehicle_Inspections_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isLoggedIn || !currentUser) {
    return (
      <>
        <LoginView
          onLogin={handleLogin}
          staffList={staffList}
          onGoogleLogin={handleGoogleLogin}
          isGoogleLoading={isGoogleLoading}
          googleUser={googleUser}
        />
        {toastNotification && (
          <div className="fixed bottom-5 right-5 z-50 max-w-md animate-in fade-in slide-in-from-bottom-3">
            <div
              className={`rounded-2xl border p-4 shadow-xl backdrop-blur-md ${
                toastNotification.type === 'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100'
                  : toastNotification.type === 'error'
                  ? 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/90 dark:text-red-100'
                  : 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/90 dark:text-sky-100'
              }`}
            >
              <div className="flex items-start gap-3">
                {toastNotification.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h5 className="text-xs font-bold">{toastNotification.title}</h5>
                  <p className="mt-0.5 text-xs opacity-90">{toastNotification.message}</p>
                </div>
                <button
                  onClick={() => setToastNotification(null)}
                  className="text-xs opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans">
      {/* Navbar with responsive desktop links, mobile bottom tab bar, and slide-over drawer */}
      <Navbar
        currentUser={currentUser}
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenGoogleSheets={() => {
          if (currentUser?.role === 'admin') {
            setGoogleSheetsModalOpen(true);
          }
        }}
        onSwitchRole={handleSwitchRole}
        onLogout={handleLogout}
        sheetsConnected={Boolean(googleSheetsConfig.spreadsheetId)}
        spreadsheetUrl={googleSheetsConfig.spreadsheetUrl}
        activeDamageCount={damageRecords.filter((d) => !d.resolved).length}
        onTriggerSyncBack={handleTriggerSyncBack}
        isSyncing={isSyncingGSheets}
      />

      {/* Main Body with bottom padding for mobile safe area & bottom tab bar */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 sm:px-6 py-5 sm:py-6 pb-28 lg:pb-12">
        {currentView === 'form' && (
          <InspectionForm
            currentUser={currentUser}
            vehicles={vehicles}
            staffList={staffList}
            onSubmitInspection={handleSubmitInspection}
            onCancel={() => setCurrentView('dashboard')}
            isSubmitting={isSubmittingInspection}
          />
        )}

        {currentView === 'dashboard' && (
          <AdminDashboard
            currentUser={currentUser}
            vehicles={vehicles}
            inspections={inspections}
            staffList={staffList}
            onOpenNewInspection={() => setCurrentView('form')}
            onViewRecordDetail={(rec) => setSelectedRecordDetail(rec)}
            onOpenVehicleModal={(veh) => {
              setVehicleToEdit(veh || null);
              setVehicleModalOpen(true);
            }}
            onDeleteVehicle={handleDeleteVehicle}
            onUpdateVehicleStatus={handleUpdateVehicleStatus}
            onOpenStaffModal={(staff) => {
              setStaffToEdit(staff || null);
              setStaffModalOpen(true);
            }}
            onDeleteStaff={handleDeleteStaff}
            onUpdateStaffStatus={handleUpdateStaffStatus}
            onDeleteInspection={handleDeleteInspection}
            onClearAllInspections={handleClearAllInspections}
            onResetDemoData={handleResetDemoData}
            onOpenGoogleSheetsModal={() => setGoogleSheetsModalOpen(true)}
            spreadsheetUrl={googleSheetsConfig.spreadsheetUrl}
            onExportCsv={handleExportCsv}
            onPrintInspection={(rec) => setRecordToPrint(rec)}
            onClearAllSystemData={handleClearAllSystemData}
          />
        )}

        {currentView === 'damage' && (
          <VehicleDamageView
            currentUser={currentUser}
            vehicles={vehicles}
            damageRecords={damageRecords}
            onSaveDamage={handleSaveDamage}
            onDeleteDamage={handleDeleteDamage}
            onUpdateDamageStatus={handleUpdateDamageStatus}
          />
        )}

        {currentView === 'fuel' && (
          <FuelLogView
            currentUser={currentUser}
            vehicles={vehicles}
            fuelLogs={fuelLogs}
            onSaveFuelLog={handleSaveFuelLog}
            onDeleteFuelLog={handleDeleteFuelLog}
          />
        )}
      </main>

      {/* Modals */}
      {recordToPrint && (
        <PrintReportView
          record={recordToPrint}
          onClose={() => setRecordToPrint(null)}
        />
      )}

      <InspectionDetailModal
        record={selectedRecordDetail}
        onClose={() => setSelectedRecordDetail(null)}
        onSyncGSheets={handleSyncSingleRecord}
        isSyncing={isSyncingGSheets}
        isAdmin={currentUser?.role === 'admin'}
        onDeleteRecord={handleDeleteInspection}
      />

      <VehicleModal
        isOpen={vehicleModalOpen}
        onClose={() => {
          setVehicleModalOpen(false);
          setVehicleToEdit(null);
        }}
        onSave={handleSaveVehicle}
        vehicleToEdit={vehicleToEdit}
      />

      <StaffModal
        isOpen={staffModalOpen}
        onClose={() => {
          setStaffModalOpen(false);
          setStaffToEdit(null);
        }}
        onSave={handleSaveStaff}
        staffToEdit={staffToEdit}
      />

      <GoogleSheetsModal
        isOpen={googleSheetsModalOpen}
        onClose={() => setGoogleSheetsModalOpen(false)}
        config={googleSheetsConfig}
        onSaveConfig={(cfg) => {
          setGoogleSheetsConfig(cfg);
          saveGoogleSheetsConfig(cfg);
        }}
        inspections={inspections}
        onUpdateInspection={(updated) => {
          updateInspectionRecord(updated);
          setInspections(getStoredInspections());
        }}
        googleUser={googleUser}
        onGoogleLoginSuccess={(u) => setGoogleUser(u)}
        vehicles={vehicles}
        staffList={staffList}
        currentUser={currentUser}
        damageRecords={damageRecords}
        fuelLogs={fuelLogs}
        onSyncBackData={handleSyncBackData}
      />

      <AdminAuthModal
        isOpen={adminAuthModalOpen}
        onClose={() => setAdminAuthModalOpen(false)}
        onSuccess={() => {
          setIsAdminVerified(true);
          setAdminAuthModalOpen(false);
          const updated: UserProfile = {
            ...(currentUser || DEMO_USERS.admin),
            role: 'admin',
          };
          setCurrentUserState(updated);
          setCurrentUser(updated);
          setCurrentView('dashboard');
          setToastNotification({
            type: 'success',
            title: 'เข้าสู่ระบบผู้ดูแลเรียบร้อย',
            message: 'ยืนยันความปลอดภัยสำเร็จ ยินดีต้อนรับสู่แดชบอร์ดผู้ดูแลระบบ',
          });
        }}
        onGoogleLogin={handleGoogleLogin}
        isGoogleLoading={isGoogleLoading}
        googleUser={googleUser}
        targetUserName={currentUser?.name}
      />

      {/* Toast Notification */}
      {toastNotification && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-in fade-in slide-in-from-bottom-3">
          <div
            className={`rounded-2xl border p-4 shadow-xl backdrop-blur-md ${
              toastNotification.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100'
                : toastNotification.type === 'error'
                ? 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/90 dark:text-red-100'
                : 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/90 dark:text-sky-100'
            }`}
          >
            <div className="flex items-start gap-3">
              {toastNotification.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h5 className="text-xs font-bold">{toastNotification.title}</h5>
                <p className="mt-0.5 text-xs opacity-90">{toastNotification.message}</p>
                {toastNotification.linkUrl && (
                  <a
                    href={toastNotification.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 font-bold text-xs underline"
                  >
                    <span>{toastNotification.linkText || 'เปิดดูลิงก์'}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <button
                onClick={() => setToastNotification(null)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
