import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import {
  CheckSquare,
  Plus,
  Trash2,
  GripVertical,
  Circle,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Palette,
  MoreHorizontal,
  Pencil,
  Webhook,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Tag,
  Eye,
  FileText,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Column config types ────────────────────────────────────────────

interface ColumnConfig {
  key: string;
  label: string;
  color: string; // tailwind color name: zinc, amber, emerald, blue, purple, rose, cyan, orange
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "todo", label: "To Do", color: "zinc" },
  { key: "in_progress", label: "In Progress", color: "amber" },
  { key: "done", label: "Done", color: "emerald" },
];

const COLOR_OPTIONS = [
  { name: "zinc", dot: "bg-zinc-400", text: "text-zinc-400", headerBg: "bg-zinc-500/10", ring: "ring-zinc-500" },
  { name: "amber", dot: "bg-amber-400", text: "text-amber-400", headerBg: "bg-amber-500/10", ring: "ring-amber-500" },
  { name: "emerald", dot: "bg-emerald-400", text: "text-emerald-400", headerBg: "bg-emerald-500/10", ring: "ring-emerald-500" },
  { name: "blue", dot: "bg-blue-400", text: "text-blue-400", headerBg: "bg-blue-500/10", ring: "ring-blue-500" },
  { name: "purple", dot: "bg-purple-400", text: "text-purple-400", headerBg: "bg-purple-500/10", ring: "ring-purple-500" },
  { name: "rose", dot: "bg-rose-400", text: "text-rose-400", headerBg: "bg-rose-500/10", ring: "ring-rose-500" },
  { name: "cyan", dot: "bg-cyan-400", text: "text-cyan-400", headerBg: "bg-cyan-500/10", ring: "ring-cyan-500" },
  { name: "orange", dot: "bg-orange-400", text: "text-orange-400", headerBg: "bg-orange-500/10", ring: "ring-orange-500" },
];

function getColorClasses(colorName: string) {
  return COLOR_OPTIONS.find((c) => c.name === colorName) ?? COLOR_OPTIONS[0];
}

const COLUMN_ICONS: Record<string, typeof Circle> = {
  zinc: Circle,
  amber: Clock,
  emerald: CheckCircle2,
  blue: Circle,
  purple: Circle,
  rose: Circle,
  cyan: Circle,
  orange: Circle,
};

// ── Main component ─────────────────────────────────────────────────

