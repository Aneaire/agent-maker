import { Link } from "react-router";
import { ChevronLeft, User, Cpu, ToggleRight, Plug, Wrench } from "lucide-react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";

const SETTINGS_SECTIONS = [
  {
    id: "general",
    label: "General",
    description: "Name, icon, system prompt",
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
    description: "Third-party services",
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
    <aside className="w-64 border-r border-rule flex flex-col bg-surface shrink-0">
      <div className="px-5 pt-6 pb-5 border-b border-rule">
        <Link
          to={`/agents/${agent._id}`}
          className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-faint hover:text-ink-muted transition-colors group mb-4"
        >
          <ChevronLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </Link>
        <p className="eyebrow">Settings</p>
        <h2 className="mt-2 font-display text-xl leading-tight text-ink truncate">
          {agent.name}
        </h2>
      </div>

      <nav className="flex-1 py-3">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`grid grid-cols-[16px_1fr] gap-3 w-full px-5 py-3 text-left transition-colors ${
                isActive
                  ? "bg-surface-sunken text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon
                className={`h-4 w-4 mt-0.5 ${
                  isActive ? "text-accent" : "text-ink-faint"
                }`}
                strokeWidth={1.5}
              />
              <div className="min-w-0">
                <div className="text-sm leading-tight font-medium">
                  {section.label}
                </div>
                <div className="mt-0.5 text-2xs text-ink-faint leading-snug">
                  {section.description}
                </div>
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
