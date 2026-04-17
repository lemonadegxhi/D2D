const API_BASE_URL = "http://localhost:5000/api";

async function parseJsonResponse(response) {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
}

export async function login(username, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  return parseJsonResponse(response);
}

export async function signup(username, password) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  return parseJsonResponse(response);
}

export async function fetchHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  return parseJsonResponse(response);
}

export async function uploadUserFile({ username, folderId, fileName, mimeType, contentBase64 }) {
  const response = await fetch(`${API_BASE_URL}/files/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-demo-user": username,
    },
    body: JSON.stringify({
      folderId,
      fileName,
      mimeType,
      contentBase64,
    }),
  });

  return parseJsonResponse(response);
}

export async function fetchMyFiles(username) {
  const response = await fetch(`${API_BASE_URL}/files/mine`, {
    headers: username
      ? {
          "x-demo-user": username,
        }
      : {},
  });

  return parseJsonResponse(response);
}

export async function browseFiles(username, folderId = null) {
  const url = new URL(`${API_BASE_URL}/files/browse`);

  if (folderId != null) {
    url.searchParams.set("folderId", folderId);
  }

  const response = await fetch(url, {
    headers: username
      ? {
          "x-demo-user": username,
        }
      : {},
  });

  return parseJsonResponse(response);
}

export async function createFolder(username, folderName, parentFolderId = null) {
  const response = await fetch(`${API_BASE_URL}/files/folders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-demo-user": username,
    },
    body: JSON.stringify({
      folderName,
      parentFolderId,
    }),
  });

  return parseJsonResponse(response);
}

export async function renameFile(username, fileId, name) {
  const response = await fetch(`${API_BASE_URL}/files/files/${fileId}/rename`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-demo-user": username,
    },
    body: JSON.stringify({
      name,
    }),
  });

  return parseJsonResponse(response);
}

export async function moveFile(username, fileId, targetFolderId) {
  const response = await fetch(`${API_BASE_URL}/files/files/${fileId}/move`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-demo-user": username,
    },
    body: JSON.stringify({
      targetFolderId,
    }),
  });

  return parseJsonResponse(response);
}

export async function downloadFile(username, fileId) {
  const response = await fetch(`${API_BASE_URL}/files/download/${fileId}`, {
    headers: username
      ? {
          "x-demo-user": username,
        }
      : {},
  });

  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.message || "Download failed.");
  }

  return response.blob();
}
