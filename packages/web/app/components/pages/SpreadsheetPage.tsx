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
      <div className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80">
            <Table className="h-4 w-4 text-zinc-300" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{tab.label}</h2>
            {rows && columns && (
              <p className="text-xs text-zinc-500">
                {rows.length} row{rows.length !== 1 ? "s" : ""} · {columns.length} column{columns.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rows && rows.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          )}
          <button
            onClick={() => setShowAddCol(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Column
          </button>
          <button
            onClick={handleAddRow}
            disabled={!columns || columns.length === 0}
            className="flex items-center gap-1.5 text-xs bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Row
          </button>
        </div>
      </div>

      {/* Add Column Dialog */}
      {showAddCol && (
        <div className="px-6 py-3 border-b border-zinc-800/60 bg-zinc-900/50 flex items-center gap-3">
          <input
            type="text"
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            placeholder="Column name"
            autoFocus
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddColumn();
              if (e.key === "Escape") setShowAddCol(false);
            }}
          />

          {/* Type selector with icons */}
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
            {(["text", "number", "date", "checkbox"] as const).map((t) => {
              const Icon = COL_TYPE_ICONS[t];
              return (
                <button
                  key={t}
                  onClick={() => setNewColType(t)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                    newColType === t
                      ? "bg-zinc-800 text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {COL_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleAddColumn}
            disabled={!newColName.trim()}
            className="text-xs bg-zinc-100 text-zinc-900 px-3 py-2 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all"
          >
            Add
          </button>
          <button
            onClick={() => setShowAddCol(false)}
            className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-2"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {!columns || columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Table className="h-12 w-12 text-zinc-800 mb-3" />
            <p className="text-zinc-500 font-medium">No columns yet</p>
            <p className="text-sm text-zinc-600 mt-1">
              Add a column to get started
            </p>
            <button
              onClick={() => setShowAddCol(true)}
              className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Column
            </button>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b-2 border-zinc-800 bg-zinc-900/95 backdrop-blur-sm">
                <th className="w-12 px-3 py-3 text-zinc-600 text-xs font-medium text-center">
                  #
                </th>
                {columns.map((col) => {
                  const Icon = COL_TYPE_ICONS[col.type] ?? Type;
                  return (
                    <th
                      key={col._id}
                      className="px-3 py-3 text-left text-xs font-semibold text-zinc-400 group border-r border-zinc-800/30 last:border-r-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3 w-3 text-zinc-600" />
                          <span>{col.name}</span>
                        </div>
                        <button
                          onClick={() => removeColumn({ columnId: col._id })}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-600 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="h-3 w-3" />
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
                  className={`border-b border-zinc-800/40 group transition-colors hover:bg-zinc-900/50 ${
                    i % 2 === 0 ? "bg-transparent" : "bg-zinc-900/20"
                  }`}
                >
                  <td className="px-3 py-1.5 text-xs text-zinc-600 text-center tabular-nums">
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
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 2}
                    className="text-center py-12 text-sm text-zinc-600"
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
          className="rounded border-zinc-600 h-4 w-4 text-blue-500 bg-zinc-800 focus:ring-0 focus:ring-offset-0 cursor-pointer"
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
      className="w-full bg-transparent px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:bg-zinc-800/80 rounded-md transition-colors"
    />
  );
}
