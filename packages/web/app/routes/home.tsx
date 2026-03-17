import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { Show, SignInButton } from "@clerk/react";
import { DashboardLayout } from "~/components/DashboardLayout";
import { AgentCard } from "~/components/AgentCard";
import {
  Plus,
  Bot,
  Sparkles,
  MessageSquare,
  Brain,
  Search,
  LayoutGrid,
  List,
  Crown,
  Zap,
} from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
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
} from "@dnd-kit/sortable";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Agent Maker" },
    { name: "description", content: "Create and manage your AI agents" },
  ];
}

export default function HomePage() {
  return (
    <DashboardLayout>
      <Show when="signed-out">
        <LandingView />
      </Show>
      <Show when="signed-in">
        <DashboardView />
      </Show>
    </DashboardLayout>
  );
}

function LandingView() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* Hero icon */}
      <div className="relative mb-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-neon-400/10 ring-1 ring-neon-400/20 shadow-2xl shadow-neon-400/10">
          <Bot className="h-10 w-10 text-neon-400" />
        </div>
        <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-neon-400 ring-4 ring-zinc-950">
          <Sparkles className="h-3 w-3 text-zinc-950" />
        </div>
      </div>

      <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-b from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
        Agent Maker
      </h1>
      <p className="mt-4 text-lg text-zinc-400 max-w-lg leading-relaxed">
        Create, customize, and interact with your own AI agents. Each agent gets
        its own memory, tools, and chat interface.
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-3 mt-8">
        {[
          { icon: MessageSquare, label: "Chat Interface" },
          { icon: Brain, label: "Memory & Context" },
          { icon: Sparkles, label: "Custom Tools" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-sm text-zinc-400"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </div>
        ))}
      </div>

      <SignInButton mode="modal">
        <button className="mt-10 rounded-xl bg-neon-400 px-8 py-3.5 text-sm font-semibold text-zinc-950 hover:bg-neon-300 transition-all glow-neon hover:shadow-neon-400/30">
          Get Started
        </button>
      </SignInButton>
    </div>
  );
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
      className={`group flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
        isPro
          ? "bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 text-amber-300 hover:border-amber-500/50"
          : "bg-zinc-800/60 border border-zinc-700/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
      }`}
    >
      {isPro ? (
        <Crown className="h-3.5 w-3.5 text-amber-400" />
      ) : (
        <Zap className="h-3.5 w-3.5" />
      )}
      <span>{isPro ? "Pro" : "Free"}</span>
      <div
        className={`relative h-4 w-8 rounded-full transition-colors ${
          isPro ? "bg-amber-500/30" : "bg-zinc-700"
        }`}
      >
        <div
          className={`absolute top-0.5 h-3 w-3 rounded-full transition-all ${
            isPro
              ? "left-[18px] bg-amber-400"
              : "left-0.5 bg-zinc-500"
          }`}
        />
      </div>
    </button>
  );
}

function DashboardView() {
  const agents = useQuery(api.agents.list);
  const user = useQuery(api.users.me);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const visibleAgents = agents?.filter((a) => a.status !== "draft");
  const filteredAgents = visibleAgents?.filter(
    (a) =>
      !searchQuery.trim() ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    // Reordering logic — for now just visual feedback
  }

  const isPro = user?.plan === "pro" || user?.plan === "enterprise";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Your Agents</h1>
            <PlanToggle />
          </div>
          {filteredAgents && (
            <p className="mt-1 text-sm text-zinc-500">
              {filteredAgents.length} agent{filteredAgents.length !== 1 ? "s" : ""}
              {user && (
                <span className="text-zinc-600">
                  {" "}/{" "}{user.maxAgents} max
                </span>
              )}
            </p>
          )}
        </div>
        <Link
          to="/agents/new"
          className="flex items-center gap-2 rounded-xl bg-neon-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-neon-300 transition-all glow-neon-sm"
        >
          <Plus className="h-4 w-4" />
          New Agent
        </Link>
      </div>

      {/* Toolbar */}
      {visibleAgents && visibleAgents.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-neon-400/30 focus:ring-1 focus:ring-neon-400/20 transition-all"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid"
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "list"
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {filteredAgents === undefined ? (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-3"
          }
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`rounded-2xl border border-zinc-800/60 bg-zinc-900/30 animate-pulse ${
                viewMode === "grid" ? "h-40" : "h-20"
              }`}
            />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 ring-1 ring-zinc-800 mb-5">
            <Bot className="h-7 w-7 text-zinc-600" />
          </div>
          {searchQuery ? (
            <>
              <p className="text-zinc-400 font-medium">No agents found</p>
              <p className="mt-1 text-sm text-zinc-600">
                Try a different search term
              </p>
            </>
          ) : (
            <>
              <p className="text-zinc-400 font-medium">No agents yet</p>
              <Link
                to="/agents/new"
                className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create your first agent
              </Link>
            </>
          )}
        </div>
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
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  : "space-y-3"
              }
            >
              {filteredAgents.map((agent) => (
                <AgentCard
                  key={agent._id}
                  agent={agent}
                  isDraggable={true}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
