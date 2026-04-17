import { useEffect, useMemo, useRef, useState } from "react";

import {
  browseFiles,
  createFolder,
  downloadFile,
  fetchHealth,
  login,
  moveFile,
  renameFile,
  signup,
  uploadUserFile,
} from "./lib/api";

const initialCredentials = {
  username: "admin",
  password: "ChangeMeNow123!",
};

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getFileCategory(file) {
  const mimeType = String(file?.mime_type || "").toLowerCase();
  const name = String(file?.original_name || "").toLowerCase();

  if (mimeType.startsWith("image/")) {
    return "Image";
  }

  if (mimeType.startsWith("audio/")) {
    return "Audio";
  }

  if (mimeType.startsWith("video/")) {
    return "Video";
  }

  if (
    mimeType.includes("zip") ||
    mimeType.includes("compressed") ||
    name.endsWith(".zip") ||
    name.endsWith(".rar") ||
    name.endsWith(".7z")
  ) {
    return "Archive";
  }

  if (name.includes(".")) {
    return `${name.split(".").pop().toUpperCase()} file`;
  }

  return "File";
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1];

      if (!base64) {
        reject(new Error("Failed to read file."));
        return;
      }

      resolve(base64);
    };

    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function FolderTree({ nodes, activeFolderId, onSelectFolder, onDropFile }) {
  return (
    <div className="folder-tree">
      {nodes.map((node) => (
        <div key={node.id} className="folder-tree-node">
          <button
            type="button"
            className={`folder-tree-item ${activeFolderId === node.id ? "active" : ""}`}
            onClick={() => onSelectFolder(node.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onDropFile(node.id);
            }}
          >
            <span className="folder-icon">▸</span>
            <span>{node.name}</span>
          </button>
          {node.children.length > 0 ? (
            <FolderTree
              nodes={node.children}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
              onDropFile={onDropFile}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [authUser, setAuthUser] = useState(null);
  const [page, setPage] = useState("login");
  const [theme, setTheme] = useState("light");
  const [healthStatus, setHealthStatus] = useState("Checking database connection...");
  const [status, setStatus] = useState("Log in to upload files.");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [draggedFileId, setDraggedFileId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [browserData, setBrowserData] = useState({
    currentFolder: { id: null, name: "", parentFolderId: null },
    breadcrumbs: [],
    folderTree: [],
    folders: [],
    files: [],
  });
  const fileInputRef = useRef(null);

  const canUpload = useMemo(() => Boolean(authUser?.username), [authUser]);
  const currentEntries = useMemo(
    () => [
      ...browserData.folders.map((folder) => ({ ...folder, item_type: "folder" })),
      ...browserData.files.map((file) => ({ ...file, item_type: "file" })),
    ],
    [browserData.files, browserData.folders]
  );
  const selectedFile = useMemo(() => {
    if (!selectedItem || selectedItem.type !== "file") {
      return null;
    }

    return browserData.files.find((file) => file.id === selectedItem.id) ?? null;
  }, [browserData.files, selectedItem]);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const payload = await fetchHealth();

        if (!cancelled) {
          setHealthStatus(`Database: ${payload.database} (${payload.status})`);
        }
      } catch (healthError) {
        if (!cancelled) {
          setHealthStatus(`Database check failed: ${healthError.message}`);
        }
      }
    }

    loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  async function loadFolderView(username, folderId = currentFolderId) {
    const payload = await browseFiles(username, folderId);
    setBrowserData(payload);
    setCurrentFolderId(payload.currentFolder.id);
    setSelectedItem((current) => {
      if (!current) {
        return payload.files[0]
          ? { type: "file", id: payload.files[0].id }
          : payload.folders[0]
            ? { type: "folder", id: payload.folders[0].id }
            : null;
      }

      const stillExists =
        payload.files.some((file) => current.type === "file" && file.id === current.id) ||
        payload.folders.some((folder) => current.type === "folder" && folder.id === current.id);

      if (stillExists) {
        return current;
      }

      return payload.files[0]
        ? { type: "file", id: payload.files[0].id }
        : payload.folders[0]
          ? { type: "folder", id: payload.folders[0].id }
          : null;
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    setIsWorking(true);
    setError("");

    try {
      const payload = await login(credentials.username, credentials.password);
      setAuthUser(payload.user);
      await loadFolderView(payload.user.username, null);
      setPage("files");
      setStatus("Logged in. Import files, create folders, or drag files into folders.");
    } catch (loginError) {
      setAuthUser(null);
      setBrowserData({
        currentFolder: { id: null, name: "", parentFolderId: null },
        breadcrumbs: [],
        folderTree: [],
        folders: [],
        files: [],
      });
      setError(loginError.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSignup() {
    setIsWorking(true);
    setError("");

    try {
      const payload = await signup(credentials.username, credentials.password);
      setAuthUser(payload.user);
      await loadFolderView(payload.user.username, null);
      setPage("files");
      setStatus("Account created. Start by creating folders or importing files.");
    } catch (signupError) {
      setAuthUser(null);
      setBrowserData({
        currentFolder: { id: null, name: "", parentFolderId: null },
        breadcrumbs: [],
        folderTree: [],
        folders: [],
        files: [],
      });
      setError(signupError.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleFilesSelected(fileList) {
    if (!canUpload) {
      setError("Log in before uploading files.");
      return;
    }

    const selected = Array.from(fileList || []);

    if (selected.length === 0) {
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      for (const file of selected) {
        const contentBase64 = await toBase64(file);

        await uploadUserFile({
          username: authUser.username,
          folderId: currentFolderId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          contentBase64,
        });
      }

      await loadFolderView(authUser.username, currentFolderId);
      setStatus(`Imported ${selected.length} file${selected.length > 1 ? "s" : ""}.`);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setIsWorking(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDownload(file) {
    if (!authUser?.username) {
      return;
    }

    setError("");

    try {
      const blob = await downloadFile(authUser.username, file.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.original_name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  async function handleCreateFolder() {
    if (!authUser?.username) {
      return;
    }

    const folderName = window.prompt("Folder name");

    if (!folderName) {
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      await createFolder(authUser.username, folderName, currentFolderId);
      await loadFolderView(authUser.username, currentFolderId);
      setStatus(`Created folder "${folderName}".`);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRenameSelectedFile() {
    if (!authUser?.username || !selectedFile) {
      return;
    }

    const nextName = window.prompt("Rename file", selectedFile.original_name);

    if (!nextName || nextName === selectedFile.original_name) {
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      await renameFile(authUser.username, selectedFile.id, nextName);
      await loadFolderView(authUser.username, currentFolderId);
      setStatus(`Renamed file to "${nextName}".`);
    } catch (renameError) {
      setError(renameError.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleMoveFile(fileId, targetFolderId) {
    if (!authUser?.username || fileId == null) {
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      await moveFile(authUser.username, fileId, targetFolderId);
      await loadFolderView(authUser.username, currentFolderId);
      setStatus("Moved file.");
    } catch (moveError) {
      setError(moveError.message);
    } finally {
      setDraggedFileId(null);
      setIsWorking(false);
    }
  }

  function handleLogout() {
    setAuthUser(null);
    setCurrentFolderId(null);
    setSelectedItem(null);
    setDraggedFileId(null);
    setBrowserData({
      currentFolder: { id: null, name: "", parentFolderId: null },
      breadcrumbs: [],
      folderTree: [],
      folders: [],
      files: [],
    });
    setError("");
    setStatus("Log in to upload files.");
    setIsMenuOpen(false);
    setPage("login");
  }

  if (page === "login") {
    return (
      <main className="app">
        <div className="container login-page">
          <h1>DAY2DAY Login</h1>
          <p className="health">{healthStatus}</p>
          <form className="login" onSubmit={handleLogin}>
            <input
              type="text"
              value={credentials.username}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
              placeholder="Username"
            />
            <input
              type="password"
              value={credentials.password}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="Password"
            />
            <div className="login-actions">
              <button type="submit" disabled={isWorking}>
                {isWorking ? "Working..." : "Log in"}
              </button>
              <button type="button" disabled={isWorking} onClick={handleSignup}>
                {isWorking ? "Working..." : "Sign up"}
              </button>
            </div>
          </form>
          <p className="status">{status}</p>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </main>
    );
  }

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
                <div className="menu-dropdown">
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setStatus(`Profile: ${authUser?.username}`);
                      setIsMenuOpen(false);
                    }}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setStatus("Settings panel coming soon.");
                      setIsMenuOpen(false);
                    }}
                  >
                    Settings
                  </button>
                  <div className="menu-section">
                    <p className="menu-label">Theme</p>
                    <div className="theme-options">
                      {["light", "dark", "sand"].map((themeOption) => (
                        <button
                          key={themeOption}
                          type="button"
                          className={`menu-item ${theme === themeOption ? "active" : ""}`}
                          onClick={() => {
                            setTheme(themeOption);
                            setStatus(`Theme changed to ${themeOption}.`);
                            setIsMenuOpen(false);
                          }}
                        >
                          {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <h1>My Files</h1>
          </div>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>

        <p className="status">Logged in as: {authUser?.username}</p>
        <p className="status">{status}</p>
        {error ? <p className="error">{error}</p> : null}

        <input
          ref={fileInputRef}
          className="hidden-input"
          type="file"
          multiple
          onChange={(event) => handleFilesSelected(event.target.files)}
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
              handleMoveFile(draggedFileId, currentFolderId);
              return;
            }
            handleFilesSelected(event.dataTransfer.files);
          }}
        >
          <aside className="explorer-sidebar">
            <p className="explorer-sidebar-label">Folders</p>
            <button
              type="button"
              className={`folder-tree-item root ${currentFolderId == null ? "active" : ""}`}
              onClick={() => loadFolderView(authUser.username, null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleMoveFile(draggedFileId, null);
              }}
            >
              <span className="folder-icon">▾</span>
              <span>{authUser?.username}</span>
            </button>
            <FolderTree
              nodes={browserData.folderTree}
              activeFolderId={currentFolderId}
              onSelectFolder={(folderId) => loadFolderView(authUser.username, folderId)}
              onDropFile={(targetFolderId) => handleMoveFile(draggedFileId, targetFolderId)}
            />
          </aside>

          <div className="explorer-main">
            <div className="explorer-toolbar">
              <div>
                <h2>File Explorer</h2>
                <p className="status">Drag files into folders, create folders, and rename files.</p>
              </div>
              <div className="toolbar-actions">
                <button
                  type="button"
                  className="select-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canUpload || isWorking}
                >
                  {isWorking ? "Working..." : "Import files"}
                </button>
                <button type="button" onClick={handleCreateFolder} disabled={isWorking}>
                  New folder
                </button>
                <button
                  type="button"
                  onClick={handleRenameSelectedFile}
                  disabled={isWorking || !selectedFile}
                >
                  Rename file
                </button>
              </div>
            </div>

            <div className="explorer-breadcrumbs">
              {browserData.breadcrumbs.map((crumb, index) => (
                <button
                  key={`${crumb.id ?? "root"}-${index}`}
                  type="button"
                  className="breadcrumb-button"
                  onClick={() => loadFolderView(authUser.username, crumb.id)}
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
                ) : (
                  currentEntries.map((entry) =>
                    entry.item_type === "folder" ? (
                      <button
                        key={`folder-${entry.id}`}
                        type="button"
                        className={`file-row folder-row ${
                          selectedItem?.type === "folder" && selectedItem.id === entry.id ? "active" : ""
                        }`}
                        onClick={() => setSelectedItem({ type: "folder", id: entry.id })}
                        onDoubleClick={() => loadFolderView(authUser.username, entry.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleMoveFile(draggedFileId, entry.id);
                        }}
                      >
                        <span className="file-cell name">📁 {entry.folder_name}</span>
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
                          selectedItem?.type === "file" && selectedItem.id === entry.id ? "active" : ""
                        }`}
                        onDragStart={() => setDraggedFileId(entry.id)}
                        onDragEnd={() => setDraggedFileId(null)}
                        onClick={() => setSelectedItem({ type: "file", id: entry.id })}
                        onDoubleClick={() => handleDownload(entry)}
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
                <button type="button" onClick={() => handleDownload(selectedFile)}>
                  Download selected
                </button>
              </>
            ) : (
              <div className="details-card">
                <strong>No file selected</strong>
                <p>Select a file to rename it or download it.</p>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
