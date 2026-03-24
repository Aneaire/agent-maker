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
  Calendar,
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
  ChevronRight,
  Cpu,
  Layers,
  Code2,
  Puzzle,
  Rocket,
  Star,
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
    { title: "Agent Maker — Build AI Agents That Work For You" },
    {
      name: "description",
      content:
        "Create powerful AI agents with memory, tools, automations, and integrations. No code required. Powered by Claude.",
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
   LANDING PAGE — Full marketing site for unauthenticated users
   ═══════════════════════════════════════════════════════════════════════ */

function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* ── Sticky Nav ──────────────────────────────────────────────── */}
      <LandingNav />

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <HeroSection />

      {/* ── Trusted by / Social proof bar ───────────────────────────── */}
      <SocialProofBar />

      {/* ── Features grid ───────────────────────────────────────────── */}
      <FeaturesSection />

      {/* ── How it works ────────────────────────────────────────────── */}
      <HowItWorksSection />

      {/* ── Capabilities deep dive ──────────────────────────────────── */}
      <CapabilitiesSection />

      {/* ── Integrations ────────────────────────────────────────────── */}
      <IntegrationsSection />

      {/* ── Pricing ─────────────────────────────────────────────────── */}
      <PricingSection />

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <FinalCTASection />

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}

/* ── Intersection Observer hook for scroll animations ───────────────── */
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

/* ── Landing Nav ────────────────────────────────────────────────────── */
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-zinc-950/80 backdrop-blur-2xl border-b border-zinc-800/50"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-zinc-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-400/10 ring-1 ring-neon-400/20 overflow-hidden">
            <img
              src="/logo.png"
              alt="Agent Maker"
              className="h-6 w-6 object-contain"
            />
          </div>
          Agent Maker
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            How it works
          </a>
          <a
            href="#capabilities"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Capabilities
          </a>
          <a
            href="#pricing"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Pricing
          </a>
          <Link
            to="/docs"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Docs
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <SignInButton mode="modal">
            <button className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors hidden sm:block">
              Sign in
            </button>
          </SignInButton>
          <SignInButton mode="modal">
            <button className="rounded-lg bg-neon-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-neon-300 transition-all glow-neon-sm">
              Get Started Free
            </button>
          </SignInButton>
        </div>
      </div>
    </nav>
  );
}

