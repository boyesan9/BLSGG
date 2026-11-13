import React, { useState } from 'react';
import { AmbulanceVehicle, DamageSeverity, UserProfile, VehicleDamageItem } from '../types';
import { compressImage } from '../utils/imageCompressor';
import { generateSvgDamagePlaceholder } from '../services/storage';
import {
  Car,
  Plus,
  Search,
  Camera,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Calendar,
  Gauge,
  User,
  X,
  Eye,
  Tag,
  Filter,
  ExternalLink,
  Pencil,
} from 'lucide-react';

interface VehicleDamageViewProps {
  currentUser: UserProfile;
  vehicles: AmbulanceVehicle[];
  damageRecords: VehicleDamageItem[];
  onSaveDamage: (item: VehicleDamageItem) => void;
  onDeleteDamage: (id: string) => void;
  onUpdateDamageStatus?: (id: string, resolved: boolean) => void;
}

const POSITION_PRESETS = [
  'กันชนหน้า',
  'กันชนหน้าขวา',
  'กันชนหน้าซ้าย',
  'ฝากระโปรงหน้า',
  'กระจังหน้า / โลโก้',
  'ประตูด้านหน้าขวา',
  'ประตูด้านหน้าซ้าย',
  'ประตูด้านหลังขวา',
  'ประตูด้านหลังซ้าย',
  'ซุ้มล้อหน้าขวา',
  'ซุ้มล้อหน้าซ้าย',
  'ซุ้มล้อหลังขวา',
  'ซุ้มล้อหลังซ้าย',
  'สเกิร์ตข้างขวา',
  'สเกิร์ตข้างซ้าย',
  'กันชนหลัง',
  'ประตูท้ายรถ / ประตูพยาบาล',
  'กระจกมองข้างขวา',
  'กระจกมองข้างซ้าย',
  'หลังคารถ / ไซเรน',
];

