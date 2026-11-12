import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  ChevronDown,
  Eye,
  EyeOff,
  Inbox,
  LoaderCircle,
  LogIn,
  Send,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { post, errorText } from '../../lib/api';
import { useRefreshSession, useSession } from '../../lib/session';
import { LogoMark } from '../../components/Logo';

export function LoginPage() {
  const { data: session } = useSession();
  const refresh = useRefreshSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await post('/auth/login', { email: email.trim(), password });
      await refresh();
      const next = params.get('next');
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const appName = session?.instanceName ?? 'Maildock';

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#241e1c] p-3 sm:p-5 lg:p-8 font-sans select-none selection:bg-rose-500 selection:text-white">
      {/* Ambient background glow & atmospheric vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#382d28] via-[#201a18] to-[#120f0e]" />
      <div className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-orange-600/10 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-rose-600/10 blur-[140px]" />

      {/* Main Dual-Panel Card: locked max dimensions, never causes page scrolling */}
      <div className="relative z-10 flex h-full max-h-[580px] sm:max-h-[620px] lg:max-h-[640px] w-full max-w-[420px] lg:max-w-[1040px] flex-col lg:flex-row overflow-hidden rounded-[28px] sm:rounded-[34px] lg:rounded-[38px] border border-white/10 bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]">

        {/* ================= LEFT HERO PANEL (Desktop only, 0 height on mobile to guarantee no-scroll) ================= */}
        <div className="relative hidden lg:flex lg:w-[48%] flex-col justify-between overflow-hidden bg-[#181514] p-8 xl:p-11 text-white shrink-0">

          {/* Subtle concentric decorative rings behind the device */}
          <div className="pointer-events-none absolute top-[58%] left-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04]" />
          <div className="pointer-events-none absolute top-[58%] left-1/2 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.03]" />

          {/* Top text block */}
          <div className="relative z-10 shrink-0">
            <p className="text-[12px] font-normal tracking-wide text-stone-400">
              Global email made simple – modern business email for you.
            </p>
            <h1 className="mt-3 text-3xl lg:text-[42px] xl:text-[48px] font-bold tracking-tight text-white leading-[1.08]">
              Manage<br />your email
            </h1>
          </div>

          {/* Device Mockup with activity graph - smoothly scaled to prevent overflow */}
          <div className="relative z-10 my-auto flex items-center justify-center py-2 shrink">
            <div className="relative w-[215px] xl:w-[230px] transform -rotate-3 transition-transform hover:rotate-0 duration-500">

              {/* Smartphone Chassis */}
              <div className="relative rounded-[36px] bg-gradient-to-b from-stone-700 via-stone-800 to-stone-900 p-[3px] shadow-[0_18px_45px_rgba(0,0,0,0.85)] border border-white/15">
                <div className="relative overflow-hidden rounded-[33px] bg-[#0c0a09] p-3.5 text-white">

                  {/* Dynamic Island */}
                  <div className="mx-auto mb-2.5 h-3.5 w-16 rounded-full bg-black/90 border border-white/10" />

                  {/* Header info */}
                  <div className="flex items-center justify-between text-[9.5px] text-stone-400">
                    <span>Week 4 · 12 July</span>
                    <span className="flex items-center gap-1 font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      Live
                    </span>
                  </div>

                  {/* Metric display */}
                  <div className="mt-1.5 text-xl font-bold tracking-tight text-white">
                    897.00 <span className="text-[11px] font-normal text-stone-400">msg</span>
                  </div>

                  {/* Activity Bar Chart (gradient red/orange) */}
                  <div className="mt-3 flex h-11 items-end justify-between gap-1 px-0.5">
                    {[
                      { h: '45%', day: 'M' },
                      { h: '70%', day: 'T' },
                      { h: '55%', day: 'W' },
                      { h: '90%', day: 'T' },
                      { h: '100%', day: 'F', active: true },
                      { h: '65%', day: 'S' },
                      { h: '40%', day: 'S' },
                    ].map((bar, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          style={{ height: bar.h }}
                          className={`w-full rounded-xs transition-all ${bar.active
                            ? 'bg-gradient-to-t from-orange-500 to-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]'
                            : 'bg-white/20'
                            }`}
                        />
                        <span className="text-[7.5px] font-medium text-stone-500">{bar.day}</span>
                      </div>
                    ))}
                  </div>

                  {/* Widgets: Inbox and Sent statistics */}
                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10.5px]">
                    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-2 backdrop-blur-sm">
                      <div className="flex items-center gap-1 text-stone-400">
                        <Inbox className="h-2.5 w-2.5 text-rose-400" />
                        <span>Inbox</span>
                      </div>
                      <div className="mt-0.5 font-semibold text-white">785.00</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-2 backdrop-blur-sm">
                      <div className="flex items-center gap-1 text-stone-400">
                        <Send className="h-2.5 w-2.5 text-orange-400" />
                        <span>Sent</span>
                      </div>
                      <div className="mt-0.5 font-semibold text-white">112.00</div>
                    </div>
                  </div>

                  {/* Mini Bottom Nav with glowing multicolored/red ring */}
                  <div className="mt-3 flex items-center justify-around border-t border-white/10 pt-2 text-stone-500">
                    <span className="h-1 w-1 rounded-full bg-stone-600" />
                    <div className="flex h-5 w-5 items-center justify-center rounded-full p-0.5" style={{ background: 'conic-gradient(from 0deg, #ff5722, #f43f5e, #ec4899, #ff5722)' }}>
                      <div className="h-full w-full rounded-full bg-[#0c0a09]" />
                    </div>
                    <span className="h-1 w-1 rounded-full bg-stone-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom branding detail */}
          <div className="relative z-10 flex items-center gap-2 shrink-0">
            <div className="flex h-5.5 w-5.5 items-center justify-center rounded-full border border-orange-500/40 text-[10px] font-bold text-orange-400">
              <ShieldCheck className="h-3 w-3 text-orange-500" />
            </div>
            <span className="text-[11.5px] text-stone-400">Cloudflare Edge Powered</span>
          </div>
        </div>

        {/* ================= RIGHT FORM PANEL (Clean White Container, fits 100% without scroll) ================= */}
        <div className="flex flex-1 flex-col justify-between bg-white p-6 sm:p-8 lg:p-11 xl:p-12 overflow-hidden">

          {/* Top Bar: Brand Logo & Sign Up link */}
          <div className="flex items-center justify-between shrink-0">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <LogoMark size={28} />
              <span className="text-xl font-bold tracking-tight text-zinc-900">{appName}</span>
            </div>
          </div>

          {/* Centered Sign In Form Area */}
          <div className="mx-auto my-auto w-full max-w-[350px] py-3 sm:py-5">
            <h2 className="mb-5 sm:mb-6 text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
              Sign In
            </h2>

            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="flex flex-col gap-3.5 sm:gap-4">
              {/* Email or Username input */}
              <div>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  inputMode="email"
                  required
                  autoFocus
                  placeholder="Email or Username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 sm:h-12 w-full rounded-full border border-zinc-200 bg-white px-4.5 text-base sm:text-[14px] text-zinc-900 placeholder:text-zinc-400 transition-all focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/10"
                />
              </div>

              {/* Password input */}
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 sm:h-12 w-full rounded-full border border-zinc-200 bg-white px-4.5 pr-11 text-base sm:text-[14px] text-zinc-900 placeholder:text-zinc-400 transition-all focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-700 active:bg-zinc-100"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Forgot password link */}
              <div>
                <Link
                  to="/recover"
                  className="text-xs sm:text-[12.5px] font-medium text-[#ea580c] transition-colors hover:text-[#c2410c] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Action Button (Pill shaped with vivid orange/rose gradient) */}
              <button
                type="submit"
                disabled={busy}
                className="mt-2 flex h-11 sm:h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff5a1f] via-[#f43f5e] to-[#ec4899] text-base sm:text-[14.5px] font-semibold text-white shadow-[0_8px_20px_-4px_rgba(244,63,94,0.45)] transition-all hover:opacity-95 hover:shadow-[0_10px_24px_-4px_rgba(244,63,94,0.55)] active:scale-[0.98] disabled:opacity-70 cursor-pointer"
              >
                {busy ? (
                  <LoaderCircle className="h-4.5 w-4.5 animate-spin text-white" />
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Bottom Footer */}
          <div className="flex flex-col items-center justify-between gap-2 border-t border-zinc-100 pt-3.5 text-[11px] text-zinc-400 sm:flex-row shrink-0">
            <div>
              © 2005-2026 {appName} Inc.
            </div>
            <div className="flex items-center gap-4 text-zinc-500">
              <Link to="/recover" className="transition-colors hover:text-zinc-800">
                Contact Us
              </Link>
              <div className="flex items-center gap-1 font-medium text-zinc-600 cursor-pointer hover:text-zinc-900 transition-colors">
                <span>English</span>
                <ChevronDown className="h-3 w-3" />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
