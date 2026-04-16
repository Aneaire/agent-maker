/**
 * DashboardView — Authenticated user's agent index.
 * Editorial refined-minimal: left-aligned, serif display heading,
 * flat row-list as primary layout (no identical card grids).
 */

import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { DashboardLayout } from "~/components/DashboardLayout";
import { AgentCard } from "~/components/AgentCard";
import { OnboardingOverlay } from "~/components/OnboardingOverlay";
import { Plus, LayoutGrid, List } from "lucide-react";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function PlanToggle() {
  const user = useQuery(api.users.me);
  const togglePlan = useMutation(api.users.togglePlan);
  const [toggling, setToggling] = useState(false);

  if (!user) return null;

  const isPro = user.plan === "pro" || user.plan === "enterprise";

  async function handleToggle() {
    setToggling(true);
    try {
      await togglePlan();
    } catch (err: any) {
      console.error("Failed to toggle plan:", err);
    }
    setToggling(false);
  }

  return (
    <button
      onClick={handleToggle}
      disabled={toggling}
      className="group inline-flex items-center gap-2 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-faint hover:text-ink-muted transition-colors"
      title={`Switch to ${isPro ? "free" : "pro"} plan`}
    >
      <span>{isPro ? "Pro" : "Free"}</span>
      <span className="relative h-[14px] w-7 rounded-full border border-rule-strong">
        <span
          className={`absolute top-[1px] h-[10px] w-[10px] rounded-full transition-[left] duration-200 ${
            isPro ? "left-[14px] bg-accent" : "left-[1px] bg-ink-faint"
          }`}
        />
      </span>
    </button>
  );
}

export default function DashboardView() {
  const agents = useQuery(api.agents.list);
  const user = useQuery(api.users.me);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [showOnboarding, setShowOnboarding] = useState(false);

  const visibleAgents = agents?.filter((a) => a.status !== "draft");

  useEffect(() => {
    if (
      user &&
      agents &&
      !user.hasCompletedOnboarding &&
      agents.filter((a) => a.status !== "draft").length === 0
    ) {
      setShowOnboarding(true);
    }
  }, [user, agents]);

  const filteredAgents = visibleAgents?.filter(
    (a) =>
      !searchQuery.trim() ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(_event: DragEndEvent) {
    // Reordering — visual only for now
  }

  return (
    <DashboardLayout>
      {showOnboarding && (
        <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
      )}

      {/* ── Header row: editorial asymmetry ─────────────────────────── */}
      <header className="flex items-start justify-between gap-8 mb-10">
        <div>
          <h1 className="font-display text-4xl leading-[1] tracking-tight text-ink">
            {getGreeting()}.
          </h1>
          {filteredAgents && (
            <p className="mt-3 text-sm text-ink-faint">
              <span className="text-ink-muted">
                {filteredAgents.length}{" "}
                {filteredAgents.length === 1 ? "agent" : "agents"}
              </span>
              {user && (
                <span> &middot; {user.maxAgents} max</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-6 pt-2">
          <PlanToggle />
          <Link
            to="/agents/new"
            className="inline-flex items-center gap-1.5 bg-ink text-ink-inverse text-sm font-medium px-4 py-2 rounded-sm hover:bg-ink-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            New agent
          </Link>
        </div>
      </header>

      {visibleAgents && visibleAgents.length > 0 && (
        <div className="mb-6 flex items-center justify-between gap-6 border-y border-rule py-3">
          <div className="flex-1 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none border-0"
            />
          </div>
          <div className="flex items-center gap-4 text-2xs uppercase tracking-[0.12em] font-semibold">
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 ${
                viewMode === "list"
                  ? "text-ink"
                  : "text-ink-faint hover:text-ink-muted"
              } transition-colors`}
            >
              <List className="h-3 w-3" strokeWidth={1.75} />
              List
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1.5 ${
                viewMode === "grid"
                  ? "text-ink"
                  : "text-ink-faint hover:text-ink-muted"
              } transition-colors`}
            >
              <LayoutGrid className="h-3 w-3" strokeWidth={1.75} />
              Grid
            </button>
          </div>
        </div>
      )}

      {/* ── Agent list ──────────────────────────────────────────────── */}
      {filteredAgents === undefined ? (
        <div className="space-y-[1px]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-surface-sunken animate-pulse" />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <EmptyState hasSearch={!!searchQuery} />
      ) : viewMode === "list" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredAgents.map((a) => a._id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="divide-y divide-rule border-b border-rule">
              {filteredAgents.map((agent, index) => (
                <AgentCard
                  key={agent._id}
                  agent={agent}
                  isDraggable
                  variant="row"
                  index={index + 1}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredAgents.map((a) => a._id)}
            strategy={rectSortingStrategy}
          >
            <div
              className="grid gap-x-10 gap-y-10"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
            >
              {filteredAgents.map((agent) => (
                <AgentCard
                  key={agent._id}
                  agent={agent}
                  isDraggable
                  variant="tile"
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </DashboardLayout>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="border-y border-rule py-24">
      <div className="max-w-md">
        {hasSearch ? (
          <>
            <h2 className="font-display text-2xl text-ink leading-tight">
              Nothing matches.
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Try a different search term, or clear the filter to see every agent.
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">Start here</p>
            <h2 className="mt-3 font-display text-3xl text-ink leading-tight">
              You haven&rsquo;t built an agent yet.
            </h2>
            <p className="mt-3 text-sm text-ink-muted leading-relaxed">
              An agent is a small, persistent assistant you configure once and
              point at a task. Describe what it should do and connect the tools
              it needs &mdash; HiGantic handles the rest.
            </p>
            <Link
              to="/agents/new"
              className="mt-6 inline-flex items-center gap-1.5 bg-ink text-ink-inverse text-sm font-medium px-4 py-2 rounded-sm hover:bg-ink-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Create your first agent
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
