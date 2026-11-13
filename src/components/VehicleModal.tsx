import React, { useState, useEffect } from 'react';
import { AmbulanceVehicle, VehicleStatus } from '../types';
import { X, Truck, Check, Camera, ExternalLink, Loader2 } from 'lucide-react';
import { generateSvgCarPlaceholder, toDisplayableDriveImageUrl } from '../services/storage';
import { compressImage } from '../utils/imageCompressor';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vehicle: AmbulanceVehicle) => Promise<void> | void;
  vehicleToEdit?: AmbulanceVehicle | null;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  vehicleToEdit,
}) => {
  const [code, setCode] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [brandModel, setBrandModel] = useState('');
  const [year, setYear] = useState('2024');
  const [status, setStatus] = useState<VehicleStatus>('available');
  const [currentOdometer, setCurrentOdometer] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setIsSaving(false);
    if (vehicleToEdit) {
      setCode(vehicleToEdit.code);
      setPlateNumber(vehicleToEdit.plateNumber);
      setBrandModel(vehicleToEdit.brandModel);
      setYear(vehicleToEdit.year);
      setStatus(vehicleToEdit.status);
      setCurrentOdometer(vehicleToEdit.currentOdometer);
      setNotes(vehicleToEdit.notes || '');
      const existingRealImg =
        vehicleToEdit.imageUrl && !vehicleToEdit.imageUrl.startsWith('data:image/svg+xml')
          ? vehicleToEdit.imageUrl
          : vehicleToEdit.drivePhotoUrl || '';
      setImageUrl(existingRealImg);
    } else {
      setCode('');
      setPlateNumber('');
      setBrandModel('');
      setYear('2024');
      setStatus('available');
      setCurrentOdometer(0);
      setNotes('');
      setImageUrl('');
    }
  }, [vehicleToEdit, isOpen]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingPhoto(true);
    setError(null);
    try {
      const compressed = await compressImage(file, 1280, 1280, 0.78);
      if (compressed) {
        setImageUrl(compressed);
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการประมวลผลรูปภาพรถ: ' + (err.message || ''));
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code.trim() || !plateNumber.trim()) {
      setError('กรุณากรอกรหัสรถและเลขทะเบียนให้ครบถ้วน');
      return;
    }

    const color =
      status === 'available' ? '#2563eb' : status === 'issue_found' ? '#eab308' : '#ef4444';

    const hasNewImage = imageUrl.trim().length > 0;
    const isSameDriveImage = hasNewImage && vehicleToEdit && imageUrl === (vehicleToEdit.imageUrl || vehicleToEdit.drivePhotoUrl);

    const vehicle: AmbulanceVehicle = {
      id: vehicleToEdit ? vehicleToEdit.id : `veh-${Date.now()}`,
      code: code.trim(),
      plateNumber: plateNumber.trim(),
      brandModel: brandModel.trim() || 'Toyota Commuter BLS Ambulance',
      year: year.trim() || '2024',
      status,
      currentOdometer: Number(currentOdometer) || 0,
      imageUrl: imageUrl.trim() || generateSvgCarPlaceholder(code.trim(), brandModel.trim() || 'รถกู้ชีพ BLS', color),
      drivePhotoUrl: isSameDriveImage ? vehicleToEdit?.drivePhotoUrl : hasNewImage ? undefined : undefined,
      driveFolderUrl: vehicleToEdit?.driveFolderUrl,
      lastInspectionDate: vehicleToEdit?.lastInspectionDate || '-',
      lastInspector: vehicleToEdit?.lastInspector || '-',
      notes: notes.trim(),
    };

    setIsSaving(true);
    try {
      await onSave(vehicle);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลรถ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-sky-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {vehicleToEdit ? 'แก้ไขข้อมูลรถกู้ชีพ BLS' : 'เพิ่มรถกู้ชีพ BLS คันใหม่'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Vehicle Photo Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                รูปถ่ายรถกู้ชีพส่วนกลาง (Vehicle Photo):
              </label>
              {vehicleToEdit?.drivePhotoUrl && (
                <a
                  href={vehicleToEdit.drivePhotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:underline dark:text-sky-400"
                >
                  <ExternalLink className="h-3 w-3" /> ดูรูปใน Google Drive
                </a>
              )}
            </div>
            {imageUrl ? (
              <div className="relative group aspect-[16/9] w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm dark:border-slate-800">
                <img
                  src={toDisplayableDriveImageUrl(imageUrl, vehicleToEdit?.drivePhotoUrl) || imageUrl}
                  alt={code || 'รูปรถกู้ชีพ'}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform group-hover:scale-102"
                />
                <div className="absolute top-2.5 left-2.5">
                  <span className="rounded-md bg-slate-950/80 px-2 py-0.5 font-mono text-xs font-bold text-sky-400 backdrop-blur-sm">
                    {code || 'BLS'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2.5 right-2.5 rounded-full bg-slate-900/85 p-1.5 text-white hover:bg-red-600 transition-colors shadow-md"
                  title="ลบหรือเปลี่ยนรูปรถ"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-[16/9] w-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 hover:border-sky-500 hover:bg-sky-50/50 cursor-pointer transition-all dark:border-slate-700 dark:bg-slate-800/60">
                <Camera className="h-8 w-8 text-sky-500 mb-2" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isProcessingPhoto ? 'กำลังประมวลผลรูปภาพ...' : 'ถ่ายภาพ / อัปโหลดรูปรถกู้ชีพ'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 text-center">
                  ระบบจะบีบอัดภาพ อัปโหลดลง Google Drive และบันทึกลง Google Sheets อัตโนมัติเมื่อกดบันทึก
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                รหัสรถ (Vehicle Code) *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="เช่น BLS-05"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                เลขทะเบียน (Plate Number) *
              </label>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="เช่น 1กข 9988 กรุงเทพฯ"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                ยี่ห้อและรุ่นรถ
              </label>
              <input
                type="text"
                value={brandModel}
                onChange={(e) => setBrandModel(e.target.value)}
                placeholder="เช่น Toyota Commuter 3.0 High-Roof"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                ปีที่จดทะเบียน
              </label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                สถานะความพร้อม
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as VehicleStatus)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="available">พร้อมใช้งาน (ปกติ)</option>
                <option value="issue_found">พบปัญหา (เฝ้าระวัง)</option>
                <option value="maintenance">อยู่ระหว่างซ่อม (งดใช้)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                เลขไมล์ปัจจุบัน (กม.)
              </label>
              <input
                type="number"
                value={currentOdometer}
                onChange={(e) => setCurrentOdometer(Number(e.target.value))}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs tabular-nums text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              หมายเหตุ / ข้อมูลจำเพาะ
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ระบุรายละเอียดอุปกรณ์ประจำรถ..."
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving || isProcessingPhoto}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-500 disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>กำลังอัปโหลดลง Drive & Sheets...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>บันทึกและอัปโหลด Cloud</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
