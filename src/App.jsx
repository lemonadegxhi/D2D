import { useEffect, useMemo, useRef, useState } from "react";

import { downloadFile, fetchHealth, fetchMyFiles, login, uploadUserFile } from "./lib/api";

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

export default function App() {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [authUser, setAuthUser] = useState(null);
  const [page, setPage] = useState("login");
  const [healthStatus, setHealthStatus] = useState("Checking database connection...");
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("Log in to upload files.");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const fileInputRef = useRef(null);

  const canUpload = useMemo(() => Boolean(authUser?.username), [authUser]);

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

  async function loadFiles(username) {
    const payload = await fetchMyFiles(username);
    setFiles(payload.files || []);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setIsWorking(true);
    setError("");

    try {
      const payload = await login(credentials.username, credentials.password);
      setAuthUser(payload.user);
      await loadFiles(payload.user.username);
      setPage("files");
      setStatus("Logged in. You can drag files into the area below or click to select.");
    } catch (loginError) {
      setAuthUser(null);
      setFiles([]);
      setError(loginError.message);
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
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          contentBase64,
        });
      }

      await loadFiles(authUser.username);
      setStatus(`Uploaded ${selected.length} file${selected.length > 1 ? "s" : ""}.`);
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

  function onDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    handleFilesSelected(event.dataTransfer.files);
  }

  function handleLogout() {
    setAuthUser(null);
    setFiles([]);
    setError("");
    setStatus("Log in to upload files.");
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
            <button type="submit" disabled={isWorking}>
              {isWorking ? "Working..." : "Log in"}
            </button>
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
          <h1>My Files</h1>
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

        <button
          type="button"
          className="select-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canUpload || isWorking}
        >
          Click to import files
        </button>

        <div
          className={`drop-zone ${isDragging ? "dragging" : ""} ${!canUpload ? "disabled" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (canUpload) {
              setIsDragging(true);
            }
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          Drag and drop files here
        </div>

        <section className="files">
          <h2>Saved files</h2>
          {files.length === 0 ? (
            <p className="status">No files uploaded yet.</p>
          ) : (
            files.map((file) => (
              <div className="file-row" key={file.id}>
                <div>
                  <strong>{file.original_name}</strong>
                  <p>{formatBytes(file.byte_size)}</p>
                </div>
                <button type="button" onClick={() => handleDownload(file)}>
                  Download
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
