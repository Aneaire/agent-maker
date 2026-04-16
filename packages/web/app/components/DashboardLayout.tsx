import { Show, SignInButton, UserButton } from "@clerk/react";
import { Link } from "react-router";
import { ThemeToggle } from "~/lib/theme";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink">
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-[2px]">
        <div className="mx-auto max-w-[1400px] px-8 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-baseline gap-2.5 text-ink hover:opacity-70 transition-opacity"
          >
            <img
              src="/logo.png"
              alt=""
              className="h-5 w-5 object-contain self-center"
            />
            <span className="font-display text-lg leading-none tracking-tight">
              HiGantic
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <Show when="signed-in">
              <Link
                to="/credentials"
                className="px-3 py-1.5 text-ink-muted hover:text-ink transition-colors"
              >
                Credentials
              </Link>
            </Show>
            <Link
              to="/docs"
              className="px-3 py-1.5 text-ink-muted hover:text-ink transition-colors"
            >
              Docs
            </Link>
            <div className="mx-2 h-4 w-px bg-rule" />
            <ThemeToggle />
            <Show when="signed-in">
              <div className="ml-1">
                <UserButton />
              </div>
            </Show>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="ml-1 rounded-sm bg-ink text-ink-inverse px-3.5 py-1.5 text-sm font-medium hover:bg-ink-muted transition-colors">
                  Sign in
                </button>
              </SignInButton>
            </Show>
          </nav>
        </div>
        <div className="h-px bg-rule" />
      </header>
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-[1400px] px-8 py-12">{children}</div>
      </main>
    </div>
  );
}