export function TasksPage({ tab }: { tab: Doc<"sidebarTabs"> }) {
  const tasks = useQuery(api.tabTasks.list, { tabId: tab._id });
  const createTask = useMutation(api.tabTasks.create);
  const updateTask = useMutation(api.tabTasks.update).withOptimisticUpdate(
    (localStore, args) => {
      const currentTasks = localStore.getQuery(api.tabTasks.list, { tabId: tab._id });
      if (currentTasks) {
        localStore.setQuery(
          api.tabTasks.list,
          { tabId: tab._id },
          currentTasks.map((t) =>
            t._id === args.taskId ? { ...t, ...Object.fromEntries(Object.entries(args).filter(([k, v]) => k !== "taskId" && v !== undefined)) } : t
          )
        );
      }
    }
  );
  const removeTask = useMutation(api.tabTasks.remove).withOptimisticUpdate(
    (localStore, args) => {
      const currentTasks = localStore.getQuery(api.tabTasks.list, { tabId: tab._id });
      if (currentTasks) {
        localStore.setQuery(
          api.tabTasks.list,
          { tabId: tab._id },
          currentTasks.filter((t) => t._id !== args.taskId)
        );
      }
    }
  );
  const updateTab = useMutation(api.sidebarTabs.update);

  const [newTaskColumn, setNewTaskColumn] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [activeTask, setActiveTask] = useState<Doc<"tabTasks"> | null>(null);
  const [activeColumn, setActiveColumn] = useState<ColumnConfig | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showWebhooks, setShowWebhooks] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Doc<"tabTasks"> | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // Local columns state for instant UI updates (optimistic)
  const serverColumns: ColumnConfig[] = (tab.config as any)?.columns ?? DEFAULT_COLUMNS;
  const [columns, setColumns] = useState<ColumnConfig[]>(serverColumns);

  // Sync from server when tab config changes (e.g. from another tab/agent edit)
  useEffect(() => {
    setColumns((tab.config as any)?.columns ?? DEFAULT_COLUMNS);
  }, [tab.config]);

  function saveColumns(newColumns: ColumnConfig[]) {
    setColumns(newColumns); // instant local update
    updateTab({
      tabId: tab._id,
      config: { ...(tab.config as any), columns: newColumns },
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  async function handleCreate(status: string) {
    if (!newTitle.trim()) return;
    await createTask({
      tabId: tab._id,
      title: newTitle.trim(),
      status,
    });
    setNewTitle("");
    setNewTaskColumn(null);
  }

  async function handleCreateRich(data: {
    title: string;
    description?: string;
    priority?: "low" | "medium" | "high";
    tags?: string[];
    status: string;
  }) {
    await createTask({
      tabId: tab._id,
      title: data.title,
      description: data.description || undefined,
      status: data.status,
      priority: data.priority || undefined,
      tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
    });
    setShowCreateDialog(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    // Check if dragging a column (prefixed with "col_")
    if (id.startsWith("col_")) {
      const colKey = id.replace("col_", "");
      const col = columns.find((c) => c.key === colKey);
      if (col) setActiveColumn(col);
    } else {
      const task = tasks?.find((t) => t._id === id);
      if (task) setActiveTask(task);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // Handle column reorder
    if (activeColumn) {
      setActiveColumn(null);
      if (!over) return;

      const activeKey = (active.id as string).replace("col_", "");
      const overKey = (over.id as string).replace("col_", "");
      if (activeKey !== overKey) {
        const oldIndex = columns.findIndex((c) => c.key === activeKey);
        const newIndex = columns.findIndex((c) => c.key === overKey);
        if (oldIndex !== -1 && newIndex !== -1) {
          saveColumns(arrayMove(columns, oldIndex, newIndex));
        }
      }
      return;
    }

    // Handle task drag
    setActiveTask(null);
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Determine target column
    let targetStatus: string | null = null;

    // Check if dropped on a column droppable (could be col_ prefixed or raw key)
    const overKey = overId.startsWith("col_") ? overId.replace("col_", "") : overId;
    const isColumn = columns.some((c) => c.key === overKey);
    if (isColumn) {
      targetStatus = overKey;
    } else {
      // Dropped on another task — use that task's column
      const overTask = tasks?.find((t) => t._id === overId);
      if (overTask) targetStatus = overTask.status;
    }

    const currentTask = tasks?.find((t) => t._id === taskId);
    if (targetStatus && currentTask && currentTask.status !== targetStatus) {
      updateTask({ taskId: taskId as any, status: targetStatus });
    }
  }

  function handleAddColumn(label: string, color: string) {
    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!key || columns.some((c) => c.key === key)) return;
    saveColumns([...columns, { key, label, color }]);
    setShowAddColumn(false);
  }

  function handleRemoveColumn(key: string) {
    // Move tasks from this column to the first column
    const firstCol = columns.find((c) => c.key !== key);
    if (firstCol) {
      tasks
        ?.filter((t) => t.status === key)
        .forEach((t) => updateTask({ taskId: t._id, status: firstCol.key }));
    }
    saveColumns(columns.filter((c) => c.key !== key));
  }

  function handleRenameColumn(key: string, newLabel: string) {
    saveColumns(
      columns.map((c) => (c.key === key ? { ...c, label: newLabel } : c))
    );
  }

  function handleRecolorColumn(key: string, newColor: string) {
    saveColumns(
      columns.map((c) => (c.key === key ? { ...c, color: newColor } : c))
    );
  }

  const totalTasks = tasks?.length ?? 0;
  const doneCol = columns.find((c) => c.key === "done");
  const doneTasks = doneCol
    ? (tasks?.filter((t) => t.status === "done").length ?? 0)
    : 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b border-rule px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <CheckSquare className="h-4 w-4 text-ink-faint" strokeWidth={1.5} />
          <div>
            <p className="eyebrow">{tab.label}</p>
            {tasks && (
              <p className="text-[10px] text-ink-faint">
                {totalTasks} task{totalTasks !== 1 ? "s" : ""}
                {doneCol && totalTasks > 0 && ` · ${doneTasks} done`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress bar */}
          {doneCol && totalTasks > 0 && (
            <div className="flex items-center gap-3">
              <div className="w-32 h-1 bg-surface-sunken border border-rule overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-500"
                  style={{
                    width: `${(doneTasks / totalTasks) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs text-ink-faint tabular-nums">
                {Math.round((doneTasks / totalTasks) * 100)}%
              </span>
            </div>
          )}

          {/* Webhooks */}
          <button
            onClick={() => setShowWebhooks(true)}
            className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink-muted px-3 py-1.5 hover:bg-surface-sunken transition-colors"
          >
            <Webhook className="h-3.5 w-3.5" strokeWidth={1.5} />
            Webhooks
          </button>

          {/* Add Column */}
          <button
            onClick={() => setShowAddColumn(true)}
            className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink-muted px-3 py-1.5 hover:bg-surface-sunken transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Column
          </button>
        </div>
      </div>

      {/* Add Column Dialog */}
      {showAddColumn && (
        <AddColumnDialog
          onAdd={handleAddColumn}
          onClose={() => setShowAddColumn(false)}
        />
      )}

      {/* Webhooks Dialog */}
      {showWebhooks && (
        <WebhooksDialog tab={tab} onClose={() => setShowWebhooks(false)} />
      )}

      {/* Create Task Dialog */}
      {showCreateDialog && (
        <TaskDialog
          mode="create"
          status={showCreateDialog}
          columns={columns}
          onClose={() => setShowCreateDialog(null)}
          onSubmit={handleCreateRich}
        />
      )}

      {/* Edit Task Dialog */}
      {editingTask && (
        <TaskDialog
          mode="edit"
          task={editingTask}
          status={editingTask.status}
          columns={columns}
          onClose={() => setEditingTask(null)}
          onSubmit={(data) => {
            updateTask({
              taskId: editingTask._id,
              title: data.title,
              description: data.description,
              priority: data.priority,
              tags: data.tags,
              status: data.status,
            });
            setEditingTask(null);
          }}
        />
      )}

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columns.map((c) => `col_${c.key}`)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-4 min-h-full">
              {columns.map((col) => {
                const columnTasks =
                  tasks?.filter((t) => t.status === col.key) ?? [];

                return (
                  <SortableColumn
                    key={col.key}
                    col={col}
                    isLoading={tasks === undefined}
                    tasks={columnTasks}
                    isAddingTask={newTaskColumn === col.key}
                    newTitle={newTitle}
                    canDelete={columns.length > 1}
                    expandedTask={expandedTask}
                    onStartAdd={() => setNewTaskColumn(col.key)}
                    onOpenCreateDialog={() => setShowCreateDialog(col.key)}
                    onTitleChange={setNewTitle}
                    onConfirmAdd={() => handleCreate(col.key)}
                    onCancelAdd={() => {
                      setNewTaskColumn(null);
                      setNewTitle("");
                    }}
                    onDelete={(taskId) => removeTask({ taskId })}
                    onToggleExpand={(taskId) => setExpandedTask(expandedTask === taskId ? null : taskId)}
                    onUpdateTask={updateTask}
                    onEditTask={(task) => setEditingTask(task)}
                    onRemoveColumn={() => handleRemoveColumn(col.key)}
                    onRenameColumn={(name) => handleRenameColumn(col.key, name)}
                    onRecolorColumn={(color) => handleRecolorColumn(col.key, color)}
                  />
                );
              })}
            </div>
          </SortableContext>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
            {activeTask ? (
              <div className="rounded-xl border border-zinc-600 bg-zinc-800 p-3.5 shadow-2xl shadow-black/50 rotate-1 w-68 opacity-90">
                <p className="text-sm text-zinc-100 font-medium">
                  {activeTask.title}
                </p>
                {activeTask.tags && activeTask.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {activeTask.tags.map((tag) => (
                      <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-950/40 text-blue-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {activeTask.description && (
                  <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {activeTask.description.replace(/[#*`>_~\[\]]/g, "").slice(0, 100)}
                  </p>
                )}
                {activeTask.priority && (
                  <PriorityBadge priority={activeTask.priority} />
                )}
              </div>
            ) : activeColumn ? (
              <div className="w-76 rounded-2xl border border-zinc-600 bg-zinc-900/90 shadow-2xl shadow-black/50 rotate-1 opacity-90 p-4">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${getColorClasses(activeColumn.color).dot}`} />
                  <span className={`text-sm font-semibold ${getColorClasses(activeColumn.color).text}`}>
                    {activeColumn.label}
                  </span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

// ── Add Column Dialog ──────────────────────────────────────────────

function AddColumnDialog({
  onAdd,
  onClose,
}: {
  onAdd: (label: string, color: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("blue");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="border-b border-rule px-6 py-3 bg-surface-sunken">
      <div className="flex items-center gap-3 max-w-md">
        <input
          ref={inputRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && label.trim()) onAdd(label.trim(), color);
            if (e.key === "Escape") onClose();
          }}
          placeholder="Column name…"
          className="flex-1 bg-transparent border-0 border-b border-rule-strong pb-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
        />

        {/* Color picker */}
        <div className="flex items-center gap-1">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.name}
              onClick={() => setColor(c.name)}
              className={`h-5 w-5 rounded-full ${c.dot} transition-all ${
                color === c.name
                  ? "ring-2 ring-offset-2 ring-offset-zinc-900 " + c.ring
                  : "opacity-50 hover:opacity-80"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => label.trim() && onAdd(label.trim(), color)}
          disabled={!label.trim()}
          className="text-xs bg-ink text-surface px-3 py-2 font-semibold hover:opacity-90 disabled:opacity-30 transition-all"
        >
          Add
        </button>
        <button
          onClick={onClose}
          className="p-2 text-ink-faint hover:text-ink-muted hover:bg-surface-sunken transition-colors"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

// ── Sortable Column Wrapper ──────────────────────────────────────────

function SortableColumn(props: {
  col: ColumnConfig;
  tasks: Doc<"tabTasks">[];
  isLoading?: boolean;
  isAddingTask: boolean;
  newTitle: string;
  canDelete: boolean;
  expandedTask: string | null;
  onStartAdd: () => void;
  onOpenCreateDialog: () => void;
  onTitleChange: (v: string) => void;
  onConfirmAdd: () => void;
  onEditTask: (task: Doc<"tabTasks">) => void;
  onCancelAdd: () => void;
  onDelete: (taskId: any) => void;
  onToggleExpand: (taskId: string) => void;
  onUpdateTask: (args: any) => void;
  onRemoveColumn: () => void;
  onRenameColumn: (name: string) => void;
  onRecolorColumn: (color: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `col_${props.col.key}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-40 scale-95" : ""}
    >
      <KanbanColumn
        {...props}
        isLoading={props.isLoading}
        columnDragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ── Kanban Column ──────────────────────────────────────────────────

function KanbanColumn({
  col,
  tasks,
  isLoading,
  isAddingTask,
  newTitle,
  canDelete,
  expandedTask,
  onStartAdd,
  onOpenCreateDialog,
  onTitleChange,
  onConfirmAdd,
  onCancelAdd,
  onDelete,
  onToggleExpand,
  onUpdateTask,
  onEditTask,
  onRemoveColumn,
  onRenameColumn,
  onRecolorColumn,
  columnDragHandleProps,
}: {
  col: ColumnConfig;
  tasks: Doc<"tabTasks">[];
  isLoading?: boolean;
  isAddingTask: boolean;
  newTitle: string;
  canDelete: boolean;
  expandedTask: string | null;
  onStartAdd: () => void;
  onOpenCreateDialog: () => void;
  onTitleChange: (v: string) => void;
  onConfirmAdd: () => void;
  onCancelAdd: () => void;
  onDelete: (taskId: any) => void;
  onToggleExpand: (taskId: string) => void;
  onUpdateTask: (args: any) => void;
  onEditTask: (task: Doc<"tabTasks">) => void;
  onRemoveColumn: () => void;
  onRenameColumn: (name: string) => void;
  onRecolorColumn: (color: string) => void;
  columnDragHandleProps?: Record<string, any>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  const colorClasses = getColorClasses(col.color);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(col.label);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  return (
    <div
      className={`w-76 shrink-0 flex flex-col border transition-all duration-200 overflow-hidden ${
        isOver
          ? "border-rule-strong bg-surface-sunken scale-[1.01]"
          : "border-rule bg-surface"
      }`}
    >
      {/* Colored top border */}
      <div className={`h-[3px] w-full ${colorClasses.dot}`} />
      {/* Column Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between border-b border-rule ${colorClasses.headerBg}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Column drag handle */}
          <button
            {...columnDragHandleProps}
            className="p-0.5 text-ink-faint hover:text-ink-muted cursor-grab active:cursor-grabbing transition-colors shrink-0"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${colorClasses.dot}`} />
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => {
                if (renameValue.trim()) onRenameColumn(renameValue.trim());
                setIsRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameValue.trim()) {
                  onRenameColumn(renameValue.trim());
                  setIsRenaming(false);
                }
                if (e.key === "Escape") setIsRenaming(false);
              }}
              className={`text-sm font-semibold bg-transparent border-b border-zinc-600 focus:outline-none ${colorClasses.text} min-w-0`}
            />
          ) : (
            <span
              className={`text-sm font-semibold truncate ${colorClasses.text}`}
            >
              {col.label}
            </span>
          )}
          <span className="text-xs text-ink-faint font-medium shrink-0 tabular-nums">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onOpenCreateDialog}
            className="p-1.5 text-ink-faint hover:text-ink-muted hover:bg-surface-sunken transition-colors"
            title="Add task"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>

          {/* Column menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-ink-faint hover:text-ink-muted hover:bg-surface-sunken transition-colors"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 border border-rule bg-surface shadow-xl z-20">
                <button
                  onClick={() => {
                    setIsRenaming(true);
                    setRenameValue(col.label);
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-ink-muted hover:bg-surface-sunken transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                  Rename
                </button>

                {/* Color submenu */}
                <div className="px-3 py-2">
                  <span className="eyebrow">Color</span>
                  <div className="flex gap-1.5 mt-1.5">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => {
                          onRecolorColumn(c.name);
                          setShowMenu(false);
                        }}
                        className={`h-4 w-4 rounded-full ${c.dot} transition-all ${
                          col.color === c.name
                            ? "ring-2 ring-offset-1 ring-offset-zinc-900 " + c.ring
                            : "opacity-50 hover:opacity-80"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {canDelete && (
                  <>
                    <div className="border-t border-rule my-1" />
                    <button
                      onClick={() => {
                        if (
                          tasks.length === 0 ||
                          confirm(
                            `Delete "${col.label}"? ${tasks.length} task(s) will be moved to the first column.`
                          )
                        ) {
                          onRemoveColumn();
                        }
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger/5 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete column
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-[80px]">
        {isLoading && (
          <>
            {[{ w: "w-3/4" }, { w: "w-1/2" }].map(({ w }, i) => (
              <div key={i} className="border border-rule bg-surface p-3.5 animate-pulse">
                {/* title: text-sm → h-5 */}
                <div className={`h-5 ${w} bg-surface-sunken`} />
                {/* optional second line */}
                {i === 0 && <div className="h-5 w-2/5 bg-surface-sunken mt-1" />}
              </div>
            ))}
          </>
        )}
        {isAddingTask && (
          <div className="border border-rule bg-surface p-3.5">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirmAdd();
                if (e.key === "Escape") onCancelAdd();
              }}
              placeholder="What needs to be done?"
              autoFocus
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={onConfirmAdd}
                disabled={!newTitle.trim()}
                className="text-xs bg-ink text-surface px-3 py-1.5 font-semibold hover:opacity-90 disabled:opacity-30 transition-all"
              >
                Add Task
              </button>
              <button
                onClick={onCancelAdd}
                className="text-xs text-ink-faint px-2.5 py-1.5 hover:text-ink-muted hover:bg-surface-sunken transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <SortableContext
          items={tasks.map((t) => t._id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task._id}
              task={task}
              isExpanded={expandedTask === task._id}
              onToggleExpand={() => onToggleExpand(task._id)}
              onDelete={() => onDelete(task._id)}
              onUpdate={onUpdateTask}
              onEdit={() => onEditTask(task)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && !isAddingTask && !isLoading && (
          <button
            onClick={onOpenCreateDialog}
            className="flex flex-col items-center justify-center py-6 text-center w-full border border-dashed border-rule hover:border-rule-strong hover:bg-surface-sunken/60 transition-all group"
          >
            <Plus className="h-4 w-4 text-ink-faint group-hover:text-ink-muted transition-colors" strokeWidth={1.5} />
            <p className="text-xs text-ink-faint group-hover:text-ink-muted mt-1 transition-colors">
              Add a task
            </p>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sortable Task Card ─────────────────────────────────────────────

function SortableTaskCard({
  task,
  isExpanded,
  onToggleExpand,
  onDelete,
  onUpdate,
  onEdit,
}: {
  task: Doc<"tabTasks">;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onUpdate: (args: any) => void;
  onEdit: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasMeta = !!(task.description || task.priority || (task.tags && task.tags.length > 0));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group border border-rule bg-surface hover:bg-surface-sunken/40 transition-all duration-200 cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-40 scale-95" : ""
      }`}
    >
      <div className="p-3.5">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p
              className="text-sm text-ink leading-snug cursor-pointer transition-colors"
              onClick={onToggleExpand}
            >
              {task.title}
            </p>

            {/* Tags row (always visible if present) */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-blue-950/30 text-blue-400 border border-blue-900/30"
                  >
                    <Tag className="h-2 w-2" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description preview (collapsed) */}
            {!isExpanded && task.description && (
              <p className="text-xs text-ink-faint mt-1.5 line-clamp-2 leading-relaxed">
                {task.description.replace(/[#*`>_~\[\]]/g, "").slice(0, 100)}
              </p>
            )}

            {task.priority && <PriorityBadge priority={task.priority} />}
          </div>

          <div className="flex items-center gap-0.5 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
            {hasMeta && (
              <button
                onClick={onToggleExpand}
                className={`p-1 rounded-lg transition-all shrink-0 ${
                  isExpanded
                    ? "text-zinc-400 bg-zinc-800"
                    : "opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-400"
                }`}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                <FileText className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 p-1 text-ink-faint hover:text-ink-muted hover:bg-surface-sunken transition-all shrink-0"
              title="Edit task"
            >
              <Pencil className="h-3 w-3" strokeWidth={1.5} />
            </button>
            <button
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 p-1 text-ink-faint hover:text-danger hover:bg-danger/5 transition-all shrink-0"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded view with markdown description */}
      {isExpanded && task.description && (
        <div className="border-t border-rule px-3.5 py-3">
          <div className="prose prose-sm max-w-none text-xs leading-relaxed text-ink-muted [&_h1]:text-sm [&_h1]:text-ink [&_h1]:font-semibold [&_h2]:text-xs [&_h2]:text-ink [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:text-ink [&_h3]:font-medium [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:pl-4 [&_ol]:mb-2 [&_code]:text-[10px] [&_code]:bg-surface-sunken [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-accent [&_pre]:bg-surface-sunken [&_pre]:p-2.5 [&_pre]:mb-2 [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-rule [&_blockquote]:pl-3 [&_blockquote]:text-ink-faint [&_blockquote]:italic [&_a]:text-accent [&_a]:underline [&_hr]:border-rule [&_hr]:my-2">
            <Markdown remarkPlugins={[remarkGfm]}>{task.description}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create Task Dialog ──────────────────────────────────────────────

function TaskDialog({
  mode,
  task,
  status,
  columns,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  task?: Doc<"tabTasks">;
  status: string;
  columns: ColumnConfig[];
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    priority?: "low" | "medium" | "high";
    tags?: string[];
    status: string;
  }) => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "">(task?.priority ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [selectedStatus, setSelectedStatus] = useState(task?.status ?? status);
  const [showPreview, setShowPreview] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const isEdit = mode === "edit";

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function addTag(val: string) {
    const tag = val.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleSubmit() {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority: priority || undefined,
      tags: tags.length > 0 ? tags : undefined,
      status: selectedStatus,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-lg max-h-[85vh] border border-rule bg-surface shadow-2xl flex flex-col overflow-hidden rise">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 border border-rule bg-surface-sunken flex items-center justify-center">
              {isEdit ? <Pencil className="h-4 w-4 text-ink-muted" strokeWidth={1.5} /> : <Plus className="h-4 w-4 text-ink-muted" strokeWidth={1.5} />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">{isEdit ? "Edit Task" : "New Task"}</h2>
              <p className="text-[11px] text-ink-faint">
                {isEdit ? "Update task details" : "Add a task with description, tags & priority"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-ink-faint hover:text-ink-muted hover:bg-surface-sunken transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <p className="eyebrow">Title <span className="text-danger">*</span></p>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              placeholder="What needs to be done?"
              className="w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          {/* Description with markdown */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="eyebrow">Description</p>
              <div className="flex items-center border border-rule">
                <button
                  onClick={() => setShowPreview(false)}
                  className={`text-[10px] px-2 py-1 transition-colors ${
                    !showPreview
                      ? "bg-surface-sunken text-ink"
                      : "text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  Write
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className={`text-[10px] px-2 py-1 transition-colors flex items-center gap-1 ${
                    showPreview
                      ? "bg-surface-sunken text-ink"
                      : "text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  <Eye className="h-2.5 w-2.5" />
                  Preview
                </button>
              </div>
            </div>

            {!showPreview ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description… (supports **markdown**)"
                rows={5}
                className="w-full bg-transparent border border-rule px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors resize-none font-mono text-xs leading-relaxed"
              />
            ) : (
              <div className="min-h-[120px] border border-rule bg-surface-sunken px-3 py-2.5 overflow-y-auto">
                {description.trim() ? (
                  <div className="prose prose-sm max-w-none text-xs leading-relaxed text-ink-muted [&_h1]:text-base [&_h1]:text-ink [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:text-ink [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:text-ink [&_h3]:font-medium [&_p]:mb-2 [&_code]:text-[11px] [&_code]:bg-surface-sunken [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-accent [&_pre]:bg-surface-sunken [&_pre]:border [&_pre]:border-rule [&_pre]:p-3 [&_pre]:mb-2 [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-rule [&_blockquote]:pl-3 [&_blockquote]:text-ink-faint [&_blockquote]:italic [&_a]:text-accent [&_a]:underline [&_hr]:border-rule [&_hr]:my-3">
                    <Markdown remarkPlugins={[remarkGfm]}>{description}</Markdown>
                  </div>
                ) : (
                  <p className="text-xs text-ink-faint italic">
                    Nothing to preview
                  </p>
                )}
              </div>
            )}
            <p className="text-[10px] text-ink-faint mt-1">
              Supports Markdown: **bold**, *italic*, `code`, lists, links, tables & more
            </p>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <p className="eyebrow">Tags</p>
            <div className="flex flex-wrap items-center gap-1.5 border border-rule bg-surface px-3 py-2 min-h-[38px]">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-blue-950/30 text-blue-400 border border-blue-900/30"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 hover:text-blue-200 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                  if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                onBlur={() => {
                  if (tagInput.trim()) addTag(tagInput);
                }}
                placeholder={tags.length === 0 ? "Type and press Enter…" : ""}
                className="flex-1 min-w-[80px] bg-transparent text-xs text-ink placeholder:text-ink-faint focus:outline-none"
              />
            </div>
          </div>

          {/* Priority & Status row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-1.5">
              <p className="eyebrow">Priority</p>
              <div className="flex gap-0.5">
                {(["low", "medium", "high"] as const).map((p) => {
                  const pConfig = {
                    low: { activeBg: "bg-surface-sunken border-rule-strong", text: "text-ink-muted" },
                    medium: { activeBg: "bg-amber-950/30 border-amber-900/30", text: "text-amber-400" },
                    high: { activeBg: "bg-red-950/30 border-red-900/30", text: "text-red-400" },
                  };
                  const c = pConfig[p];
                  const isActive = priority === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPriority(isActive ? "" : p)}
                      className={`flex-1 text-[11px] font-medium py-1.5 capitalize transition-all border ${
                        isActive ? `${c.activeBg} ${c.text}` : `border-rule text-ink-faint hover:text-ink-muted hover:bg-surface-sunken`
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <p className="eyebrow">Column</p>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-surface border-0 border-b border-rule-strong pb-1.5 text-xs text-ink focus:outline-none focus:border-accent transition-colors"
              >
                {columns.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rule">
          <button
            onClick={onClose}
            className="text-xs text-ink-faint px-4 py-2 hover:text-ink-muted hover:bg-surface-sunken transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="text-xs bg-ink text-surface px-4 py-2 font-semibold hover:opacity-90 disabled:opacity-30 transition-all"
          >
            {isEdit ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Webhooks Dialog ─────────────────────────────────────────────────

const AGENT_SERVER_URL =
  typeof window !== "undefined"
    ? (import.meta.env.VITE_AGENT_SERVER_URL ?? `${window.location.protocol}//${window.location.hostname}:3001`)
    : (import.meta.env.VITE_AGENT_SERVER_URL ?? "http://localhost:3001");

const TASK_EVENTS = [
  { value: "task.created", label: "Task Created" },
  { value: "task.updated", label: "Task Updated" },
  { value: "task.deleted", label: "Task Deleted" },
];

function WebhooksDialog({
  tab,
  onClose,
}: {
  tab: Doc<"sidebarTabs">;
  onClose: () => void;
}) {
  const webhooks = useQuery(api.webhooks.list, { tabId: tab._id });
  const createWebhook = useMutation(api.webhooks.create);
  const toggleWebhook = useMutation(api.webhooks.toggle);
  const removeWebhook = useMutation(api.webhooks.remove);

  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState<"incoming" | "outgoing">("incoming");
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["task.created"]);
  const [newLabel, setNewLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCreate() {
    try {
      await createWebhook({
        tabId: tab._id,
        type: newType,
        url: newType === "outgoing" ? newUrl.trim() : undefined,
        events: newEvents,
        label: newLabel.trim() || undefined,
      });
      setShowAdd(false);
      setNewUrl("");
      setNewEvents(["task.created"]);
      setNewLabel("");
    } catch (err: any) {
      alert(err.message);
    }
  }

  function toggleEvent(event: string) {
    setNewEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-lg max-h-[80vh] border border-rule bg-surface shadow-2xl flex flex-col overflow-hidden rise">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 border border-rule bg-surface-sunken flex items-center justify-center">
              <Webhook className="h-4 w-4 text-ink-muted" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Webhooks</h2>
              <p className="text-[11px] text-ink-faint">
                Connect external services to this task board
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-ink-faint hover:text-ink-muted hover:bg-surface-sunken transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Existing webhooks */}
          {webhooks === undefined ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 border border-rule bg-surface-sunken animate-pulse"
                />
              ))}
            </div>
          ) : webhooks.length === 0 && !showAdd ? (
            <div className="text-center py-8">
              <Webhook className="h-8 w-8 text-ink-faint mx-auto mb-3" strokeWidth={1} />
              <p className="text-sm text-ink-muted mb-1">No webhooks configured</p>
              <p className="text-xs text-ink-faint">
                Add incoming webhooks to create tasks from external services, or
                outgoing webhooks to notify services when tasks change.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {webhooks?.map((wh) => {
                const webhookUrl = `${AGENT_SERVER_URL}/webhook/${wh.secret}`;
                return (
                  <div
                    key={wh._id}
                    className="group border border-rule bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`eyebrow ${
                              wh.type === "incoming"
                                ? "text-blue-400"
                                : "text-purple-400"
                            }`}
                          >
                            {wh.type}
                          </span>
                          {wh.label && (
                            <span className="text-sm font-medium text-zinc-300 truncate">
                              {wh.label}
                            </span>
                          )}
                        </div>

                        {/* URL display */}
                        {wh.type === "incoming" ? (
                          <div className="flex items-center gap-2 mt-2">
                            <code className="text-[11px] font-mono text-ink-faint bg-surface-sunken border border-rule px-2 py-1 truncate flex-1">
                              {webhookUrl}
                            </code>
                            <button
                              onClick={() =>
                                copyToClipboard(webhookUrl, wh._id)
                              }
                              className="p-1.5 text-ink-faint hover:text-ink-muted hover:bg-surface-sunken transition-colors shrink-0"
                            >
                              {copiedId === wh._id ? (
                                <Check className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                              ) : (
                                <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <code className="text-[11px] font-mono text-zinc-500 block mt-1 truncate">
                            {wh.url}
                          </code>
                        )}

                        {/* Events */}
                        <div className="flex gap-1 mt-2">
                          {wh.events.map((e) => (
                            <span
                              key={e}
                              className="text-[10px] text-ink-faint bg-surface-sunken border border-rule px-1.5 py-0.5 font-mono"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleWebhook({ webhookId: wh._id })}
                          className="p-1.5 text-ink-faint hover:bg-surface-sunken transition-colors"
                          title={wh.isActive ? "Disable" : "Enable"}
                        >
                          {wh.isActive ? (
                            <ToggleRight className="h-4 w-4 text-accent" strokeWidth={1.5} />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-ink-faint" strokeWidth={1.5} />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            removeWebhook({ webhookId: wh._id })
                          }
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-faint hover:text-danger hover:bg-danger/5 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add webhook form */}
          {showAdd ? (
            <div className="border border-rule bg-surface p-4 space-y-3">
              <div className="flex gap-1">
                <button
                  onClick={() => setNewType("incoming")}
                  className={`flex-1 text-xs py-2 font-medium transition-colors border ${
                    newType === "incoming"
                      ? "border-blue-800/40 bg-blue-950/30 text-blue-400"
                      : "border-rule text-ink-faint hover:bg-surface-sunken"
                  }`}
                >
                  Incoming
                </button>
                <button
                  onClick={() => setNewType("outgoing")}
                  className={`flex-1 text-xs py-2 font-medium transition-colors border ${
                    newType === "outgoing"
                      ? "border-purple-800/40 bg-purple-950/30 text-purple-400"
                      : "border-rule text-ink-faint hover:bg-surface-sunken"
                  }`}
                >
                  Outgoing
                </button>
              </div>

              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (optional)"
                className="w-full bg-transparent border-0 border-b border-rule-strong pb-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
              />

              {newType === "outgoing" && (
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://your-service.com/webhook"
                  className="w-full bg-transparent border-0 border-b border-rule-strong pb-1.5 text-sm font-mono text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
                />
              )}

              <div>
                <p className="eyebrow mb-2">Events</p>
                <div className="flex flex-wrap gap-1.5">
                  {TASK_EVENTS.map((ev) => (
                    <button
                      key={ev.value}
                      onClick={() => toggleEvent(ev.value)}
                      className={`text-xs px-2.5 py-1 border transition-colors ${
                        newEvents.includes(ev.value)
                          ? "border-rule-strong bg-surface-sunken text-ink"
                          : "border-rule text-ink-faint hover:border-rule-strong"
                      }`}
                    >
                      {ev.label}
                    </button>
                  ))}
                </div>
              </div>

              {newType === "incoming" && (
                <p className="text-[11px] text-ink-faint leading-relaxed">
                  A unique URL will be generated. POST JSON with{" "}
                  <code className="text-ink-muted font-mono">
                    {`{ "title": "...", "status": "todo" }`}
                  </code>{" "}
                  to create tasks.
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={
                    newEvents.length === 0 ||
                    (newType === "outgoing" && !newUrl.trim())
                  }
                  className="text-xs bg-ink text-surface px-3 py-1.5 font-semibold hover:opacity-90 disabled:opacity-30 transition-all"
                >
                  Create Webhook
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="text-xs text-ink-faint px-2 py-1.5 hover:text-ink-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-rule text-xs text-ink-faint hover:text-ink-muted hover:border-rule-strong transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Add Webhook
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Priority Badge ─────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<
    string,
    { icon: typeof AlertCircle; bg: string; text: string }
  > = {
    high: {
      icon: AlertCircle,
      bg: "bg-red-950/50 ring-1 ring-red-900/30",
      text: "text-red-400",
    },
    medium: {
      icon: Clock,
      bg: "bg-amber-950/50 ring-1 ring-amber-900/30",
      text: "text-amber-400",
    },
    low: {
      icon: Circle,
      bg: "bg-zinc-800/50 ring-1 ring-zinc-700/30",
      text: "text-zinc-400",
    },
  };

  const c = config[priority] ?? config.low;
  const Icon = c.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {priority}
    </span>
  );
}
