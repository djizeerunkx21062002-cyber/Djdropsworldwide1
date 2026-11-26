import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const BOOTSTRAPPED_ADMIN_EMAIL = 'djizeerunkx21062002@gmail.com';
export const FIREBASE_AUTH_PROVIDERS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

export function isOperationNotAllowedError(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  return code === 'auth/operation-not-allowed';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

export function formatFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const msg = err instanceof Error ? err.message : String(err || '');

  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is disabled in Firebase Console. Enable it under Authentication -> Sign-in method, or use Google Sign-In now.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Please switch to Sign In instead.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Invalid email or password. Double-check your credentials or use Google Sign-In.';
  }
  if (code === 'auth/weak-password') {
    return 'Password should be at least 6 characters long.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Sign-in popup was closed before finishing.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Browser blocked the sign-in popup. Please allow popups for this site and retry.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment before trying again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while contacting authentication service. Check your connection.';
  }
  return msg || 'Authentication failed. Please try again.';
}

export async function signInWithGoogle(loginHint?: string) {
  const params: Record<string, string> = { prompt: 'select_account' };
  if (loginHint) {
    params.login_hint = loginHint;
  }
  googleProvider.setCustomParameters(params);
  return signInWithPopup(auth, googleProvider);
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const cleanName = displayName.trim().slice(0, 100);
  if (cleanName) {
    await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
  }
  await sendEmailVerification(cred.user).catch(() => {});
  return cred;
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function resetPasswordEmail(email: string) {
  return sendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmail() {
  if (!auth.currentUser) throw new Error('No active signed-in user.');
  return sendEmailVerification(auth.currentUser);
}

export async function signOutUser() {
  return signOut(auth);
}
