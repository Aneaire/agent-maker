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
  ArrowLeft,
  MoreHorizontal,
  Grid3X3,
  List,
  Sparkles,
} from "lucide-react";
import { useState, useRef } from "react";
import type { Doc, Id } from "@agent-maker/shared/convex/_generated/dataModel";

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

  // Get current folder info and subfolders
  const currentFolder = currentFolderId
    ? folders?.find((f) => f._id === currentFolderId)
    : null;
  const subFolders = folders?.filter((f) =>
    currentFolderId ? f.parentId === currentFolderId : !f.parentId
  ) ?? [];

  // Build breadcrumb
  const breadcrumbs: Array<{ id: string | null; name: string }> = [
    { id: null, name: "All Assets" },
  ];
  if (currentFolder) {
    // Walk up parent chain
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

  return (
    <div className="flex-1 overflow-y-auto">
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
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </button>
          </div>
        </div>

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
                      ? "rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:bg-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer"
                      : "flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-zinc-800/80 transition-colors cursor-pointer"
                  }`}
                  onClick={() => navigateToFolder(folder._id)}
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
                  className={`group relative rounded-xl border overflow-hidden transition-all cursor-pointer ${
                    selectedAsset === asset._id
                      ? "border-neon-400/50 ring-1 ring-neon-400/30 bg-zinc-800/80"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/80"
                  }`}
                  onClick={() => setSelectedAsset(selectedAsset === asset._id ? null : asset._id)}
                >
                  {/* Image Preview */}
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
                  {/* Info */}
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
                  {/* Hover Actions */}
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
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
                    selectedAsset === asset._id
                      ? "bg-neon-400/10 text-neon-400"
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
                Generated images and files will appear here. Ask your agent to
                generate an image, or create a folder to organize your assets.
              </p>
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
              {/* Image */}
              {selectedAssetData.resolvedUrl && selectedAssetData.type === "image" && (
                <div className="bg-zinc-950 flex items-center justify-center max-h-[60vh] overflow-hidden">
                  <img
                    src={selectedAssetData.resolvedUrl}
                    alt={selectedAssetData.name}
                    className="max-w-full max-h-[60vh] object-contain"
                  />
                </div>
              )}
              {/* Info */}
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
      </div>
    </div>
  );
}
