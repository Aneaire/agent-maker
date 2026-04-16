import { useQuery } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useParams, useOutletContext, Link } from "react-router";
import { Loader2 } from "lucide-react";
import { TasksPage } from "~/components/pages/TasksPage";
import { NotesPage } from "~/components/pages/NotesPage";
import { SpreadsheetPage } from "~/components/pages/SpreadsheetPage";
import { PostgresPage } from "~/components/pages/PostgresPage";
import { ApiPage } from "~/components/pages/ApiPage";
import { WorkflowPage } from "~/components/pages/WorkflowPage";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";

export default function DynamicTabPage() {
  const { tabId } = useParams();
  const { agent } = useOutletContext<{ agent: Doc<"agents"> }>();

  const tab = useQuery(api.sidebarTabs.get, {
    tabId: tabId as Id<"sidebarTabs">,
  });

  if (tab === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-ink-faint" strokeWidth={1.5} />
      </div>
    );
  }

  if (tab === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-sm">
          <p className="eyebrow">404</p>
          <h2 className="mt-2 font-display text-2xl text-ink leading-tight">
            Page not found.
          </h2>
          <Link
            to={`/agents/${agent._id}`}
            className="mt-4 inline-block text-sm text-accent hover:text-accent-strong transition-colors"
          >
            &larr; Back to agent
          </Link>
        </div>
      </div>
    );
  }

  switch (tab.type) {
    case "tasks":
      return <TasksPage tab={tab} />;
    case "notes":
      return <NotesPage tab={tab} />;
    case "spreadsheet":
      return <SpreadsheetPage tab={tab} />;
    case "markdown":
      return <NotesPage tab={tab} />;
    case "postgres":
      return <PostgresPage tab={tab} />;
    case "api":
      return <ApiPage tab={tab} />;
    case "workflow":
      return <WorkflowPage tab={tab} />;
    default:
      return (
        <div className="flex-1 flex items-center justify-center text-sm text-ink-faint">
          Page type &ldquo;{tab.type}&rdquo; is not yet implemented
        </div>
      );
  }
}
