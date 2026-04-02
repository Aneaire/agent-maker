import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useOutletContext, useSearchParams } from "react-router";
import {
  ImageIcon,
  FolderPlus,
  Folder,
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-neon-400/60 bg-zinc-900/90 px-16 py-12">
            <Upload className="h-10 w-10 text-neon-400 animate-bounce" />
            <p className="text-sm font-semibold text-neon-400">Drop files to upload</p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-zinc-400" />
            <h1 className="text-lg font-semibold">Assets</h1>
            <span className="text-xs text-zinc-600">
              {(assets ?? []).length} items
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title={viewMode === "grid" ? "List view" : "Grid view"}
            >
              {viewMode === "grid" ? (
                <List className="h-4 w-4" />
              ) : (
                <Grid3X3 className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => {
                setUploadFolderId(currentFolderId ?? null);
                setPendingFiles([]);
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-2 rounded-lg bg-zinc-100 text-zinc-900 px-3 py-2 text-xs font-semibold hover:bg-white transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </button>
            <button
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <FolderPlus className="h-4 w-4" />
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
        <div className="flex items-center gap-1 mb-4 text-sm">
          {breadcrumbs.map((bc, i) => (
            <div key={bc.id ?? "root"} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-zinc-600" />}
              <button
                onClick={() => navigateToFolder(bc.id)}
                className={`px-2 py-1 rounded-md transition-colors ${
                  i === breadcrumbs.length - 1
                    ? "text-zinc-200 font-medium"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {bc.name}
              </button>
            </div>
          ))}
        </div>

        {/* New Folder Input */}
        {showNewFolder && (
          <div className="mb-4 flex items-center gap-2">
            <Folder className="h-4 w-4 text-zinc-500" />
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") setShowNewFolder(false);
              }}
              placeholder="Folder name..."
              className="flex-1 max-w-xs rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
            <button
              onClick={handleCreateFolder}
              className="p-2 rounded-lg text-neon-400 hover:bg-zinc-800"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowNewFolder(false)}
              className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Folders */}
        {subFolders.length > 0 && (
          <div className="mb-6">
            <div className="text-[10px] text-zinc-600 font-semibold uppercase tracking-widest mb-2">
              Folders
            </div>
            <div className={viewMode === "grid"
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
              : "space-y-1"
            }>
              {subFolders.map((folder) => (
                <div
                  key={folder._id}
                  className={`group relative ${
                    viewMode === "grid"
                      ? `rounded-xl border p-4 transition-all cursor-pointer ${
                          folderDragOverId === folder._id
                            ? "border-neon-400/60 bg-neon-400/5 ring-1 ring-neon-400/20"
                            : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/80 hover:border-zinc-700"
                        }`
                      : `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
                          folderDragOverId === folder._id
                            ? "bg-neon-400/5 border border-neon-400/40"
                            : "hover:bg-zinc-800/80"
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
                  <FolderOpen className={`text-amber-400/80 ${viewMode === "grid" ? "h-8 w-8 mb-2" : "h-4 w-4"}`} />
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
                        className="bg-transparent border-b border-zinc-600 text-sm outline-none w-full"
                      />
                    </form>
                  ) : (
                    <span className={`truncate ${viewMode === "grid" ? "text-sm font-medium" : "text-sm flex-1"}`}>
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
                      className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete folder "${folder.name}"?`)) {
                          await removeFolder({ folderId: folder._id });
                        }
                      }}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assets Grid/List */}
        <div>
          {(assets ?? []).length > 0 && (
            <div className="text-[10px] text-zinc-600 font-semibold uppercase tracking-widest mb-2">
              Images & Files
            </div>
          )}

          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
                  className={`group relative rounded-xl border overflow-hidden transition-all cursor-pointer ${
                    selectedAsset === asset._id
                      ? "border-neon-400/50 ring-1 ring-neon-400/30 bg-zinc-800/80"
                      : draggingAssetId === asset._id
                        ? "opacity-40 border-zinc-800 bg-zinc-900/50"
                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/80"
                  }`}
                  onClick={() => setSelectedAsset(selectedAsset === asset._id ? null : asset._id)}
                >
                  <div className="aspect-square bg-zinc-800/50 flex items-center justify-center overflow-hidden">
                    {asset.resolvedUrl && asset.type === "image" ? (
                      <img
                        src={asset.resolvedUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-zinc-700" />
                    )}
                  </div>
                  <div className="p-2.5">
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
                          className="bg-transparent border-b border-zinc-600 text-xs outline-none w-full"
                        />
                      </form>
                    ) : (
                      <p className="text-xs font-medium truncate">{asset.name}</p>
                    )}
                    {asset.generatedBy && (
                      <div className="flex items-center gap-1 mt-1">
                        <Sparkles className="h-2.5 w-2.5 text-violet-400" />
                        <span className="text-[10px] text-zinc-500">
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
                      className="p-1.5 rounded-md bg-black/50 backdrop-blur text-zinc-300 hover:text-white"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => {
                        setMoveAssetId(asset._id);
                        setMoveFolderId(null);
                      }}
                      className="p-1.5 rounded-md bg-black/50 backdrop-blur text-zinc-300 hover:text-white"
                      title="Move to folder"
                    >
                      <FolderInput className="h-3 w-3" />
                    </button>
                    {asset.resolvedUrl && (
                      <a
                        href={asset.resolvedUrl}
                        download={asset.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md bg-black/50 backdrop-blur text-zinc-300 hover:text-white"
                      >
                        <Download className="h-3 w-3" />
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        if (confirm(`Delete "${asset.name}"?`)) {
                          await removeAsset({ assetId: asset._id });
                          if (selectedAsset === asset._id) setSelectedAsset(null);
                        }
                      }}
                      className="p-1.5 rounded-md bg-black/50 backdrop-blur text-zinc-300 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
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
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
                    selectedAsset === asset._id
                      ? "bg-neon-400/10 text-neon-400"
                      : draggingAssetId === asset._id
                        ? "opacity-40"
                        : "hover:bg-zinc-800/80"
                  }`}
                  onClick={() => setSelectedAsset(selectedAsset === asset._id ? null : asset._id)}
                >
                  <div className="h-10 w-10 rounded-lg bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
                    {asset.resolvedUrl && asset.type === "image" ? (
                      <img src={asset.resolvedUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-zinc-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      {asset.generatedBy && (
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5 text-violet-400" />
                          {asset.generatedBy === "gemini" ? "Gemini" : "Nano Banana"}
                        </span>
                      )}
                      {asset.mimeType && <span>{asset.mimeType}</span>}
                      {asset.fileSize && (
                        <span>{Math.round(asset.fileSize / 1024)}KB</span>
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
                      className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                      title="Move to folder"
                    >
                      <FolderInput className="h-3.5 w-3.5" />
                    </button>
                    {asset.resolvedUrl && (
                      <a
                        href={asset.resolvedUrl}
                        download={asset.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        if (confirm(`Delete "${asset.name}"?`)) {
                          await removeAsset({ assetId: asset._id });
                        }
                      }}
                      className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {(assets ?? []).length === 0 && subFolders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/80 ring-1 ring-zinc-700/50 mb-4">
                <ImageIcon className="h-8 w-8 text-zinc-600" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-1">
                No assets yet
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Drag and drop files here, click Upload, or ask your agent to generate an image.
              </p>
              <button
                onClick={() => {
                  setUploadFolderId(null);
                  setPendingFiles([]);
                  fileInputRef.current?.click();
                }}
                className="mt-4 flex items-center gap-2 rounded-lg bg-zinc-100 text-zinc-900 px-4 py-2 text-xs font-semibold hover:bg-white transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload your first file
              </button>
            </div>
          )}
        </div>

        {/* Asset Detail Panel */}
        {selectedAssetData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedAsset(null)}
          >
            <div
              className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedAssetData.resolvedUrl && selectedAssetData.type === "image" && (
                <div className="bg-zinc-950 flex items-center justify-center max-h-[60vh] overflow-hidden">
                  <img
                    src={selectedAssetData.resolvedUrl}
                    alt={selectedAssetData.name}
                    className="max-w-full max-h-[60vh] object-contain"
                  />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">{selectedAssetData.name}</h2>
                  <button
                    onClick={() => setSelectedAsset(null)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {selectedAssetData.prompt && (
                  <div className="mb-3">
                    <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">
                      Prompt
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/50 rounded-lg p-3">
                      {selectedAssetData.prompt}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500">
                  {selectedAssetData.generatedBy && (
                    <span className="flex items-center gap-1 bg-zinc-800 rounded-full px-2.5 py-1">
                      <Sparkles className="h-2.5 w-2.5 text-violet-400" />
                      {selectedAssetData.generatedBy === "gemini" ? "Gemini Imagen" : "Nano Banana"}
                    </span>
                  )}
                  {selectedAssetData.model && (
                    <span className="bg-zinc-800 rounded-full px-2.5 py-1">
                      {selectedAssetData.model}
                    </span>
                  )}
                  {selectedAssetData.width && selectedAssetData.height && (
                    <span className="bg-zinc-800 rounded-full px-2.5 py-1">
                      {selectedAssetData.width} x {selectedAssetData.height}
                    </span>
                  )}
                  {selectedAssetData.fileSize && (
                    <span className="bg-zinc-800 rounded-full px-2.5 py-1">
                      {Math.round(selectedAssetData.fileSize / 1024)}KB
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-800">
                  {selectedAssetData.resolvedUrl && (
                    <a
                      href={selectedAssetData.resolvedUrl}
                      download={selectedAssetData.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setMoveAssetId(selectedAssetData._id);
                      setMoveFolderId(selectedAssetData.folderId ?? null);
                    }}
                    className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    <FolderInput className="h-3.5 w-3.5" />
                    Move to folder
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete "${selectedAssetData.name}"?`)) {
                        await removeAsset({ assetId: selectedAssetData._id });
                        setSelectedAsset(null);
                      }
                    }}
                    className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!uploading) setShowUploadModal(false); }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold">Upload {pendingFiles.length === 1 ? "file" : `${pendingFiles.length} files`}</h2>
                  <button
                    onClick={() => { if (!uploading) setShowUploadModal(false); }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* File list */}
                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-lg bg-zinc-800/50 px-3 py-2">
                      {IMAGE_TYPES.has(file.type) ? (
                        <ImageIcon className="h-4 w-4 text-zinc-500 shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-zinc-500 shrink-0" />
                      )}
                      <span className="text-xs text-zinc-300 truncate flex-1">{file.name}</span>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        {file.size < 1024 * 1024
                          ? `${Math.round(file.size / 1024)}KB`
                          : `${(file.size / (1024 * 1024)).toFixed(1)}MB`}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Folder picker */}
                <div className="mb-5">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block mb-2">
                    Destination folder
                  </label>
                  <select
                    value={uploadFolderId ?? "root"}
                    onChange={(e) => setUploadFolderId((e.target.value === "root" ? null : e.target.value) as Id<"assetFolders"> | null)}
                    disabled={uploading}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none transition-colors"
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
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowUploadModal(false)}
                    disabled={uploading}
                    className="text-xs text-zinc-500 px-3 py-2 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-30"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex items-center gap-2 text-xs bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setMoveAssetId(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold">Move to folder</h2>
                  <button
                    onClick={() => setMoveAssetId(null)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-5">
                  <select
                    value={moveFolderId ?? "root"}
                    onChange={(e) => setMoveFolderId((e.target.value === "root" ? null : e.target.value) as Id<"assetFolders"> | null)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none transition-colors"
                  >
                    <option value="root">Root (no folder)</option>
                    {folders?.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.parentId ? "\u00A0\u00A0\u00A0\u00A0" : ""}{f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setMoveAssetId(null)}
                    className="text-xs text-zinc-500 px-3 py-2 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
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
                    className="flex items-center gap-2 text-xs bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-semibold hover:bg-white transition-all"
                  >
                    <FolderInput className="h-3.5 w-3.5" />
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
