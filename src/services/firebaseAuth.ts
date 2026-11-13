import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, UserRole } from '../types';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

const TOKEN_STORAGE_KEY = 'bls_google_access_token_v1';
const TOKEN_TIME_KEY = 'bls_google_token_time_v1';
const REDIRECT_INTENT_KEY = 'bls_redirect_login_intent_v1';
const LOGGED_OUT_KEY = 'bls_is_logged_out_v1';

export interface RedirectLoginIntent {
  type: 'login_view' | 'admin_auth' | 'sheets_modal' | 'sync';
  role?: UserRole;
  targetUser?: UserProfile;
  timestamp: number;
}

export interface GoogleSignInResult {
  user?: User;
  accessToken?: string;
  redirected?: boolean;
}

let cachedAccessToken: string | null = (() => {
  try {
    const saved = localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const savedTime = Number(localStorage.getItem(TOKEN_TIME_KEY) || 0);
    if (saved && savedTime && Date.now() - savedTime < 3500 * 1000) {
      return saved;
    }
  } catch (_) {}
  return null;
})();

export const saveToken = (token: string) => {
  cachedAccessToken = token;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(TOKEN_TIME_KEY, String(Date.now()));
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (_) {}
};

export const clearToken = () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_TIME_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (_) {}
};

export const saveRedirectIntent = (intent: Omit<RedirectLoginIntent, 'timestamp'>) => {
  try {
    const payload: RedirectLoginIntent = {
      ...intent,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(REDIRECT_INTENT_KEY, JSON.stringify(payload));
  } catch (_) {}
};

export const consumeRedirectIntent = (): RedirectLoginIntent | null => {
  try {
    const raw = sessionStorage.getItem(REDIRECT_INTENT_KEY);
    sessionStorage.removeItem(REDIRECT_INTENT_KEY);
    if (!raw) return null;
    const parsed: RedirectLoginIntent = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > 10 * 60 * 1000) {
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
};

export const setLoggedOutFlag = (loggedOut: boolean) => {
  try {
    if (loggedOut) {
      sessionStorage.setItem(LOGGED_OUT_KEY, '1');
    } else {
      sessionStorage.removeItem(LOGGED_OUT_KEY);
    }
  } catch (_) {}
};

export const getLoggedOutFlag = (): boolean => {
  try {
    return sessionStorage.getItem(LOGGED_OUT_KEY) === '1';
  } catch (_) {
    return false;
  }
};

export type FirebaseAuthFriendlyError = Error & {
  code?: string;
  unauthorizedDomain?: string;
};

export const formatFirebaseAuthError = (error: any): FirebaseAuthFriendlyError => {
  const code = error?.code || '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  let message = error?.message || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้';

  if (code === 'auth/unauthorized-domain') {
    message = `โดเมน "${host}" ยังไม่ได้รับอนุญาตใน Firebase (${firebaseConfig.projectId}) กรุณาเพิ่มโดเมนนี้ใน Firebase Console > Authentication > Settings > Authorized domains (หรือใช้รหัสความปลอดภัย Admin ชั่วคราว)`;
  } else if (code === 'auth/popup-blocked') {
    message = 'เบราว์เซอร์บล็อกหน้าต่างป๊อปอัพ กรุณาอนุญาตป๊อปอัพสำหรับเว็บไซต์นี้ หรือเปิดใช้งานแบบเต็มหน้าจอ';
  } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    message = 'การเข้าสู่ระบบด้วย Google ถูกปิดหรือยกเลิกก่อนเสร็จสมบูรณ์';
  } else if (code === 'auth/operation-not-allowed') {
    message = `ยังไม่ได้เปิดใช้งาน Google Sign-in ใน Firebase Console (${firebaseConfig.projectId}) > Authentication > Sign-in method`;
  } else if (code === 'auth/network-request-failed') {
    message = 'ไม่สามารถเชื่อมต่อบริการยืนยันตัวตน Google ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
  }

  const formatted = new Error(message) as FirebaseAuthFriendlyError;
  formatted.code = code;
  if (code === 'auth/unauthorized-domain' && host) {
    formatted.unauthorizedDomain = host;
  }
  return formatted;
};

let pendingRedirectError: FirebaseAuthFriendlyError | null = null;
let redirectResultConsumed = false;

const redirectResultPromise: Promise<{ user: User; accessToken: string } | null> = (async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || '';
      if (token) {
        saveToken(token);
      }
      return { user: result.user, accessToken: token };
    }
    return null;
  } catch (error: any) {
    console.warn('Google Sign-in redirect result warning:', error?.code || error?.message);
    pendingRedirectError = formatFirebaseAuthError(error);
    return null;
  }
})();

