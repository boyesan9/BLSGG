import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { Shield, User, ArrowRight, UserCheck, Phone, Lock } from 'lucide-react';
import { AdminAuthModal } from './AdminAuthModal';
import { User as FirebaseUser } from 'firebase/auth';
import { RedirectLoginIntent } from '../services/firebaseAuth';

interface LoginViewProps {
  onLogin: (user: UserProfile) => void;
  staffList: UserProfile[];
  onGoogleLogin?: (
    intent?: Omit<RedirectLoginIntent, 'timestamp'>
  ) => Promise<'success' | 'redirected' | boolean | void>;
  isGoogleLoading?: boolean;
  googleUser?: FirebaseUser | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  staffList,
  onGoogleLogin,
  isGoogleLoading = false,
  googleUser = null,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [customName, setCustomName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Admin Auth Modal state
  const [adminAuthModalOpen, setAdminAuthModalOpen] = useState(false);
  const [pendingAdminUser, setPendingAdminUser] = useState<UserProfile | null>(null);

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError(null);
    if (!customName.trim()) {
      setCustomError('กรุณากรอกชื่อ-นามสกุลผู้เข้าใช้งาน');
      return;
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      name: customName.trim(),
      role: selectedRole,
      employeeId: employeeId.trim() || (selectedRole === 'admin' ? 'ADM-001' : 'EMT-001'),
      email: `${customName.trim().replace(/\s+/g, '.').toLowerCase()}@ems-fleet.go.th`,
      status: 'active',
    };

    if (selectedRole === 'admin' && !googleUser) {
      setPendingAdminUser(newUser);
      setAdminAuthModalOpen(true);
    } else {
      onLogin(newUser);
    }
  };

  const handleSelectStaff = (staff: UserProfile) => {
    if (staff.role === 'admin' && !googleUser) {
      setPendingAdminUser(staff);
      setAdminAuthModalOpen(true);
    } else {
      onLogin(staff);
    }
  };

  const handleQuickAdminLogin = () => {
    const adminProfile: UserProfile = {
      id: googleUser ? `user-admin-${googleUser.uid.slice(0, 8)}` : `user-admin-${Date.now()}`,
      name: googleUser?.displayName || 'ผู้ดูแลระบบ (Admin)',
      role: 'admin',
      employeeId: 'ADM-001',
      position: 'ผู้ดูแลระบบส่วนกลาง (Admin)',
      department: 'ศูนย์กู้ชีพ BLS',
      email: googleUser?.email || '',
      status: 'active',
    };

    if (googleUser) {
      onLogin(adminProfile);
    } else {
      setPendingAdminUser(adminProfile);
      setAdminAuthModalOpen(true);
    }
  };

  // Group staff by role with strictly unique IDs
  const uniqueStaff = Array.from(new Map((staffList || []).map((s) => [s.id, s])).values());
  const staffByRole = uniqueStaff.filter((s) => s.role === selectedRole);

