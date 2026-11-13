import {
  GoogleDriveLinks,
  InspectionRecord,
  VehicleDamageItem,
  FuelLogRecord,
  MasterDatabasePayload,
  AmbulanceVehicle,
} from '../types';

// Convert base64 data URL to Blob
export function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const isBase64 = parts[0].includes(';base64');
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  if (isBase64) {
    const byteString = atob(parts[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    return {
      blob: new Blob([uint8Array], { type: mimeType }),
      mimeType,
    };
  } else {
    const decoded = decodeURIComponent(parts[1]);
    return {
      blob: new Blob([decoded], { type: mimeType }),
      mimeType,
    };
  }
}

export function formatGoogleApiError(
  rawMessage: string,
  serviceLabel = 'Google API'
): { message: string; activationUrl?: string; isApiDisabled: boolean } {
  const urlMatch = rawMessage.match(/https:\/\/console\.(?:developers|cloud)\.google\.com\/apis\/api\/[^\s)]+/);
  const projectMatch = rawMessage.match(/project\s+(\d+)/i);
  const isDisabled =
    rawMessage.includes('has not been used in project') ||
    rawMessage.includes('it is disabled') ||
    rawMessage.includes('SERVICE_DISABLED');

  if (isDisabled) {
    const projectInfo = projectMatch ? ` (โปรเจกต์ ${projectMatch[1]})` : '';
    return {
      isApiDisabled: true,
      activationUrl: urlMatch?.[0],
      message: `ยังไม่ได้เปิดใช้งาน ${serviceLabel}${projectInfo} ใน Google Cloud Console — กรุณาเปิดลิงก์เพื่อกด Enable API แล้วรอ 1-2 นาทีแล้วลองใหม่`,
    };
  }

  return {
    isApiDisabled: false,
    activationUrl: urlMatch?.[0],
    message: rawMessage,
  };
}

// Find or create inspection media folder in Google Drive
export async function getOrCreateInspectionFolder(
  accessToken: string,
  folderName = 'BLS_Ambulance_Inspections_Media'
): Promise<{ folderId: string; folderUrl: string }> {
  // Search for existing folder
  const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return {
        folderId: data.files[0].id,
        folderUrl: data.files[0].webViewLink || `https://drive.google.com/drive/folders/${data.files[0].id}`,
      };
    }
  } else if (searchRes.status === 401 || searchRes.status === 403) {
    const err = await searchRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `ไม่สามารถเข้าถึง Google Drive ได้ (${searchRes.status})`);
  }

  // Create new folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'ไม่สามารถสร้างโฟลเดอร์ใน Google Drive ได้');
  }

  const folderData = await createRes.json();
  return {
    folderId: folderData.id,
    folderUrl: folderData.webViewLink || `https://drive.google.com/drive/folders/${folderData.id}`,
  };
}

