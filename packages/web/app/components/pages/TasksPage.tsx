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
      <div className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80">
            <CheckSquare className="h-4 w-4 text-zinc-300" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{tab.label}</h2>
            {tasks && (
              <p className="text-xs text-zinc-500">
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
              <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-neon-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${(doneTasks / totalTasks) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs text-zinc-500 tabular-nums">
                {Math.round((doneTasks / totalTasks) * 100)}%
              </span>
            </div>
          )}

          {/* Webhooks */}
          <button
            onClick={() => setShowWebhooks(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Webhook className="h-3.5 w-3.5" />
            Webhooks
          </button>

          {/* Add Column */}
          <button
            onClick={() => setShowAddColumn(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
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
    <div className="border-b border-zinc-800/60 px-6 py-3 bg-zinc-900/50">
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
          placeholder="Column name..."
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
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
          className="text-xs bg-zinc-100 text-zinc-900 px-3 py-2 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all"
        >
          Add
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Sortable Column Wrapper ──────────────────────────────────────────

function SortableColumn(props: {
  col: ColumnConfig;
  tasks: Doc<"tabTasks">[];
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
        columnDragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ── Kanban Column ──────────────────────────────────────────────────

function KanbanColumn({
  col,
  tasks,
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
      className={`w-76 shrink-0 flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden ${
        isOver
          ? "border-zinc-600 bg-zinc-800/40 scale-[1.01] shadow-lg shadow-black/20"
          : "border-zinc-800/60 bg-zinc-900/30"
      }`}
    >
      {/* Colored top border */}
      <div className={`h-[3px] w-full ${colorClasses.dot}`} />
      {/* Column Header */}
      <div
        className={`px-4 py-3.5 flex items-center justify-between ${colorClasses.headerBg}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Column drag handle */}
          <button
            {...columnDragHandleProps}
            className="p-0.5 rounded text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing transition-colors shrink-0"
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
          <span className="text-xs text-zinc-600 bg-zinc-800/80 px-2 py-0.5 rounded-full font-medium shrink-0">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onOpenCreateDialog}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
            title="Add task"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {/* Column menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/60 transition-colors"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-zinc-800 bg-zinc-900 p-1.5 shadow-xl shadow-black/40 z-20">
                <button
                  onClick={() => {
                    setIsRenaming(true);
                    setRenameValue(col.label);
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                  Rename
                </button>

                {/* Color submenu */}
                <div className="px-3 py-2">
                  <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">
                    Color
                  </span>
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
                    <div className="border-t border-zinc-800 my-1" />
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
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-950/30 transition-colors"
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
        {isAddingTask && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3.5 shadow-lg shadow-black/20">
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
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={onConfirmAdd}
                disabled={!newTitle.trim()}
                className="text-xs bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all"
              >
                Add Task
              </button>
              <button
                onClick={onCancelAdd}
                className="text-xs text-zinc-500 px-2.5 py-1.5 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
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

        {tasks.length === 0 && !isAddingTask && (
          <button
            onClick={onOpenCreateDialog}
            className="flex flex-col items-center justify-center py-6 text-center w-full rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/30 transition-all group"
          >
            <Plus className="h-4 w-4 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
            <p className="text-xs text-zinc-700 group-hover:text-zinc-500 mt-1 transition-colors">
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
      className={`group rounded-xl border border-zinc-800/60 bg-zinc-900/60 backdrop-blur-sm hover:border-zinc-700 hover:bg-zinc-900/80 transition-all duration-200 cursor-default ${
        isDragging ? "opacity-40 scale-95 shadow-xl" : "hover:shadow-md hover:shadow-black/20"
      }`}
    >
      <div className="p-3.5">
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing transition-all shrink-0"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          <div className="flex-1 min-w-0">
            <p
              className="text-sm text-zinc-200 leading-snug cursor-pointer hover:text-zinc-100 transition-colors"
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
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-950/40 text-blue-400 ring-1 ring-blue-900/30"
                  >
                    <Tag className="h-2 w-2" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description preview (collapsed) */}
            {!isExpanded && task.description && (
              <p className="text-xs text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">
                {task.description.replace(/[#*`>_~\[\]]/g, "").slice(0, 100)}
              </p>
            )}

            {task.priority && <PriorityBadge priority={task.priority} />}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
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
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-600 hover:text-blue-400 hover:bg-blue-950/30 transition-all shrink-0"
              title="Edit task"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-all shrink-0"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded view with markdown description */}
      {isExpanded && task.description && (
        <div className="border-t border-zinc-800/60 px-3.5 py-3">
          <div className="prose prose-invert prose-xs max-w-none text-xs leading-relaxed text-zinc-400 [&_h1]:text-sm [&_h1]:text-zinc-200 [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-xs [&_h2]:text-zinc-300 [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:text-zinc-300 [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:space-y-0.5 [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:space-y-0.5 [&_li]:text-zinc-400 [&_code]:text-[10px] [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-zinc-300 [&_pre]:bg-zinc-800/80 [&_pre]:rounded-lg [&_pre]:p-2.5 [&_pre]:mb-2 [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-700 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-500 [&_blockquote]:italic [&_a]:text-blue-400 [&_a]:underline [&_a]:underline-offset-2 [&_hr]:border-zinc-800 [&_hr]:my-2 [&_table]:text-[10px] [&_th]:px-2 [&_th]:py-1 [&_th]:text-zinc-300 [&_td]:px-2 [&_td]:py-1 [&_td]:border-t [&_td]:border-zinc-800 [&_input[type=checkbox]]:mr-1.5 [&_input[type=checkbox]]:accent-blue-500">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
      <div className="w-full max-w-lg max-h-[85vh] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${
              isEdit
                ? "bg-gradient-to-br from-blue-600/20 to-indigo-600/20 ring-blue-500/20"
                : "bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 ring-emerald-500/20"
            }`}>
              {isEdit ? <Pencil className="h-4 w-4 text-blue-400" /> : <Plus className="h-4 w-4 text-emerald-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">{isEdit ? "Edit Task" : "New Task"}</h2>
              <p className="text-[11px] text-zinc-500">
                {isEdit ? "Update task details" : "Add a task with description, tags & priority"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          {/* Description with markdown */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-zinc-400">
                Description
              </label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowPreview(false)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                    !showPreview
                      ? "bg-zinc-700 text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-400"
                  }`}
                >
                  Write
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    showPreview
                      ? "bg-zinc-700 text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-400"
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
                placeholder="Add a description... (supports **markdown**)"
                rows={5}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors resize-none font-mono text-xs leading-relaxed"
              />
            ) : (
              <div className="min-h-[120px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 overflow-y-auto">
                {description.trim() ? (
                  <div className="prose prose-invert prose-sm max-w-none text-xs leading-relaxed text-zinc-300 [&_h1]:text-base [&_h1]:text-zinc-100 [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-sm [&_h2]:text-zinc-200 [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:text-zinc-200 [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:space-y-0.5 [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:space-y-0.5 [&_li]:text-zinc-300 [&_code]:text-[11px] [&_code]:bg-zinc-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-zinc-200 [&_pre]:bg-zinc-800/80 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:mb-2 [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-600 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-400 [&_blockquote]:italic [&_a]:text-blue-400 [&_a]:underline [&_a]:underline-offset-2 [&_hr]:border-zinc-700 [&_hr]:my-3 [&_table]:text-[11px] [&_th]:px-2 [&_th]:py-1 [&_th]:text-zinc-200 [&_td]:px-2 [&_td]:py-1 [&_td]:border-t [&_td]:border-zinc-800 [&_input[type=checkbox]]:mr-1.5 [&_input[type=checkbox]]:accent-blue-500">
                    <Markdown remarkPlugins={[remarkGfm]}>{description}</Markdown>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600 italic">
                    Nothing to preview
                  </p>
                )}
              </div>
            )}
            <p className="text-[10px] text-zinc-600 mt-1">
              Supports Markdown: **bold**, *italic*, `code`, lists, links, tables & more
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 min-h-[38px]">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-950/40 text-blue-400 ring-1 ring-blue-900/30"
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
                placeholder={tags.length === 0 ? "Type and press Enter..." : ""}
                className="flex-1 min-w-[80px] bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Priority & Status row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Priority
              </label>
              <div className="flex gap-1">
                {(["low", "medium", "high"] as const).map((p) => {
                  const pConfig = {
                    low: { bg: "bg-zinc-800/50", activeBg: "bg-zinc-700 ring-1 ring-zinc-600", text: "text-zinc-400" },
                    medium: { bg: "bg-zinc-800/50", activeBg: "bg-amber-950/50 ring-1 ring-amber-900/30", text: "text-amber-400" },
                    high: { bg: "bg-zinc-800/50", activeBg: "bg-red-950/50 ring-1 ring-red-900/30", text: "text-red-400" },
                  };
                  const c = pConfig[p];
                  const isActive = priority === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPriority(isActive ? "" : p)}
                      className={`flex-1 text-[11px] font-medium py-1.5 rounded-lg capitalize transition-all ${
                        isActive ? `${c.activeBg} ${c.text}` : `${c.bg} text-zinc-500 hover:text-zinc-400`
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Column
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors"
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
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-800/80">
          <button
            onClick={onClose}
            className="text-xs text-zinc-500 px-4 py-2 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="text-xs bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
      <div className="w-full max-w-lg max-h-[80vh] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-cyan-600/20 ring-1 ring-blue-500/20">
              <Webhook className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Webhooks</h2>
              <p className="text-[11px] text-zinc-500">
                Connect external services to this task board
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
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
                  className="h-16 rounded-lg bg-zinc-800 animate-pulse"
                />
              ))}
            </div>
          ) : webhooks.length === 0 && !showAdd ? (
            <div className="text-center py-8">
              <Webhook className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500 mb-1">No webhooks configured</p>
              <p className="text-xs text-zinc-600">
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
                    className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full ${
                              wh.type === "incoming"
                                ? "bg-blue-950/50 text-blue-400 ring-1 ring-blue-900/30"
                                : "bg-purple-950/50 text-purple-400 ring-1 ring-purple-900/30"
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
                            <code className="text-[11px] font-mono text-zinc-500 bg-zinc-800 px-2 py-1 rounded-lg truncate flex-1">
                              {webhookUrl}
                            </code>
                            <button
                              onClick={() =>
                                copyToClipboard(webhookUrl, wh._id)
                              }
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors shrink-0"
                            >
                              {copiedId === wh._id ? (
                                <Check className="h-3.5 w-3.5 text-neon-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
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
                              className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleWebhook({ webhookId: wh._id })}
                          className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-800 transition-colors"
                          title={wh.isActive ? "Disable" : "Enable"}
                        >
                          {wh.isActive ? (
                            <ToggleRight className="h-4 w-4 text-neon-400" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-zinc-600" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            removeWebhook({ webhookId: wh._id })
                          }
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all"
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
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setNewType("incoming")}
                  className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${
                    newType === "incoming"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  Incoming
                </button>
                <button
                  onClick={() => setNewType("outgoing")}
                  className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${
                    newType === "outgoing"
                      ? "bg-purple-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
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
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
              />

              {newType === "outgoing" && (
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://your-service.com/webhook"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Events
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TASK_EVENTS.map((ev) => (
                    <button
                      key={ev.value}
                      onClick={() => toggleEvent(ev.value)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        newEvents.includes(ev.value)
                          ? "border-zinc-500 bg-zinc-700 text-zinc-200"
                          : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
                      }`}
                    >
                      {ev.label}
                    </button>
                  ))}
                </div>
              </div>

              {newType === "incoming" && (
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  A unique URL will be generated. POST JSON with{" "}
                  <code className="text-zinc-500">
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
                  className="text-xs bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-30 transition-colors"
                >
                  Create Webhook
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="text-xs text-zinc-500 px-2 py-1.5 hover:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-zinc-800 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
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
