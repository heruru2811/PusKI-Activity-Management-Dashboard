import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { auth, googleProvider } from "../firebase";

function getFirebaseAuthErrorMessage(code?: string): string {
  switch (code) {
    case "auth/popup-closed-by-user":
      return "Jendela login Google ditutup sebelum proses selesai. Silakan coba lagi.";
    case "auth/cancelled-popup-request":
      return "Permintaan login sebelumnya dibatalkan. Silakan klik tombol masuk kembali.";
    case "auth/popup-blocked":
      return "Pop-up login diblokir oleh browser. Izinkan pop-up untuk situs ini lalu coba lagi.";
    case "auth/unauthorized-domain":
      return `Domain aplikasi ini (${window.location.hostname}) belum terdaftar di Authorized Domains pada Firebase Console proyek Anda.`;
    case "auth/network-request-failed":
      return "Koneksi jaringan gagal saat menghubungi layanan autentikasi Google.";
    default:
      return "Gagal masuk dengan akun Google. Silakan periksa konfigurasi Firebase Authentication dan coba kembali.";
  }
}

export function LoginView() {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      setErrorMsg(getFirebaseAuthErrorMessage(firebaseErr?.code));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between px-4 py-8 sm:px-6">
      {/* Top Institutional Wordmark */}
      <div className="mx-auto w-full max-w-md flex items-center justify-center gap-3 pt-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0B1F3A] text-white font-bold text-sm tracking-tight">
          PK
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-[#0B1F3A]">
            PusKI Activity Management Dashboard
          </p>
          <p className="text-xs text-slate-500">
            Kementerian Komunikasi dan Digital
          </p>
        </div>
      </div>

      {/* Centered Login Card */}
      <main className="mx-auto w-full max-w-md my-auto py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A]">
              Masuk ke Dashboard PusKI
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Gunakan akun Google Anda untuk mengakses perencanaan, pemantauan kegiatan, dan fitur AI Activity Planner Pusat Kelembagaan Internasional.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800 leading-relaxed"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 hover:border-slate-400 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#1D4ED8]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8]" aria-hidden="true" />
                <span>Menghubungkan ke Google...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Masuk dengan Google</span>
              </>
            )}
          </button>

          <div className="border-t border-slate-100 pt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-[#1D4ED8] shrink-0" aria-hidden="true" />
            <span>Autentikasi dilindungi oleh Firebase Authentication</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400">
        Pusat Kelembagaan Internasional · Kementerian Komunikasi dan Digital RI
      </footer>
    </div>
  );
}
