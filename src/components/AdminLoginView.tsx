import { FormEvent, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  TrendingUp,
  Users,
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
  signOutUser,
} from '../firebase';
import { UserRole } from '../types';

interface AdminLoginViewProps {
  user: User | null;
  userRole: UserRole;
  onRefreshAuth: () => Promise<User | null>;
  onAdminAuthenticated: () => void;
  onGoToPortal: () => void;
  onBackToStorefront: () => void;
}

export function AdminLoginView({
  user,
  userRole,
  onRefreshAuth,
  onAdminAuthenticated,
  onGoToPortal,
  onBackToStorefront,
}: AdminLoginViewProps) {
  const [adminEmail, setAdminEmail] = useState(BOOTSTRAPPED_ADMIN_EMAIL);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [providerDisabled, setProviderDisabled] = useState(false);

  const isBootstrappedEmail =
    Boolean(user?.email) &&
    user?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
  const isUnverifiedAdmin = isBootstrappedEmail && !user?.emailVerified;
  const isAlreadyAdmin =
    userRole === 'admin' || (isBootstrappedEmail && Boolean(user?.emailVerified));
  const isSignedInAsNonAdmin = Boolean(user) && !isBootstrappedEmail && !isAlreadyAdmin;

  const handleGoogleAdminLogin = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setProviderDisabled(false);
    setLoading(true);
    try {
      const cred = await signInWithGoogle(BOOTSTRAPPED_ADMIN_EMAIL);
      if (
        cred.user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
        cred.user.emailVerified
      ) {
        onAdminAuthenticated();
      } else {
        await onRefreshAuth();
        setInfoMsg(
          `Signed in as ${cred.user.email || 'user'}. Ensure this account is assigned an active Admin role in Team & Roles.`
        );
      }
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setProviderDisabled(false);
    if (!adminEmail.trim() || !adminPassword) {
      setErrorMsg('Enter your administrator email and password.');
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmail(adminEmail, adminPassword);
      setAdminPassword('');
      const refreshed = await onRefreshAuth();
      const activeUser = refreshed || cred.user;
      if (
        activeUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
        !activeUser.emailVerified
      ) {
        setInfoMsg(
          'Signed in successfully. Verify your email address or click One-Click Admin Google Login above to unlock full Firestore admin privileges.'
        );
      } else {
        onAdminAuthenticated();
      }
    } catch (err) {
      if (isOperationNotAllowedError(err)) {
        setProviderDisabled(true);
      } else {
        setErrorMsg(formatFirebaseAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setErrorMsg('');
    setInfoMsg('');
    const target = adminEmail.trim();
    if (!target) {
      setErrorMsg('Enter your administrator email address first.');
      return;
    }
    setLoading(true);
    try {
      await resetPasswordEmail(target);
      setInfoMsg(
        `Password reset link sent to ${target}. Check your inbox or spam folder.`
      );
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
      setInfoMsg(
        'Verification link sent to your inbox. After clicking the link, press Refresh Verification Status below.'
      );
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      const updated = await onRefreshAuth();
      if (updated?.emailVerified) {
        onAdminAuthenticated();
      } else {
        setErrorMsg(
          'Email is still unverified. Click the verification link in your inbox or use Google Admin Sign-In for instant verification.'
        );
      }
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      await signOutUser();
      setInfoMsg('Signed out previous session. Ready for administrator login.');
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0B0D11] text-zinc-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 border border-zinc-800 rounded-xl overflow-hidden bg-[#12151C] shadow-2xl">
        {/* Left Executive Context Column */}
        <div className="lg:col-span-5 bg-[#0E1117] border-b lg:border-b-0 lg:border-r border-zinc-800 p-8 flex flex-col justify-between gap-8">
          <div className="space-y-6">
            <button
              type="button"
              onClick={onBackToStorefront}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Storefront</span>
            </button>

            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-400">
                <Shield className="w-4 h-4" />
                <span>Quality DJ Drops Worldwide 🌐 · Administration</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                Studio Executive Console
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Dedicated sign-in portal for catalog governance, global tax &amp; settlement ledgers, co-creator payout approvals, and storefront CMS publishing.
              </p>
            </div>

            <div className="divide-y divide-zinc-800/80 border-t border-b border-zinc-800/80">
              {[
                {
                  icon: TrendingUp,
                  title: 'Revenue & Fee Ledger',
                  desc: 'Real-time order analytics, 5% sale & 7% cashout fees, and jurisdiction VAT/GST reports.',
                },
                {
                  icon: SlidersHorizontal,
                  title: 'Catalog, Custom Briefs & CMS',
                  desc: 'Manage Deep male & Female voice drops, milestone queues, promo codes, and banners.',
                },
                {
                  icon: Users,
                  title: 'RBAC & Audit Governance',
                  desc: 'Control user roles, producer permissions, payout settlements, and immutable security logs.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="py-3.5 flex items-start gap-3">
                    <Icon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-zinc-100">{item.title}</div>
                      <div className="text-xs text-zinc-400 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-zinc-500 space-y-1">
            <div>Authorized Super Admin</div>
            <div className="font-mono text-zinc-300 truncate">{BOOTSTRAPPED_ADMIN_EMAIL}</div>
          </div>
        </div>

        {/* Right Sign-In Form Column */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
              Administrator Sign In
            </h2>
            <p className="text-xs text-zinc-400">
              Authenticate with verified Google Admin credentials or Email &amp; Password to open the Executive Dashboard.
            </p>
          </div>

          {isAlreadyAdmin && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verified Admin Session Active</span>
                </div>
                <div className="text-xs text-zinc-300 font-mono truncate">
                  {user?.email}
                </div>
              </div>
              <button
                type="button"
                onClick={onAdminAuthenticated}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Open Admin Dashboard
              </button>
            </div>
          )}

          {isUnverifiedAdmin && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-lg space-y-3">
              <div className="text-xs font-semibold text-amber-300">
                Email Verification Required for Full Admin Access
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                You are signed in as <span className="font-mono text-zinc-100">{user?.email}</span>, but this session is unverified. Firestore security rules require a verified email token for admin queries.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCheckVerification}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Verification Status</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleResendVerification}
                  className="px-3 py-1.5 bg-[#0B0D11] border border-zinc-700 hover:border-amber-500 text-zinc-200 text-xs font-medium rounded-md transition-colors"
                >
                  Resend Verification Email
                </button>
              </div>
            </div>
          )}

          {isSignedInAsNonAdmin && (
            <div className="p-4 bg-[#0B0D11] border border-zinc-700 rounded-lg space-y-3">
              <div className="text-xs font-semibold text-zinc-200">
                Signed in with non-admin account ({userRole})
              </div>
              <p className="text-xs text-zinc-400">
                Current session: <span className="font-mono text-zinc-200">{user?.email}</span>. Sign out to switch to an administrator account, or return to your studio portal.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSwitchAccount}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                >
                  Switch to Admin Account
                </button>
                <button
                  type="button"
                  onClick={onGoToPortal}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-md transition-colors"
                >
                  Open My Portal
                </button>
              </div>
            </div>
          )}

          {providerDisabled && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-lg space-y-2.5 text-xs">
              <div className="font-semibold text-amber-300">
                Enable Email/Password in Firebase Console
              </div>
              <p className="text-zinc-300 leading-relaxed">
                Google Sign-In is already active on this Firebase project, while Email/Password is still turned off in Authentication settings:
              </p>
              <ol className="text-zinc-300 space-y-1 list-decimal list-inside">
                <li>Open Authentication &rarr; Sign-in method in Firebase Console</li>
                <li>Click <span className="font-semibold text-zinc-100">Add new provider</span> &rarr; <span className="font-semibold text-zinc-100">Email/Password</span></li>
                <li>Turn <span className="font-semibold text-zinc-100">Enable</span> on and click <span className="font-semibold text-zinc-100">Save</span></li>
              </ol>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={FIREBASE_AUTH_PROVIDERS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B0D11] border border-zinc-700 hover:border-amber-500 text-zinc-100 font-medium rounded-md text-xs"
                >
                  <span>Open Firebase Auth Providers</span>
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                </a>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleAdminLogin}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-md text-xs"
                >
                  Sign In with Google Instead
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-300 leading-relaxed">
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs text-emerald-300 flex items-start gap-2 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleAdminLogin}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#09090B"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#09090B"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#09090B"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#09090B"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>One-Click Verified Google Admin Login</span>
          </button>

          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <div className="h-px flex-1 bg-zinc-800" />
            <span>or sign in with admin email &amp; password</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <form onSubmit={handleEmailAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="djizeerunkx21062002@gmail.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-400">Password</label>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handlePasswordReset}
                  className="text-xs text-amber-400 hover:underline"
                >
                  Set / Reset Password
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full pl-9 pr-10 py-2.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{loading ? 'Authenticating...' : 'Sign In to Admin Dashboard'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
