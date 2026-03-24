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
  Globe,
  Database,
  Mail,
  Workflow,
  Shield,
  ArrowRight,
  Check,
  Terminal,
  FileText,
  Table2,
  Webhook,
  Clock,
  Users,
  Cpu,
  Code2,
  Puzzle,
  Star,
  ArrowUpRight,
  Minus,
} from "lucide-react";
import { Link } from "react-router";
import { useState, useEffect, useRef } from "react";
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
    { title: "HiGantic — AI Agents That Think, Remember, and Act" },
    {
      name: "description",
      content:
        "Build autonomous AI agents with persistent memory, tools, and automations. Powered by Claude and Gemini.",
    },
  ];
}

export default function HomePage() {
  return (
    <>
      <Show when="signed-out">
        <LandingPage />
      </Show>
      <Show when="signed-in">
        <DashboardLayout>
          <DashboardView />
        </DashboardLayout>
      </Show>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════════════════════════════ */

function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden">
      <LandingNav />
      <Hero />
      <Marquee />
      <WhatItDoes />
      <ShowDontTell />
      <ToolTape />
      <Pricing />
      <BottomCTA />
      <Footer />
    </div>
  );
}

/* ── Intersection observer ──────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/* ── Model Slide Badge ──────────────────────────────────────────────── */
/*
 * SUPPORTED_MODELS: When adding a new AI model to the platform, add it here.
 * This list drives the animated "Powered by" badge on the landing page hero.
 * See CLAUDE.md / AGENTS.md for the full checklist when adding a model.
 */
const SUPPORTED_MODELS = [
  { name: "Claude", color: "text-neon-400" },
  { name: "Gemini", color: "text-blue-400" },
];

/* ── Nav ────────────────────────────────────────────────────────────── */
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-zinc-950/90 backdrop-blur-2xl border-b border-zinc-800/40"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <div className="h-7 w-7 rounded-md bg-neon-400/10 ring-1 ring-neon-400/20 overflow-hidden flex items-center justify-center">
            <img src="/logo.png" alt="HiGantic" className="h-5 w-5 object-contain" />
          </div>
          <span>HiGantic</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-[13px] text-zinc-500">
          <a href="#what" className="hover:text-zinc-200 transition-colors">Product</a>
          <a href="#how" className="hover:text-zinc-200 transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-zinc-200 transition-colors">Pricing</a>
          <Link to="/docs" className="hover:text-zinc-200 transition-colors">Docs</Link>
        </div>

        <SignInButton mode="modal">
          <button className="text-[13px] font-medium bg-zinc-100 text-zinc-900 px-4 py-1.5 rounded-lg hover:bg-white transition-colors">
            Sign in
          </button>
        </SignInButton>
      </div>
    </nav>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative pt-28 pb-0 md:pt-36">
      {/* Single subtle glow — not blobs everywhere */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-neon-400/[0.04] blur-[180px] rounded-full pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Tight editorial layout — left aligned, not centered */}
        <div className="max-w-3xl">
          {/* Model badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-900/60 px-3 py-1 mb-6 fade-in-up-slow">
            <div className="h-1.5 w-1.5 rounded-full bg-neon-400 status-pulse" />
            <span className="text-[11px] text-zinc-500">Powered by</span>
            <div className="h-[16px] overflow-hidden">
              <div className="model-slider-track">
                {SUPPORTED_MODELS.map((m) => (
                  <div key={m.name} className="h-[16px] flex items-center">
                    <span className={`text-[11px] font-semibold ${m.color}`}>{m.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.08] tracking-tight fade-in-up-slow" style={{ animationDelay: "0.08s" }}>
            Your ideas deserve
            <br />
            <span className="text-neon-400">agents that ship.</span>
          </h1>

          <p className="mt-5 text-base md:text-lg text-zinc-400 leading-relaxed max-w-xl fade-in-up-slow" style={{ animationDelay: "0.16s" }}>
            HiGantic lets you build AI agents that remember context, use tools,
            browse the web, manage tasks, and run automations — all through conversation.
          </p>

          <div className="flex items-center gap-3 mt-8 fade-in-up-slow" style={{ animationDelay: "0.24s" }}>
            <SignInButton mode="modal">
              <button className="group text-sm font-medium bg-neon-400 text-zinc-950 px-5 py-2.5 rounded-lg hover:bg-neon-300 transition-all glow-neon-sm">
                Start building
                <ArrowRight className="inline ml-1.5 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </SignInButton>
            <Link
              to="/docs"
              className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors px-4 py-2.5"
            >
              Read the docs
            </Link>
          </div>
        </div>

        {/* Hero product shot — the real thing, not a cartoon */}
        <div className="mt-16 md:mt-20 fade-in-up-slow" style={{ animationDelay: "0.35s" }}>
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}