// Upload a single file to Google Drive using multipart upload
export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  dataUrl: string,
  folderId?: string
): Promise<{ fileId: string; webViewLink: string }> {
  const { blob, mimeType } = dataUrlToBlob(dataUrl);

  const metadata: Record<string, any> = {
    name: fileName,
    mimeType,
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataBlob = new Blob([
    delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n`,
  ]);

  const body = new Blob([metadataBlob, blob, new Blob([closeDelimiter])]);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `เกิดข้อผิดพลาดในการอัปโหลดไฟล์ ${fileName} ไปยัง Google Drive`);
  }

  const result = await uploadRes.json();
  return {
    fileId: result.id,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
  };
}

// Upload all media (4-side photos and attached document) for an inspection record
export async function uploadInspectionMediaToDrive(
  accessToken: string,
  record: InspectionRecord
): Promise<GoogleDriveLinks> {
  const { folderId, folderUrl } = await getOrCreateInspectionFolder(accessToken);
  const links: GoogleDriveLinks = {
    folderId,
    folderUrl,
  };

  const safeCode = record.vehicleCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeId = record.id.slice(-6);

  // Upload 4 side photos
  const photoKeys: Array<keyof typeof record.photos> = ['front', 'rear', 'left', 'right'];
  for (const key of photoKeys) {
    const photoDataUrl = record.photos[key];
    if (photoDataUrl && photoDataUrl.startsWith('data:')) {
      const fileName = `${safeCode}_${key.toUpperCase()}_${safeId}.jpg`;
      try {
        const uploaded = await uploadFileToDrive(accessToken, fileName, photoDataUrl, folderId);
        if (key === 'front') links.frontPhotoUrl = uploaded.webViewLink;
        if (key === 'rear') links.rearPhotoUrl = uploaded.webViewLink;
        if (key === 'left') links.leftPhotoUrl = uploaded.webViewLink;
        if (key === 'right') links.rightPhotoUrl = uploaded.webViewLink;
      } catch (e) {
        console.warn(`Failed to upload ${key} photo to Google Drive`, e);
      }
    }
  }

  // Upload document attachment if present
  if (record.documentAttachment && record.documentAttachment.dataUrl.startsWith('data:')) {
    const docName = `${safeCode}_DOC_${record.documentAttachment.name}`;
    try {
      const uploadedDoc = await uploadFileToDrive(
        accessToken,
        docName,
        record.documentAttachment.dataUrl,
        folderId
      );
      links.documentUrl = uploadedDoc.webViewLink;
    } catch (e) {
      console.warn('Failed to upload document attachment to Google Drive', e);
    }
  }

  return links;
}

// Upload damage photos (main and additional) to Google Drive
export async function uploadDamagePhotosToDrive(
  accessToken: string,
  item: VehicleDamageItem
): Promise<{ drivePhotoUrl?: string; driveAdditionalPhotoUrls: string[]; driveFolderUrl: string }> {
  const { folderId, folderUrl } = await getOrCreateInspectionFolder(accessToken, 'BLS_Vehicle_Damage_Media');
  const safeCode = (item.vehicleCode || 'BLS').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safePos = (item.positionArea || 'POS').replace(/[\\/:*?"<>|]/g, '_');
  const safeId = item.id.slice(-6);

  let drivePhotoUrl: string | undefined;
  const driveAdditionalPhotoUrls: string[] = [];
  let uploadError: any = null;

  // 1. Upload main photo
  if (item.photoUrl && item.photoUrl.startsWith('data:')) {
    const fileName = `${safeCode}_DAMAGE_${safePos}_${safeId}_MAIN.jpg`;
    try {
      const uploaded = await uploadFileToDrive(accessToken, fileName, item.photoUrl, folderId);
      drivePhotoUrl = uploaded.webViewLink;
    } catch (e: any) {
      console.warn('Failed to upload main damage photo to Google Drive:', e);
      uploadError = e;
    }
  }

  // 2. Upload additional photos
  if (item.additionalPhotos && item.additionalPhotos.length > 0) {
    for (let i = 0; i < item.additionalPhotos.length; i++) {
      const pUrl = item.additionalPhotos[i];
      if (pUrl && pUrl.startsWith('data:')) {
        const fileName = `${safeCode}_DAMAGE_${safePos}_${safeId}_SUB${i + 1}.jpg`;
        try {
          const uploaded = await uploadFileToDrive(accessToken, fileName, pUrl, folderId);
          driveAdditionalPhotoUrls.push(uploaded.webViewLink);
        } catch (e: any) {
          console.warn(`Failed to upload sub-damage photo ${i + 1} to Google Drive:`, e);
          if (!uploadError) uploadError = e;
        }
      }
    }
  }

  if (!drivePhotoUrl && uploadError) {
    throw new Error(`ไม่สามารถอัปโหลดภาพรอยตัวรถไปยัง Google Drive ได้: ${uploadError.message || uploadError}`);
  }

  return {
    drivePhotoUrl,
    driveAdditionalPhotoUrls,
    driveFolderUrl: folderUrl,
  };
}

// Upload fuel log receipt / slip to Google Drive
export async function uploadFuelReceiptToDrive(
  accessToken: string,
  log: FuelLogRecord
): Promise<{ receiptDriveUrl?: string; driveFolderUrl: string }> {
  const { folderId, folderUrl } = await getOrCreateInspectionFolder(accessToken, 'BLS_Fuel_Receipts_Media');
  const safeCode = (log.vehicleCode || 'BLS').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeId = log.id.slice(-6);

  let receiptDriveUrl: string | undefined;
  if (log.receiptPhotoUrl && log.receiptPhotoUrl.startsWith('data:')) {
    const fileName = `${safeCode}_FUEL_RECEIPT_${safeId}.jpg`;
    try {
      const uploaded = await uploadFileToDrive(accessToken, fileName, log.receiptPhotoUrl, folderId);
      receiptDriveUrl = uploaded.webViewLink;
    } catch (e: any) {
      console.warn('Failed to upload fuel slip to Google Drive:', e);
      throw new Error(`ไม่สามารถอัปโหลดสลิปค่าน้ำมันไปยัง Google Drive ได้: ${e.message || e}`);
    }
  }

  return {
    receiptDriveUrl,
    driveFolderUrl: folderUrl,
  };
}

// Upload Fleet Vehicle Photo to Google Drive
export async function uploadVehiclePhotoToDrive(
  accessToken: string,
  vehicle: AmbulanceVehicle
): Promise<{ drivePhotoUrl?: string; driveFolderUrl: string }> {
  const { folderId, folderUrl } = await getOrCreateInspectionFolder(accessToken, 'BLS_Fleet_Vehicles_Media');
  const safeCode = (vehicle.code || 'BLS').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeId = vehicle.id.slice(-6);

  let drivePhotoUrl: string | undefined;
  if (
    vehicle.imageUrl &&
    vehicle.imageUrl.startsWith('data:image/') &&
    !vehicle.imageUrl.startsWith('data:image/svg+xml')
  ) {
    const fileName = `${safeCode}_VEHICLE_${safeId}.jpg`;
    try {
      const uploaded = await uploadFileToDrive(accessToken, fileName, vehicle.imageUrl, folderId);
      drivePhotoUrl = uploaded.webViewLink;
    } catch (e: any) {
      console.warn('Failed to upload vehicle photo to Google Drive:', e);
      throw new Error(`ไม่สามารถอัปโหลดรูปรถไปยัง Google Drive ได้: ${e.message || e}`);
    }
  }

  return {
    drivePhotoUrl,
    driveFolderUrl: folderUrl,
  };
}

/**
 * Searches Google Drive for an existing BLS inspection spreadsheet created by the app.
 * Enables auto-sync when opening on any new machine or device.
 */
export async function findExistingInspectionSpreadsheet(
  accessToken: string,
  spreadsheetTitle = 'ระบบตรวจสภาพรถกู้ชีพ BLS - บันทึกส่วนกลาง'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string } | null> {
  try {
    const query = `name = '${spreadsheetTitle}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&fields=files(id,name,webViewLink)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return {
          spreadsheetId: data.files[0].id,
          spreadsheetUrl: data.files[0].webViewLink || `https://docs.google.com/spreadsheets/d/${data.files[0].id}/edit`,
        };
      }
    }
  } catch (err) {
    console.warn('Error searching for existing spreadsheet in Drive:', err);
  }
  return null;
}

