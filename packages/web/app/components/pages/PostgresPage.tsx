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
      dot: "bg-accent animate-pulse",
      text: "text-accent",
      label: "Connected",
      iconColor: "text-accent",
    },
    error: {
      dot: "bg-danger",
      text: "text-danger",
      label: "Connection error",
      iconColor: "text-danger",
    },
    disconnected: {
      dot: "bg-ink-faint",
      text: "text-ink-muted",
      label: "Disconnected",
      iconColor: "text-ink-faint",
    },
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b border-rule px-6 py-4 flex items-center gap-3 shrink-0">
        <Database className="h-4 w-4 text-ink-muted" strokeWidth={1.5} />
        <div>
          <p className="eyebrow">PostgreSQL</p>
          <p className="text-xs text-ink-faint">{tab.label}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto">
          {dbConnection === undefined ? (
            <div className="h-40 border border-rule bg-surface-sunken animate-pulse" />
          ) : dbConnection ? (
            /* Connected state */
            <div className="border border-rule bg-surface overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 border border-rule bg-surface-sunken flex items-center justify-center shrink-0">
                      <Database
                        className={`h-5 w-5 ${
                          statusConfig[dbConnection.status]?.iconColor ?? statusConfig.disconnected.iconColor
                        }`}
                        strokeWidth={1.5}
                      />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-ink">
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
                    className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-danger px-3 py-2 hover:bg-danger/5 transition-all"
                  >
                    <Unplug className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Disconnect
                  </button>
                </div>

                <div className="text-xs text-ink-faint bg-surface-sunken border border-rule p-3.5 font-mono">
                  postgresql://****:****@****
                </div>
              </div>

              <div className="border-t border-rule px-6 py-4 bg-surface-sunken">
                <div className="flex items-start gap-2.5">
                  <Shield className="h-4 w-4 text-ink-faint mt-0.5 shrink-0" strokeWidth={1.5} />
                  <div>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Your agent can query this database using read-only SELECT
                      statements during conversations.
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-ink-faint">
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
            <div className="border border-rule bg-surface p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 border border-rule bg-surface-sunken flex items-center justify-center">
                  <Plug className="h-5 w-5 text-ink-muted" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-semibold text-sm text-ink">
                    Connect PostgreSQL Database
                  </div>
                  <div className="text-xs text-ink-faint">
                    Your agent will have read-only access
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <p className="eyebrow">Display Name</p>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="My Database"
                    className="w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="eyebrow">Connection String</p>
                  <input
                    type="password"
                    value={connString}
                    onChange={(e) => setConnString(e.target.value)}
                    placeholder="postgresql://user:pass@host:5432/db"
                    className="w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm font-mono text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 mt-4 border border-danger/30 bg-danger/5 p-3">
                  <AlertCircle className="h-4 w-4 text-danger shrink-0" strokeWidth={1.5} />
                  <p className="text-xs text-danger">{error}</p>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={connecting || !connString.trim() || !displayName.trim()}
                className="mt-6 w-full bg-ink text-surface px-4 py-2.5 text-xs font-semibold hover:opacity-90 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
              >
                {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
                {connecting ? "Connecting…" : "Connect Database"}
              </button>

              <div className="flex items-start gap-2 mt-4 p-3 bg-surface-sunken border border-rule">
                <Shield className="h-3.5 w-3.5 text-ink-faint mt-0.5 shrink-0" strokeWidth={1.5} />
                <p className="text-[10px] text-ink-faint leading-relaxed">
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
