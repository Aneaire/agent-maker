import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useOutletContext, useSearchParams } from "react-router";
import {
  ImageIcon,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  Trash2,
  Download,
  Pencil,
  Check,
  X,
  Grid3X3,
  List,
  Sparkles,
  Upload,
  File,
  Loader2,
  FolderInput,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import type { Doc, Id } from "@agent-maker/shared/convex/_generated/dataModel";

const IMAGE_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/bmp",
]);

function getAssetType(mimeType: string): "image" | "file" {
  return IMAGE_TYPES.has(mimeType) ? "image" : "file";
}

export default function AssetsPage() {
  const { agent } = useOutletContext<{ agent: Doc<"agents"> }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get("folder") as Id<"assetFolders"> | null;
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadFolderId, setUploadFolderId] = useState<Id<"assetFolders"> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [moveAssetId, setMoveAssetId] = useState<string | null>(null);
  const [moveFolderId, setMoveFolderId] = useState<Id<"assetFolders"> | null>(null);
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [folderDragOverId, setFolderDragOverId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const folders = useQuery(api.assetFolders.listAll, { agentId: agent._id });
  const assets = useQuery(api.assets.list, {
    agentId: agent._id,
    folderId: currentFolderId ?? undefined,
  });
  const createFolder = useMutation(api.assetFolders.create);
  const removeFolder = useMutation(api.assetFolders.remove);
  const renameFolder = useMutation(api.assetFolders.rename);
  const removeAsset = useMutation(api.assets.remove);
  const renameAsset = useMutation(api.assets.rename);
  const generateUploadUrl = useMutation(api.assets.generateUploadUrl);
  const createAsset = useMutation(api.assets.create);
  const moveAsset = useMutation(api.assets.move);

  const currentFolder = currentFolderId
    ? folders?.find((f) => f._id === currentFolderId)
    : null;
  const subFolders = folders?.filter((f) =>
    currentFolderId ? f.parentId === currentFolderId : !f.parentId
  ) ?? [];

  const breadcrumbs: Array<{ id: string | null; name: string }> = [
    { id: null, name: "All Assets" },
  ];
  if (currentFolder) {
    const chain: typeof breadcrumbs = [];
    let cursor = currentFolder;
    while (cursor) {
      chain.unshift({ id: cursor._id, name: cursor.name });
      cursor = cursor.parentId
        ? folders?.find((f) => f._id === cursor!.parentId) ?? null as any
        : null as any;
    }
    breadcrumbs.push(...chain);
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    await createFolder({
      agentId: agent._id,
      name: newFolderName.trim(),
      parentId: currentFolderId ?? undefined,
    });
    setNewFolderName("");
    setShowNewFolder(false);
  }

  function navigateToFolder(folderId: string | null) {
    if (folderId) {
      setSearchParams({ folder: folderId });
    } else {
      setSearchParams({});
    }
    setSelectedAsset(null);
  }

  async function handleRenameSubmit(type: "folder" | "asset", id: string) {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    if (type === "folder") {
      await renameFolder({ folderId: id as Id<"assetFolders">, name: renameValue.trim() });
    } else {
      await renameAsset({ assetId: id as Id<"assets">, name: renameValue.trim() });
    }
    setRenamingId(null);
  }

  const selectedAssetData = selectedAsset
    ? (assets ?? []).find((a) => a._id === selectedAsset)
    : null;

  function openUploadModal(files: File[]) {
    setPendingFiles(files);
    setUploadFolderId(currentFolderId ?? null);
    setShowUploadModal(true);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.types.includes("Files") && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      openUploadModal(files);
    }
  }, [currentFolderId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  async function handleUpload() {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of pendingFiles) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await res.json();
        await createAsset({
          agentId: agent._id,
          folderId: uploadFolderId ?? undefined,
          name: file.name,
          type: getAssetType(file.type),
          storageId: storageId as Id<"_storage">,
          mimeType: file.type,
          fileSize: file.size,
        });
      }
      setShowUploadModal(false);
      setPendingFiles([]);
      if (uploadFolderId && uploadFolderId !== currentFolderId) {
        navigateToFolder(uploadFolderId);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="flex-1 overflow-y-auto relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 pointer-events-none">
          <div className="flex flex-col items-center gap-3 border-2 border-dashed border-rule-strong bg-surface/95 px-16 py-12">
            <Upload className="h-10 w-10 text-ink-muted" strokeWidth={1.5} />
            <p className="text-sm text-ink-muted">Drop files to upload</p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-baseline justify-between border-b border-rule pb-4 mb-6">
          <div>
            <p className="eyebrow">Assets</p>
            <div className="flex items-baseline gap-3 mt-1">
              <h1 className="font-display text-2xl text-ink">
                {currentFolder ? currentFolder.name : "All Assets"}
              </h1>
              <span className="font-mono text-xs text-ink-faint">
                {(assets ?? []).length} items
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="text-ink-faint hover:text-ink transition-colors"
              title={viewMode === "grid" ? "List view" : "Grid view"}
            >
              {viewMode === "grid" ? (
                <List className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Grid3X3 className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>
            <button
              onClick={() => {
                setUploadFolderId(currentFolderId ?? null);
                setPendingFiles([]);
                fileInputRef.current?.click();
              }}
              className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold bg-ink text-surface px-3 py-1.5 hover:opacity-90 transition-all"
            >
              <Upload className="h-3 w-3" strokeWidth={1.5} />
              Upload
            </button>
            <button
              onClick={() => setShowNewFolder(true)}
              className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-muted hover:text-ink border border-rule px-3 py-1.5 transition-colors"
            >
              <FolderPlus className="h-3 w-3" strokeWidth={1.5} />
              New Folder
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) openUploadModal(files);
            e.target.value = "";
          }}
        />

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 mb-5 text-sm">
          {breadcrumbs.map((bc, i) => (
            <div key={bc.id ?? "root"} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-ink-faint" strokeWidth={1.5} />}
              <button
                onClick={() => navigateToFolder(bc.id)}
                className={`px-1 transition-colors ${
                  i === breadcrumbs.length - 1
                    ? "text-ink"
                    : "text-ink-faint hover:text-ink-muted"
                }`}
              >
                {bc.name}
              </button>
            </div>
          ))}
        </div>

        {/* New Folder Input */}
        {showNewFolder && (
          <div className="mb-5 flex items-center gap-2">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") setShowNewFolder(false);
              }}
              placeholder="Folder name…"
              className="flex-1 max-w-xs bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
            />
            <button
              onClick={handleCreateFolder}
              className="p-1.5 text-accent hover:text-ink transition-colors"
            >
              <Check className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              onClick={() => setShowNewFolder(false)}
              className="p-1.5 text-ink-faint hover:text-ink transition-colors"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Folders */}
        {subFolders.length > 0 && (
          <div className="mb-8">
            <p className="eyebrow mb-3">Folders</p>
            <div className={viewMode === "grid"
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2"
              : "divide-y divide-rule border-y border-rule"
            }>
              {subFolders.map((folder) => (
                <div
                  key={folder._id}
                  className={`group relative ${
                    viewMode === "grid"
                      ? `border p-4 transition-all cursor-pointer ${
                          folderDragOverId === folder._id
                            ? "border-accent bg-accent-soft/20"
                            : "border-rule bg-surface hover:bg-surface-sunken hover:border-rule-strong"
                        }`
                      : `flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer ${
                          folderDragOverId === folder._id
                            ? "bg-accent-soft/20"
                            : "hover:bg-surface-sunken/60"
                        }`
                  }`}
                  onClick={() => navigateToFolder(folder._id)}
                  onDragOver={(e) => {
                    if (draggingAssetId) {
                      e.preventDefault();
                      e.stopPropagation();
                      setFolderDragOverId(folder._id);
                    }
                  }}
                  onDragLeave={() => setFolderDragOverId(null)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFolderDragOverId(null);
                    const assetId = draggingAssetId ?? e.dataTransfer.getData("text/plain");
                    if (assetId && assetId !== folder._id) {
                      await moveAsset({ assetId: assetId as Id<"assets">, folderId: folder._id });
                      setDraggingAssetId(null);
                      if (selectedAsset === assetId) setSelectedAsset(null);
                    }
                  }}
                >
                  <FolderOpen className={`text-ink-muted shrink-0 ${viewMode === "grid" ? "h-7 w-7 mb-2" : "h-4 w-4"}`} strokeWidth={1.5} />
                  {renamingId === folder._id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRenameSubmit("folder", folder._id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => setRenamingId(null)}
                        onKeyDown={(e) => { if (e.key === "Escape") setRenamingId(null); }}
                        className="bg-transparent border-b border-rule-strong text-sm outline-none w-full"
                      />
                    </form>
                  ) : (
                    <span className={`truncate text-sm ${viewMode === "list" ? "flex-1" : ""}`}>
                      {folder.name}
                    </span>
                  )}
                  <div
                    className="hidden group-hover:flex items-center gap-0.5 absolute top-2 right-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setRenameValue(folder.name);
                        setRenamingId(folder._id);
                      }}
                      className="p-1 text-ink-faint hover:text-ink transition-colors"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete folder "${folder.name}"?`)) {
                          await removeFolder({ folderId: folder._id });
                        }
                      }}
                      className="p-1 text-ink-faint hover:text-danger transition-colors"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assets Grid/List */}
        <div>
          {assets !== undefined && assets.length > 0 && (
            <p className="eyebrow mb-3">Images & Files</p>
          )}

          {assets === undefined ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div key={i} className="border border-rule bg-surface animate-pulse">
                    {/* aspect-square thumbnail */}
                    <div className="aspect-square bg-surface-sunken" />
                    {/* name: text-xs border-t → h-[13px] + padding */}
                    <div className="p-2.5 border-t border-rule">
                      <div className="h-[13px] w-3/4 bg-surface-sunken" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ol className="divide-y divide-rule border-y border-rule">
                {[1, 2, 3, 4, 5].map((i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                    {/* thumbnail: h-10 w-10 */}
                    <div className="h-10 w-10 border border-rule bg-surface-sunken animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      {/* name: text-sm → h-5 */}
                      <div className="h-5 w-40 bg-surface-sunken animate-pulse" />
                      {/* meta: text-[10px] → h-[9px] */}
                      <div className="h-[9px] w-24 bg-surface-sunken animate-pulse" />
                    </div>
                  </li>
                ))}
              </ol>
            )
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {(assets ?? []).map((asset) => (
                <div
                  key={asset._id}
                  draggable
                  onDragStart={(e) => {
                    setDraggingAssetId(asset._id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", asset._id);
                  }}
                  onDragEnd={() => setDraggingAssetId(null)}
                  className={`group relative border overflow-hidden transition-all cursor-pointer ${
                    selectedAsset === asset._id
                      ? "border-rule-strong bg-surface-sunken"
                      : draggingAssetId === asset._id
                        ? "opacity-40 border-rule"
                        : "border-rule bg-surface hover:border-rule-strong hover:bg-surface-sunken"
                  }`}
                  onClick={() => setSelectedAsset(selectedAsset === asset._id ? null : asset._id)}
                >
                  <div className="aspect-square bg-surface-sunken flex items-center justify-center overflow-hidden">
                    {asset.resolvedUrl && asset.type === "image" ? (
                      <img
                        src={asset.resolvedUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-ink-faint" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="p-2.5 border-t border-rule">
                    {renamingId === asset._id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleRenameSubmit("asset", asset._id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => setRenamingId(null)}
                          onKeyDown={(e) => { if (e.key === "Escape") setRenamingId(null); }}
                          className="bg-transparent border-b border-rule-strong text-xs outline-none w-full"
                        />
                      </form>
                    ) : (
                      <p className="text-xs text-ink truncate">{asset.name}</p>
                    )}
                    {asset.generatedBy && (
                      <div className="flex items-center gap-1 mt-1">
                        <Sparkles className="h-2.5 w-2.5 text-ink-faint" strokeWidth={1.5} />
                        <span className="text-[10px] text-ink-faint">
                          {asset.generatedBy === "gemini" ? "Gemini" : "Nano Banana"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div
                    className="hidden group-hover:flex items-center gap-0.5 absolute top-2 right-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setRenameValue(asset.name);
                        setRenamingId(asset._id);
                      }}
                      className="p-1.5 bg-surface/90 border border-rule text-ink-muted hover:text-ink transition-colors"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => {
                        setMoveAssetId(asset._id);
                        setMoveFolderId(null);
                      }}
                      className="p-1.5 bg-surface/90 border border-rule text-ink-muted hover:text-ink transition-colors"
                      title="Move to folder"
                    >
                      <FolderInput className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                    {asset.resolvedUrl && (
                      <a
                        href={asset.resolvedUrl}
                        download={asset.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-surface/90 border border-rule text-ink-muted hover:text-ink transition-colors"
                      >
                        <Download className="h-3 w-3" strokeWidth={1.5} />
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        if (confirm(`Delete "${asset.name}"?`)) {
                          await removeAsset({ assetId: asset._id });
                          if (selectedAsset === asset._id) setSelectedAsset(null);
                        }
                      }}
                      className="p-1.5 bg-surface/90 border border-rule text-ink-muted hover:text-danger transition-colors"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ol className="divide-y divide-rule border-y border-rule">
              {(assets ?? []).map((asset) => (
                <li
                  key={asset._id}
                  draggable
                  onDragStart={(e) => {
                    setDraggingAssetId(asset._id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", asset._id);
                  }}
                  onDragEnd={() => setDraggingAssetId(null)}
                  className={`group flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer ${
                    selectedAsset === asset._id
                      ? "bg-surface-sunken"
                      : draggingAssetId === asset._id
                        ? "opacity-40"
                        : "hover:bg-surface-sunken/60"
                  }`}
                  onClick={() => setSelectedAsset(selectedAsset === asset._id ? null : asset._id)}
                >
                  <div className="h-10 w-10 border border-rule overflow-hidden flex items-center justify-center shrink-0">
                    {asset.resolvedUrl && asset.type === "image" ? (
                      <img src={asset.resolvedUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-ink-faint" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{asset.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-ink-faint">
                      {asset.generatedBy && (
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5" strokeWidth={1.5} />
                          {asset.generatedBy === "gemini" ? "Gemini" : "Nano Banana"}
                        </span>
                      )}
                      {asset.mimeType && <span className="font-mono">{asset.mimeType}</span>}
                      {asset.fileSize && (
                        <span className="font-mono">{Math.round(asset.fileSize / 1024)}KB</span>
                      )}
                    </div>
                  </div>
                  <div
                    className="hidden group-hover:flex items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setMoveAssetId(asset._id);
                        setMoveFolderId(null);
                      }}
                      className="p-1.5 text-ink-faint hover:text-ink transition-colors"
                      title="Move to folder"
                    >
                      <FolderInput className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                    {asset.resolvedUrl && (
                      <a
                        href={asset.resolvedUrl}
                        download={asset.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-ink-faint hover:text-ink transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        if (confirm(`Delete "${asset.name}"?`)) {
                          await removeAsset({ assetId: asset._id });
                        }
                      }}
                      className="p-1.5 text-ink-faint hover:text-danger transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* Empty State */}
          {assets !== undefined && assets.length === 0 && subFolders.length === 0 && (
            <div className="py-20 max-w-md">
              <p className="eyebrow">Empty</p>
              <h2 className="mt-2 font-display text-2xl text-ink">No assets yet.</h2>
              <p className="mt-3 text-sm text-ink-muted leading-relaxed">
                Drag and drop files here, click Upload, or ask your agent to generate an image.
              </p>
              <button
                onClick={() => {
                  setUploadFolderId(null);
                  setPendingFiles([]);
                  fileInputRef.current?.click();
                }}
                className="mt-6 inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold bg-ink text-surface px-4 py-2 hover:opacity-90 transition-all"
              >
                <Upload className="h-3 w-3" strokeWidth={1.5} />
                Upload your first file
              </button>
            </div>
          )}
        </div>

        {/* Asset Detail Panel */}
        {selectedAssetData && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setSelectedAsset(null)}
          >
            <div
              className="w-full max-w-2xl border border-rule bg-surface shadow-2xl overflow-hidden rise"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedAssetData.resolvedUrl && selectedAssetData.type === "image" && (
                <div className="bg-surface-sunken flex items-center justify-center max-h-[60vh] overflow-hidden border-b border-rule">
                  <img
                    src={selectedAssetData.resolvedUrl}
                    alt={selectedAssetData.name}
                    className="max-w-full max-h-[60vh] object-contain"
                  />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-display text-ink">{selectedAssetData.name}</h2>
                  <button
                    onClick={() => setSelectedAsset(null)}
                    className="p-1.5 text-ink-faint hover:text-ink transition-colors"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
                {selectedAssetData.prompt && (
                  <div className="mb-4">
                    <p className="eyebrow mb-1.5">Prompt</p>
                    <p className="text-xs text-ink-muted leading-relaxed bg-surface-sunken border border-rule p-3">
                      {selectedAssetData.prompt}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 text-[10px] text-ink-faint">
                  {selectedAssetData.generatedBy && (
                    <span className="flex items-center gap-1 border border-rule bg-surface-sunken px-2 py-0.5">
                      <Sparkles className="h-2.5 w-2.5" strokeWidth={1.5} />
                      {selectedAssetData.generatedBy === "gemini" ? "Gemini Imagen" : "Nano Banana"}
                    </span>
                  )}
                  {selectedAssetData.model && (
                    <span className="font-mono border border-rule bg-surface-sunken px-2 py-0.5">
                      {selectedAssetData.model}
                    </span>
                  )}
                  {selectedAssetData.width && selectedAssetData.height && (
                    <span className="font-mono border border-rule bg-surface-sunken px-2 py-0.5">
                      {selectedAssetData.width} × {selectedAssetData.height}
                    </span>
                  )}
                  {selectedAssetData.fileSize && (
                    <span className="font-mono border border-rule bg-surface-sunken px-2 py-0.5">
                      {Math.round(selectedAssetData.fileSize / 1024)}KB
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-rule">
                  {selectedAssetData.resolvedUrl && (
                    <a
                      href={selectedAssetData.resolvedUrl}
                      download={selectedAssetData.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs border border-rule bg-surface-sunken px-3 py-2 text-ink-muted hover:text-ink transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Download
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setMoveAssetId(selectedAssetData._id);
                      setMoveFolderId(selectedAssetData.folderId ?? null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs border border-rule bg-surface-sunken px-3 py-2 text-ink-muted hover:text-ink transition-colors"
                  >
                    <FolderInput className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Move to folder
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete "${selectedAssetData.name}"?`)) {
                        await removeAsset({ assetId: selectedAssetData._id });
                        setSelectedAsset(null);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-xs border border-danger/30 bg-danger/5 px-3 py-2 text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => { if (!uploading) setShowUploadModal(false); }}
          >
            <div
              className="w-full max-w-md border border-rule bg-surface shadow-2xl overflow-hidden rise"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 h-14 border-b border-rule">
                <p className="eyebrow">
                  Upload {pendingFiles.length === 1 ? "file" : `${pendingFiles.length} files`}
                </p>
                <button
                  onClick={() => { if (!uploading) setShowUploadModal(false); }}
                  className="p-1.5 text-ink-faint hover:text-ink transition-colors"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* File list */}
                <div className="space-y-[1px] max-h-40 overflow-y-auto">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2.5 bg-surface-sunken px-3 py-2">
                      {IMAGE_TYPES.has(file.type) ? (
                        <ImageIcon className="h-4 w-4 text-ink-faint shrink-0" strokeWidth={1.5} />
                      ) : (
                        <File className="h-4 w-4 text-ink-faint shrink-0" strokeWidth={1.5} />
                      )}
                      <span className="text-xs text-ink truncate flex-1">{file.name}</span>
                      <span className="font-mono text-[10px] text-ink-faint shrink-0">
                        {file.size < 1024 * 1024
                          ? `${Math.round(file.size / 1024)}KB`
                          : `${(file.size / (1024 * 1024)).toFixed(1)}MB`}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Folder picker */}
                <div>
                  <p className="eyebrow mb-2">Destination folder</p>
                  <select
                    value={uploadFolderId ?? "root"}
                    onChange={(e) => setUploadFolderId((e.target.value === "root" ? null : e.target.value) as Id<"assetFolders"> | null)}
                    disabled={uploading}
                    className="w-full bg-surface-sunken border border-rule px-3 py-2 text-sm text-ink focus:border-rule-strong focus:outline-none transition-colors"
                  >
                    <option value="root">Root (no folder)</option>
                    {folders?.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.parentId ? "\u00A0\u00A0\u00A0\u00A0" : ""}{f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowUploadModal(false)}
                    disabled={uploading}
                    className="text-sm text-ink-muted hover:text-ink disabled:opacity-30 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 text-xs bg-ink text-surface px-4 py-2 font-semibold hover:opacity-90 disabled:opacity-30 transition-all"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Upload
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Move Modal */}
        {moveAssetId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setMoveAssetId(null)}
          >
            <div
              className="w-full max-w-sm border border-rule bg-surface shadow-2xl overflow-hidden rise"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 h-14 border-b border-rule">
                <p className="eyebrow">Move to folder</p>
                <button
                  onClick={() => setMoveAssetId(null)}
                  className="p-1.5 text-ink-faint hover:text-ink transition-colors"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <select
                  value={moveFolderId ?? "root"}
                  onChange={(e) => setMoveFolderId((e.target.value === "root" ? null : e.target.value) as Id<"assetFolders"> | null)}
                  className="w-full bg-surface-sunken border border-rule px-3 py-2 text-sm text-ink focus:border-rule-strong focus:outline-none transition-colors"
                >
                  <option value="root">Root (no folder)</option>
                  {folders?.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.parentId ? "\u00A0\u00A0\u00A0\u00A0" : ""}{f.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setMoveAssetId(null)}
                    className="text-sm text-ink-muted hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await moveAsset({
                        assetId: moveAssetId as Id<"assets">,
                        folderId: moveFolderId ?? undefined,
                      });
                      setMoveAssetId(null);
                      if (selectedAsset === moveAssetId) setSelectedAsset(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs bg-ink text-surface px-4 py-2 font-semibold hover:opacity-90 transition-all"
                  >
                    <FolderInput className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Move
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
