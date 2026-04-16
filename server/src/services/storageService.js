const fs = require("fs");
const path = require("path");

const { storageRoot } = require("../config/env");

function ensureStorageRoot() {
  fs.mkdirSync(storageRoot, { recursive: true });
}

function normalizeRelativePath(relativePath = "") {
  return relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
}

function resolveStoragePath(relativePath = "") {
  const normalizedPath = normalizeRelativePath(relativePath);
  const absolutePath = path.resolve(storageRoot, normalizedPath);
  const relativeToRoot = path.relative(storageRoot, absolutePath);

  if (
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new Error("Invalid storage path.");
  }

  return {
    absolutePath,
    normalizedPath,
  };
}

function toFileEntry(dirent, parentPath) {
  const relativePath = normalizeRelativePath(
    path.posix.join(parentPath, dirent.name)
  );
  const absolutePath = path.join(storageRoot, relativePath);
  const stats = fs.statSync(absolutePath);

  return {
    name: dirent.name,
    path: relativePath,
    type: dirent.isDirectory() ? "directory" : "file",
    size: dirent.isDirectory() ? null : stats.size,
    updatedAt: stats.mtime.toISOString(),
  };
}

function listDirectory(relativePath = "") {
  const { absolutePath, normalizedPath } = resolveStoragePath(relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error("Directory not found.");
  }

  const stats = fs.statSync(absolutePath);

  if (!stats.isDirectory()) {
    throw new Error("Target path is not a directory.");
  }

  const entries = fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .map((dirent) => toFileEntry(dirent, normalizedPath))
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "directory" ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });

  return {
    currentPath: normalizedPath,
    entries,
  };
}

function scanAllFiles(currentPath = "", bucket = []) {
  const directory = listDirectory(currentPath);

  for (const entry of directory.entries) {
    if (entry.type === "directory") {
      scanAllFiles(entry.path, bucket);
      continue;
    }

    bucket.push(entry);
  }

  return bucket;
}

function buildStorageOverview() {
  const files = scanAllFiles();
  const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
  const recentFiles = [...files]
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
    .slice(0, 8);

  return {
    storageRoot,
    totalFiles: files.length,
    totalBytes,
    recentFiles,
  };
}

module.exports = {
  buildStorageOverview,
  ensureStorageRoot,
  listDirectory,
  resolveStoragePath,
};
