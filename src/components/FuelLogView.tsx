import React, { useState } from 'react';
import { AmbulanceVehicle, FuelLogRecord, UserProfile } from '../types';
import { compressImage } from '../utils/imageCompressor';
import { toDisplayableDriveImageUrl } from '../services/storage';
import {
  Fuel,
  Plus,
  Search,
  Download,
  Calendar,
  Gauge,
  TrendingUp,
  DollarSign,
  Droplet,
  Trash2,
  X,
  Camera,
  CheckCircle2,
  FileText,
  User,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

interface FuelLogViewProps {
  currentUser: UserProfile;
  vehicles: AmbulanceVehicle[];
  fuelLogs: FuelLogRecord[];
  onSaveFuelLog: (log: FuelLogRecord) => void;
  onDeleteFuelLog: (id: string) => void;
}

const FUEL_TYPES = [
  'ดีเซล B7',
  'ดีเซล B10',
  'ดีเซลพรีเมียม (Euro 5)',
  'แก๊สโซฮอล์ 95',
  'แก๊สโซฮอล์ 91',
  'เบนซิน 95',
];

const GAS_STATIONS = [
  'ปตท. (PTT Station)',
  'บางจาก (Bangchak)',
  'เชลล์ (Shell)',
  'คาลเท็กซ์ (Caltex)',
  'พีที (PT)',
  'เอสโซ่ (Esso)',
  'อื่นๆ',
];

export const FuelLogView: React.FC<FuelLogViewProps> = ({
  currentUser,
  vehicles,
  fuelLogs,
  onSaveFuelLog,
  onDeleteFuelLog,
}) => {
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewReceiptModalUrl, setViewReceiptModalUrl] = useState<string | null>(null);

  // Form states
  const [vehicleId, setVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [fuelDate, setFuelDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [fuelTime, setFuelTime] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [odometer, setOdometer] = useState<number>(0);
  const [liters, setLiters] = useState<number>(50);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [fuelType, setFuelType] = useState<string>(FUEL_TYPES[0]);
  const [gasStation, setGasStation] = useState<string>(GAS_STATIONS[0]);
  const [customStation, setCustomStation] = useState<string>('');
  const [driverName, setDriverName] = useState<string>(currentUser.name);
  const [notes, setNotes] = useState<string>('');
  const [receiptPhoto, setReceiptPhoto] = useState<string>('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('BLS-01');
  const [manualPlate, setManualPlate] = useState<string>('1กข 4589 กทม.');

  // Find latest recorded odometer for current vehicle in form
  const getPreviousOdometerForVehicle = (targetVehId: string): number | null => {
    if (!targetVehId) return null;
    const veh = vehicles.find((v) => v.id === targetVehId);
    const logsForVeh = fuelLogs
      .filter((l) => l.vehicleId === targetVehId || (veh && l.vehicleCode === veh.code))
      .sort((a, b) => b.odometer - a.odometer);
    if (logsForVeh.length > 0) {
      return logsForVeh[0].odometer;
    }
    return veh?.currentOdometer || null;
  };

  const previousOdometer = getPreviousOdometerForVehicle(vehicleId);
  const calculatedDistanceDriven =
    previousOdometer !== null && odometer > previousOdometer
      ? odometer - previousOdometer
      : null;
  const calculatedKmPerLiter =
    calculatedDistanceDriven !== null && liters > 0
      ? Number((calculatedDistanceDriven / liters).toFixed(2))
      : null;

  // Filtered Fuel Logs
  const selectedFilterVehicle = vehicles.find((v) => v.id === selectedVehicleFilter);
  const filteredLogs = fuelLogs
    .filter((log) => {
      const matchVehicle =
        selectedVehicleFilter === 'all' ||
        log.vehicleId === selectedVehicleFilter ||
        (selectedFilterVehicle && log.vehicleCode === selectedFilterVehicle.code);
      const term = searchTerm.toLowerCase();
      const matchSearch =
        !term ||
        log.vehicleCode.toLowerCase().includes(term) ||
        log.plateNumber.toLowerCase().includes(term) ||
        (log.gasStation && log.gasStation.toLowerCase().includes(term)) ||
        (log.driverName && log.driverName.toLowerCase().includes(term));
      return matchVehicle && matchSearch;
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  // Analytics KPI calculations
  const totalLitersAll = filteredLogs.reduce((acc, curr) => acc + (curr.liters || 0), 0);
  const totalCostAll = filteredLogs.reduce((acc, curr) => acc + (curr.totalCost || 0), 0);
  const totalDistanceAll = filteredLogs.reduce((acc, curr) => acc + (curr.distanceDriven || 0), 0);
  const avgKmPerLiter =
    totalLitersAll > 0 && totalDistanceAll > 0
      ? Number((totalDistanceAll / totalLitersAll).toFixed(2))
      : 0;

  const handleOpenAddModal = () => {
    setFormError(null);
    const targetVehId = selectedVehicleFilter !== 'all' ? selectedVehicleFilter : vehicles[0]?.id || '';
    const prevOdo = targetVehId ? getPreviousOdometerForVehicle(targetVehId) : null;
    const targetVeh = vehicles.find((v) => v.id === targetVehId) || vehicles[0];
    setVehicleId(targetVehId);
    setOdometer(prevOdo ? prevOdo + 400 : (targetVeh?.currentOdometer || 100000));
    setLiters(50);
    setTotalCost(0);
    setDriverName(currentUser?.name || '');
    setNotes('');
    setReceiptPhoto('');
    setCustomStation('');
    setManualCode('BLS-01');
    setManualPlate('1กข 4589 กทม.');
    setModalOpen(true);
  };

  const handleVehicleChange = (newVehId: string) => {
    setVehicleId(newVehId);
    const prevOdo = getPreviousOdometerForVehicle(newVehId);
    if (prevOdo) {
      setOdometer(prevOdo + 400);
    }
  };

  const handleReceiptPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    setFormError(null);
    try {
      const compressed = await compressImage(file, 1200, 1200, 0.75);
      if (compressed) {
        setReceiptPhoto(compressed);
      }
    } catch (err: any) {
      setFormError('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ: ' + (err.message || ''));
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSubmitFuelLog = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!odometer || odometer <= 0) {
      setFormError('กรุณาระบุเลขไมล์ขณะเติมน้ำมันให้ถูกต้อง');
      return;
    }

    if (!liters || liters <= 0) {
      setFormError('กรุณาระบุจำนวนลิตรที่เติม');
      return;
    }

    const veh = vehicles.find((v) => v.id === vehicleId) || (vehicles.length > 0 ? vehicles[0] : null);

    let targetVehicleId = vehicleId;
    let targetVehicleCode = '';
    let targetPlateNumber = '';

    if (veh) {
      targetVehicleId = veh.id;
      targetVehicleCode = veh.code;
      targetPlateNumber = veh.plateNumber;
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

    const prevOdo = targetVehicleId ? getPreviousOdometerForVehicle(targetVehicleId) : null;

    const distance = prevOdo && odometer > prevOdo ? odometer - prevOdo : undefined;
    const kmPerL = distance && liters > 0 ? Number((distance / liters).toFixed(2)) : undefined;
    const costPerKm = distance && distance > 0 && totalCost && totalCost > 0 ? Number((totalCost / distance).toFixed(2)) : undefined;
    const pricePerL = totalCost && totalCost > 0 && liters > 0 ? Number((totalCost / liters).toFixed(2)) : undefined;

    const formattedDate = `${fuelDate.split('-').reverse().join('/')} ${fuelTime}`;

    const newRecord: FuelLogRecord = {
      id: `fuel-${Date.now()}`,
      vehicleId: targetVehicleId,
      vehicleCode: targetVehicleCode,
      plateNumber: targetPlateNumber,
      fuelDate: formattedDate,
      odometer: Number(odometer),
      previousOdometer: prevOdo || undefined,
      distanceDriven: distance,
      kmPerLiter: kmPerL,
      costPerKm,
      liters: Number(liters),
      totalCost: Number(totalCost),
      pricePerLiter: pricePerL,
      fuelType,
      gasStation: customStation.trim() ? customStation.trim() : gasStation,
      receiptPhotoUrl: receiptPhoto || undefined,
      driverName: driverName.trim() || currentUser?.name || 'เจ้าหน้าที่',
      notes: notes.trim() || undefined,
      createdAt: Date.now(),
    };

    onSaveFuelLog(newRecord);
    setModalOpen(false);
  };

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;

    const headers = [
      'วันที่เติม',
      'รหัสรถ',
      'เลขทะเบียน',
      'เลขไมล์ขณะเติม (กม.)',
      'เลขไมล์ครั้งก่อน (กม.)',
      'ระยะทางที่วิ่งได้ (กม.)',
      'จำนวนลิตร',
      'ยอดเงิน (บาท)',
      'ราคาต่อลิตร (บาท)',
      'อัตราสิ้นเปลือง (กม./ลิตร)',
      'ต้นทุน (บาท/กม.)',
      'ประเภทน้ำมัน',
      'สถานีบริการ/ปั๊ม',
      'ผู้เติม/คนขับ',
      'หมายเหตุ',
    ];

    const rows = filteredLogs.map((log) => [
      `"${log.fuelDate}"`,
      `"${log.vehicleCode}"`,
      `"${log.plateNumber}"`,
      log.odometer,
      log.previousOdometer || '-',
      log.distanceDriven || '-',
      log.liters,
      log.totalCost,
      log.pricePerLiter || '-',
      log.kmPerLiter || '-',
      log.costPerKm || '-',
      `"${log.fuelType}"`,
      `"${log.gasStation || '-'}"`,
      `"${log.driverName}"`,
      `"${log.notes || '-'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BLS_Fuel_Log_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Fuel className="h-6 w-6 text-emerald-600" />
            <span>เมนูประวัติการเติมน้ำมันและอัตราการใช้น้ำมัน (Fuel Log & Efficiency)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            บันทึกการเติมน้ำมันแต่ละครั้ง วันที่เติม เลขไมล์ สรุปคำนวณระยะทางที่วิ่งได้ (กม.) และอัตราสิ้นเปลือง
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <Download className="h-4 w-4" />
            <span>ส่งออก CSV</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>บันทึกการเติมน้ำมัน</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Strip */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {/* Total Distance Driven */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-950 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              ระยะทางวิ่งรวมสะสม
            </span>
            <Gauge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {totalDistanceAll.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">กม.</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
            คำนวณจากทุกครั้งที่เติมน้ำมัน
          </p>
        </div>

        {/* Total Liters */}
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 shadow-sm dark:border-sky-950 dark:bg-sky-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              ปริมาณน้ำมันรวม
            </span>
            <Droplet className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tabular-nums text-sky-600 dark:text-sky-400">
              {totalLitersAll.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-bold text-sky-700 dark:text-sky-300">ลิตร</span>
          </div>
          <p className="mt-1 text-[11px] text-sky-700 dark:text-sky-400">ปริมาณน้ำมันที่เติม</p>
        </div>

        {/* Avg Fuel Efficiency */}
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm dark:border-indigo-950 dark:bg-indigo-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
              อัตราสิ้นเปลืองเฉลี่ย
            </span>
            <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
              {avgKmPerLiter > 0 ? avgKmPerLiter : '-'}
            </span>
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">กม./ลิตร</span>
          </div>
          <p className="mt-1 text-[11px] text-indigo-700 dark:text-indigo-400">ประสิทธิภาพการประหยัดน้ำมัน</p>
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
            placeholder="ค้นหาตามปั๊มน้ำมัน, ชื่อผู้เติม, รหัสรถ หรือทะเบียน..."
            className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none dark:text-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedVehicleFilter}
            onChange={(e) => setSelectedVehicleFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">รถกู้ชีพ BLS ทั้งหมด ({vehicles.length} คัน)</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} - {v.plateNumber}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fuel Log Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">วันที่-เวลาเติม</th>
                <th className="px-4 py-3">รถกู้ชีพ BLS</th>
                <th className="px-4 py-3">เลขไมล์ขณะเติม</th>
                <th className="px-4 py-3 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                  ⚡ วิ่งได้ (จากการเติมครั้งก่อน)
                </th>
                <th className="px-4 py-3">ลิตรที่เติม</th>
                <th className="px-4 py-3">ประเภทน้ำมัน</th>
                <th className="px-4 py-3">อัตราสิ้นเปลือง</th>
                <th className="px-4 py-3">ปั๊ม / สถานี</th>
                <th className="px-4 py-3">ผู้เติม</th>
                <th className="px-4 py-3">สลิป/ใบเสร็จ</th>
                <th className="px-4 py-3 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3.5 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {log.fuelDate}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400 mr-1.5">
                        {log.vehicleCode}
                      </span>
                      <span className="text-[11px] text-slate-500">{log.plateNumber}</span>
                    </td>

                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {log.odometer.toLocaleString()} กม.
                    </td>

                    {/* วิ่งได้กี่กิโลเมตรจากการเติมครั้งก่อน */}
                    <td className="px-4 py-3.5 bg-emerald-50/40 dark:bg-emerald-950/20 whitespace-nowrap">
                      {log.distanceDriven ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            +{log.distanceDriven.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-semibold">กม.</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">การเติมครั้งแรก</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {log.liters} ลิตร
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {log.fuelType || 'ดีเซล B7'}
                      </span>
                    </td>

                    {/* อัตราสิ้นเปลือง กม./ลิตร */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {log.kmPerLiter ? (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                            {log.kmPerLiter} กม./ลิตร
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 text-xs">
                      <span className="line-clamp-1">{log.gasStation || '-'}</span>
                      <span className="text-[10px] text-slate-400">{log.fuelType}</span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                      {log.driverName}
                    </td>

                    {/* Receipt photo button */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {(log.receiptPhotoUrl || log.receiptDriveUrl) && (
                          <button
                            type="button"
                            onClick={() =>
                              setViewReceiptModalUrl(
                                toDisplayableDriveImageUrl(log.receiptPhotoUrl, log.receiptDriveUrl) || null
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                            title="ดูภาพสลิปใบเสร็จ"
                          >
                            <FileText className="h-3 w-3" />
                            <span>ดูสลิป</span>
                          </button>
                        )}
                        {log.receiptDriveUrl && (
                          <a
                            href={log.receiptDriveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            title="เปิดดูสลิปใน Google Drive"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Drive</span>
                          </a>
                        )}
                        {!log.receiptPhotoUrl && !log.receiptDriveUrl && (
                          <span className="text-[11px] text-slate-400">ไม่มี</span>
                        )}
                      </div>
                    </td>

                    {/* Delete action */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {currentUser.role === 'admin' ? (
                        <button
                          type="button"
                          onClick={() => onDeleteFuelLog(log.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title="ลบรายการเติมน้ำมัน"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    ไม่พบประวัติการเติมน้ำมันตามเงื่อนไขที่ค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Fuel Log */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative flex flex-col w-full max-w-xl max-h-[90vh] rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            {/* Modal Header (Pinned) */}
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-emerald-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-850">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600">
                  <Fuel className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  บันทึกประวัติการเติมน้ำมัน
                </h3>
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

            <form id="fuel-log-form" onSubmit={handleSubmitFuelLog} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                  {formError}
                </div>
              )}

              {/* Vehicle Selection */}
              {vehicles.length > 0 ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    เลือกรถกู้ชีพ BLS:
                  </label>
                  <select
                    value={vehicleId || vehicles[0].id}
                    onChange={(e) => handleVehicleChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} - {v.plateNumber} ({v.brandModel})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>ขณะนี้ยังไม่มีรถกู้ชีพในระบบ (ระบุข้อมูลรถเพื่อบันทึกทดสอบได้):</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">
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
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">
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

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    วันที่เติมน้ำมัน:
                  </label>
                  <input
                    type="date"
                    value={fuelDate}
                    onChange={(e) => setFuelDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    เวลาที่เติม:
                  </label>
                  <input
                    type="time"
                    value={fuelTime}
                    onChange={(e) => setFuelTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Odometer reading & Real-time Distance Driven Calculation Banner */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  เลขไมล์ขณะเติมน้ำมัน (กิโลเมตร):
                </label>
                <input
                  type="number"
                  value={odometer || ''}
                  onChange={(e) => setOdometer(Number(e.target.value))}
                  placeholder="ระบุเลขไมล์บนหน้าปัดรถ เช่น 142850"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-mono font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />

                {/* Calculation summary callout */}
                <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs dark:border-emerald-900 dark:bg-emerald-950/40">
                  <div className="flex items-center justify-between text-emerald-900 dark:text-emerald-200 font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <span>สรุปการใช้น้ำมันรอบนี้:</span>
                    </span>
                    {previousOdometer !== null && (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        เลขไมล์ครั้งก่อน: {previousOdometer.toLocaleString()} กม.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 rounded-xl bg-white p-2 text-center border border-emerald-100 shadow-2xs dark:bg-slate-900 dark:border-emerald-900/60">
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                        ระยะทางที่วิ่งได้
                      </span>
                      <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-300">
                        {calculatedDistanceDriven !== null
                          ? `${calculatedDistanceDriven.toLocaleString()} กม.`
                          : '-'}
                      </span>
                    </div>

                    <div className="flex-1 rounded-xl bg-white p-2 text-center border border-emerald-100 shadow-2xs dark:bg-slate-900 dark:border-emerald-900/60">
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                        อัตราสิ้นเปลือง
                      </span>
                      <span className="font-mono text-base font-bold text-indigo-700 dark:text-indigo-300">
                        {calculatedKmPerLiter !== null ? `${calculatedKmPerLiter} กม./ลิตร` : '-'}
                      </span>
                    </div>

                  </div>
                </div>
              </div>

              {/* Liters & Fuel Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    จำนวนลิตรที่เติม: *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={liters || ''}
                    onChange={(e) => setLiters(Number(e.target.value))}
                    placeholder="เช่น 55.4"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    ประเภทน้ำมัน:
                  </label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {FUEL_TYPES.map((ft) => (
                      <option key={ft} value={ft}>
                        {ft}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Gas Station */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  สถานีบริการ / ปั๊มน้ำมัน:
                </label>
                <select
                  value={gasStation}
                  onChange={(e) => setGasStation(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {GAS_STATIONS.map((gs) => (
                    <option key={gs} value={gs}>
                      {gs}
                    </option>
                  ))}
                </select>
              </div>

              {gasStation === 'อื่นๆ' && (
                <div>
                  <input
                    type="text"
                    value={customStation}
                    onChange={(e) => setCustomStation(e.target.value)}
                    placeholder="ระบุชื่อปั๊มน้ำมันหรือสาขา"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
              )}

              {/* Driver Name & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    ผู้เติม / พนักงานขับรถ:
                  </label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    หมายเหตุเพิ่มเติม:
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="เช่น วิ่งส่งต่อผู้ป่วยฉุกเฉินต่างจังหวัด"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Receipt / Slip Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  ภาพถ่ายใบเสร็จ / สลิปค่าน้ำมัน (ถ้ามี):
                </label>
                {receiptPhoto ? (
                  <div className="relative h-28 w-44 rounded-xl overflow-hidden border border-slate-200">
                    <img src={receiptPhoto} alt="สลิปค่าน้ำมัน" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setReceiptPhoto('')}
                      className="absolute top-1 right-1 rounded-full bg-slate-900/80 p-1 text-white hover:bg-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 hover:border-emerald-500 hover:bg-emerald-50/40 cursor-pointer transition-all dark:border-slate-700 dark:bg-slate-800">
                    <Camera className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {isProcessingPhoto ? 'กำลังประมวลผลสลิป...' : 'แนบภาพสลิป / ถ่ายรูปใบเสร็จ'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleReceiptPhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

            </form>

            {/* Modal Footer (Pinned at bottom) */}
            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/90 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-850">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                ยกเลิก
              </button>
              <button
                form="fuel-log-form"
                type="submit"
                disabled={isProcessingPhoto}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {isProcessingPhoto ? 'กำลังประมวลผล...' : 'บันทึกประวัติการเติมน้ำมัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slip Preview Modal */}
      {viewReceiptModalUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
          onClick={() => setViewReceiptModalUrl(null)}
        >
          <div className="relative max-w-lg max-h-[90vh] overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
            <img
              src={viewReceiptModalUrl}
              alt="สลิปค่าน้ำมัน"
              referrerPolicy="no-referrer"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
            <button
              type="button"
              onClick={() => setViewReceiptModalUrl(null)}
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
