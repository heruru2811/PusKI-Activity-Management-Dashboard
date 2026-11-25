import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class FirestoreErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || "Terjadi gangguan sinkronisasi data.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application ErrorBoundary caught:", error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let friendlyDetail =
      "Terjadi kendala saat mengakses Cloud Firestore. Pastikan koneksi internet aktif dan hak akses akun Anda sudah sesuai.";

    try {
      const parsed = JSON.parse(this.state.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed?.error) {
        friendlyDetail = `${parsed.error} (${parsed.operationType ?? "akses"} pada ${parsed.path ?? "database"})`;
      }
    } catch {
      if (this.state.message) {
        friendlyDetail = this.state.message;
      }
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900">
                Gangguan Akses Data Firestore
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {friendlyDetail}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#13325C]"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Muat Ulang Aplikasi</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
