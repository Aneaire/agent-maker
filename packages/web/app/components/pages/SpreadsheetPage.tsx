import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import {
  Table,
  Plus,
  Trash2,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  Download,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";

const COL_TYPE_ICONS: Record<string, typeof Type> = {
  text: Type,
  number: Hash,
  date: Calendar,
  checkbox: CheckSquare,
};

const COL_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  checkbox: "Checkbox",
};

export function SpreadsheetPage({ tab }: { tab: Doc<"sidebarTabs"> }) {
  const columns = useQuery(api.tabSpreadsheet.listColumns, {
    tabId: tab._id,
  });
  const rows = useQuery(api.tabSpreadsheet.listRows, { tabId: tab._id });
  const addColumn = useMutation(api.tabSpreadsheet.addColumn);
  const removeColumn = useMutation(api.tabSpreadsheet.removeColumn);
  const addRow = useMutation(api.tabSpreadsheet.addRow);
  const updateRow = useMutation(api.tabSpreadsheet.updateRow);
  const removeRow = useMutation(api.tabSpreadsheet.removeRow);
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState<
    "text" | "number" | "date" | "checkbox"
  >("text");

  async function handleAddColumn() {
    if (!newColName.trim()) return;
    await addColumn({
      tabId: tab._id,
      name: newColName.trim(),
      type: newColType,
    });
    setNewColName("");
    setShowAddCol(false);
  }

  async function handleAddRow() {
    const data: Record<string, any> = {};
    columns?.forEach((col) => {
      data[col.name] = col.type === "checkbox" ? false : "";
    });
    await addRow({ tabId: tab._id, data });
  }

  function handleExportCSV() {
    if (!columns || !rows) return;
    const header = columns.map((c) => c.name).join(",");
    const body = rows
      .map((r) =>
        columns
          .map((c) => {
            const val = (r.data as any)?.[c.name] ?? "";
            return typeof val === "string" && val.includes(",")
              ? `"${val}"`
              : String(val);
          })
          .join(",")
      )
      .join("\n");
    const csv = header + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab.label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b border-rule px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Table className="h-4 w-4 text-ink-faint" strokeWidth={1.5} />
          <div>
            <p className="eyebrow">{tab.label}</p>
            {rows && columns && (
              <p className="text-[10px] text-ink-faint">
                {rows.length} row{rows.length !== 1 ? "s" : ""} · {columns.length} col{columns.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rows && rows.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink-muted px-3 py-1.5 hover:bg-surface-sunken transition-colors"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
              CSV
            </button>
          )}
          <button
            onClick={() => setShowAddCol(true)}
            className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink-muted px-3 py-1.5 hover:bg-surface-sunken transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Column
          </button>
          <button
            onClick={handleAddRow}
            disabled={!columns || columns.length === 0}
            className="flex items-center gap-1.5 text-xs bg-ink text-surface px-3 py-1.5 font-semibold hover:opacity-90 disabled:opacity-30 transition-all"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Row
          </button>
        </div>
      </div>

      {/* Add Column Panel */}
      {showAddCol && (
        <div className="px-6 py-3 border-b border-rule bg-surface-sunken flex items-center gap-3">
          <input
            type="text"
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            placeholder="Column name"
            autoFocus
            className="bg-transparent border-0 border-b border-rule-strong px-0 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddColumn();
              if (e.key === "Escape") setShowAddCol(false);
            }}
          />

          {/* Type selector */}
          <div className="flex items-center gap-0.5 border border-rule">
            {(["text", "number", "date", "checkbox"] as const).map((t) => {
              const Icon = COL_TYPE_ICONS[t];
              return (
                <button
                  key={t}
                  onClick={() => setNewColType(t)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors ${
                    newColType === t
                      ? "bg-surface-sunken text-ink"
                      : "text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  <Icon className="h-3 w-3" strokeWidth={1.5} />
                  {COL_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleAddColumn}
            disabled={!newColName.trim()}
            className="text-xs bg-ink text-surface px-3 py-1.5 font-semibold hover:opacity-90 disabled:opacity-30 transition-all"
          >
            Add
          </button>
          <button
            onClick={() => setShowAddCol(false)}
            className="text-xs text-ink-faint hover:text-ink-muted px-2 py-1.5 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {columns === undefined ? (
          /* Loading skeleton — matches sticky header + rows layout */
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b-2 border-rule bg-surface">
                {/* row-number col */}
                <th className="w-12 px-3 py-3" />
                {[{ w: "w-20" }, { w: "w-28" }, { w: "w-16" }].map(({ w }, i) => (
                  <th key={i} className="px-3 py-3 border-r border-rule last:border-r-0">
                    <div className="flex items-center gap-2">
                      {/* col type icon: h-3 w-3 */}
                      <div className="h-3 w-3 bg-surface-sunken animate-pulse shrink-0" />
                      {/* col name: text-xs font-semibold ~13px */}
                      <div className={`h-[13px] ${w} bg-surface-sunken animate-pulse`} />
                    </div>
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className={`border-b border-rule ${i % 2 === 0 ? "bg-surface-sunken/30" : ""}`}>
                  {/* row number */}
                  <td className="px-3 py-1.5">
                    <div className="h-[13px] w-4 bg-surface-sunken animate-pulse mx-auto" />
                  </td>
                  {/* cells: px-1 py-0.5, input is py-1.5 text-sm → h-5 */}
                  {[1, 2, 3].map((j) => (
                    <td key={j} className="px-2 py-1.5 border-r border-rule last:border-r-0">
                      <div className="h-5 w-full bg-surface-sunken animate-pulse" />
                    </td>
                  ))}
                  <td className="w-10" />
                </tr>
              ))}
            </tbody>
          </table>
        ) : columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Table className="h-10 w-10 text-ink-faint mb-3" strokeWidth={1} />
            <p className="font-display text-2xl text-ink mb-1">No columns yet</p>
            <p className="text-sm text-ink-faint">Add a column to get started</p>
            <button
              onClick={() => setShowAddCol(true)}
              className="mt-4 flex items-center gap-2 border border-rule px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-sunken transition-colors"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Add Column
            </button>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b-2 border-rule bg-surface">
                <th className="w-12 px-3 py-3 text-ink-faint text-xs font-medium text-center">
                  #
                </th>
                {columns.map((col) => {
                  const Icon = COL_TYPE_ICONS[col.type] ?? Type;
                  return (
                    <th
                      key={col._id}
                      className="px-3 py-3 text-left text-xs font-semibold text-ink-muted group border-r border-rule last:border-r-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3 w-3 text-ink-faint" strokeWidth={1.5} />
                          <span>{col.name}</span>
                        </div>
                        <button
                          onClick={() => removeColumn({ columnId: col._id })}
                          className="opacity-0 group-hover:opacity-100 p-1 text-ink-faint hover:text-danger transition-all"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                      </div>
                    </th>
                  );
                })}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows?.map((row, i) => (
                <tr
                  key={row._id}
                  className={`border-b border-rule group transition-colors hover:bg-surface-sunken/60 ${
                    i % 2 === 0 ? "bg-transparent" : "bg-surface-sunken/30"
                  }`}
                >
                  <td className="px-3 py-1.5 text-xs text-ink-faint text-center tabular-nums">
                    {i + 1}
                  </td>
                  {columns.map((col) => (
                    <td key={col._id} className="px-1 py-0.5">
                      <DebouncedCellEditor
                        type={col.type}
                        value={(row.data as any)?.[col.name]}
                        onChange={(val) =>
                          updateRow({
                            rowId: row._id,
                            data: { ...(row.data as any), [col.name]: val },
                          })
                        }
                      />
                    </td>
                  ))}
                  <td className="px-1">
                    <button
                      onClick={() => removeRow({ rowId: row._id })}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-faint hover:text-danger hover:bg-danger/5 transition-all"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                  </td>
                </tr>
              ))}
              {rows && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 2}
                    className="text-center py-12 text-sm text-ink-faint"
                  >
                    No rows yet — click "+ Row" to add data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DebouncedCellEditor({
  type,
  value,
  onChange,
}: {
  type: string;
  value: any;
  onChange: (val: any) => void;
}) {
  const [localValue, setLocalValue] = useState(value ?? (type === "checkbox" ? false : ""));
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(value ?? (type === "checkbox" ? false : ""));
    }
  }, [value, type]);

  useEffect(() => {
    return () => clearTimeout(timer.current);
  }, []);

  if (type === "checkbox") {
    return (
      <div className="flex items-center justify-center py-1">
        <input
          type="checkbox"
          checked={!!localValue}
          onChange={(e) => {
            setLocalValue(e.target.checked);
            onChange(e.target.checked);
          }}
          className="h-4 w-4 cursor-pointer"
        />
      </div>
    );
  }

  function handleChange(newVal: string) {
    const parsed = type === "number" ? (newVal === "" ? "" : Number(newVal)) : newVal;
    setLocalValue(newVal);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(parsed), 400);
  }

  function handleBlur() {
    isFocused.current = false;
    clearTimeout(timer.current);
    const parsed = type === "number" ? (localValue === "" ? "" : Number(localValue)) : localValue;
    if (parsed !== value) onChange(parsed);
  }

  return (
    <input
      type={type === "number" ? "number" : type === "date" ? "date" : "text"}
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={() => (isFocused.current = true)}
      onBlur={handleBlur}
      className="w-full bg-transparent px-2 py-1.5 text-sm text-ink focus:outline-none focus:bg-surface-sunken transition-colors"
    />
  );
}