/* ── Hero Section ───────────────────────────────────────────────────── */
function HeroSection() {
  return (
    <section className="relative pt-32 pb-24 md:pt-44 md:pb-32 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Central hero glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-neon-400/[0.07] blur-[150px] hero-glow-pulse" />
        {/* Side orbs */}
        <div className="absolute top-1/4 left-[10%] w-72 h-72 rounded-full bg-neon-400/[0.04] blur-[100px] float-orb" />
        <div className="absolute bottom-1/4 right-[10%] w-96 h-96 rounded-full bg-emerald-500/[0.03] blur-[120px] float-orb-alt" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(52,211,153,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.3) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Radial fade on the grid */}
        <div className="absolute inset-0 bg-radial-[ellipse_at_center] from-transparent via-zinc-950/80 to-zinc-950" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-neon-400/20 bg-neon-400/5 px-4 py-1.5 mb-8 fade-in-up-slow">
          <div className="h-1.5 w-1.5 rounded-full bg-neon-400 status-pulse" />
          <span className="text-xs font-medium text-neon-400/80">
            Powered by Claude AI
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] fade-in-up-slow" style={{ animationDelay: "0.1s" }}>
          <span className="bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            Build AI Agents
          </span>
          <br />
          <span className="bg-gradient-to-r from-neon-300 via-neon-400 to-emerald-400 bg-clip-text text-transparent">
            That Actually Work
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 md:mt-8 text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed fade-in-up-slow" style={{ animationDelay: "0.2s" }}>
          Create autonomous AI agents with persistent memory, custom tools,
          real-time collaboration, and powerful automations.{" "}
          <span className="text-zinc-300">No code required.</span>
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 fade-in-up-slow" style={{ animationDelay: "0.3s" }}>
          <SignInButton mode="modal">
            <button className="group relative rounded-xl bg-gradient-to-r from-neon-500 to-neon-400 px-8 py-4 text-base font-semibold text-zinc-950 hover:from-neon-400 hover:to-neon-300 transition-all glow-neon hover:shadow-xl hover:shadow-neon-400/25 w-full sm:w-auto">
              Start Building Free
              <ArrowRight className="inline-block ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </SignInButton>
          <Link
            to="/docs"
            className="group flex items-center gap-2 rounded-xl border border-zinc-700/60 bg-zinc-900/40 px-8 py-4 text-base font-medium text-zinc-300 hover:border-zinc-600 hover:text-white hover:bg-zinc-800/40 transition-all w-full sm:w-auto justify-center"
          >
            View Documentation
            <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>

        {/* Hero visual — Mock agent workspace */}
        <div className="relative mt-20 max-w-5xl mx-auto fade-in-up-slow" style={{ animationDelay: "0.45s" }}>
          <div className="relative rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/40">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/60">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-zinc-700/60" />
                <div className="h-3 w-3 rounded-full bg-zinc-700/60" />
                <div className="h-3 w-3 rounded-full bg-zinc-700/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="flex items-center gap-2 rounded-lg bg-zinc-800/60 px-3 py-1">
                  <div className="h-3 w-3 rounded bg-neon-400/30" />
                  <span className="text-xs text-zinc-500">
                    Research Assistant
                  </span>
                  <span className="text-[10px] text-neon-400/50 bg-neon-400/10 px-1.5 py-0.5 rounded">
                    active
                  </span>
                </div>
              </div>
            </div>

            {/* Mock workspace layout */}
            <div className="flex min-h-[340px] md:min-h-[420px]">
              {/* Sidebar */}
              <div className="hidden md:block w-56 border-r border-zinc-800/60 bg-zinc-950/40 p-3 space-y-1">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider px-2 mb-2">
                  Conversations
                </div>
                {[
                  "Market analysis Q1",
                  "Competitor research",
                  "Product roadmap ideas",
                ].map((name, i) => (
                  <div
                    key={name}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                      i === 0
                        ? "bg-zinc-800/60 text-zinc-200"
                        : "text-zinc-500 hover:bg-zinc-800/30"
                    }`}
                  >
                    <MessageSquare className="h-3 w-3 shrink-0" />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
                <div className="border-t border-zinc-800/40 my-3" />
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider px-2 mb-2">
                  Pages
                </div>
                {[
                  { icon: FileText, name: "Notes", color: "text-blue-400" },
                  { icon: Table2, name: "Tasks", color: "text-amber-400" },
                  { icon: Database, name: "Data", color: "text-purple-400" },
                ].map(({ icon: Icon, name, color }) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-500 hover:bg-zinc-800/30 transition-colors"
                  >
                    <Icon className={`h-3 w-3 shrink-0 ${color}`} />
                    <span>{name}</span>
                  </div>
                ))}
              </div>

              {/* Chat area */}
              <div className="flex-1 flex flex-col">
                <div className="flex-1 p-4 md:p-6 space-y-4 overflow-hidden">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="max-w-xs md:max-w-sm rounded-2xl rounded-br-md bg-neon-400/10 border border-neon-400/20 px-4 py-2.5 text-sm text-zinc-200">
                      Research the latest trends in AI agent frameworks
                    </div>
                  </div>
                  {/* Agent message */}
                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-neon-400/20 to-emerald-400/20 ring-1 ring-neon-400/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-neon-400" />
                    </div>
                    <div className="space-y-3 max-w-sm md:max-w-lg">
                      <div className="rounded-2xl rounded-bl-md bg-zinc-800/50 border border-zinc-700/40 px-4 py-2.5 text-sm text-zinc-300 leading-relaxed">
                        I found several key trends. Let me organize my findings
                        into your research notes...
                      </div>
                      {/* Tool use indicator */}
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <div className="flex items-center gap-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/30 px-2.5 py-1">
                          <Globe className="h-3 w-3 text-neon-400" />
                          <span>web_search</span>
                          <Check className="h-3 w-3 text-neon-400" />
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/30 px-2.5 py-1">
                          <Brain className="h-3 w-3 text-purple-400" />
                          <span>store_memory</span>
                          <Check className="h-3 w-3 text-neon-400" />
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/30 px-2.5 py-1">
                          <FileText className="h-3 w-3 text-blue-400" />
                          <span>save_note</span>
                          <Check className="h-3 w-3 text-neon-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Input */}
                <div className="p-4 border-t border-zinc-800/60">
                  <div className="flex items-center gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/60 px-4 py-3">
                    <span className="text-sm text-zinc-600 flex-1">
                      Ask your agent anything...
                    </span>
                    <div className="h-7 w-7 rounded-lg bg-neon-400/20 flex items-center justify-center">
                      <ArrowRight className="h-3.5 w-3.5 text-neon-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Glow under the hero card */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-neon-400/[0.06] blur-[80px] rounded-full" />
        </div>
      </div>
    </section>
  );
}

/* ── Social Proof Bar ───────────────────────────────────────────────── */
function SocialProofBar() {
  const { ref, inView } = useInView(0.3);

  const stats = [
    { value: "10k+", label: "Agents Created" },
    { value: "50+", label: "Built-in Tools" },
    { value: "17+", label: "Integrations" },
    { value: "99.9%", label: "Uptime" },
  ];

  return (
    <section ref={ref} className="relative border-y border-zinc-800/40 bg-zinc-950/50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center transition-all duration-700 ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features Section ───────────────────────────────────────────────── */
function FeaturesSection() {
  const { ref, inView } = useInView();

  const features = [
    {
      icon: MessageSquare,
      title: "Conversational AI Chat",
      desc: "Natural language interface with real-time streaming, suggestions, and multi-turn conversations that feel alive.",
      color: "from-neon-400/20 to-emerald-400/20",
      iconColor: "text-neon-400",
      borderColor: "group-hover:border-neon-400/30",
    },
    {
      icon: Brain,
      title: "Persistent Memory",
      desc: "Your agents remember everything. Store, recall, and search across conversations with intelligent categorization.",
      color: "from-purple-400/20 to-violet-400/20",
      iconColor: "text-purple-400",
      borderColor: "group-hover:border-purple-400/30",
    },
    {
      icon: Layers,
      title: "Workspace Pages",
      desc: "Tasks with Kanban boards, notes with markdown, spreadsheets, data tables — all managed by your agent.",
      color: "from-blue-400/20 to-cyan-400/20",
      iconColor: "text-blue-400",
      borderColor: "group-hover:border-blue-400/30",
    },
    {
      icon: Workflow,
      title: "Automations & Schedules",
      desc: "Event-driven workflows and cron-based scheduled actions. Your agents work autonomously around the clock.",
      color: "from-amber-400/20 to-orange-400/20",
      iconColor: "text-amber-400",
      borderColor: "group-hover:border-amber-400/30",
    },
    {
      icon: Globe,
      title: "Web Search & RAG",
      desc: "Search the internet, fetch web pages, and retrieve from uploaded documents with vector-powered RAG.",
      color: "from-cyan-400/20 to-teal-400/20",
      iconColor: "text-cyan-400",
      borderColor: "group-hover:border-cyan-400/30",
    },
    {
      icon: Puzzle,
      title: "Custom Tools & APIs",
      desc: "Define custom HTTP tools, expose agents as REST endpoints, or connect to any external API with ease.",
      color: "from-rose-400/20 to-pink-400/20",
      iconColor: "text-rose-400",
      borderColor: "group-hover:border-rose-400/30",
    },
  ];

  return (
    <section id="features" ref={ref} className="relative py-24 md:py-32">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-neon-400/[0.02] blur-[200px]" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <div
            className={`inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-1.5 mb-6 transition-all duration-700 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-neon-400" />
            <span className="text-xs font-medium text-zinc-400">
              Everything your agents need
            </span>
          </div>
          <h2
            className={`text-3xl md:text-5xl font-bold tracking-tight transition-all duration-700 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: "100ms" }}
          >
            <span className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
              Powerful Features,
            </span>{" "}
            <span className="bg-gradient-to-r from-neon-300 to-emerald-400 bg-clip-text text-transparent">
              Zero Complexity
            </span>
          </h2>
          <p
            className={`mt-4 text-lg text-zinc-500 max-w-2xl mx-auto transition-all duration-700 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            Each agent comes equipped with a complete workspace — from chat and
            memory to tasks, notes, and automations.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`group relative rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-6 hover:bg-zinc-900/50 transition-all duration-500 hover-lift ${feature.borderColor} ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${200 + i * 80}ms` }}
            >
              {/* Icon */}
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} ring-1 ring-white/5 mb-4`}
              >
                <feature.icon className={`h-5.5 w-5.5 ${feature.iconColor}`} />
              </div>

              <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How It Works Section ───────────────────────────────────────────── */
function HowItWorksSection() {
  const { ref, inView } = useInView();

  const steps = [
    {
      step: "01",
      title: "Describe Your Agent",
      desc: "Tell our AI creator what you want — a research assistant, project manager, journal companion, or anything you can imagine.",
      icon: MessageSquare,
      visual: (
        <div className="space-y-2.5">
          <div className="flex gap-2 items-center">
            <div className="h-6 w-6 rounded-md bg-neon-400/20 flex items-center justify-center">
              <Bot className="h-3 w-3 text-neon-400" />
            </div>
            <span className="text-xs text-zinc-500">
              What kind of agent would you like?
            </span>
          </div>
          <div className="ml-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 px-3 py-2 text-xs text-zinc-300">
            I need a research assistant that can search the web, take notes, and
            remember key findings
          </div>
          <div className="ml-8 flex items-center gap-1.5 text-[10px] text-neon-400/70">
            <Check className="h-3 w-3" /> Understanding your needs...
          </div>
        </div>
      ),
    },
    {
      step: "02",
      title: "Configure & Customize",
      desc: "Choose models, enable tools, set up pages and automations. Our guided creator handles the complexity for you.",
      icon: Cpu,
      visual: (
        <div className="space-y-2">
          {[
            { label: "Memory & Context", active: true },
            { label: "Web Search", active: true },
            { label: "Task Management", active: true },
            { label: "Email Integration", active: false },
          ].map((tool) => (
            <div
              key={tool.label}
              className="flex items-center justify-between rounded-lg bg-zinc-800/30 border border-zinc-700/20 px-3 py-1.5"
            >
              <span className="text-xs text-zinc-400">{tool.label}</span>
              <div
                className={`h-4 w-8 rounded-full transition-colors ${
                  tool.active ? "bg-neon-400/30" : "bg-zinc-700/50"
                }`}
              >
                <div
                  className={`h-3 w-3 rounded-full mt-0.5 transition-all ${
                    tool.active
                      ? "ml-[18px] bg-neon-400"
                      : "ml-0.5 bg-zinc-500"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      step: "03",
      title: "Deploy & Interact",
      desc: "Your agent is live instantly. Chat naturally, watch it use tools autonomously, and let automations handle the rest.",
      icon: Rocket,
      visual: (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 rounded-lg bg-neon-400/5 border border-neon-400/20 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-neon-400 status-pulse" />
            <span className="text-xs text-neon-400">
              Agent active & ready
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {["Memory", "Search", "Notes"].map((t) => (
              <div
                key={t}
                className="rounded bg-zinc-800/40 border border-zinc-700/20 px-2 py-1.5 text-center text-[10px] text-zinc-500"
              >
                {t}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <Clock className="h-3 w-3" /> Next scheduled action in 2h 14m
          </div>
        </div>
      ),
    },
  ];

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative py-24 md:py-32 border-t border-zinc-800/40"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900/20 to-zinc-950 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <div
            className={`inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-1.5 mb-6 transition-all duration-700 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <Rocket className="h-3.5 w-3.5 text-neon-400" />
            <span className="text-xs font-medium text-zinc-400">
              Up and running in minutes
            </span>
          </div>
          <h2
            className={`text-3xl md:text-5xl font-bold tracking-tight transition-all duration-700 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: "100ms" }}
          >
            <span className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
              Three Steps to
            </span>{" "}
            <span className="bg-gradient-to-r from-neon-300 to-emerald-400 bg-clip-text text-transparent">
              Your AI Workforce
            </span>
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((step, i) => (
            <div
              key={step.step}
              className={`relative group transition-all duration-700 ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${200 + i * 150}ms` }}
            >
              {/* Connector line (desktop) */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 -right-4 w-8 border-t border-dashed border-zinc-700/50 z-10" />
              )}

              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-6 h-full hover:border-zinc-700/60 transition-all">
                {/* Step number */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-3xl font-bold text-neon-400/20">
                    {step.step}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
                </div>

                <h3 className="text-xl font-semibold text-zinc-100 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed mb-5">
                  {step.desc}
                </p>

                {/* Visual */}
                <div className="rounded-xl border border-zinc-800/40 bg-zinc-950/40 p-3">
                  {step.visual}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Capabilities Deep Dive ─────────────────────────────────────────── */
function CapabilitiesSection() {
  const { ref, inView } = useInView();

  const capabilities = [
    {
      icon: Terminal,
      label: "17+ Tool Sets",
      desc: "Memory, web search, pages, RAG, email, schedules, webhooks, and more",
    },
    {
      icon: Users,
      label: "Multi-Agent Coordination",
      desc: "Agents can delegate tasks and communicate with each other",
    },
    {
      icon: Code2,
      label: "REST API Exposure",
      desc: "Expose any agent as an API endpoint for external integration",
    },
    {
      icon: Shield,
      label: "Encrypted Credentials",
      desc: "AES-256-GCM encrypted credential vault for all integrations",
    },
    {
      icon: Webhook,
      label: "Webhooks & Events",
      desc: "Incoming and outgoing webhooks with a full event bus system",
    },
    {
      icon: Database,
      label: "Document RAG",
      desc: "Upload PDFs, docs, and text files for vector-powered retrieval",
    },
    {
      icon: Clock,
      label: "Cron Scheduling",
      desc: "Interval-based and cron-based recurring actions and reports",
    },
    {
      icon: Cpu,
      label: "Multiple AI Models",
      desc: "Claude Sonnet, Opus, Haiku, and Gemini — pick the right brain",
    },
  ];

  return (
    <section
      id="capabilities"
      ref={ref}
      className="relative py-24 md:py-32 border-t border-zinc-800/40"
    >
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — text */}
          <div>
            <div
              className={`inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-1.5 mb-6 transition-all duration-700 ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-neon-400" />
              <span className="text-xs font-medium text-zinc-400">
                Built for power users
              </span>
            </div>
            <h2
              className={`text-3xl md:text-4xl font-bold tracking-tight mb-4 transition-all duration-700 ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "100ms" }}
            >
              <span className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
                Everything Under
              </span>
              <br />
              <span className="bg-gradient-to-r from-neon-300 to-emerald-400 bg-clip-text text-transparent">
                One Roof
              </span>
            </h2>
            <p
              className={`text-zinc-500 leading-relaxed mb-8 transition-all duration-700 ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              From simple chat assistants to complex autonomous workflows — Agent
              Maker gives you the building blocks to create agents that truly
              work for you. No coding required, but developers will love the API.
            </p>

            <SignInButton mode="modal">
              <button
                className={`group flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-500 to-neon-400 px-6 py-3 text-sm font-semibold text-zinc-950 hover:from-neon-400 hover:to-neon-300 transition-all glow-neon-sm ${
                  inView
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: "300ms" }}
              >
                Explore All Features
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </SignInButton>
          </div>

          {/* Right — capabilities grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {capabilities.map((cap, i) => (
              <div
                key={cap.label}
                className={`group flex items-start gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 hover:bg-zinc-900/50 hover:border-zinc-700/60 transition-all duration-500 ${
                  inView
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-6"
                }`}
                style={{ transitionDelay: `${150 + i * 60}ms` }}
              >
                <div className="h-9 w-9 rounded-lg bg-neon-400/10 ring-1 ring-neon-400/10 flex items-center justify-center shrink-0 group-hover:bg-neon-400/15 transition-colors">
                  <cap.icon className="h-4 w-4 text-neon-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-200">
                    {cap.label}
                  </h4>
                  <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">
                    {cap.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Integrations Section ───────────────────────────────────────────── */
function IntegrationsSection() {
  const { ref, inView } = useInView();

  const integrations = [
    { name: "Slack", color: "bg-[#4A154B]/20 text-[#E01E5A]" },
    { name: "Notion", color: "bg-zinc-800/60 text-zinc-200" },
    { name: "Google Calendar", color: "bg-blue-500/10 text-blue-400" },
    { name: "Google Drive", color: "bg-green-500/10 text-green-400" },
    { name: "Google Sheets", color: "bg-emerald-500/10 text-emerald-400" },
    { name: "Gmail", color: "bg-red-500/10 text-red-400" },
    { name: "Resend", color: "bg-zinc-800/60 text-zinc-300" },
    { name: "Webhooks", color: "bg-orange-500/10 text-orange-400" },
    { name: "REST APIs", color: "bg-purple-500/10 text-purple-400" },
    { name: "PostgreSQL", color: "bg-blue-500/10 text-blue-300" },
  ];

  return (
    <section
      ref={ref}
      className="relative py-24 md:py-32 border-t border-zinc-800/40"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900/20 to-zinc-950 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 text-center">
        <h2
          className={`text-3xl md:text-5xl font-bold tracking-tight mb-4 transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
            Connects to
          </span>{" "}
          <span className="bg-gradient-to-r from-neon-300 to-emerald-400 bg-clip-text text-transparent">
            Your Stack
          </span>
        </h2>
        <p
          className={`text-zinc-500 max-w-xl mx-auto mb-12 transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "100ms" }}
        >
          Plug your agents into the tools you already use. Credentials are
          encrypted and securely stored.
        </p>

        <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
          {integrations.map((int, i) => (
            <div
              key={int.name}
              className={`rounded-xl border border-zinc-800/60 ${int.color} px-5 py-3 text-sm font-medium transition-all duration-500 hover:scale-105 hover:border-zinc-700/60 ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${150 + i * 50}ms` }}
            >
              {int.name}
            </div>
          ))}
        </div>

        <p
          className={`mt-8 text-sm text-zinc-600 transition-all duration-700 ${
            inView ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDelay: "800ms" }}
        >
          + Custom HTTP tools for any API
        </p>
      </div>
    </section>
  );
}

/* ── Pricing Section ────────────────────────────────────────────────── */
function PricingSection() {
  const { ref, inView } = useInView();

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      desc: "Perfect for trying out Agent Maker",
      features: [
        "Up to 3 agents",
        "Tasks, Notes & Markdown pages",
        "Memory & web search",
        "1 concurrent job",
        "5 pages per agent",
        "Community support",
      ],
      cta: "Get Started Free",
      featured: false,
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      desc: "For power users and small teams",
      features: [
        "Up to 10 agents",
        "All page types (Spreadsheet, API, Workflow)",
        "Full automation & scheduling",
        "5 concurrent jobs",
        "20 pages per agent",
        "PostgreSQL connections",
        "REST API endpoints",
        "Priority support",
      ],
      cta: "Start Pro Trial",
      featured: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      desc: "For organizations at scale",
      features: [
        "Up to 100 agents",
        "All Pro features included",
        "20 concurrent jobs",
        "50 pages per agent",
        "5 PostgreSQL connections",
        "SSO & team management",
        "Custom integrations",
        "Dedicated support & SLA",
      ],
      cta: "Contact Sales",
      featured: false,
    },
  ];

  return (
    <section
      id="pricing"
      ref={ref}
      className="relative py-24 md:py-32 border-t border-zinc-800/40"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-neon-400/[0.02] blur-[200px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2
            className={`text-3xl md:text-5xl font-bold tracking-tight mb-4 transition-all duration-700 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <span className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
              Simple, Transparent
            </span>{" "}
            <span className="bg-gradient-to-r from-neon-300 to-emerald-400 bg-clip-text text-transparent">
              Pricing
            </span>
          </h2>
          <p
            className={`text-zinc-500 max-w-lg mx-auto transition-all duration-700 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: "100ms" }}
          >
            Start free, scale when you're ready. No hidden fees.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 md:p-8 transition-all duration-700 ${
                plan.featured
                  ? "border-neon-400/30 bg-gradient-to-b from-neon-400/[0.08] via-zinc-900/50 to-zinc-900/30 shadow-xl shadow-neon-400/[0.05] md:scale-105"
                  : "border-zinc-800/60 bg-zinc-900/30"
              } ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${200 + i * 100}ms` }}
            >
              {/* Popular badge */}
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1.5 rounded-full bg-neon-400 px-4 py-1 text-xs font-semibold text-zinc-950">
                    <Star className="h-3 w-3" />
                    Most Popular
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-zinc-200">
                  {plan.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-zinc-500">{plan.period}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-zinc-500">{plan.desc}</p>
              </div>

              <div className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-neon-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-zinc-400">{feature}</span>
                  </div>
                ))}
              </div>

              <SignInButton mode="modal">
                <button
                  className={`w-full rounded-xl py-3 text-sm font-semibold transition-all ${
                    plan.featured
                      ? "bg-gradient-to-r from-neon-500 to-neon-400 text-zinc-950 hover:from-neon-400 hover:to-neon-300 glow-neon-sm"
                      : "border border-zinc-700/60 bg-zinc-800/40 text-zinc-200 hover:bg-zinc-800/60 hover:border-zinc-600"
                  }`}
                >
                  {plan.cta}
                </button>
              </SignInButton>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA Section ──────────────────────────────────────────────── */
function FinalCTASection() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className="relative py-24 md:py-32 border-t border-zinc-800/40">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-neon-400/[0.06] blur-[150px] hero-glow-pulse" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <div
          className={`relative inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-neon-400/10 ring-1 ring-neon-400/20 shadow-2xl shadow-neon-400/10 overflow-hidden mb-8 transition-all duration-700 ${
            inView ? "opacity-100 scale-100" : "opacity-0 scale-90"
          }`}
        >
          <img
            src="/logo.png"
            alt="Agent Maker"
            className="h-14 w-14 object-contain"
          />
        </div>

        <h2
          className={`text-3xl md:text-5xl font-bold tracking-tight mb-4 transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "100ms" }}
        >
          <span className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
            Ready to Build Your
          </span>
          <br />
          <span className="bg-gradient-to-r from-neon-300 to-emerald-400 bg-clip-text text-transparent">
            AI Workforce?
          </span>
        </h2>
        <p
          className={`text-lg text-zinc-500 max-w-xl mx-auto mb-10 transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          Join thousands of creators building agents that think, remember, and
          act. Start for free — no credit card required.
        </p>

        <SignInButton mode="modal">
          <button
            className={`group relative rounded-xl bg-gradient-to-r from-neon-500 to-neon-400 px-10 py-4 text-base font-semibold text-zinc-950 hover:from-neon-400 hover:to-neon-300 transition-all glow-neon hover:shadow-xl hover:shadow-neon-400/25 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: "300ms" }}
          >
            Get Started Free
            <ArrowRight className="inline-block ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </SignInButton>
      </div>
    </section>
  );
}

/* ── Footer ─────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-zinc-800/40 bg-zinc-950/80">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              to="/"
              className="flex items-center gap-2 text-base font-semibold text-zinc-100"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neon-400/10 ring-1 ring-neon-400/20 overflow-hidden">
                <img
                  src="/logo.png"
                  alt="Agent Maker"
                  className="h-5 w-5 object-contain"
                />
              </div>
              Agent Maker
            </Link>
            <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
              Build AI agents that think, remember, and act autonomously.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">
              Product
            </h4>
            <div className="space-y-2">
              {["Features", "Pricing", "Integrations", "Changelog"].map(
                (item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className="block text-sm text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    {item}
                  </a>
                )
              )}
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">
              Resources
            </h4>
            <div className="space-y-2">
              {[
                { label: "Documentation", href: "/docs" },
                { label: "API Reference", href: "/docs/api" },
                { label: "Templates", href: "#" },
                { label: "Blog", href: "#" },
              ].map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="block text-sm text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">Legal</h4>
            <div className="space-y-2">
              {["Privacy", "Terms", "Security"].map((item) => (
                <a
                  key={item}
                  href="#"
                  className="block text-sm text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-zinc-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-700">
            &copy; {new Date().getFullYear()} Agent Maker. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-xs text-zinc-700">
            Built with
            <span className="text-neon-400 mx-0.5">
              <Sparkles className="h-3 w-3 inline" />
            </span>
            and Claude
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {getGreeting()}
            </h1>
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

      {/* Toolbar */}
      {visibleAgents && visibleAgents.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          {/* Search */}
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
          {/* CSS-art empty state */}
          <div className="relative mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 ring-1 ring-zinc-800">
              <Bot className="h-8 w-8 text-zinc-700" />
            </div>
            {/* Decorative dots */}
            <div className="absolute -top-2 -right-2 h-3 w-3 rounded-full bg-neon-400/20" />
            <div className="absolute -bottom-1 -left-3 h-2 w-2 rounded-full bg-zinc-700/40" />
            <div className="absolute top-1/2 -right-5 h-1.5 w-1.5 rounded-full bg-zinc-600/30" />
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