const SEVERITY_LABELS: Record<DamageSeverity, { label: string; color: string; badgeClass: string }> = {
  minor_scratch: {
    label: 'รอยขูดขีดตื้น (ขนแมว/ผิวสี)',
    color: '#3b82f6',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  deep_scratch: {
    label: 'รอยขูดขีดลึก (กินเนื้อสี/เห็นแผ่นเหล็ก)',
    color: '#f59e0b',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  dent: {
    label: 'รอยบุบ / ยุบตัว',
    color: '#ea580c',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  },
  crack: {
    label: 'รอยแตกหัก / แตกปริ',
    color: '#dc2626',
    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  },
  paint_chip: {
    label: 'สะเก็ดหินดีด / สีหลุดร่อน',
    color: '#8b5cf6',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
  rust: {
    label: 'คราบสนิมกัดกร่อน',
    color: '#78716c',
    badgeClass: 'bg-stone-50 text-stone-700 border-stone-200 dark:bg-stone-900/40 dark:text-stone-300 dark:border-stone-800',
  },
};

export const VehicleDamageView: React.FC<VehicleDamageViewProps> = ({
  currentUser,
  vehicles,
  damageRecords,
  onSaveDamage,
  onDeleteDamage,
  onUpdateDamageStatus,
}) => {
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDamageId, setEditingDamageId] = useState<string | null>(null);
  const [viewPhotoModalUrl, setViewPhotoModalUrl] = useState<string | null>(null);

  // Form states for new damage record
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [positionArea, setPositionArea] = useState<string>(POSITION_PRESETS[0]);
  const [customPosition, setCustomPosition] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [severity, setSeverity] = useState<DamageSeverity>('minor_scratch');
  const [mainPhoto, setMainPhoto] = useState<string>('');
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);
  const [odometer, setOdometer] = useState<number>(vehicles[0]?.currentOdometer || 0);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('BLS-01');
  const [manualPlate, setManualPlate] = useState<string>('1กข 4589 กทม.');

  // Filtered records
  const selectedFilterVehicle = vehicles.find((v) => v.id === selectedVehicleFilter);
  const filteredRecords = damageRecords.filter((item) => {
    const matchVehicle =
      selectedVehicleFilter === 'all' ||
      item.vehicleId === selectedVehicleFilter ||
      (selectedFilterVehicle && item.vehicleCode === selectedFilterVehicle.code);
    const matchSeverity = selectedSeverityFilter === 'all' || item.severity === selectedSeverityFilter;
    const term = searchTerm.toLowerCase();
    const matchSearch =
      !term ||
      item.positionArea.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.vehicleCode.toLowerCase().includes(term) ||
      item.plateNumber.toLowerCase().includes(term);
    return matchVehicle && matchSeverity && matchSearch;
  });

  const handleOpenAddModal = (defaultVehId?: string) => {
    setFormError(null);
    setEditingDamageId(null);
    const targetVehId = defaultVehId || (selectedVehicleFilter !== 'all' ? selectedVehicleFilter : vehicles[0]?.id || '');
    const currentVeh = vehicles.find((v) => v.id === targetVehId) || vehicles[0];
    setSelectedVehicleId(targetVehId);
    setOdometer(currentVeh?.currentOdometer || 0);
    setPositionArea(POSITION_PRESETS[0]);
    setCustomPosition('');
    setDescription('');
    setSeverity('minor_scratch');
    setMainPhoto('');
    setAdditionalPhotos([]);
    setManualCode('BLS-01');
    setManualPlate('1กข 4589 กทม.');
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: VehicleDamageItem) => {
    setFormError(null);
    setEditingDamageId(item.id);
    setSelectedVehicleId(item.vehicleId);
    setOdometer(item.odometerAtReport || 0);
    if (POSITION_PRESETS.includes(item.positionArea)) {
      setPositionArea(item.positionArea);
      setCustomPosition('');
    } else {
      setPositionArea(POSITION_PRESETS[0]);
      setCustomPosition(item.positionArea);
    }
    setDescription(item.description || '');
    setSeverity(item.severity);
    setMainPhoto(item.photoUrl || item.drivePhotoUrl || '');
    setAdditionalPhotos(item.additionalPhotos ? [...item.additionalPhotos] : []);
    setManualCode(item.vehicleCode || 'BLS-01');
    setManualPlate(item.plateNumber || '1กข 4589 กทม.');
    setModalOpen(true);
  };

  const handleVehicleChange = (vehId: string) => {
    setSelectedVehicleId(vehId);
    const veh = vehicles.find((v) => v.id === vehId);
    if (veh) {
      setOdometer(veh.currentOdometer || 0);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isMain: boolean) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingPhoto(true);
    setFormError(null);
    try {
      if (isMain) {
        const file = files[0];
        const compressed = await compressImage(file, 1200, 1200, 0.75);
        if (compressed) {
          setMainPhoto(compressed);
        }
      } else {
        const newUrls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const compressed = await compressImage(files[i], 1200, 1200, 0.75);
          if (compressed) {
            newUrls.push(compressed);
          }
        }
        setAdditionalPhotos((prev) => [...prev, ...newUrls]);
      }
    } catch (err: any) {
      setFormError('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ: ' + (err.message || ''));
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemoveAdditionalPhoto = (index: number) => {
    setAdditionalPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitDamage = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const effectivePosition = customPosition.trim() ? customPosition.trim() : positionArea;
    if (!effectivePosition) {
      setFormError('กรุณาระบุตำแหน่งที่เกิดรอยบนตัวรถ');
      return;
    }

    if (!description.trim()) {
      setFormError('กรุณากรอกรายละเอียดว่ารอยเกิดขึ้นตรงไหนและมีลักษณะอย่างไร');
      return;
    }

    if (!mainPhoto) {
      setFormError('กรุณาถ่ายรูปหรืออัปโหลดรูปถ่ายรอยแผลอย่างน้อย 1 รูป');
      return;
    }

    const veh = vehicles.find((v) => v.id === selectedVehicleId) || (vehicles.length > 0 ? vehicles[0] : null);

    let targetVehicleId = selectedVehicleId;
    let targetVehicleCode = '';
    let targetPlateNumber = '';
    let targetOdometer = odometer;

    if (veh) {
      targetVehicleId = veh.id;
      targetVehicleCode = veh.code;
      targetPlateNumber = veh.plateNumber;
      if (!targetOdometer && veh.currentOdometer) {
        targetOdometer = veh.currentOdometer;
      }
    } else if (manualCode.trim() && manualPlate.trim()) {
      targetVehicleId = `veh-custom-${Date.now()}`;
      targetVehicleCode = manualCode.trim();
      targetPlateNumber = manualPlate.trim();
    } else if (vehicles.length === 0) {
      setFormError('ขณะนี้ไม่มีรถกู้ชีพในระบบ กรุณากรอกรหัสรถและเลขทะเบียน หรือเพิ่มรถในระบบก่อนทำการบันทึก');
      return;
    } else {
      setFormError('กรุณาเลือกรถกู้ชีพ BLS ที่ต้องการบันทึก');
      return;
    }

    const existing = editingDamageId ? damageRecords.find((d) => d.id === editingDamageId) : null;

    const itemToSave: VehicleDamageItem = {
      id: editingDamageId || `dmg-${Date.now()}`,
      vehicleId: targetVehicleId,
      vehicleCode: targetVehicleCode,
      plateNumber: targetPlateNumber,
      positionArea: effectivePosition,
      description: description.trim(),
      severity,
      photoUrl: mainPhoto,
      additionalPhotos: additionalPhotos.length > 0 ? additionalPhotos : undefined,
      drivePhotoUrl: existing?.drivePhotoUrl,
      driveFolderUrl: existing?.driveFolderUrl,
      createdAt:
        existing?.createdAt ||
        new Date().toLocaleString('th-TH', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      inspectorName: existing?.inspectorName || currentUser?.name || 'เจ้าหน้าที่',
      inspectorRole: existing?.inspectorRole || currentUser?.role || 'staff',
      odometerAtReport: targetOdometer || existing?.odometerAtReport || undefined,
      resolved: existing?.resolved ?? false,
    };

    onSaveDamage(itemToSave);
    setModalOpen(false);
    setEditingDamageId(null);
  };

  // Helper to ensure any photo URL (base64, Google Drive link, or SVG schematic) displays reliably
  const getDisplayablePhotoUrl = (rawUrl?: string, driveUrl?: string, position?: string, desc?: string): string => {
    if (rawUrl && (rawUrl.startsWith('data:image/') || rawUrl.startsWith('blob:') || (rawUrl.startsWith('http') && !rawUrl.includes('drive.google.com/file/d/')))) {
      return rawUrl;
    }
    const target = rawUrl || driveUrl;
    if (target) {
      const match = target.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || target.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}=w1000`;
      }
    }
    return generateSvgDamagePlaceholder(position || 'จุดความเสียหาย', desc || 'รอยแผลตัวรถ');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Car className="h-6 w-6 text-sky-600" />
            <span>เมนูบันทึกรอยรอบตัวรถ (Vehicle Scratch & Damage Tracker)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ตรวจเช็ค ถ่ายรูปบันทึกรอยขูดขีด รอยบุบ รอยแตกหักรอบตัวถังรถกู้ชีพ BLS และระบุตำแหน่งอย่างละเอียด
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenAddModal()}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-sky-500 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>บันทึกรอยรอบตัวรถใหม่</span>
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            รอยแผลที่บันทึกทั้งหมด
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {damageRecords.length}
            </span>
            <span className="text-xs text-slate-400">จุด</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">บันทึกสะสมในระบบ</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:border-amber-950 dark:bg-amber-950/20">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            รอยขูดขีด / สีถลอก
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {damageRecords.filter((d) => d.severity === 'minor_scratch' || d.severity === 'deep_scratch').length}
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">รอยขูดเฉี่ยวชน</p>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 shadow-sm dark:border-orange-950 dark:bg-orange-950/20">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-800 dark:text-orange-300">
            รอยบุบ / ยุบตัว
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
              {damageRecords.filter((d) => d.severity === 'dent').length}
            </span>
            <span className="text-xs text-orange-500 font-semibold">แผลบุบ</span>
          </div>
          <p className="mt-1 text-[11px] text-orange-700 dark:text-orange-400">ตัวถัง/กันชนบุบ</p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-sm dark:border-red-950 dark:bg-red-950/20">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-red-800 dark:text-red-300">
            รอยแตกหัก / ต้องซ่อม
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {damageRecords.filter((d) => d.severity === 'crack' || d.severity === 'rust').length}
            </span>
            <span className="text-xs text-red-500 font-semibold">ชำรุด</span>
          </div>
          <p className="mt-1 text-[11px] text-red-700 dark:text-red-400">ต้องส่งซ่อมสี/ตัวถัง</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 items-center gap-2 min-w-[240px]">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาตามตำแหน่ง เช่น กันชนหน้า, ฝากระโปรง หรือรายละเอียดรอย..."
            className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none dark:text-slate-200"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Vehicle Filter */}
          <select
            value={selectedVehicleFilter}
            onChange={(e) => setSelectedVehicleFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">รถกู้ชีพ BLS ทั้งหมด ({vehicles.length} คัน)</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} - {v.plateNumber}
              </option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={selectedSeverityFilter}
            onChange={(e) => setSelectedSeverityFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">ประเภทความเสียหายทั้งหมด</option>
            <option value="minor_scratch">รอยขูดขีดตื้น</option>
            <option value="deep_scratch">รอยขูดขีดลึก</option>
            <option value="dent">รอยบุบ / ยุบตัว</option>
            <option value="crack">รอยแตกหัก</option>
            <option value="paint_chip">สะเก็ดหิน / สีหลุด</option>
            <option value="rust">คราบสนิม</option>
          </select>
        </div>
      </div>

      {/* Grid of Damage Records */}
      {filteredRecords.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecords.map((item) => {
            const sev = SEVERITY_LABELS[item.severity] || SEVERITY_LABELS.minor_scratch;
            const mainPhotoUrl = getDisplayablePhotoUrl(
              item.photoUrl,
              item.drivePhotoUrl,
              item.positionArea,
              item.description || item.vehicleCode
            );

            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all dark:border-slate-800 dark:bg-slate-900 flex flex-col"
              >
                {/* Photo Preview Container */}
                <div
                  className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900 group cursor-pointer"
                  onClick={() => setViewPhotoModalUrl(mainPhotoUrl)}
                >
                  <img
                    src={mainPhotoUrl}
                    alt={item.positionArea}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const fallback = generateSvgDamagePlaceholder(
                        item.positionArea,
                        item.description || item.vehicleCode
                      );
                      if (e.currentTarget.src !== fallback) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 pointer-events-none" />

                  {/* Vehicle Tag Badge */}
                  <div className="absolute left-2.5 top-2.5">
                    <span className="rounded-md bg-slate-950/80 px-2 py-0.5 font-mono text-xs font-bold text-sky-400 backdrop-blur-sm">
                      {item.vehicleCode}
                    </span>
                  </div>

                  {/* Severity Badge */}
                  <div className="absolute right-2.5 top-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border backdrop-blur-sm ${sev.badgeClass}`}
                    >
                      {sev.label}
                    </span>
                  </div>

                  {/* Location Banner at bottom of photo */}
                  <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white pointer-events-none">
                    <div className="flex items-center gap-1.5 font-bold text-xs truncate drop-shadow-md">
                      <Tag className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{item.positionArea}</span>
                    </div>
                    {item.additionalPhotos && item.additionalPhotos.length > 0 && (
                      <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-sky-300 font-mono">
                        +{item.additionalPhotos.length} รูป
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {item.plateNumber}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.createdAt}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      {item.description}
                    </p>
                  </div>

                  {/* Additional mini photos preview if any */}
                  {item.additionalPhotos && item.additionalPhotos.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                        รูปภาพมุมเพิ่มเติม:
                      </span>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {item.additionalPhotos.map((photo, pIdx) => {
                          const subPhotoUrl = getDisplayablePhotoUrl(
                            photo,
                            undefined,
                            `${item.positionArea} (มุม ${pIdx + 1})`,
                            'มุมเสริม'
                          );
                          return (
                            <img
                              key={pIdx}
                              src={subPhotoUrl}
                              alt={`มุมเพิ่มเติม ${pIdx + 1}`}
                              onClick={() => setViewPhotoModalUrl(subPhotoUrl)}
                              className="h-10 w-10 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 shrink-0"
                              onError={(e) => {
                                const fallback = generateSvgDamagePlaceholder(
                                  `${item.positionArea} (มุม ${pIdx + 1})`,
                                  'มุมเสริม'
                                );
                                if (e.currentTarget.src !== fallback) {
                                  e.currentTarget.src = fallback;
                                }
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Metadata & Actions */}
                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate max-w-[130px]">{item.inspectorName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {(item.driveFolderUrl || item.drivePhotoUrl) && (
                        <a
                          href={item.driveFolderUrl || item.drivePhotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                          title="เปิดดูรูปภาพใน Google Drive"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Drive</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setViewPhotoModalUrl(mainPhotoUrl)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                        title="ดูรูปภาพขนาดใหญ่"
                      >
                        <Eye className="h-3 w-3" />
                        <span>ดูรูป</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                        title="แก้ไขข้อมูลและรูปภาพรอยนี้"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>แก้ไข</span>
                      </button>

                      {onUpdateDamageStatus && (
                        <button
                          type="button"
                          onClick={() => onUpdateDamageStatus(item.id, !item.resolved)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold border transition-colors ${
                            item.resolved
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                          title={item.resolved ? 'คลิกเพื่อเปลี่ยนเป็น: รอซ่อมสี' : 'คลิกเพื่อเปลี่ยนเป็น: ซ่อมสีแล้ว'}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{item.resolved ? 'ซ่อมแล้ว' : 'รอซ่อม'}</span>
                        </button>
                      )}

                      {currentUser.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => onDeleteDamage(item.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title="ลบรายการรอยนี้"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <Car className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
          <h3 className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">
            ยังไม่พบรายการบันทึกรอยรอบตัวรถ
          </h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            {selectedVehicleFilter !== 'all'
              ? 'รถกู้ชีพคันนี้ยังไม่มีการบันทึกรอยขูดขีดหรือความเสียหาย'
              : 'สามารถเริ่มบันทึกรอยขูดขีด รอยบุบ หรือรอยแตกหักรอบตัวรถได้ทันที'}
          </p>
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-500"
          >
            <Plus className="h-4 w-4" />
            <span>บันทึกรอยรอบตัวรถคันนี้</span>
          </button>
        </div>
      )}

      {/* Modal: Add New Vehicle Damage */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            {/* Modal Header (Pinned) */}
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-850">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-950/50 text-sky-600">
                  <Car className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingDamageId ? 'แก้ไขข้อมูลรอยรอบตัวรถและจุดความเสียหาย' : 'บันทึกรอยรอบตัวรถและจุดความเสียหาย'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingDamageId
                      ? 'แก้ไขรายละเอียด ตำแหน่ง ลักษณะรอย และรูปถ่ายจุดความเสียหาย'
                      : 'ถ่ายภาพหรืออัปโหลดรูปจุดที่มีรอยขูดขีด/บุบ/เสียหาย พร้อมระบุตำแหน่งและรายละเอียด'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="vehicle-damage-form" onSubmit={handleSubmitDamage} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                  {formError}
                </div>
              )}

              {/* Vehicle Selection & Odometer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {vehicles.length > 0 ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      เลือกรถกู้ชีพ BLS:
                    </label>
                    <select
                      value={selectedVehicleId || vehicles[0].id}
                      onChange={(e) => handleVehicleChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.code} - {v.plateNumber} ({v.brandModel})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="sm:col-span-2 space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span>ขณะนี้ยังไม่มีรถกู้ชีพในระบบ (ระบุข้อมูลรถเพื่อบันทึกทดสอบได้):</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          รหัสรถ:
                        </label>
                        <input
                          type="text"
                          value={manualCode}
                          onChange={(e) => setManualCode(e.target.value)}
                          placeholder="เช่น BLS-01"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          เลขทะเบียน:
                        </label>
                        <input
                          type="text"
                          value={manualPlate}
                          onChange={(e) => setManualPlate(e.target.value)}
                          placeholder="เช่น 1กข 4589 กทม."
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    เลขไมล์ขณะพบรอย (กม.):
                  </label>
                  <input
                    type="number"
                    value={odometer || ''}
                    onChange={(e) => setOdometer(Number(e.target.value))}
                    placeholder="เช่น 142500"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-semibold text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Position Area Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  ตำแหน่งที่เกิดรอยรอบตัวรถ:
                </label>
                <div className="space-y-2">
                  <select
                    value={positionArea}
                    onChange={(e) => setPositionArea(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {POSITION_PRESETS.map((pos) => (
                      <option key={pos} value={pos}>
                        📍 {pos}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={customPosition}
                    onChange={(e) => setCustomPosition(e.target.value)}
                    placeholder="หรือระบุตำแหน่งอย่างละเอียดเอง (เช่น 'ชายล่างประตูหน้าขวาใต้คิ้วโครเมียม')"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Severity / Damage Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  ลักษณะของรอยและความรุนแรง:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(SEVERITY_LABELS) as DamageSeverity[]).map((key) => {
                    const item = SEVERITY_LABELS[key];
                    const isSelected = severity === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSeverity(key)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                          isSelected
                            ? 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-500/20 font-bold dark:bg-sky-950/40'
                            : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                        }`}
                      >
                        <span className="block font-semibold text-slate-800 dark:text-slate-200">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  รายละเอียดของรอย (ว่าเกิดขึ้นตรงไหน อย่างไร):
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="เช่น รอยขูดขีดเป็นเส้นตรงยาวประมาณ 15 ซม. บริเวณชายล่างกันชนหน้า เกิดจากการเบียดขอบหินขณะจอดรับผู้ป่วย"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Photos Section */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    รูปถ่ายรอยแผลหลัก (จำเป็น):
                  </label>
                  {mainPhoto ? (
                    <div className="relative group aspect-[16/9] w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-inner">
                      <img
                        src={getDisplayablePhotoUrl(mainPhoto, undefined, customPosition || positionArea, description || 'รอยแผลหลัก')}
                        alt="รอยหลัก"
                        className="h-full w-full object-cover cursor-pointer transition-transform group-hover:scale-102"
                        onClick={() => setViewPhotoModalUrl(mainPhoto)}
                        onError={(e) => {
                          const fallback = generateSvgDamagePlaceholder(customPosition || positionArea, description || 'รอยแผลหลัก');
                          if (e.currentTarget.src !== fallback) {
                            e.currentTarget.src = fallback;
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1 text-xs text-white backdrop-blur-sm">
                          <Eye className="h-3.5 w-3.5" /> คลิกดูรูปเต็ม
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMainPhoto('')}
                        className="absolute top-2 right-2 rounded-full bg-slate-900/85 p-1.5 text-white hover:bg-red-600 transition-colors shadow-md"
                        title="ลบหรือเปลี่ยนรูป"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center aspect-[16/9] w-full max-w-sm rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 hover:border-sky-500 hover:bg-sky-50/50 cursor-pointer transition-all dark:border-slate-700 dark:bg-slate-800">
                      <Camera className="h-8 w-8 text-sky-500 mb-2" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {isProcessingPhoto ? 'กำลังประมวลผล...' : 'ถ่ายภาพ / อัปโหลดรูปรอยแผล'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        ระบบจะบีบอัดขนาดไฟล์ภาพให้อัตโนมัติ คมชัด และไม่เปลืองพื้นที่
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e, true)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Additional Photos (รูปถ่ายมุมอื่นๆ หลายรูป) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      รูปถ่ายมุมอื่นๆ เพิ่มเติม (สามารถอัปโหลดได้หลายรูป):
                    </label>
                    {additionalPhotos.length > 0 && (
                      <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                        ({additionalPhotos.length} รูป)
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2.5 items-center">
                    {additionalPhotos.map((photo, index) => {
                      const displaySub = getDisplayablePhotoUrl(
                        photo,
                        undefined,
                        `${customPosition || positionArea} (มุม ${index + 1})`,
                        'รูปมุมเสริม'
                      );
                      return (
                        <div
                          key={index}
                          className="group relative h-20 w-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-700 dark:bg-slate-800 shrink-0"
                        >
                          <img
                            src={displaySub}
                            alt={`รูปมุม ${index + 1}`}
                            className="h-full w-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                            onClick={() => setViewPhotoModalUrl(displaySub)}
                            onError={(e) => {
                              const fallback = generateSvgDamagePlaceholder(
                                `${customPosition || positionArea} (มุม ${index + 1})`,
                                'รูปมุมเสริม'
                              );
                              if (e.currentTarget.src !== fallback) {
                                e.currentTarget.src = fallback;
                              }
                            }}
                          />
                          <span className="absolute bottom-1 left-1 rounded bg-slate-900/80 px-1 py-0.5 text-[9px] font-mono font-bold text-white pointer-events-none">
                            #{index + 1}
                          </span>
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <Eye className="h-4 w-4 text-white drop-shadow" />
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAdditionalPhoto(index);
                            }}
                            className="absolute top-1 right-1 z-10 rounded-full bg-slate-900/85 p-1 text-white hover:bg-red-600 transition-colors shadow"
                            title="ลบรูปนี้"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}

                    <label
                      className={`flex flex-col items-center justify-center h-20 w-20 rounded-xl border-2 border-dashed transition-all ${
                        isProcessingPhoto
                          ? 'opacity-60 pointer-events-none border-slate-300 bg-slate-100 dark:bg-slate-800'
                          : 'border-slate-300 bg-slate-50 hover:border-sky-500 hover:bg-sky-50/50 cursor-pointer dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      {isProcessingPhoto ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                      ) : (
                        <>
                          <Plus className="h-5 w-5 text-sky-500" />
                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                            เพิ่มรูป
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={isProcessingPhoto}
                        onChange={(e) => handlePhotoUpload(e, false)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </form>

            {/* Modal Footer (Pinned at bottom, never cut off) */}
            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/90 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-850">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                ยกเลิก
              </button>
              <button
                form="vehicle-damage-form"
                type="submit"
                disabled={isProcessingPhoto}
                className="rounded-xl bg-sky-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-sky-500 disabled:opacity-50 transition-colors"
              >
                {isProcessingPhoto
                  ? 'กำลังประมวลผลรูป...'
                  : editingDamageId
                  ? 'บันทึกการแก้ไข'
                  : 'บันทึกรอยรอบตัวรถ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Photo Preview Zoom Modal */}
      {viewPhotoModalUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
          onClick={() => setViewPhotoModalUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
            <img
              src={viewPhotoModalUrl}
              alt="ภาพขยายรอยรอบตัวรถ"
              referrerPolicy="no-referrer"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
            <button
              type="button"
              onClick={() => setViewPhotoModalUrl(null)}
              className="absolute top-3 right-3 rounded-full bg-slate-900/80 p-2 text-white hover:bg-red-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