/* ── Hero Mockup — realistic product preview ────────────────────────── */
function HeroMockup() {
  return (
    <div className="relative">
      <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/50 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/50 text-left">
        {/* Titlebar */}
        <div className="flex items-center px-3.5 py-2 border-b border-zinc-800/60 bg-zinc-950/60">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-700/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-700/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-700/70" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <div className="h-2 w-2 rounded-full bg-neon-400/60" />
              Research Assistant
            </div>
          </div>
        </div>

        {/* Layout */}
        <div className="flex min-h-[320px] md:min-h-[380px]">
          {/* Sidebar */}
          <div className="hidden md:flex flex-col w-48 border-r border-zinc-800/50 bg-zinc-950/50 p-2.5 text-[11px]">
            <div className="text-[9px] uppercase tracking-[0.08em] text-zinc-600 px-2 mb-1.5">Chats</div>
            {["Market analysis Q1", "Competitor deep-dive", "Product roadmap"].map((c, i) => (
              <div
                key={c}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 truncate ${
                  i === 0 ? "bg-zinc-800/50 text-zinc-200" : "text-zinc-600"
                }`}
              >
                <MessageSquare className="h-3 w-3 shrink-0 opacity-40" />
                {c}
              </div>
            ))}

            <div className="mt-auto border-t border-zinc-800/40 pt-2 space-y-0.5">
              <div className="text-[9px] uppercase tracking-[0.08em] text-zinc-600 px-2 mb-1">Pages</div>
              {[
                { name: "Tasks", color: "text-amber-400/60" },
                { name: "Notes", color: "text-blue-400/60" },
                { name: "Data", color: "text-purple-400/60" },
              ].map((p) => (
                <div key={p.name} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-zinc-600">
                  <div className={`h-1.5 w-1.5 rounded-sm ${p.color} bg-current`} />
                  {p.name}
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-4 md:p-5 space-y-3.5">
              {/* User */}
              <div className="flex justify-end">
                <div className="rounded-xl rounded-br-sm bg-zinc-800/60 border border-zinc-700/30 px-3.5 py-2 text-[13px] text-zinc-300 max-w-xs md:max-w-sm">
                  Research the latest trends in AI agent frameworks and organize the findings
                </div>
              </div>

              {/* Agent */}
              <div className="flex gap-2.5">
                <div className="h-6 w-6 rounded-md bg-neon-400/10 ring-1 ring-neon-400/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3 w-3 text-neon-400" />
                </div>
                <div className="space-y-2 max-w-xs md:max-w-md">
                  {/* Tool calls — the part that makes this product different */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { icon: Globe, name: "web_search", c: "text-neon-400" },
                      { icon: Brain, name: "store_memory", c: "text-purple-400" },
                      { icon: FileText, name: "save_note", c: "text-blue-400" },
                    ].map((t) => (
                      <div
                        key={t.name}
                        className="inline-flex items-center gap-1 rounded-md bg-zinc-800/40 border border-zinc-700/20 px-2 py-0.5 text-[10px] text-zinc-500"
                      >
                        <t.icon className={`h-2.5 w-2.5 ${t.c}`} />
                        {t.name}
                        <Check className="h-2.5 w-2.5 text-neon-400/70" />
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl rounded-bl-sm bg-zinc-900/60 border border-zinc-800/40 px-3.5 py-2 text-[13px] text-zinc-400 leading-relaxed">
                    I've found 3 major trends in agent frameworks for 2026. I saved the key findings to your{" "}
                    <span className="text-blue-400">Research Notes</span> page and stored the important data points in memory for future reference.
                  </div>
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="px-4 pb-3">
              <div className="flex items-center rounded-lg border border-zinc-800/50 bg-zinc-950/50 px-3.5 py-2.5">
                <span className="text-[13px] text-zinc-700 flex-1">Message your agent...</span>
                <div className="h-6 w-6 rounded-md bg-zinc-800 flex items-center justify-center">
                  <ArrowRight className="h-3 w-3 text-zinc-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edge glow */}
      <div className="absolute -bottom-6 left-[10%] right-[10%] h-20 bg-neon-400/[0.03] blur-[60px] rounded-full" />
    </div>
  );
}

/* ── Marquee — scrolling tool names ─────────────────────────────────── */
function Marquee() {
  const tools = [
    "web_search", "store_memory", "recall_memory", "create_task", "save_note",
    "send_email", "schedule_action", "fire_webhook", "search_documents",
    "send_slack_message", "create_notion_page", "google_calendar",
    "image_generation", "write_page", "set_timer", "send_agent_message",
  ];

  return (
    <div className="relative py-8 mt-8 border-y border-zinc-800/30 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-zinc-950 to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-zinc-950 to-transparent z-10" />
      <div className="flex gap-4 marquee-scroll">
        {[...tools, ...tools].map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="shrink-0 text-[11px] font-mono text-zinc-700 whitespace-nowrap"
          >
            {t}()
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── What It Does — asymmetric feature blocks ───────────────────────── */
function WhatItDoes() {
  const { ref, inView } = useInView(0.1);

  return (
    <section id="what" ref={ref} className="relative max-w-6xl mx-auto px-6 py-24 md:py-32">
      <div className="mb-16">
        <p
          className={`text-[11px] font-mono uppercase tracking-[0.15em] text-neon-400/70 mb-3 transition-all duration-700 ${
            inView ? "opacity-100" : "opacity-0"
          }`}
        >
          What HiGantic does
        </p>
        <h2
          className={`text-2xl md:text-4xl font-bold tracking-tight leading-tight max-w-lg transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "80ms" }}
        >
          Not another chatbot.
          <br />
          <span className="text-zinc-500">A workspace that thinks.</span>
        </h2>
      </div>

      {/* Bento-ish grid — deliberately asymmetric */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Large — Memory */}
        <FeatureBlock
          className="md:col-span-7"
          inView={inView}
          delay={120}
          label="Memory"
          title="Remembers everything, forgets nothing"
          desc="Agents store facts, preferences, and context across every conversation. They recall what matters, when it matters."
        >
          <div className="mt-4 space-y-1.5 font-mono text-[11px]">
            {[
              { cat: "preference", val: "User prefers concise bullet points" },
              { cat: "fact", val: "Q1 revenue target: $2.4M" },
              { cat: "context", val: "Working on competitor analysis project" },
            ].map((m, i) => (
              <div key={i} className="flex gap-2 text-zinc-600">
                <span className="text-neon-400/50 shrink-0">[{m.cat}]</span>
                <span className="text-zinc-500">{m.val}</span>
              </div>
            ))}
          </div>
        </FeatureBlock>

        {/* Small — Tools */}
        <FeatureBlock
          className="md:col-span-5"
          inView={inView}
          delay={200}
          label="Tools"
          title="50+ built-in capabilities"
          desc="Web search, email, Slack, Notion, Google Workspace, webhooks, scheduled actions, and custom HTTP endpoints."
        >
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[
              { icon: Globe, c: "text-neon-400/50" },
              { icon: Mail, c: "text-rose-400/50" },
              { icon: Database, c: "text-purple-400/50" },
              { icon: Workflow, c: "text-amber-400/50" },
              { icon: Shield, c: "text-cyan-400/50" },
              { icon: Webhook, c: "text-orange-400/50" },
            ].map((t, i) => (
              <div key={i} className="h-8 w-8 rounded-md border border-zinc-800/50 bg-zinc-900/30 flex items-center justify-center">
                <t.icon className={`h-3.5 w-3.5 ${t.c}`} />
              </div>
            ))}
          </div>
        </FeatureBlock>

        {/* Small — Pages */}
        <FeatureBlock
          className="md:col-span-5"
          inView={inView}
          delay={280}
          label="Pages"
          title="A workspace per agent"
          desc="Kanban tasks, markdown notes, spreadsheets, data tables — agents create and manage them autonomously."
        >
          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {["Tasks", "Notes", "Sheets"].map((p) => (
              <div key={p} className="rounded-md border border-zinc-800/40 bg-zinc-950/30 px-2 py-3 text-center">
                <div className="text-[10px] text-zinc-600">{p}</div>
              </div>
            ))}
          </div>
        </FeatureBlock>

        {/* Large — Automations */}
        <FeatureBlock
          className="md:col-span-7"
          inView={inView}
          delay={360}
          label="Automations"
          title="Runs while you sleep"
          desc="Event-driven workflows trigger on task creation, email receipt, or any custom event. Cron schedules keep agents working around the clock."
        >
          <div className="mt-4 font-mono text-[11px] space-y-1">
            <div className="text-zinc-600">
              <span className="text-amber-400/60">on</span> task.created <span className="text-zinc-700">→</span> send_slack_message
            </div>
            <div className="text-zinc-600">
              <span className="text-amber-400/60">on</span> email.received <span className="text-zinc-700">→</span> store_memory → create_task
            </div>
            <div className="text-zinc-600">
              <span className="text-cyan-400/60">cron</span> 0 9 * * 1 <span className="text-zinc-700">→</span> weekly_report
            </div>
          </div>
        </FeatureBlock>
      </div>
    </section>
  );
}

