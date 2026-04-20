import { useEffect, useMemo, useRef, useState } from "react";

import DashboardPage from "./components/DashboardPage";
import FilesPage from "./components/FilesPage";
import LoginPage from "./components/LoginPage";
import {
  browseFiles,
  changePassword,
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
import { buildCalendarDays, getMonthDateKey, getTodayDateInputValue } from "./lib/calendarUtils";
import { formatBytes, formatDate } from "./lib/formatters";
import {
  extractDroppedFiles,
  extractDocxText,
  getFileCategory,
  getFilePreviewType,
  getItemFromEntry,
  getSelectionKey,
  normalizeRelativePath,
  toBase64,
} from "./lib/fileUtils";
import { getStoredTheme, getThemeStorageKey } from "./lib/theme";

const initialCredentials = {
  username: "",
  password: "",
};

const initialBrowserData = {
  storageUsedBytes: 0,
  currentFolder: { id: null, name: "", parentFolderId: null },
  breadcrumbs: [],
  folderTree: [],
  folders: [],
  files: [],
};

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
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [fileSearchQuery, setFileSearchQuery] = useState("");
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
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [signupForm, setSignupForm] = useState({
    email: "",
    username: "",
    password: "",
  });
  const [browserData, setBrowserData] = useState(initialBrowserData);
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

  const visibleEntries = useMemo(() => {
    const query = fileSearchQuery.trim().toLowerCase();

    if (!query) {
      return currentEntries;
    }

    return currentEntries.filter((entry) => {
      if (entry.item_type === "folder") {
        return String(entry.folder_name || "").toLowerCase().includes(query);
      }

      return [
        entry.original_name,
        entry.mime_type,
        getFileCategory(entry),
        formatBytes(entry.byte_size),
        formatDate(entry.updated_at),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [currentEntries, fileSearchQuery]);

  const currentSelectableItems = useMemo(
    () => visibleEntries.map((entry) => getItemFromEntry(entry)),
    [visibleEntries]
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

  useEffect(() => {
    if (!authUser?.username || page !== "dashboard") {
      return;
    }

    loadCalendarEvents(authUser.username);
  }, [authUser, dashboardDate, page]);

  useEffect(() => {
    if (!fileSearchQuery.trim()) {
      return;
    }

    const visibleKeys = new Set(currentSelectableItems.map((item) => getSelectionKey(item)));
    setSelectedItems((current) => current.filter((item) => visibleKeys.has(getSelectionKey(item))));
    setSelectionAnchorKey((current) => (current && visibleKeys.has(current) ? current : null));
  }, [currentSelectableItems, fileSearchQuery]);

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
          const merged = new Map(
            current.map((currentItem) => [getSelectionKey(currentItem), currentItem])
          );

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
      setBrowserData(initialBrowserData);
      setSelectedItems([]);
      setSelectionAnchorKey(null);
      setError(loginError.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    setIsWorking(true);
    setError("");

    try {
      const payload = await signup(signupForm.email, signupForm.username, signupForm.password);
      setTheme(getStoredTheme(payload.user.username));
      setAuthUser(payload.user);
      setCredentials(initialCredentials);
      setSignupForm({
        email: "",
        username: "",
        password: "",
      });
      setIsSignupOpen(false);
      await loadFolderView(payload.user.username, null);
      setPage("dashboard");
      setStatus("Account created. Start by creating folders or importing files.");
    } catch (signupError) {
      setAuthUser(null);
      setBrowserData(initialBrowserData);
      setSelectedItems([]);
      setSelectionAnchorKey(null);
      setError(signupError.message);
    } finally {
      setIsWorking(false);
    }
  }

  function openSignupDialog() {
    setSignupForm({
      email: "",
      username: "",
      password: "",
    });
    setError("");
    setIsSignupOpen(true);
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

    const previewType = getFilePreviewType(file);

    if (!previewType) {
      await handleDownload(file);
      return;
    }

    if (!authUser?.username) {
      return;
    }

    setError("");

    try {
      const blob = await downloadFile(authUser.username, file.id);
      const nextUrl = previewType === "docx" ? null : URL.createObjectURL(blob);
      const docxText = previewType === "docx" ? await extractDocxText(blob) : "";

      setPdfPreview((current) => {
        if (current?.url) {
          URL.revokeObjectURL(current.url);
        }

        return {
          name: file.original_name,
          type: previewType,
          text: docxText,
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
      setStatus(`Deleted ${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"}.`);
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

  async function handleChangePassword(event) {
    event.preventDefault();

    if (!authUser?.username) {
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      await changePassword(authUser.username, passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setStatus("Password updated.");
    } catch (passwordError) {
      setError(passwordError.message);
    } finally {
      setIsWorking(false);
    }
  }

  function handleOpenSettings() {
    setIsSettingsOpen(true);
    setIsMenuOpen(false);
  }

  function handleThemeChange(themeOption) {
    setTheme(themeOption);
    setStatus(`Theme changed to ${themeOption}.`);
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
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setSignupForm({
      email: "",
      username: "",
      password: "",
    });
    setBrowserData(initialBrowserData);
    setError("");
    setStatus("Log in to upload files.");
    setIsSignupOpen(false);
    setIsMenuOpen(false);
    setIsSettingsOpen(false);
    setPage("login");
  }

  if (page === "login") {
    return (
      <LoginPage
        credentials={credentials}
        error={error}
        healthStatus={healthStatus}
        isSignupOpen={isSignupOpen}
        isWorking={isWorking}
        onCloseSignup={() => setIsSignupOpen(false)}
        onLogin={handleLogin}
        onOpenSignup={openSignupDialog}
        onSignup={handleSignup}
        setCredentials={setCredentials}
        setSignupForm={setSignupForm}
        signupForm={signupForm}
        status={status}
      />
    );
  }

  if (page === "dashboard") {
    return (
      <DashboardPage
        authUser={authUser}
        calendar={calendar}
        calendarError={calendarError}
        calendarEventMap={calendarEventMap}
        calendarForm={calendarForm}
        error={error}
        isCalendarLoading={isCalendarLoading}
        isCalendarSaving={isCalendarSaving}
        isMenuOpen={isMenuOpen}
        isSettingsOpen={isSettingsOpen}
        isWorking={isWorking}
        onChangePassword={handleChangePassword}
        onCreateCalendarEvent={handleCreateCalendarEvent}
        onDeleteCalendarEvent={handleDeleteCalendarEvent}
        onLogout={handleLogout}
        onOpenSettings={handleOpenSettings}
        onThemeChange={handleThemeChange}
        passwordForm={passwordForm}
        setCalendarForm={setCalendarForm}
        setIsMenuOpen={setIsMenuOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        setPage={setPage}
        setPasswordForm={setPasswordForm}
        status={status}
        theme={theme}
        upcomingCalendarEvents={upcomingCalendarEvents}
      />
    );
  }

  return (
    <FilesPage
      authUser={authUser}
      browserData={browserData}
      canUpload={canUpload}
      currentEntries={currentEntries}
      currentFolderId={currentFolderId}
      draggedFileId={draggedFileId}
      error={error}
      fileInputRef={fileInputRef}
      fileSearchQuery={fileSearchQuery}
      isDragging={isDragging}
      isMenuOpen={isMenuOpen}
      isSettingsOpen={isSettingsOpen}
      isWorking={isWorking}
      onChangePassword={handleChangePassword}
      onClosePdfPreview={handleClosePdfPreview}
      onCreateFolder={handleCreateFolder}
      onDeleteSelectedItem={handleDeleteSelectedItem}
      onDownload={handleDownload}
      onEntrySelection={handleEntrySelection}
      onExternalDrop={handleExternalDrop}
      onFilesSelected={handleFilesSelected}
      onLoadFolderView={loadFolderView}
      onLogout={handleLogout}
      onMoveFile={handleMoveFile}
      onOpenFile={handleOpenFile}
      onOpenSettings={handleOpenSettings}
      onRenameSelectedFile={handleRenameSelectedFile}
      onThemeChange={handleThemeChange}
      passwordForm={passwordForm}
      pdfPreview={pdfPreview}
      selectedFile={selectedFile}
      selectedFolder={selectedFolder}
      selectedItems={selectedItems}
      selectedKeySet={selectedKeySet}
      setDraggedFileId={setDraggedFileId}
      setFileSearchQuery={setFileSearchQuery}
      setIsDragging={setIsDragging}
      setIsMenuOpen={setIsMenuOpen}
      setIsSettingsOpen={setIsSettingsOpen}
      setPage={setPage}
      setPasswordForm={setPasswordForm}
      status={status}
      theme={theme}
      visibleEntries={visibleEntries}
    />
  );
}