export const MASTER_DB_FILENAME = 'BLS_SYSTEM_MASTER_DATABASE.json';

/**
 * Saves or updates the centralized master database snapshot on Google Drive.
 * Keeps all records (vehicles, staff, inspections, damage, fuel) safely preserved on Google Drive.
 */
export async function saveMasterDatabaseToDrive(
  accessToken: string,
  payload: MasterDatabasePayload
): Promise<{ fileId: string; modifiedTime: string }> {
  const query = `name = '${MASTER_DB_FILENAME}' and trashed = false`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let existingFileId: string | null = null;
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      existingFileId = data.files[0].id;
    }
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: MASTER_DB_FILENAME,
    mimeType: 'application/json',
    description: 'ฐานข้อมูลกลางระบบตรวจสภาพรถกู้ชีพ BLS สำรองบน Google Drive',
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    jsonString +
    closeDelimiter;

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime`;

  const method = existingFileId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'ไม่สามารถบันทึกฐานข้อมูลลง Google Drive ได้');
  }

  const result = await res.json();
  return {
    fileId: result.id,
    modifiedTime: result.modifiedTime || new Date().toISOString(),
  };
}

/**
 * Loads the master database snapshot directly from Google Drive.
 * Loads FIRST before Google Sheets to ensure data fidelity across all devices.
 */
export async function loadMasterDatabaseFromDrive(
  accessToken: string
): Promise<MasterDatabasePayload | null> {
  try {
    const query = `name = '${MASTER_DB_FILENAME}' and trashed = false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    if (!searchData.files || searchData.files.length === 0) return null;

    const fileId = searchData.files[0].id;
    const downloadRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!downloadRes.ok) return null;
    const rawData = await downloadRes.json();

    if (rawData && typeof rawData === 'object') {
      return {
        inspections: Array.isArray(rawData.inspections) ? rawData.inspections : [],
        vehicles: Array.isArray(rawData.vehicles) ? rawData.vehicles : [],
        staffList: Array.isArray(rawData.staffList) ? rawData.staffList : [],
        damageRecords: Array.isArray(rawData.damageRecords) ? rawData.damageRecords : [],
        fuelLogs: Array.isArray(rawData.fuelLogs) ? rawData.fuelLogs : [],
        spreadsheetId: rawData.spreadsheetId,
        spreadsheetUrl: rawData.spreadsheetUrl,
        lastSyncedAt: rawData.lastSyncedAt || new Date().toLocaleString('th-TH'),
        version: rawData.version || 1,
      };
    }
  } catch (err) {
    console.warn('Error loading master database from Google Drive:', err);
  }
  return null;
}

