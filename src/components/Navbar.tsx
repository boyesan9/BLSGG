import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import {
  Shield,
  FileSpreadsheet,
  User,
  LogOut,
  Car,
  Fuel,
  ClipboardCheck,
  LayoutDashboard,
  Menu,
  X,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Phone,
  Building,
  Sparkles,
} from 'lucide-react';

export type AppViewMode = 'form' | 'dashboard' | 'damage' | 'fuel';

interface NavbarProps {
  currentUser: UserProfile;
  currentView: AppViewMode;
  onViewChange: (view: AppViewMode) => void;
  onOpenGoogleSheets: () => void;
  onSwitchRole: (role: UserRole) => void;
  onLogout: () => void;
  sheetsConnected: boolean;
  spreadsheetUrl?: string;
  activeDamageCount?: number;
  onTriggerSyncBack?: () => void;
  isSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentView,
  onViewChange,
  onOpenGoogleSheets,
  onSwitchRole,
  onLogout,
  sheetsConnected,
  spreadsheetUrl,
  activeDamageCount = 0,
  onTriggerSyncBack,
  isSyncing = false,
}) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const navItems = [
    {
      id: 'form' as AppViewMode,
      label: 'ตรวจสภาพรถ',
      subLabel: '22 รายการ',
      icon: ClipboardCheck,
      badge: null,
    },
    {
      id: 'dashboard' as AppViewMode,
      label: currentUser.role === 'admin' ? 'แดชบอร์ดผู้ดูแล' : 'แดชบอร์ดภาพรวม',
      subLabel: 'สถิติ/กองรถ/เวร',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'damage' as AppViewMode,
      label: 'รอยรอบตัวรถ',
      subLabel: 'บันทึกจุดเสียหาย',
      icon: Car,
      badge: activeDamageCount > 0 ? activeDamageCount : null,
    },
    {
      id: 'fuel' as AppViewMode,
      label: 'ประวัติเติมน้ำมัน',
      subLabel: 'เลขไมล์/ระยะทาง',
      icon: Fuel,
      badge: null,
    },
  ];

  const handleNavClick = (viewId: AppViewMode) => {
    onViewChange(viewId);
    setMobileDrawerOpen(false);
  };

  return (
    <>
      {/* ======================================================== */}
      {/* 1. TOP HEADER (Desktop, Tablet & Mobile Header)          */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 transition-colors">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:px-6">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleNavClick('form')}
              className="flex items-center gap-2.5 text-left group transition-transform active:scale-95"
              title="กลับสู่หน้าหลัก"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sm shadow-sky-500/20 group-hover:from-sky-600 group-hover:to-sky-800 transition-all">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    BLS Fleet
                  </span>
                  <span className="rounded bg-sky-100 px-1.5 py-0.2 text-[10px] font-extrabold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                    BLS
                  </span>
                </div>
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight hidden xs:block">
                  ระบบตรวจสภาพและบริหารกองรถกู้ชีพ
                </p>
              </div>
            </button>
          </div>

          {/* Desktop Navigation Links (Large Screens >= 1024px) */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-white text-sky-700 shadow-xs dark:bg-slate-900 dark:text-sky-400'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700/50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== null && (
                    <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Google Sheets Trigger (Admin) */}
            {currentUser.role === 'admin' && (
              <button
                onClick={onOpenGoogleSheets}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50 transition-colors"
                title="จัดการระบบเชื่อมต่อ Google Sheets"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Google Sheets</span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    sheetsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                  title={sheetsConnected ? 'เชื่อมต่อ Google Sheets แล้ว' : 'ยังไม่ได้เชื่อมต่อ'}
                />
              </button>
            )}
          </nav>

          {/* Right Area: Role Badge, Quick Sheets Sync, Profile, Logout & Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick Sync Back button */}
            {onTriggerSyncBack && (
              <button
                type="button"
                onClick={onTriggerSyncBack}
                disabled={isSyncing}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300 transition-colors disabled:opacity-50"
                title="ดึงข้อมูลคืน (Sync Back) จาก Google Sheets & Google Drive"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-sky-600 dark:text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">{isSyncing ? 'กำลังดึงข้อมูล...' : 'Sync Back'}</span>
              </button>
            )}

            {/* Google Sheets Quick Status indicator on mobile & tablet */}
            {sheetsConnected && (
              <button
                type="button"
                onClick={currentUser.role === 'admin' ? onOpenGoogleSheets : undefined}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 transition-colors"
                title="Google Sheets Auto-Sync พร้อมใช้งาน"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden md:inline">Sheets Sync</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </button>
            )}

            {/* User Role Badge */}
            {currentUser.role === 'admin' ? (
              <div className="flex items-center">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-300 shadow-2xs">
                  <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="hidden xs:inline">ผู้ดูแลระบบ</span>
                  <span>(Admin)</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                  <User className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  <span className="hidden xs:inline">เจ้าหน้าที่</span>
                  <span>(Staff)</span>
                </span>
              </div>
            )}

            {/* User profile snippet (Desktop/Tablet) */}
            <div className="hidden md:flex items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-800">
              <div className="text-right">
                <p className="truncate text-xs font-bold text-slate-900 dark:text-white max-w-[120px]">
                  {currentUser.name}
                </p>
                <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                  {currentUser.position || (currentUser.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'เจ้าหน้าที่เวร')}
                </p>
              </div>
            </div>

            {/* Desktop Logout Button */}
            <button
              onClick={onLogout}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
              title="ออกจากระบบ"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>ออกระบบ</span>
            </button>

            {/* Mobile Hamburger Drawer Toggle (Screen < 1024px) */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 transition-colors"
              aria-label="เปิดเมนูการใช้งาน"
              title="เปิดเมนูทั้งหมด"
            >
              {mobileDrawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. MOBILE BOTTOM NAVIGATION BAR (Phones & Tablets)       */}
      {/* ======================================================== */}
      <nav
        aria-label="แถบเมนูหลักสำหรับโทรศัพท์"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 bg-white/95 dark:border-slate-800/90 dark:bg-slate-900/95 backdrop-blur-lg shadow-2xl px-2 py-1 safe-area-bottom"
      >
        <div className="grid grid-cols-5 gap-1 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 ${
                  isActive
                    ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-50/70 dark:bg-sky-950/40'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-sky-600 dark:text-sky-400 stroke-[2.2]' : 'text-slate-500 dark:text-slate-400'}`} />
                  {item.badge !== null && (
                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-extrabold text-white">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">
                  {item.id === 'form' ? 'ตรวจรถ' : item.id === 'dashboard' ? 'แดชบอร์ด' : item.id === 'damage' ? 'รอยตัวรถ' : 'เติมน้ำมัน'}
                </span>
                {isActive && (
                  <span className="absolute bottom-0.5 h-1 w-6 rounded-full bg-sky-600 dark:bg-sky-400" />
                )}
              </button>
            );
          })}

          {/* 5th Tab: Mobile Menu & Sync */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 ${
              mobileDrawerOpen
                ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-50/70 dark:bg-sky-950/40'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              <Menu className="h-5 w-5" />
              {sheetsConnected && (
                <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight">เมนู/ซิงค์</span>
          </button>
        </div>
      </nav>

      {/* ======================================================== */}
      {/* 3. MOBILE SLIDE-OVER DRAWER SHEET                        */}
      {/* ======================================================== */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          {/* Backdrop Click */}
          <div className="flex-1" onClick={() => setMobileDrawerOpen(false)} />

          {/* Drawer Panel */}
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    เมนูการใช้งานและระบบซิงค์
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    BLS Fleet Inspection · ระบบตรวจสภาพรถส่วนกลาง
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="ปิดเมนู"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current User Profile Card */}
            <div className="my-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-850">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    {currentUser.role === 'admin' ? (
                      <Shield className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <User className="h-6 w-6 text-sky-600 dark:text-sky-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {currentUser.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {currentUser.employeeId || 'ID: Staff'} · {currentUser.position || 'เจ้าหน้าที่กู้ชีพ'}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                    currentUser.role === 'admin'
                      ? 'border border-amber-300 bg-amber-100/60 text-amber-800 dark:border-amber-700 dark:bg-amber-950/80 dark:text-amber-300'
                      : 'border border-sky-200 bg-sky-100/60 text-sky-800 dark:border-sky-800 dark:bg-sky-950/80 dark:text-sky-300'
                  }`}
                >
                  {currentUser.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงานทั่วไป (Staff)'}
                </span>
              </div>

              {(currentUser.department || currentUser.phone) && (
                <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  {currentUser.department && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{currentUser.department}</span>
                    </div>
                  )}
                  {currentUser.phone && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{currentUser.phone}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Google Sheets Status & Actions */}
            <div className="my-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      ระบบ Google Sheets & Drive Auto-Sync
                    </h4>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
                      {sheetsConnected
                        ? 'เชื่อมต่อพร้อมบันทึกอัตโนมัติ 6 แท็บ'
                        : 'ยังไม่ได้ตั้งค่าสเปรดชีตส่วนกลาง'}
                    </p>
                  </div>
                </div>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    sheetsConnected ? 'bg-emerald-500 ring-4 ring-emerald-200 dark:ring-emerald-900' : 'bg-slate-300'
                  }`}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      onOpenGoogleSheets();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>จัดการ Google Sheets</span>
                  </button>
                )}

                {spreadsheetUrl && (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>เปิดสเปรดชีต</span>
                  </a>
                )}

                {onTriggerSyncBack && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      onTriggerSyncBack();
                    }}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>ดึงข้อมูลคืน (Sync Back)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Navigation Shortcuts List */}
            <div className="space-y-1.5 my-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                ไปยังหน้าต่างๆ
              </span>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      isActive
                        ? 'border-sky-500 bg-sky-50/80 font-bold dark:border-sky-700 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-850 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-xl ${
                          isActive
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">{item.label}</div>
                        <div className="text-[10px] text-slate-400">{item.subLabel}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.badge !== null && (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Role Switching & Logout Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              {currentUser.role === 'staff' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    onSwitchRole('admin');
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-amber-300 bg-amber-50 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <Shield className="h-4 w-4 text-amber-600" />
                  <span>เข้าสู่ระบบผู้ดูแล (Admin Login)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    onSwitchRole('staff');
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-sky-200 bg-sky-50 text-xs font-bold text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                >
                  <User className="h-4 w-4 text-sky-600" />
                  <span>สลับเป็นโหมดพนักงานทั่วไป (Staff View)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                <LogOut className="h-4 w-4" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
