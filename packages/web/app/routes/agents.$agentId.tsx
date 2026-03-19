import { useQuery } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useParams, Link, Outlet, useLocation } from "react-router";
import { Bot } from "lucide-react";
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
      <div className="flex h-screen bg-zinc-950">
        <div className="w-64 border-r border-zinc-800 animate-pulse bg-zinc-900" />
        <div className="flex-1 animate-pulse" />
      </div>
    );
  }

  if (agent === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Bot className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 mb-4">Agent not found</p>
          <Link
            to="/"
            className="text-sm text-zinc-300 hover:text-zinc-100 underline underline-offset-4"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950">
      {isSettings ? (
        <SettingsSidebar
          agent={agent}
          activeSection={settingsSection}
          onSectionChange={setSettingsSection}
        />
      ) : (
        <AgentSidebar agent={agent} />
      )}
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet context={{ agent, settingsSection, setSettingsSection }} />
      </main>
    </div>
  );
}
