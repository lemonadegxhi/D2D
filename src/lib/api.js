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

export async function uploadUserFile({ username, fileName, mimeType, contentBase64 }) {
  const response = await fetch(`${API_BASE_URL}/files/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-demo-user": username,
    },
    body: JSON.stringify({
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