function FeatureBlock({
  className = "",
  inView,
  delay,
  label,
  title,
  desc,
  children,
}: {
  className?: string;
  inView: boolean;
  delay: number;
  label: string;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-5 transition-all duration-700 hover:border-zinc-700/50 hover:bg-zinc-900/30 ${className} ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-neon-400/50 mb-2">{label}</p>
      <h3 className="text-base font-semibold text-zinc-200 mb-1">{title}</h3>
      <p className="text-[13px] text-zinc-500 leading-relaxed">{desc}</p>
      {children}
    </div>
  );
}

/* ── Show Don't Tell — interactive-looking agent flow ───────────────── */
function ShowDontTell() {
  const { ref, inView } = useInView(0.1);

  return (
    <section id="how" ref={ref} className="relative max-w-6xl mx-auto px-6 py-24 md:py-32">
      <div className="mb-16">
        <p
          className={`text-[11px] font-mono uppercase tracking-[0.15em] text-neon-400/70 mb-3 transition-all duration-700 ${
            inView ? "opacity-100" : "opacity-0"
          }`}
        >
          How it works
        </p>
        <h2
          className={`text-2xl md:text-4xl font-bold tracking-tight leading-tight max-w-lg transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "80ms" }}
        >
          Describe it. We build it.
          <br />
          <span className="text-zinc-500">You use it.</span>
        </h2>
      </div>

      {/* Vertical timeline — not horizontal cards */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-neon-400/20 via-zinc-800/40 to-transparent hidden md:block" />

        <div className="space-y-10 md:space-y-14">
          {[
            {
              n: "1",
              title: "Talk to the creator agent",
              body: "Describe what you want in plain language. The creator agent asks clarifying questions, suggests tools, and builds your agent's config through conversation.",
              mono: (
                <div className="space-y-1 text-[12px] font-mono">
                  <div><span className="text-zinc-600">you:</span> <span className="text-zinc-400">I need an agent that monitors competitor pricing</span></div>
                  <div><span className="text-neon-400/60">creator:</span> <span className="text-zinc-500">I'll set up web search, memory, and a daily cron schedule. Should it also post updates to Slack?</span></div>
                </div>
              ),
            },
            {
              n: "2",
              title: "It picks the right tools",
              body: "Based on your description, the creator selects from 17+ tool sets — memory, web search, pages, email, Slack, Notion, Google, and more.",
              mono: (
                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                  {["memory", "web_search", "pages", "slack", "schedules"].map((t) => (
                    <span key={t} className="text-neon-400/50 border border-neon-400/15 rounded px-1.5 py-0.5 bg-neon-400/5">{t}</span>
                  ))}
                </div>
              ),
            },
            {
              n: "3",
              title: "Your agent goes live",
              body: "Instantly deployed with its own workspace, conversation history, memory store, and pages. Chat with it, let it run automations, or expose it as an API.",
              mono: (
                <div className="text-[12px] font-mono text-zinc-600">
                  <span className="text-neon-400/70">status:</span> active &nbsp;
                  <span className="text-zinc-700">|</span> &nbsp;
                  <span className="text-zinc-500">3 pages</span> &nbsp;
                  <span className="text-zinc-700">|</span> &nbsp;
                  <span className="text-zinc-500">cron: 0 9 * * *</span>
                </div>
              ),
            },
          ].map((step, i) => (
            <div
              key={step.n}
              className={`flex gap-5 md:gap-8 transition-all duration-700 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: `${200 + i * 120}ms` }}
            >
              {/* Step marker */}
              <div className="shrink-0 relative">
                <div className="h-10 w-10 rounded-lg border border-zinc-800/60 bg-zinc-900/40 flex items-center justify-center text-sm font-bold text-zinc-600">
                  {step.n}
                </div>
              </div>

              <div className="flex-1 pb-2">
                <h3 className="text-lg font-semibold text-zinc-200 mb-1.5">{step.title}</h3>
                <p className="text-[13px] text-zinc-500 leading-relaxed mb-3 max-w-lg">{step.body}</p>
                <div className="rounded-lg border border-zinc-800/40 bg-zinc-950/30 px-4 py-3">
                  {step.mono}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Tool Tape — horizontal scrolling tool grid ─────────────────────── */
function ToolTape() {
  const { ref, inView } = useInView(0.1);

  const tools = [
    { icon: Brain, name: "Memory", desc: "Store & recall across sessions" },
    { icon: Globe, name: "Web Search", desc: "Search & fetch live data" },
    { icon: FileText, name: "Pages", desc: "Notes, tasks, spreadsheets" },
    { icon: Mail, name: "Email", desc: "Send via Resend or Gmail" },
    { icon: Clock, name: "Schedules", desc: "Cron & interval triggers" },
    { icon: Webhook, name: "Webhooks", desc: "Inbound & outbound hooks" },
    { icon: Users, name: "Multi-Agent", desc: "Agent-to-agent delegation" },
    { icon: Code2, name: "REST API", desc: "Expose agents as endpoints" },
    { icon: Shield, name: "Credentials", desc: "AES-256 encrypted vault" },
    { icon: Database, name: "RAG", desc: "Vector search on documents" },
    { icon: Puzzle, name: "Custom Tools", desc: "Your own HTTP endpoints" },
    { icon: Cpu, name: "Multi-Model", desc: "Claude, Gemini & more" },
  ];

  return (
    <section ref={ref} className="py-20 md:py-28 border-t border-zinc-800/30">
      <div className="max-w-6xl mx-auto px-6 mb-10">
        <p
          className={`text-[11px] font-mono uppercase tracking-[0.15em] text-neon-400/70 mb-3 transition-all duration-700 ${
            inView ? "opacity-100" : "opacity-0"
          }`}
        >
          Capabilities
        </p>
        <h2
          className={`text-2xl md:text-3xl font-bold tracking-tight transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "80ms" }}
        >
          Everything an agent needs. Nothing it doesn't.
        </h2>
      </div>

      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {tools.map((tool, i) => (
            <div
              key={tool.name}
              className={`group rounded-lg border border-zinc-800/40 bg-zinc-900/20 p-3.5 hover:border-zinc-700/50 hover:bg-zinc-900/40 transition-all duration-500 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${120 + i * 40}ms` }}
            >
              <tool.icon className="h-4 w-4 text-zinc-600 group-hover:text-neon-400/70 transition-colors mb-2.5" />
              <div className="text-[13px] font-medium text-zinc-300">{tool.name}</div>
              <div className="text-[11px] text-zinc-600 mt-0.5">{tool.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ────────────────────────────────────────────────────────── */
function Pricing() {
  const { ref, inView } = useInView();

  const plans = [
    {
      name: "Free",
      price: "$0",
      note: "No card required",
      items: [
        { text: "3 agents", included: true },
        { text: "Tasks, Notes, Markdown", included: true },
        { text: "Memory & web search", included: true },
        { text: "5 pages per agent", included: true },
        { text: "Spreadsheets & APIs", included: false },
        { text: "Automations", included: false },
      ],
      cta: "Get started",
      featured: false,
    },
    {
      name: "Pro",
      price: "$29",
      note: "/month",
      items: [
        { text: "10 agents", included: true },
        { text: "All page types", included: true },
        { text: "Full automation & cron", included: true },
        { text: "20 pages per agent", included: true },
        { text: "REST API endpoints", included: true },
        { text: "PostgreSQL connections", included: true },
      ],
      cta: "Start trial",
      featured: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      note: "",
      items: [
        { text: "100 agents", included: true },
        { text: "Everything in Pro", included: true },
        { text: "20 concurrent jobs", included: true },
        { text: "SSO & team management", included: true },
        { text: "Custom integrations", included: true },
        { text: "Dedicated support & SLA", included: true },
      ],
      cta: "Talk to us",
      featured: false,
    },
  ];

  return (
    <section id="pricing" ref={ref} className="max-w-6xl mx-auto px-6 py-24 md:py-32">
      <div className="mb-14">
        <p
          className={`text-[11px] font-mono uppercase tracking-[0.15em] text-neon-400/70 mb-3 transition-all duration-700 ${
            inView ? "opacity-100" : "opacity-0"
          }`}
        >
          Pricing
        </p>
        <h2
          className={`text-2xl md:text-4xl font-bold tracking-tight transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "80ms" }}
        >
          Start free. Scale when ready.
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {plans.map((plan, i) => (
          <div
            key={plan.name}
            className={`relative rounded-xl border p-6 transition-all duration-700 ${
              plan.featured
                ? "border-neon-400/25 bg-neon-400/[0.03]"
                : "border-zinc-800/50 bg-zinc-900/20"
            } ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
            style={{ transitionDelay: `${150 + i * 80}ms` }}
          >
            {plan.featured && (
              <div className="absolute -top-2.5 left-4">
                <span className="text-[10px] font-mono uppercase tracking-wider bg-neon-400 text-zinc-950 px-2 py-0.5 rounded font-semibold">
                  Popular
                </span>
              </div>
            )}

            <div className="mb-5">
              <h3 className="text-sm font-medium text-zinc-400">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-3xl font-bold text-white">{plan.price}</span>
                {plan.note && <span className="text-xs text-zinc-600">{plan.note}</span>}
              </div>
            </div>

            <div className="space-y-2.5 mb-6">
              {plan.items.map((item) => (
                <div key={item.text} className="flex items-center gap-2.5 text-[13px]">
                  {item.included ? (
                    <Check className="h-3.5 w-3.5 text-neon-400/70 shrink-0" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-zinc-700 shrink-0" />
                  )}
                  <span className={item.included ? "text-zinc-400" : "text-zinc-700"}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>

            <SignInButton mode="modal">
              <button
                className={`w-full text-[13px] font-medium py-2.5 rounded-lg transition-all ${
                  plan.featured
                    ? "bg-neon-400 text-zinc-950 hover:bg-neon-300"
                    : "border border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {plan.cta}
              </button>
            </SignInButton>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Bottom CTA ─────────────────────────────────────────────────────── */
function BottomCTA() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className="border-t border-zinc-800/30">
      <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
        <div
          className={`max-w-2xl transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">
            Stop configuring.
            <br />
            <span className="text-neon-400">Start shipping agents.</span>
          </h2>
          <p className="text-zinc-500 text-base mb-8 max-w-lg">
            Free to start. No credit card. Your first agent is a conversation away.
          </p>
          <SignInButton mode="modal">
            <button className="group text-sm font-medium bg-neon-400 text-zinc-950 px-6 py-3 rounded-lg hover:bg-neon-300 transition-all glow-neon-sm">
              Get started free
              <ArrowRight className="inline ml-1.5 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </SignInButton>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ─────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-zinc-800/30">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <div className="h-5 w-5 rounded bg-neon-400/10 ring-1 ring-neon-400/20 overflow-hidden flex items-center justify-center">
              <img src="/logo.png" alt="" className="h-3.5 w-3.5 object-contain" />
            </div>
            <span>&copy; {new Date().getFullYear()} HiGantic</span>
          </div>

          <div className="flex items-center gap-5 text-[13px] text-zinc-600">
            <Link to="/docs" className="hover:text-zinc-300 transition-colors">Docs</Link>
            <a href="#pricing" className="hover:text-zinc-300 transition-colors">Pricing</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD VIEW — Authenticated user's agent management
   ═══════════════════════════════════════════════════════════════════════ */

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
            isPro ? "left-[18px] bg-amber-400" : "left-0.5 bg-zinc-500"
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
  const [searchFocused, setSearchFocused] = useState(false);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{getGreeting()}</h1>
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
          className="flex items-center gap-2 rounded-xl bg-neon-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-neon-300 transition-all glow-neon-sm hover:shadow-lg hover:shadow-neon-400/20"
        >
          <Plus className="h-4 w-4" />
          New Agent
        </Link>
      </div>

      {visibleAgents && visibleAgents.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <div className={`relative transition-all duration-300 ${searchFocused ? "flex-1 max-w-sm" : "flex-1 max-w-xs"}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search agents..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus-glow transition-all"
            />
          </div>
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid" ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "list" ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {filteredAgents === undefined ? (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`rounded-2xl border border-zinc-800/60 bg-zinc-900/30 animate-pulse ${viewMode === "grid" ? "h-40" : "h-20"}`} />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 ring-1 ring-zinc-800">
              <Bot className="h-8 w-8 text-zinc-700" />
            </div>
            <div className="absolute -top-2 -right-2 h-3 w-3 rounded-full bg-neon-400/20" />
            <div className="absolute -bottom-1 -left-3 h-2 w-2 rounded-full bg-zinc-700/40" />
          </div>
          {searchQuery ? (
            <>
              <p className="text-zinc-400 font-medium">No agents found</p>
              <p className="mt-1 text-sm text-zinc-600">Try a different search term</p>
            </>
          ) : (
            <>
              <p className="text-zinc-400 font-medium">No agents yet</p>
              <p className="mt-1 text-sm text-zinc-600">Create your first agent to get started</p>
              <Link
                to="/agents/new"
                className="mt-5 flex items-center gap-2 rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create your first agent
              </Link>
            </>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredAgents.map((a) => a._id)} strategy={rectSortingStrategy}>
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
              {filteredAgents.map((agent) => (
                <AgentCard key={agent._id} agent={agent} isDraggable={true} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
