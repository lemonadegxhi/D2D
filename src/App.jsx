import { useEffect, useMemo, useRef, useState } from "react";

import {
  browseFiles,
  createCalendarEvent,
  createFolder,
  deleteCalendarEvent,
  deleteFile,
  deleteFolder,
  downloadFile,
  fetchCalendarEvents,
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
const AVAILABLE_THEMES = ["light", "dark", "sand"];

function getThemeStorageKey(username) {
  return `day2day-theme:${String(username || "").trim().toLowerCase()}`;
}

function getStoredTheme(username) {
  if (typeof window === "undefined" || !username) {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(getThemeStorageKey(username));
  return AVAILABLE_THEMES.includes(storedTheme) ? storedTheme : "light";
}

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

function isPdfFile(file) {
  const mimeType = String(file?.mime_type || file?.type || "").toLowerCase();
  const name = String(file?.original_name || file?.name || "").toLowerCase();

  return mimeType.includes("pdf") || name.endsWith(".pdf");
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

function normalizeRelativePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function getSelectionKey(item) {
  return `${item.type}:${item.id}`;
}

function getItemFromEntry(entry) {
  return {
    type: entry.item_type,
    id: entry.id,
  };
}

function buildCalendarDays(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  const today = new Date();

  for (let index = 0; index < startWeekday; index += 1) {
    cells.push({
      key: `empty-start-${index}`,
      label: "",
      dateKey: null,
      isCurrentMonth: false,
      isToday: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isToday =
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();

    cells.push({
      key: `day-${day}`,
      label: String(day),
      dateKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      isCurrentMonth: true,
      isToday,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      key: `empty-end-${cells.length}`,
      label: "",
      dateKey: null,
      isCurrentMonth: false,
      isToday: false,
    });
  }

  return {
    monthLabel: new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(firstDay),
    weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    cells,
  };
}

async function readEntry(entry, currentPath = "") {
  if (!entry) {
    return [];
  }

  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      entry.file(
        (file) => {
          const relativePath = normalizeRelativePath(
            [currentPath, entry.name].filter(Boolean).join("/")
          );
          resolve([{ file, relativePath }]);
        },
        () => reject(new Error("Failed to read dropped file."))
      );
    });
  }

  if (!entry.isDirectory) {
    return [];
  }

  const reader = entry.createReader();
  const children = [];

  async function readBatch() {
    return new Promise((resolve, reject) => {
      reader.readEntries(resolve, () => reject(new Error("Failed to read dropped folder.")));
    });
  }

  while (true) {
    const batch = await readBatch();

    if (batch.length === 0) {
      break;
    }

    children.push(...batch);
  }

  const nestedGroups = await Promise.all(
    children.map((child) => readEntry(child, [currentPath, entry.name].filter(Boolean).join("/")))
  );

  return nestedGroups.flat();
}

async function extractDroppedFiles(dataTransfer) {
  const items = Array.from(dataTransfer?.items || []);
  const entryReaders = items
    .map((item) =>
      item.kind === "file" && typeof item.webkitGetAsEntry === "function"
        ? item.webkitGetAsEntry()
        : null
    )
    .filter(Boolean);

  if (entryReaders.length > 0) {
    const groups = await Promise.all(entryReaders.map((entry) => readEntry(entry)));
    return groups.flat();
  }

  return Array.from(dataTransfer?.files || []).map((file) => ({
    file,
    relativePath: normalizeRelativePath(file.webkitRelativePath || file.name),
  }));
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
              onDropFile(event, node.id);
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

function getMonthDateKey(value) {
  return String(value || "").slice(0, 10);
}

function getTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatCalendarTimeRange(eventItem) {
  if (eventItem.startTime && eventItem.endTime) {
    return `${eventItem.startTime}-${eventItem.endTime}`;
  }

  if (eventItem.startTime) {
    return eventItem.startTime;
  }

  return "All day";
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
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectionAnchorKey, setSelectionAnchorKey] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarError, setCalendarError] = useState("");
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [isCalendarSaving, setIsCalendarSaving] = useState(false);
  const [calendarForm, setCalendarForm] = useState({
    title: "",
    eventDate: getTodayDateInputValue(),
    startTime: "",
    endTime: "",
    description: "",
  });
  const [browserData, setBrowserData] = useState({
    currentFolder: { id: null, name: "", parentFolderId: null },
    breadcrumbs: [],
    folderTree: [],
    folders: [],
    files: [],
  });
  const fileInputRef = useRef(null);
  const dashboardDate = useMemo(() => new Date(), []);
  const calendarEventMap = useMemo(() => {
    const map = new Map();

    for (const event of calendarEvents) {
      const key = getMonthDateKey(event.eventDate);

      if (!key) {
        continue;
      }

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(event);
    }

    return map;
  }, [calendarEvents]);
  const upcomingCalendarEvents = useMemo(
    () =>
      [...calendarEvents].sort((left, right) => {
        const leftKey = `${left.eventDate || ""} ${left.startTime || "00:00"}`;
        const rightKey = `${right.eventDate || ""} ${right.startTime || "00:00"}`;
        return leftKey.localeCompare(rightKey);
      }),
    [calendarEvents]
  );
  const calendar = useMemo(() => buildCalendarDays(dashboardDate), [dashboardDate]);

  const canUpload = useMemo(() => Boolean(authUser?.username), [authUser]);
  const currentEntries = useMemo(
    () => [
      ...browserData.folders.map((folder) => ({ ...folder, item_type: "folder" })),
      ...browserData.files.map((file) => ({ ...file, item_type: "file" })),
    ],
    [browserData.files, browserData.folders]
  );
  const currentSelectableItems = useMemo(
    () => currentEntries.map((entry) => getItemFromEntry(entry)),
    [currentEntries]
  );
  const selectedKeySet = useMemo(
    () => new Set(selectedItems.map((item) => getSelectionKey(item))),
    [selectedItems]
  );
  const selectedFile = useMemo(() => {
    if (selectedItems.length !== 1 || selectedItems[0].type !== "file") {
      return null;
    }

    return browserData.files.find((file) => file.id === selectedItems[0].id) ?? null;
  }, [browserData.files, selectedItems]);
  const selectedFolder = useMemo(() => {
    if (selectedItems.length !== 1 || selectedItems[0].type !== "folder") {
      return null;
    }

    return browserData.folders.find((folder) => folder.id === selectedItems[0].id) ?? null;
  }, [browserData.folders, selectedItems]);

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
    document.body.dataset.theme = page === "login" ? "light" : theme;
  }, [page, theme]);

  useEffect(() => {
    if (!authUser?.username || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(getThemeStorageKey(authUser.username), theme);
  }, [authUser, theme]);

  useEffect(() => {
    return () => {
      if (pdfPreview?.url) {
        URL.revokeObjectURL(pdfPreview.url);
      }
    };
  }, [pdfPreview]);

  async function loadCalendarEvents(username) {
    if (!username) {
      return;
    }

    setIsCalendarLoading(true);
    setCalendarError("");

    try {
      const eventsPayload = await fetchCalendarEvents(
        username,
        dashboardDate.getFullYear(),
        dashboardDate.getMonth() + 1
      );
      setCalendarEvents(eventsPayload.events || []);
    } catch (loadError) {
      setCalendarEvents([]);
      setCalendarError(loadError.message);
    } finally {
      setIsCalendarLoading(false);
    }
  }

  useEffect(() => {
    if (!authUser?.username || page !== "dashboard") {
      return;
    }

    loadCalendarEvents(authUser.username);
  }, [authUser, dashboardDate, page]);

  async function loadFolderView(username, folderId = currentFolderId) {
    const payload = await browseFiles(username, folderId);
    setBrowserData(payload);
    setCurrentFolderId(payload.currentFolder.id);
    setSelectedItems((current) => {
      const availableItems = [
        ...payload.folders.map((folder) => ({ type: "folder", id: folder.id })),
        ...payload.files.map((file) => ({ type: "file", id: file.id })),
      ];
      const availableKeys = new Set(availableItems.map((item) => getSelectionKey(item)));
      const preserved = current.filter((item) => availableKeys.has(getSelectionKey(item)));

      if (preserved.length > 0) {
        return preserved;
      }

      return availableItems[0] ? [availableItems[0]] : [];
    });
    setSelectionAnchorKey((current) => {
      const availableKeys = new Set([
        ...payload.folders.map((folder) => getSelectionKey({ type: "folder", id: folder.id })),
        ...payload.files.map((file) => getSelectionKey({ type: "file", id: file.id })),
      ]);

      if (current && availableKeys.has(current)) {
        return current;
      }

      const firstFolder = payload.folders[0];
      if (firstFolder) {
        return getSelectionKey({ type: "folder", id: firstFolder.id });
      }

      const firstFile = payload.files[0];
      return firstFile ? getSelectionKey({ type: "file", id: firstFile.id }) : null;
    });
  }

  function handleEntrySelection(event, entry) {
    const item = getItemFromEntry(entry);
    const itemKey = getSelectionKey(item);
    const entryKeys = currentSelectableItems.map((currentItem) => getSelectionKey(currentItem));
    const ctrlPressed = event.ctrlKey || event.metaKey;

    if (event.shiftKey && selectionAnchorKey && entryKeys.includes(selectionAnchorKey)) {
      const startIndex = entryKeys.indexOf(selectionAnchorKey);
      const endIndex = entryKeys.indexOf(itemKey);
      const [rangeStart, rangeEnd] =
        startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
      const rangeItems = currentSelectableItems.slice(rangeStart, rangeEnd + 1);

      setSelectedItems((current) => {
        if (ctrlPressed) {
          const merged = new Map(current.map((currentItem) => [getSelectionKey(currentItem), currentItem]));

          for (const rangeItem of rangeItems) {
            merged.set(getSelectionKey(rangeItem), rangeItem);
          }

          return Array.from(merged.values());
        }

        return rangeItems;
      });
      return;
    }

    if (ctrlPressed) {
      setSelectedItems((current) => {
        const exists = current.some((currentItem) => getSelectionKey(currentItem) === itemKey);

        if (exists) {
          const nextItems = current.filter((currentItem) => getSelectionKey(currentItem) !== itemKey);

          if (nextItems.length === 0) {
            setSelectionAnchorKey(null);
          }

          return nextItems;
        }

        return [...current, item];
      });
      setSelectionAnchorKey(itemKey);
      return;
    }

    setSelectedItems([item]);
    setSelectionAnchorKey(itemKey);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setIsWorking(true);
    setError("");

    try {
      const payload = await login(credentials.username, credentials.password);
      setTheme(getStoredTheme(payload.user.username));
      setAuthUser(payload.user);
      await loadFolderView(payload.user.username, null);
      setPage("dashboard");
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
      setSelectedItems([]);
      setSelectionAnchorKey(null);
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
      setTheme(getStoredTheme(payload.user.username));
      setAuthUser(payload.user);
      await loadFolderView(payload.user.username, null);
      setPage("dashboard");
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
      setSelectedItems([]);
      setSelectionAnchorKey(null);
      setError(signupError.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleFilesSelected(fileList, targetFolderId = currentFolderId) {
    if (!canUpload) {
      setError("Log in before uploading files.");
      return;
    }

    const selected = Array.from(fileList || []).map((file) => ({
      file,
      relativePath: normalizeRelativePath(file.webkitRelativePath || file.name),
    }));

    await handleFileImports(selected, targetFolderId);
  }

  async function handleFileImports(filesToImport, targetFolderId = currentFolderId) {
    if (!canUpload) {
      setError("Log in before uploading files.");
      return;
    }

    const selected = Array.from(filesToImport || []);

    if (selected.length === 0) {
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      for (const { file, relativePath } of selected) {
        const contentBase64 = await toBase64(file);

        await uploadUserFile({
          username: authUser.username,
          folderId: targetFolderId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          contentBase64,
          relativePath,
        });
      }

      await loadFolderView(authUser.username, currentFolderId);
      setStatus(`Imported ${selected.length} item${selected.length > 1 ? "s" : ""}.`);
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

  async function handleOpenFile(file) {
    if (!file) {
      return;
    }

    if (!isPdfFile(file)) {
      await handleDownload(file);
      return;
    }

    if (!authUser?.username) {
      return;
    }

    setError("");

    try {
      const blob = await downloadFile(authUser.username, file.id);
      const nextUrl = URL.createObjectURL(blob);

      setPdfPreview((current) => {
        if (current?.url) {
          URL.revokeObjectURL(current.url);
        }

        return {
          name: file.original_name,
          url: nextUrl,
        };
      });
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  function handleClosePdfPreview() {
    setPdfPreview((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }

      return null;
    });
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

  async function handleDeleteSelectedItem() {
    if (!authUser?.username || selectedItems.length === 0) {
      return;
    }

    const fileSelections = selectedItems.filter((item) => item.type === "file");
    const folderSelections = selectedItems.filter((item) => item.type === "folder");
    const singleSelectedName =
      selectedItems.length === 1
        ? selectedItems[0].type === "file"
          ? selectedFile?.original_name
          : selectedFolder?.folder_name
        : null;
    const confirmed = window.confirm(
      singleSelectedName
        ? selectedItems[0].type === "file"
          ? `Delete file "${singleSelectedName}"?`
          : `Delete folder "${singleSelectedName}" and everything inside it?`
        : `Delete ${fileSelections.length} file${fileSelections.length === 1 ? "" : "s"} and ${folderSelections.length} folder${folderSelections.length === 1 ? "" : "s"}? Folders will delete everything inside them.`
    );

    if (!confirmed) {
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      for (const item of fileSelections) {
        await deleteFile(authUser.username, item.id);
      }

      for (const item of folderSelections) {
        await deleteFolder(authUser.username, item.id);
      }

      setSelectedItems([]);
      setSelectionAnchorKey(null);
      await loadFolderView(authUser.username, currentFolderId);
      setStatus(
        `Deleted ${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"}.`
      );
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDeleteCurrentFolder() {
    if (!authUser?.username || currentFolderId == null) {
      return;
    }

    const folderName = browserData.currentFolder.name;
    const parentFolderId = browserData.currentFolder.parentFolderId ?? null;
    const confirmed = window.confirm(`Delete folder "${folderName}" and everything inside it?`);

    if (!confirmed) {
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      await deleteFolder(authUser.username, currentFolderId);
      setSelectedItems([]);
      setSelectionAnchorKey(null);
      await loadFolderView(authUser.username, parentFolderId);
      setStatus(`Deleted folder "${folderName}".`);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleExternalDrop(event, targetFolderId = currentFolderId) {
    const droppedFiles = await extractDroppedFiles(event.dataTransfer);
    await handleFileImports(droppedFiles, targetFolderId);
  }

  async function handleCreateCalendarEvent(event) {
    event.preventDefault();

    if (!authUser?.username) {
      return;
    }

    setIsCalendarSaving(true);
    setCalendarError("");

    try {
      await createCalendarEvent(authUser.username, calendarForm);
      await loadCalendarEvents(authUser.username);
      setCalendarForm((current) => ({
        ...current,
        title: "",
        startTime: "",
        endTime: "",
        description: "",
      }));
      setStatus(`Added "${calendarForm.title}" to the calendar.`);
    } catch (saveError) {
      setCalendarError(saveError.message);
    } finally {
      setIsCalendarSaving(false);
    }
  }

  async function handleDeleteCalendarEvent(eventId, eventTitle) {
    if (!authUser?.username) {
      return;
    }

    const confirmed = window.confirm(`Delete "${eventTitle}" from the calendar?`);

    if (!confirmed) {
      return;
    }

    setIsCalendarSaving(true);
    setCalendarError("");

    try {
      await deleteCalendarEvent(authUser.username, eventId);
      await loadCalendarEvents(authUser.username);
      setStatus(`Deleted "${eventTitle}" from the calendar.`);
    } catch (deleteError) {
      setCalendarError(deleteError.message);
    } finally {
      setIsCalendarSaving(false);
    }
  }

  function handleLogout() {
    setAuthUser(null);
    setCurrentFolderId(null);
    setSelectedItems([]);
    setSelectionAnchorKey(null);
    setDraggedFileId(null);
    handleClosePdfPreview();
    setCalendarEvents([]);
    setCalendarError("");
    setIsCalendarSaving(false);
    setCalendarForm({
      title: "",
      eventDate: getTodayDateInputValue(),
      startTime: "",
      endTime: "",
      description: "",
    });
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

  if (page === "dashboard") {
    return (
      <main className="app">
        <div className="container dashboard-page">
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
                        {AVAILABLE_THEMES.map((themeOption) => (
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
              <h1>DAY2DAY</h1>
            </div>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>

          <p className="status">Logged in as: {authUser?.username}</p>
          <p className="status">{status}</p>
          {error ? <p className="error">{error}</p> : null}

          <section className="dashboard-layout">
            <div className="calendar-panel">
              <div className="calendar-header">
                <h2>{calendar.monthLabel}</h2>
                <p className="status">This month at a glance</p>
              </div>
              <div className="calendar-grid calendar-weekdays">
                {calendar.weekdayLabels.map((label) => (
                  <span key={label} className="calendar-weekday">
                    {label}
                  </span>
                ))}
              </div>
              <div className="calendar-grid">
                {calendar.cells.map((cell) => (
                  <div
                    key={cell.key}
                    className={`calendar-cell ${cell.isCurrentMonth ? "" : "muted"} ${
                      cell.isToday ? "today" : ""
                    }`}
                  >
                    <span className="calendar-day-label">{cell.label}</span>
                    {cell.isCurrentMonth ? (
                      <div className="calendar-events">
                        {(calendarEventMap.get(cell.dateKey) || [])
                          .slice(0, 3)
                          .map((eventItem) => (
                            <span
                              key={eventItem.id}
                              className="calendar-event-pill"
                              title={
                                eventItem.description
                                  ? `${eventItem.title} - ${eventItem.description}`
                                  : eventItem.title
                              }
                            >
                              {eventItem.startTime ? `${eventItem.startTime} ` : ""}
                              {eventItem.title}
                            </span>
                          ))}
                        {(calendarEventMap.get(cell.dateKey) || []).length > 3 ? (
                          <span className="calendar-more-events">
                            +
                            {(calendarEventMap.get(cell.dateKey) || []).length - 3}{" "}
                            more
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-actions-panel">
              <div className="dashboard-card">
                <h2>File Explorer</h2>
                <p>Open the file app to manage folders, upload documents, and preview PDFs.</p>
                <button
                  type="button"
                  onClick={() => setPage("files")}
                >
                  Go to Files
                </button>
              </div>
              <div className="dashboard-card">
                <h2>Calendar Events</h2>
                <p>Add your own events here. They are saved to your account and shown on the monthly calendar.</p>
                {calendarError ? <p className="error">{calendarError}</p> : null}
                <form className="calendar-form" onSubmit={handleCreateCalendarEvent}>
                  <input
                    type="text"
                    value={calendarForm.title}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Event title"
                    maxLength={120}
                  />
                  <input
                    type="date"
                    value={calendarForm.eventDate}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
                        ...current,
                        eventDate: event.target.value,
                      }))
                    }
                  />
                  <div className="calendar-form-times">
                    <input
                      type="time"
                      value={calendarForm.startTime}
                      onChange={(event) =>
                        setCalendarForm((current) => ({
                          ...current,
                          startTime: event.target.value,
                        }))
                      }
                    />
                    <input
                      type="time"
                      value={calendarForm.endTime}
                      onChange={(event) =>
                        setCalendarForm((current) => ({
                          ...current,
                          endTime: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <input
                    type="text"
                    value={calendarForm.description}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Description (optional)"
                    maxLength={240}
                  />
                  <button type="submit" disabled={isCalendarSaving}>
                    {isCalendarSaving ? "Saving..." : "Add event"}
                  </button>
                </form>
                {isCalendarLoading ? <p className="status">Loading calendar events...</p> : null}
                <div className="calendar-list">
                  {upcomingCalendarEvents.length === 0 ? (
                    <p className="status">No events added for this month yet.</p>
                  ) : (
                    upcomingCalendarEvents.map((eventItem) => (
                      <div key={eventItem.id} className="calendar-list-item">
                        <div>
                          <strong>{eventItem.title}</strong>
                          <p>
                            {eventItem.eventDate} · {formatCalendarTimeRange(eventItem)}
                          </p>
                          {eventItem.description ? <p>{eventItem.description}</p> : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCalendarEvent(eventItem.id, eventItem.title)}
                          disabled={isCalendarSaving}
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
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
                      {AVAILABLE_THEMES.map((themeOption) => (
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
          <div className="top-actions">
            <button type="button" onClick={() => setPage("dashboard")}>
              Main Page
            </button>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
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
            handleExternalDrop(event, currentFolderId);
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
                if (draggedFileId != null) {
                  handleMoveFile(draggedFileId, null);
                  return;
                }
                handleExternalDrop(event, null);
              }}
            >
              <span className="folder-icon">▾</span>
              <span>{authUser?.username}</span>
            </button>
            <FolderTree
              nodes={browserData.folderTree}
              activeFolderId={currentFolderId}
              onSelectFolder={(folderId) => loadFolderView(authUser.username, folderId)}
              onDropFile={(event, targetFolderId) => {
                if (draggedFileId != null) {
                  handleMoveFile(draggedFileId, targetFolderId);
                  return;
                }
                handleExternalDrop(event, targetFolderId);
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
                <button
                  type="button"
                  onClick={handleDeleteSelectedItem}
                  disabled={isWorking || selectedItems.length === 0}
                >
                  Delete selected
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCurrentFolder}
                  disabled={isWorking || currentFolderId == null}
                >
                  Delete current folder
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
                          selectedKeySet.has(getSelectionKey({ type: "folder", id: entry.id })) ? "active" : ""
                        }`}
                        onClick={(event) => handleEntrySelection(event, entry)}
                        onDoubleClick={() => loadFolderView(authUser.username, entry.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggedFileId != null) {
                            handleMoveFile(draggedFileId, entry.id);
                            return;
                          }
                          handleExternalDrop(event, entry.id);
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
                          selectedKeySet.has(getSelectionKey({ type: "file", id: entry.id })) ? "active" : ""
                        }`}
                        onDragStart={() => setDraggedFileId(entry.id)}
                        onDragEnd={() => setDraggedFileId(null)}
                        onClick={(event) => handleEntrySelection(event, entry)}
                        onDoubleClick={() => handleOpenFile(entry)}
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
                {isPdfFile(selectedFile) ? (
                  <button type="button" onClick={() => handleOpenFile(selectedFile)}>
                    Open PDF
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

        {pdfPreview ? (
          <div className="pdf-preview-overlay" onClick={handleClosePdfPreview}>
            <div
              className="pdf-preview-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pdf-preview-header">
                <strong>{pdfPreview.name}</strong>
                <button type="button" onClick={handleClosePdfPreview}>
                  Close
                </button>
              </div>
              <iframe
                className="pdf-preview-frame"
                src={pdfPreview.url}
                title={pdfPreview.name}
              />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
