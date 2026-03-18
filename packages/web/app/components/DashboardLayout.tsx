import { Show, SignInButton, UserButton } from "@clerk/react";
import { Link } from "react-router";
import { Bot, BookOpen, KeyRound } from "lucide-react";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <header className="sticky top-0 z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-zinc-100 hover:text-white transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-400/10 ring-1 ring-neon-400/20">
            <Bot className="h-4 w-4 text-neon-400" />
          </div>
          Agent Maker
        </Link>
        <div className="flex items-center gap-4">
          <Show when="signed-in">
            <Link
              to="/credentials"
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              <KeyRound className="h-4 w-4" />
              Credentials
            </Link>
          </Show>
          <Link
            to="/docs"
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Docs
          </Link>
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="rounded-lg bg-neon-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-neon-300 transition-colors glow-neon-sm">
                Sign In
              </button>
            </SignInButton>
          </Show>
        </div>
      </header>
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