export const consumeRedirectError = (): FirebaseAuthFriendlyError | null => {
  const err = pendingRedirectError;
  pendingRedirectError = null;
  return err;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string, isFromRedirect?: boolean) => void,
  onAuthFailure?: (error?: FirebaseAuthFriendlyError | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    const redirectRes = await redirectResultPromise;
    const redirectErr = consumeRedirectError();
    if (redirectErr && onAuthFailure) {
      onAuthFailure(redirectErr);
    }

    if (user) {
      const isFromRedirect = Boolean(
        !redirectResultConsumed && redirectRes && redirectRes.user.uid === user.uid
      );
      if (isFromRedirect) {
        redirectResultConsumed = true;
      }
      const token = redirectRes?.accessToken || (await getAccessToken()) || '';
      if (onAuthSuccess) onAuthSuccess(user, token, isFromRedirect);
    } else {
      clearToken();
      if (onAuthFailure) onAuthFailure(null);
    }
  });
};

export const isEmbeddedInIframe = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch (_) {
    return true;
  }
};

export const googleSignIn = async (options?: {
  intent?: Omit<RedirectLoginIntent, 'timestamp'>;
}): Promise<GoogleSignInResult | null> => {
  try {
    if (options?.intent) {
      saveRedirectIntent(options.intent);
    }

    // ใช้ signInWithPopup เป็นหลักทั้งบน AI Studio และ Vercel (ร่วมกับ COOP same-origin-allow-popups ใน vercel.json)
    // เพื่อหลีกเลี่ยงปัญหา Third-Party Storage Partitioning ที่ทำให้ getRedirectResult คืนค่า null เมื่อ authDomain เป็น firebaseapp.com
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่สามารถรับ Access Token จากการเข้าสู่ระบบ Google ได้ กรุณาลองใหม่อีกครั้ง');
    }

    saveToken(credential.accessToken);
    consumeRedirectIntent();
    return { user: result.user, accessToken: credential.accessToken, redirected: false };
  } catch (error: any) {
    // หากถูกบล็อกป๊อปอัพบนเบราว์เซอร์ปกติ (ไม่ได้อยู่ใน iframe) ให้สลับไปใช้ signInWithRedirect อัตโนมัติ
    if (error?.code === 'auth/popup-blocked' && !isEmbeddedInIframe()) {
      try {
        await signInWithRedirect(auth, provider);
        return { redirected: true };
      } catch (redirectErr: any) {
        consumeRedirectIntent();
        console.warn('Google Sign-in redirect fallback warning:', redirectErr?.code || redirectErr?.message);
        throw formatFirebaseAuthError(redirectErr);
      }
    }

    consumeRedirectIntent();
    console.warn('Google Sign-in warning:', error?.code || error?.message);
    throw formatFirebaseAuthError(error);
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  await redirectResultPromise;
  if (cachedAccessToken) {
    try {
      const savedTime = Number(localStorage.getItem(TOKEN_TIME_KEY) || 0);
      if (savedTime && Date.now() - savedTime > 3500 * 1000) {
        clearToken();
        return null;
      }
    } catch (_) {}
    return cachedAccessToken;
  }
  try {
    const saved = localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const savedTime = Number(localStorage.getItem(TOKEN_TIME_KEY) || 0);
    if (saved && savedTime && Date.now() - savedTime < 3500 * 1000) {
      cachedAccessToken = saved;
      return saved;
    }
  } catch (_) {}
  return null;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  clearToken();
};

