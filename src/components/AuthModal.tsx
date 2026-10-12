import React, { useState } from 'react';
import { X, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TvcLogo } from './TvcLogo.tsx';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any, token: string) => void;
  onGoogleLogin: () => Promise<boolean | void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onGoogleLogin,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }
      onLoginSuccess(data.user, data.sessionToken);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (u: string, p: string = 'venture2026') => {
    setIdentifier(u);
    setPassword(p);
    setError(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Brand Header with Club Logo */}
            <div className="flex flex-col items-center text-center space-y-2 pt-2">
              <TvcLogo size="xl" />
              <h2 className="text-2xl font-bold font-sans text-zinc-950 tracking-tight mt-1">
                Sign In to The Venture Club ERP
              </h2>
              <p className="text-xs text-zinc-500 max-w-xs">
                Authenticated role-based access to the Club ERP, Attendance Station, and Member Portal.
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Username & Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Username or College Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. arjun or anandhish"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-950 focus:outline-none focus:border-zinc-900 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-950 focus:outline-none focus:border-zinc-900 focus:bg-white transition-colors font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-bold text-white bg-zinc-950 rounded-lg hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In with Credentials'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-zinc-200"></div>
              <span className="shrink mx-3 text-[11px] font-mono text-zinc-400 uppercase">
                Or continue with
              </span>
              <div className="grow border-t border-zinc-200"></div>
            </div>

            {/* Google OAuth Button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await onGoogleLogin();
                    if (res !== false) {
                      onClose();
                    }
                  } catch (err: any) {
                    if (
                      err?.code !== 'auth/popup-closed-by-user' &&
                      err?.code !== 'auth/cancelled-popup-request'
                    ) {
                      setError(err?.message || 'Google sign-in failed.');
                    }
                  }
                }}
                className="gsi-material-button w-full"
              >
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg viewBox="0 0 48 48" style={{ display: 'block' }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">Sign in with Google</span>
                </div>
              </button>
            </div>

            {/* Quick Role Login Accounts for All 9 Club Roles */}
            <div className="pt-2 border-t border-zinc-100 text-[11px] text-zinc-500 space-y-1.5">
              <div className="font-semibold text-zinc-700">
                Sign-In Credentials by Role (Password: <span className="font-mono">venture2026</span>):
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => fillDemoAccount('arjun')}
                  className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded font-mono cursor-pointer font-semibold transition-colors"
                >
                  arjun (Arjun Mehta · Super Admin)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('anandhish')}
                  className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded font-mono cursor-pointer font-semibold transition-colors"
                >
                  anandhish (President)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('ananya')}
                  className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded font-mono cursor-pointer transition-colors"
                >
                  ananya (Vice President)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('dev')}
                  className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded font-mono cursor-pointer transition-colors"
                >
                  dev (Secretary)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('maya')}
                  className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded font-mono cursor-pointer transition-colors"
                >
                  maya (Admin)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('elena')}
                  className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded font-mono cursor-pointer transition-colors"
                >
                  elena (Project Lead)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('rohan')}
                  className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-mono cursor-pointer font-medium transition-colors"
                >
                  rohan (Attendance Head)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('dhruv_venture')}
                  className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded font-mono cursor-pointer transition-colors"
                >
                  dhruv_venture (Media Head)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('kabir')}
                  className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded font-mono cursor-pointer transition-colors"
                >
                  kabir (Member)
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