  return (
    <div className="flex min-h-[90vh] items-center justify-center p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-sky-950 p-6 text-white text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/20 ring-1 ring-sky-400/40">
            <Shield className="h-8 w-8 text-sky-400" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            ระบบตรวจรถยนต์ส่วนกลาง
          </h2>
          <p className="mt-1 text-xs text-sky-200">
            รถกู้ชีพ BLS (Basic Life Support) ส่วนกลาง
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Role selector tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              เลือกระดับการเข้าใช้งาน:
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('staff');
                  setShowCustomForm(false);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                  selectedRole === 'staff'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                พนักงานทั่วไป (Staff)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('admin');
                  setShowCustomForm(false);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  selectedRole === 'admin'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Lock className="h-3 w-3 text-sky-500" />
                <span>ผู้ดูแลระบบ (Admin)</span>
              </button>
            </div>
          </div>

          {/* Registered Staff List Selector */}
          {!showCustomForm ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  เลือกบัญชีเจ้าหน้าที่ประจำการ ({staffByRole.length} ท่าน):
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomForm(true)}
                  className="text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
                >
                  + ระบุชื่อเจ้าหน้าที่ใหม่
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {staffByRole.length > 0 ? (
                  <>
                    {staffByRole.map((staff) => (
                      <div
                        key={staff.id}
                        onClick={() => handleSelectStaff(staff)}
                        className="group cursor-pointer rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition-all hover:border-sky-400 hover:bg-sky-50/50 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-sky-500"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sky-600 shadow-xs dark:bg-slate-700 dark:text-sky-400">
                              {staff.role === 'admin' ? (
                                <Shield className="h-4 w-4" />
                              ) : (
                                <User className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-sky-600">
                                {staff.name}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {staff.position || 'เจ้าหน้าที่กู้ชีพ'} · รหัส {staff.employeeId}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                staff.status === 'on_leave'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              {staff.status === 'on_leave' ? 'พักเวร' : 'พร้อมปฏิบัติงาน'}
                            </span>
                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                              <Phone className="h-2.5 w-2.5" />
                              <span>{staff.phone || '-'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : selectedRole === 'admin' ? (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 text-center dark:border-sky-900/60 dark:bg-sky-950/30">
                    <Shield className="mx-auto h-9 w-9 text-sky-600 dark:text-sky-400 mb-2" />
                    <p className="text-xs font-bold text-slate-800 dark:text-white">
                      {googleUser
                        ? `เข้าสู่ระบบผู้ดูแลระบบ (${googleUser.email})`
                        : 'เข้าสู่ระบบในฐานะผู้ดูแลระบบ (Admin)'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {googleUser
                        ? 'ไม่พบรายชื่อ Admin ในชีตเดิม กดปุ่มด้านล่างเพื่อเข้าใช้งานสิทธิ์ Admin และบันทึกลงระบบได้ทันที'
                        : 'ยืนยันสิทธิ์ผ่านบัญชี Google (Gmail) หรือรหัสความปลอดภัย เพื่อเข้าจัดการระบบและดึงข้อมูลจาก Sheets & Drive'}
                    </p>
                    <div className="mt-3.5 flex flex-col sm:flex-row items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleQuickAdminLogin}
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-500 transition-all"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        <span>เข้าสู่ระบบด้วย Admin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCustomForm(true)}
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <span>+ ระบุชื่อ Admin ใหม่</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-slate-800 dark:bg-slate-800/40">
                    <UserCheck className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      ยังไม่มีรายชื่อเจ้าหน้าที่ในระบบ
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      ระบบจะโหลดข้อมูลจริงจาก Google Sheets & Drive เมื่อเชื่อมต่อบัญชี Google
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCustomForm(true)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-500"
                    >
                      <span>+ ระบุชื่อเข้าใช้งาน</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Custom form */
            <form onSubmit={handleCustomLogin} className="space-y-3.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  กรอกข้อมูลเจ้าหน้าที่:
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="text-xs text-slate-500 hover:underline"
                >
                  กลับไปเลือกจากรายชื่อ
                </button>
              </div>

              {customError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {customError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ชื่อ-นามสกุล ผู้ตรวจ (Uploader Name)
                </label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="เช่น วิภาวัลย์ แจ่มใส (EMT-B)"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  รหัสประจำตัวพนักงาน / สังกัด
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="เช่น EMT-67089"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-mono text-xs text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <button
                type="submit"
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
              >
                <span>เข้าสู่ระบบตรวจรถ</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          )}

          {/* Google Workspace Sign-In section */}
          {onGoogleLogin && (
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800 text-center">
              {googleUser ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <div className="flex items-center gap-2 truncate">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">เชื่อมต่อ Google แล้ว ({googleUser.email})</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                    Auto-Sync Active
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onGoogleLogin({ type: 'login_view' })}
                  disabled={isGoogleLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-all"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>
                    {isGoogleLoading
                      ? 'กำลังเชื่อมต่อและดึงข้อมูลคืน...'
                      : 'ลงชื่อเข้าใช้ Google & ดึงข้อมูลคืน (Sync Back อัตโนมัติ)'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Admin Security Auth Modal */}
      {adminAuthModalOpen && (
        <AdminAuthModal
          isOpen={adminAuthModalOpen}
          onClose={() => {
            setAdminAuthModalOpen(false);
            setPendingAdminUser(null);
          }}
          onSuccess={() => {
            setAdminAuthModalOpen(false);
            if (pendingAdminUser) {
              onLogin(pendingAdminUser);
              setPendingAdminUser(null);
            }
          }}
          onGoogleLogin={onGoogleLogin || (async () => {})}
          isGoogleLoading={isGoogleLoading}
          googleUser={googleUser}
          targetUserName={pendingAdminUser?.name}
          targetUser={pendingAdminUser}
        />
      )}
    </div>
  );
};
