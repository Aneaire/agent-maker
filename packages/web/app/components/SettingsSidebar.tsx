import { Link } from "react-router";
import {
  Bot,
  ChevronLeft,
  Settings,
  User,
  Cpu,
  ToggleRight,
  Plug,
  Wrench,
} from "lucide-react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";

const SETTINGS_SECTIONS = [
  {
    id: "general",
    label: "General",
    description: "Name, icon, and system prompt",
    icon: User,
  },
  {
    id: "models",
    label: "Models",
    description: "Enable or disable AI models",
    icon: Cpu,
  },
  {
    id: "capabilities",
    label: "Capabilities",
    description: "Core features and automation",
    icon: ToggleRight,
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Third-party services and credentials",
    icon: Plug,
  },
  {
    id: "tools",
    label: "Tools",
    description: "Custom HTTP tools and documents",
    icon: Wrench,
  },
];

export function SettingsSidebar({
  agent,
  activeSection,
  onSectionChange,
}: {
  agent: Doc<"agents">;
  activeSection: string;
  onSectionChange: (section: string) => void;
}) {
  return (
    <aside className="w-64 border-r border-zinc-800/50 flex flex-col bg-gradient-to-b from-zinc-950 to-zinc-900/50 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <Link
          to={`/agents/${agent._id}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-300 transition-colors mb-3 group"
        >
          <ChevronLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" />
          Back to Agent
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800/80 ring-1 ring-zinc-700/50">
            <Settings className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">Settings</div>
            <div className="text-xs text-zinc-500 truncate">{agent.name}</div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <nav className="flex-1 p-2 space-y-0.5">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-left transition-all ${
                isActive
                  ? "bg-neon-400/10 text-neon-400 shadow-sm border-l-2 border-neon-400 pl-2.5"
                  : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">{section.label}</div>
                <div className={`text-[11px] mt-0.5 ${isActive ? "text-neon-400/60" : "text-zinc-600"}`}>
                  {section.description}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-zinc-800/50">
        <Link
          to={`/agents/${agent._id}`}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-300 transition-all"
        >
          <Bot className="h-4 w-4" />
          Back to Agent
        </Link>
      </div>
    </aside>
  );
}
