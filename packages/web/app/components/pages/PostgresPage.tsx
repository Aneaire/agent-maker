import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import {
  Database,
  Plug,
  Unplug,
  AlertCircle,
  Shield,
  Clock,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";

export function PostgresPage({ tab }: { tab: Doc<"sidebarTabs"> }) {
  const dbConnection = useQuery(api.agentDatabases.getByTab, {
    tabId: tab._id,
  });
  const connect = useMutation(api.agentDatabases.connect);
  const disconnect = useMutation(api.agentDatabases.disconnect);

  const [connString, setConnString] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    if (!connString.trim() || !displayName.trim()) return;
    setConnecting(true);
    setError("");
    try {
      await connect({
        tabId: tab._id,
        displayName: displayName.trim(),
        connectionString: connString.trim(),
      });
      setConnString("");
      setDisplayName("");
    } catch (err: any) {
      setError(err.message);
    }
    setConnecting(false);
  }

  const statusConfig = {
    connected: {
      dot: "bg-neon-400 animate-pulse",
      text: "text-neon-400",
      label: "Connected",
      iconBg: "bg-neon-950",
    },
    error: {
      dot: "bg-red-400",
      text: "text-red-400",
      label: "Connection error",
      iconBg: "bg-red-950",
    },
    disconnected: {
      dot: "bg-zinc-500",
      text: "text-zinc-400",
      label: "Disconnected",
      iconBg: "bg-zinc-800",
    },
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b border-zinc-800/60 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80">
          <Database className="h-4 w-4 text-zinc-300" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{tab.label}</h2>
          <p className="text-xs text-zinc-500">PostgreSQL connection</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto">
          {dbConnection === undefined ? (
            <div className="h-40 rounded-2xl bg-zinc-900/30 animate-pulse" />
          ) : dbConnection ? (
            /* Connected state */
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                        statusConfig[dbConnection.status]?.iconBg ?? statusConfig.disconnected.iconBg
                      }`}
                    >
                      <Database className="h-5 w-5 text-neon-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">
                        {dbConnection.displayName}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            statusConfig[dbConnection.status]?.dot ?? statusConfig.disconnected.dot
                          }`}
                        />
                        <span
                          className={`text-xs ${
                            statusConfig[dbConnection.status]?.text ?? statusConfig.disconnected.text
                          }`}
                        >
                          {statusConfig[dbConnection.status]?.label ?? "Unknown"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => disconnect({ dbId: dbConnection._id })}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-950/30 transition-all"
                  >
                    <Unplug className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                </div>

                <div className="text-xs text-zinc-600 bg-zinc-950 rounded-xl p-3.5 font-mono border border-zinc-800/40">
                  postgresql://****:****@****
                </div>
              </div>

              <div className="border-t border-zinc-800/40 px-6 py-4 bg-zinc-900/30">
                <div className="flex items-start gap-2.5">
                  <Shield className="h-4 w-4 text-zinc-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Your agent can query this database using read-only SELECT
                      statements during conversations.
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> 10s timeout
                      </span>
                      <span>· 1,000 row limit</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Setup state */
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800">
                  <Plug className="h-5 w-5 text-zinc-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm">
                    Connect PostgreSQL Database
                  </div>
                  <div className="text-xs text-zinc-500">
                    Your agent will have read-only access
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="My Database"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Connection String
                  </label>
                  <input
                    type="password"
                    value={connString}
                    onChange={(e) => setConnString(e.target.value)}
                    placeholder="postgresql://user:pass@host:5432/db"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-mono placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 mt-4 rounded-xl bg-red-950/30 border border-red-900/30 p-3">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={
                  connecting || !connString.trim() || !displayName.trim()
                }
                className="mt-5 w-full rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
                {connecting ? "Connecting..." : "Connect Database"}
              </button>

              <div className="flex items-start gap-2 mt-4 p-3 rounded-xl bg-zinc-800/30">
                <Shield className="h-3.5 w-3.5 text-zinc-600 mt-0.5 shrink-0" />
                <p className="text-[10px] text-zinc-600 leading-relaxed">
                  Credentials are stored securely and never exposed in agent
                  responses. Only read-only SELECT queries are allowed.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
