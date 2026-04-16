import { useQuery } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useParams, Link, Outlet, useLocation } from "react-router";
import { AgentSidebar } from "~/components/AgentSidebar";
import { SettingsSidebar } from "~/components/SettingsSidebar";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";
import { useState } from "react";

export default function AgentLayout() {
  const { agentId } = useParams();
  const location = useLocation();
  const isSettings = location.pathname.endsWith("/settings");
  const [settingsSection, setSettingsSection] = useState("general");
  const agent = useQuery(api.agents.get, {
    agentId: agentId as Id<"agents">,
  });

  if (agent === undefined) {
    return (
      <div className="flex h-screen bg-surface">
        <div className="w-64 border-r border-rule animate-pulse bg-surface-sunken" />
        <div className="flex-1 animate-pulse bg-surface" />
      </div>
    );
  }

  if (agent === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="max-w-sm px-8 text-left">
          <p className="eyebrow">404</p>
          <h1 className="mt-3 font-display text-3xl leading-tight text-ink">
            Agent not found.
          </h1>
          <p className="mt-3 text-sm text-ink-muted leading-relaxed">
            This agent may have been deleted, or the link is stale.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-strong transition-colors"
          >
            &larr; Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface">
      {isSettings ? (
        <SettingsSidebar
          agent={agent}
          activeSection={settingsSection}
          onSectionChange={setSettingsSection}
        />
      ) : (
        <AgentSidebar agent={agent} />
      )}
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        <Outlet context={{ agent, settingsSection, setSettingsSection }} />
      </main>
    </div>
  );
}
