import { FormEvent, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Lock,
  Mail,
  Shield,
  UserPlus,
  X,
} from 'lucide-react';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  FIREBASE_AUTH_PROVIDERS_URL,
  formatFirebaseAuthError,
  isOperationNotAllowedError,
  resendVerificationEmail,
  resetPasswordEmail,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../firebase';

export type AuthModalTab = 'signin' | 'signup' | 'admin';

interface AuthModalProps {
  open: boolean;
  initialTab?: AuthModalTab;
  onClose: () => void;
  user?: User | null;
  onSuccess?: (user: User, tab: AuthModalTab) => void;
  onOpenAdminConsole?: () => void;
}

export function AuthModal({
  open,
  initialTab = 'signin',
  onClose,
  user,
  onSuccess,
  onOpenAdminConsole,
}: AuthModalProps) {
  const [tab, setTab] = useState<AuthModalTab>(initialTab);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState(BOOTSTRAPPED_ADMIN_EMAIL);
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [providerDisabled, setProviderDisabled] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setErrorMsg('');
      setInfoMsg('');
      setProviderDisabled(false);
      if (initialTab === 'admin') {
        setAdminEmail(BOOTSTRAPPED_ADMIN_EMAIL);
      }
    }
  }, [open, initialTab]);

  if (!open) return null;

  const isUnverifiedAdmin =
    Boolean(user) &&
    user?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
    !user?.emailVerified;

  const finishAuth = (signedInUser: User, usedTab: AuthModalTab = tab) => {
    setPassword('');
    setAdminPassword('');
    setErrorMsg('');
    setProviderDisabled(false);
    onSuccess?.(signedInUser, usedTab);
    onClose();
  };

  const handleAuthError = (err: unknown) => {
    if (isOperationNotAllowedError(err)) {
      setProviderDisabled(true);
      setErrorMsg('');
      return;
    }
    setProviderDisabled(false);
    setErrorMsg(formatFirebaseAuthError(err));
  };

  const handleGoogleSignIn = async (hintEmail?: string, usedTab: AuthModalTab = tab) => {
    setErrorMsg('');
    setInfoMsg('');
    setProviderDisabled(false);
    setLoading(true);
    try {
      const cred = await signInWithGoogle(hintEmail);
      finishAuth(cred.user, usedTab);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setProviderDisabled(false);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmail(email, password);
      finishAuth(cred.user, 'signin');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setProviderDisabled(false);
    if (displayName.trim().length < 2) {
      setErrorMsg('Please enter your DJ or studio name (at least 2 characters).');
      return;
    }
    if (!email.trim() || password.length < 6) {
      setErrorMsg('Please enter a valid email and password (at least 6 characters).');
      return;
    }
    setLoading(true);
    try {
      const cred = await signUpWithEmail(email, password, displayName);
      finishAuth(cred.user, 'signup');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setProviderDisabled(false);
    if (!adminEmail.trim() || !adminPassword) {
      setErrorMsg('Enter your admin email and password, or use One-Click Admin Google Login above.');
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmail(adminEmail, adminPassword);
      finishAuth(cred.user, 'admin');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (targetEmail: string) => {
    setErrorMsg('');
    setInfoMsg('');
    const clean = targetEmail.trim();
    if (!clean) {
      setErrorMsg('Enter your email address first so we can send a reset link.');
      return;
    }
    setLoading(true);
    try {
      await resetPasswordEmail(clean);
      setInfoMsg(`Password reset email sent to ${clean}. Check your inbox or spam folder.`);
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      await resendVerificationEmail();
      setInfoMsg('Verification email sent. After confirming, reload the page or use Google Sign-In.');
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Account Authentication"
    >
      <div className="w-full max-w-md bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0B0D11] border-b border-zinc-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-100">
              {tab === 'admin'
                ? 'Direct Admin Login'
                : tab === 'signup'
                ? 'Create Quality DJ Drops Worldwide Account'
                : 'Sign In to Quality DJ Drops Worldwide 🌐'}
            </h2>
            <p className="text-xs text-zinc-400">
              {tab === 'admin'
                ? 'Authorized Super Admin & Studio Management Access'
                : 'Use Email & Password or Google to place orders, license & review'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-[#0E1117] border-b border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setTab('signin');
              setErrorMsg('');
              setInfoMsg('');
              setProviderDisabled(false);
            }}
            className={`py-2 px-2 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'signin'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signup');
              setErrorMsg('');
              setInfoMsg('');
              setProviderDisabled(false);
            }}
            className={`py-2 px-2 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'signup'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Sign Up</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('admin');
              setErrorMsg('');
              setInfoMsg('');
              setProviderDisabled(false);
            }}
            className={`py-2 px-2 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'admin'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {isUnverifiedAdmin && (
            <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-md space-y-2 text-xs text-amber-200">
              <div className="font-semibold">Admin Email Verification Needed</div>
              <p className="text-[11px] leading-relaxed">
                Signed in as {user?.email}. Firestore super-admin permissions require a verified email. Click One-Click Admin Google Login below for instant verification or resend the verification email.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={handleResendVerification}
                className="px-3 py-1.5 bg-amber-500 text-zinc-950 font-semibold rounded text-[11px]"
              >
                Resend Verification Email
              </button>
            </div>
          )}

          {providerDisabled && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/40 rounded-md space-y-2.5 text-xs">
              <div className="font-semibold text-amber-300">
                Enable Email/Password in Firebase Console
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Only Google Sign-In is enabled on this project by default. To use Email &amp; Password:
              </p>
              <ol className="text-[11px] text-zinc-300 space-y-1 list-decimal list-inside">
                <li>Open Authentication &rarr; Sign-in method in Firebase Console</li>
                <li>Click <span className="font-semibold text-zinc-100">Add new provider</span> &rarr; <span className="font-semibold text-zinc-100">Email/Password</span></li>
                <li>Switch <span className="font-semibold text-zinc-100">Enable</span> on and click <span className="font-semibold text-zinc-100">Save</span></li>
              </ol>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={FIREBASE_AUTH_PROVIDERS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B0D11] border border-zinc-700 hover:border-amber-500 text-zinc-100 font-medium rounded text-[11px]"
                >
                  <span>Open Firebase Auth Providers</span>
                  <ExternalLink className="w-3 h-3 text-amber-400" />
                </a>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    handleGoogleSignIn(
                      tab === 'admin' ? BOOTSTRAPPED_ADMIN_EMAIL : undefined,
                      tab
                    )
                  }
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded text-[11px]"
                >
                  Continue with Google Now
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-300 leading-relaxed">
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs text-emerald-300 flex items-start gap-2 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {tab === 'signin' && (
            <div className="space-y-4">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleGoogleSignIn()}
                className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                <div className="h-px flex-1 bg-zinc-800" />
                <span>or sign in with email</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="dj@example.com"
                      className="w-full pl-9 pr-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-zinc-400">Password</label>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleForgotPassword(email)}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                >
                  {loading ? 'Signing In...' : 'Sign In with Email'}
                </button>
              </form>
            </div>
          )}

          {tab === 'signup' && (
            <div className="space-y-4">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleGoogleSignIn()}
                className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Sign Up with Google</span>
              </button>

              <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                <div className="h-px flex-1 bg-zinc-800" />
                <span>or create account with email</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              <form onSubmit={handleEmailSignUp} className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">DJ / Studio Name</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. DJ Flamezy Official"
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="dj@example.com"
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Password (min 6 chars)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            </div>
          )}

          {tab === 'admin' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#0B0D11] border border-amber-500/30 rounded-md text-xs text-zinc-300 space-y-1">
                <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Direct Studio Admin Access</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Super Admin account (<span className="font-mono text-zinc-200">{BOOTSTRAPPED_ADMIN_EMAIL}</span>) or authorized team admins can log in directly below.
                </p>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleGoogleSignIn(BOOTSTRAPPED_ADMIN_EMAIL)}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>One-Click Admin Google Login</span>
              </button>

              <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                <div className="h-px flex-1 bg-zinc-800" />
                <span>or admin email &amp; password</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              <form onSubmit={handleAdminEmailSignIn} className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-zinc-400">Admin Password</label>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleForgotPassword(adminEmail)}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      Set / Reset Password
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                >
                  {loading ? 'Signing In...' : 'Direct Admin Email Sign In'}
                </button>
              </form>

              {onOpenAdminConsole && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdminConsole();
                  }}
                  className="w-full py-2 text-xs text-amber-400 hover:underline text-center"
                >
                  Open Dedicated Full-Screen Admin Login Console
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
