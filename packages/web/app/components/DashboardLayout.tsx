import { Show, SignInButton, UserButton } from "@clerk/react";
import { Link } from "react-router";
import { Bot, BookOpen, KeyRound } from "lucide-react";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-zinc-950 via-zinc-950 to-emerald-950/20 noise-overlay">
      <header className="sticky top-0 z-40 bg-zinc-950/70 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-zinc-100 hover:text-white transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-400/10 ring-1 ring-neon-400/20">
            <Bot className="h-4 w-4 text-neon-400" />
          </div>
          Agent Maker
        </Link>
        <div className="flex items-center gap-1">
          <Show when="signed-in">
            <Link
              to="/credentials"
              className="nav-underline flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800/40"
            >
              <KeyRound className="h-4 w-4" />
              Credentials
            </Link>
          </Show>
          <Link
            to="/docs"
            className="nav-underline flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800/40"
          >
            <BookOpen className="h-4 w-4" />
            Docs
          </Link>
          <div className="w-px h-5 bg-zinc-800 mx-2" />
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="relative rounded-lg bg-neon-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-neon-300 transition-all glow-neon-sm hover:shadow-lg hover:shadow-neon-400/20">
                Sign In
              </button>
            </SignInButton>
          </Show>
        </div>
      </header>
      {/* Subtle header fade border */}
      <div className="h-px bg-gradient-to-r from-transparent via-zinc-800/60 to-transparent" />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
