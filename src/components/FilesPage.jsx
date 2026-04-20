import FolderTree from "./FolderTree";
import FilePreviewModal from "./FilePreviewModal";
import MainMenu from "./MainMenu";
import SettingsPanel from "./SettingsPanel";
import { formatBytes, formatDate } from "../lib/formatters";
import {
  getFileCategory,
  getFilePreviewLabel,
  getSelectionKey,
  isPreviewableFile,
} from "../lib/fileUtils";

export default function FilesPage({
  authUser,
  browserData,
  canUpload,
  currentEntries,
  currentFolderId,
  draggedFileId,
  error,
  fileInputRef,
  fileSearchQuery,
  isDragging,
  isMenuOpen,
  isSettingsOpen,
  isWorking,
  onChangePassword,
  onClosePdfPreview,
  onCreateFolder,
  onDeleteSelectedItem,
  onDownload,
  onEntrySelection,
  onExternalDrop,
  onFilesSelected,
  onLoadFolderView,
  onLogout,
  onMoveFile,
  onOpenFile,
  onOpenSettings,
  onRenameSelectedFile,
  onThemeChange,
  passwordForm,
  pdfPreview,
  selectedFile,
  selectedFolder,
  selectedItems,
  selectedKeySet,
  setFileSearchQuery,
  setIsDragging,
  setIsMenuOpen,
  setIsSettingsOpen,
  setPage,
  setPasswordForm,
  setDraggedFileId,
  status,
  theme,
  visibleEntries,
}) {
  return (
    <main className="app">
      <div className="container files-page">
        <div className="top-row">
          <div className="top-left">
            <div className="menu-shell">
              <button
                type="button"
                className="menu-button"
                aria-label="Open menu"
                aria-expanded={isMenuOpen}
                onClick={() => setIsMenuOpen((current) => !current)}
              >
                <span />
                <span />
                <span />
              </button>
              {isMenuOpen ? (
                <MainMenu onOpenSettings={onOpenSettings} onLogout={onLogout} />
              ) : null}
            </div>
            <h1>My Files</h1>
          </div>
          <div className="top-actions">
            <button type="button" onClick={() => setPage("dashboard")}>
              Main Page
            </button>
          </div>
        </div>

        <p className="status">Logged in as: {authUser?.username}</p>
        <p className="status">Storage Used: {formatBytes(browserData.storageUsedBytes)}</p>
        <p className="status">{status}</p>
        {error ? <p className="error">{error}</p> : null}
        <SettingsPanel
          authUser={authUser}
          isOpen={isSettingsOpen}
          isWorking={isWorking}
          passwordForm={passwordForm}
          setPasswordForm={setPasswordForm}
          theme={theme}
          onChangePassword={onChangePassword}
          onClose={() => setIsSettingsOpen(false)}
          onThemeChange={onThemeChange}
        />

        <input
          ref={fileInputRef}
          className="hidden-input"
          type="file"
          multiple
          onChange={(event) => onFilesSelected(event.target.files)}
        />

        <section
          className={`explorer ${isDragging ? "dragging" : ""} ${!canUpload ? "disabled" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (canUpload) {
              setIsDragging(true);
            }
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (draggedFileId != null) {
              onMoveFile(draggedFileId, currentFolderId);
              return;
            }
            onExternalDrop(event, currentFolderId);
          }}
        >
          <aside className="explorer-sidebar">
            <p className="explorer-sidebar-label">Folders</p>
            <button
              type="button"
              className={`folder-tree-item root ${currentFolderId == null ? "active" : ""}`}
              onClick={() => onLoadFolderView(authUser.username, null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedFileId != null) {
                  onMoveFile(draggedFileId, null);
                  return;
                }
                onExternalDrop(event, null);
              }}
            >
              <span className="folder-icon">v</span>
              <span>{authUser?.username}</span>
            </button>
            <FolderTree
              nodes={browserData.folderTree}
              activeFolderId={currentFolderId}
              onSelectFolder={(folderId) => onLoadFolderView(authUser.username, folderId)}
              onDropFile={(event, targetFolderId) => {
                if (draggedFileId != null) {
                  onMoveFile(draggedFileId, targetFolderId);
                  return;
                }
                onExternalDrop(event, targetFolderId);
              }}
            />
          </aside>

          <div className="explorer-main">
            <div className="explorer-toolbar">
              <div>
                <h2>File Explorer</h2>
                <p className="status">Drag files into folders, create folders, and rename files.</p>
              </div>
              <div className="toolbar-actions">
                <div className="file-search">
                  <input
                    type="search"
                    value={fileSearchQuery}
                    onChange={(event) => setFileSearchQuery(event.target.value)}
                    placeholder="Search files"
                    aria-label="Search files and folders"
                  />
                  {fileSearchQuery ? (
                    <button
                      type="button"
                      className="search-clear-button"
                      onClick={() => setFileSearchQuery("")}
                      aria-label="Clear file search"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="select-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canUpload || isWorking}
                >
                  {isWorking ? "Working..." : "Import files"}
                </button>
                <button type="button" onClick={onCreateFolder} disabled={isWorking}>
                  New folder
                </button>
                <button type="button" onClick={onRenameSelectedFile} disabled={isWorking || !selectedFile}>
                  Rename file
                </button>
                <button
                  type="button"
                  onClick={onDeleteSelectedItem}
                  disabled={isWorking || selectedItems.length === 0}
                >
                  Delete selected
                </button>
              </div>
            </div>

            <div className="explorer-breadcrumbs">
              {browserData.breadcrumbs.map((crumb, index) => (
                <button
                  key={`${crumb.id ?? "root"}-${index}`}
                  type="button"
                  className="breadcrumb-button"
                  onClick={() => onLoadFolderView(authUser.username, crumb.id)}
                >
                  {crumb.name}
                </button>
              ))}
            </div>

            <div className="explorer-table">
              <div className="explorer-table-head">
                <span className="column-button name">Name</span>
                <span className="column-button type">Type</span>
                <span className="column-button modified">Date modified</span>
                <span className="column-button size">Size</span>
              </div>

              <div className="explorer-table-body">
                {currentEntries.length === 0 ? (
                  <div className="empty-state">
                    <p>This folder is empty.</p>
                    <p>Import files or create a folder to get started.</p>
                  </div>
                ) : visibleEntries.length === 0 ? (
                  <div className="empty-state">
                    <p>No files or folders match "{fileSearchQuery}".</p>
                    <p>Clear the search to show everything in this folder.</p>
                  </div>
                ) : (
                  visibleEntries.map((entry) =>
                    entry.item_type === "folder" ? (
                      <button
                        key={`folder-${entry.id}`}
                        type="button"
                        className={`file-row folder-row ${
                          selectedKeySet.has(getSelectionKey({ type: "folder", id: entry.id })) ? "active" : ""
                        }`}
                        onClick={(event) => onEntrySelection(event, entry)}
                        onDoubleClick={() => onLoadFolderView(authUser.username, entry.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggedFileId != null) {
                            onMoveFile(draggedFileId, entry.id);
                            return;
                          }
                          onExternalDrop(event, entry.id);
                        }}
                      >
                        <span className="file-cell name">[Folder] {entry.folder_name}</span>
                        <span className="file-cell type">Folder</span>
                        <span className="file-cell modified">{formatDate(entry.updated_at)}</span>
                        <span className="file-cell size">-</span>
                      </button>
                    ) : (
                      <button
                        key={`file-${entry.id}`}
                        type="button"
                        draggable
                        className={`file-row ${
                          selectedKeySet.has(getSelectionKey({ type: "file", id: entry.id })) ? "active" : ""
                        }`}
                        onDragStart={() => setDraggedFileId(entry.id)}
                        onDragEnd={() => setDraggedFileId(null)}
                        onClick={(event) => onEntrySelection(event, entry)}
                        onDoubleClick={() => onOpenFile(entry)}
                      >
                        <span className="file-cell name">{entry.original_name}</span>
                        <span className="file-cell type">{getFileCategory(entry)}</span>
                        <span className="file-cell modified">{formatDate(entry.updated_at)}</span>
                        <span className="file-cell size">{formatBytes(entry.byte_size)}</span>
                      </button>
                    )
                  )
                )}
              </div>
            </div>
          </div>

          <aside className="details-pane">
            <h2>Details</h2>
            {selectedFile ? (
              <>
                <div className="details-card">
                  <strong>{selectedFile.original_name}</strong>
                  <p>{getFileCategory(selectedFile)}</p>
                </div>
                <dl className="details-list">
                  <div>
                    <dt>Owner</dt>
                    <dd>{selectedFile.owner_username}</dd>
                  </div>
                  <div>
                    <dt>Folder</dt>
                    <dd>{browserData.currentFolder.name || authUser?.username}</dd>
                  </div>
                  <div>
                    <dt>Modified</dt>
                    <dd>{formatDate(selectedFile.updated_at)}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{formatBytes(selectedFile.byte_size)}</dd>
                  </div>
                  <div>
                    <dt>MIME type</dt>
                    <dd>{selectedFile.mime_type}</dd>
                  </div>
                </dl>
                <button type="button" onClick={() => onDownload(selectedFile)}>
                  Download selected
                </button>
                {isPreviewableFile(selectedFile) ? (
                  <button type="button" onClick={() => onOpenFile(selectedFile)}>
                    {getFilePreviewLabel(selectedFile)}
                  </button>
                ) : null}
              </>
            ) : selectedItems.length > 1 ? (
              <div className="details-card">
                <strong>{selectedItems.length} items selected</strong>
                <p>
                  {selectedItems.filter((item) => item.type === "folder").length} folder
                  {selectedItems.filter((item) => item.type === "folder").length === 1 ? "" : "s"} and{" "}
                  {selectedItems.filter((item) => item.type === "file").length} file
                  {selectedItems.filter((item) => item.type === "file").length === 1 ? "" : "s"} selected.
                </p>
              </div>
            ) : selectedFolder ? (
              <div className="details-card">
                <strong>{selectedFolder.folder_name}</strong>
                <p>Folder selected.</p>
              </div>
            ) : (
              <div className="details-card">
                <strong>No item selected</strong>
                <p>Select a file or folder to manage it.</p>
              </div>
            )}
          </aside>
        </section>

        <FilePreviewModal preview={pdfPreview} onClose={onClosePdfPreview} />
      </div>
    </main>
  );
}
