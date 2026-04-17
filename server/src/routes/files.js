const express = require("express");

const pool = require("../config/db");
const { buildStorageOverview, listDirectory } = require("../services/storageService");

const router = express.Router();
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function getActor(req) {
  return req.header("x-demo-user") || "anonymous";
}

async function getValidatedActor(req) {
  const actor = getActor(req);

  if (!actor || actor === "anonymous") {
    throw new Error("Authentication required.");
  }

  const result = await pool.query("SELECT username FROM app_users WHERE username = $1", [actor]);

  if (result.rowCount === 0) {
    throw new Error("Unknown user.");
  }

  return actor;
}

async function logAuditEvent(username, action, targetPath) {
  await pool.query(
    `
      INSERT INTO file_audit_log (username, action, target_path)
      VALUES ($1, $2, $3)
    `,
    [username, action, targetPath]
  );
}

async function getFolderRecord(ownerUsername, folderId) {
  if (folderId == null) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT id, owner_username, parent_folder_id, folder_name, created_at, updated_at
      FROM user_folders
      WHERE id = $1 AND owner_username = $2
    `,
    [folderId, ownerUsername]
  );

  if (result.rowCount === 0) {
    throw new Error("Folder not found.");
  }

  return result.rows[0];
}

async function buildFolderTree(ownerUsername) {
  const result = await pool.query(
    `
      SELECT id, parent_folder_id, folder_name
      FROM user_folders
      WHERE owner_username = $1
      ORDER BY lower(folder_name), id
    `,
    [ownerUsername]
  );

  const map = new Map();

  for (const row of result.rows) {
    map.set(row.id, {
      id: row.id,
      name: row.folder_name,
      parentFolderId: row.parent_folder_id,
      children: [],
    });
  }

  const roots = [];

  for (const folder of map.values()) {
    if (folder.parentFolderId && map.has(folder.parentFolderId)) {
      map.get(folder.parentFolderId).children.push(folder);
    } else {
      roots.push(folder);
    }
  }

  return roots;
}

async function buildBreadcrumbs(ownerUsername, folderRecord) {
  const breadcrumbs = [{ id: null, name: ownerUsername }];

  if (!folderRecord) {
    return breadcrumbs;
  }

  const chain = [];
  let currentFolder = folderRecord;

  while (currentFolder) {
    chain.unshift({
      id: currentFolder.id,
      name: currentFolder.folder_name,
    });

    currentFolder =
      currentFolder.parent_folder_id == null
        ? null
        : await getFolderRecord(ownerUsername, currentFolder.parent_folder_id);
  }

  return breadcrumbs.concat(chain);
}

async function browseFolder(ownerUsername, folderId = null) {
  const folderRecord = await getFolderRecord(ownerUsername, folderId);
  const foldersPromise = pool.query(
    `
      SELECT id, owner_username, parent_folder_id, folder_name, created_at, updated_at
      FROM user_folders
      WHERE owner_username = $1
        AND parent_folder_id IS NOT DISTINCT FROM $2
      ORDER BY lower(folder_name), id
    `,
    [ownerUsername, folderId]
  );
  const filesPromise = pool.query(
    `
      SELECT id, owner_username, folder_id, original_name, mime_type, byte_size, created_at, updated_at
      FROM user_files
      WHERE owner_username = $1
        AND folder_id IS NOT DISTINCT FROM $2
      ORDER BY lower(original_name), id
    `,
    [ownerUsername, folderId]
  );
  const treePromise = buildFolderTree(ownerUsername);
  const breadcrumbsPromise = buildBreadcrumbs(ownerUsername, folderRecord);
  const [foldersResult, filesResult, folderTree, breadcrumbs] = await Promise.all([
    foldersPromise,
    filesPromise,
    treePromise,
    breadcrumbsPromise,
  ]);

  return {
    currentFolder: folderRecord
      ? {
          id: folderRecord.id,
          name: folderRecord.folder_name,
          parentFolderId: folderRecord.parent_folder_id,
        }
      : {
          id: null,
          name: ownerUsername,
          parentFolderId: null,
        },
    breadcrumbs,
    folderTree,
    folders: foldersResult.rows.map((row) => ({
      id: row.id,
      owner_username: row.owner_username,
      parent_folder_id: row.parent_folder_id,
      folder_name: row.folder_name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      item_type: "folder",
    })),
    files: filesResult.rows.map((row) => ({
      ...row,
      item_type: "file",
    })),
  };
}

async function ensureFolderNameAvailable(ownerUsername, parentFolderId, folderName, excludeFolderId = null) {
  const result = await pool.query(
    `
      SELECT id
      FROM user_folders
      WHERE owner_username = $1
        AND COALESCE(parent_folder_id, -1) = COALESCE($2, -1)
        AND lower(folder_name) = lower($3)
        AND ($4::INTEGER IS NULL OR id <> $4)
    `,
    [ownerUsername, parentFolderId, folderName, excludeFolderId]
  );

  if (result.rowCount > 0) {
    throw new Error("A folder with that name already exists here.");
  }
}

router.get("/overview", async (req, res) => {
  try {
    const overview = buildStorageOverview();
    await logAuditEvent(getActor(req), "overview", "/");

    res.json(overview);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load storage overview.",
      error: error.message,
    });
  }
});

router.get("/browse", async (req, res) => {
  try {
    const actor = await getValidatedActor(req);
    const folderId =
      req.query.folderId == null || req.query.folderId === ""
        ? null
        : Number(req.query.folderId);

    if (folderId !== null && (!Number.isInteger(folderId) || folderId <= 0)) {
      return res.status(400).json({
        message: "Invalid folder id.",
      });
    }

    const payload = await browseFolder(actor, folderId);
    await logAuditEvent(actor, "browse_files", String(folderId ?? "root"));

    return res.json(payload);
  } catch (error) {
    const status =
      error.message === "Authentication required."
        ? 401
        : error.message === "Unknown user."
          ? 403
          : error.message === "Folder not found."
            ? 404
            : 500;

    return res.status(status).json({
      message: "Failed to browse files.",
      error: error.message,
    });
  }
});

router.post("/folders", async (req, res) => {
  try {
    const actor = await getValidatedActor(req);
    const folderName = String(req.body?.folderName || "").trim();
    const parentFolderId = req.body?.parentFolderId == null ? null : Number(req.body.parentFolderId);

    if (!folderName) {
      return res.status(400).json({
        message: "Folder name is required.",
      });
    }

    if (parentFolderId !== null && (!Number.isInteger(parentFolderId) || parentFolderId <= 0)) {
      return res.status(400).json({
        message: "Invalid parent folder id.",
      });
    }

    await getFolderRecord(actor, parentFolderId);
    await ensureFolderNameAvailable(actor, parentFolderId, folderName);

    const result = await pool.query(
      `
        INSERT INTO user_folders (owner_username, parent_folder_id, folder_name)
        VALUES ($1, $2, $3)
        RETURNING id, owner_username, parent_folder_id, folder_name, created_at, updated_at
      `,
      [actor, parentFolderId, folderName]
    );

    await logAuditEvent(actor, "create_folder", folderName);

    return res.status(201).json({
      message: "Folder created successfully.",
      folder: result.rows[0],
    });
  } catch (error) {
    const status =
      error.message === "Authentication required."
        ? 401
        : error.message === "Unknown user."
          ? 403
          : error.message === "Folder not found."
            ? 404
            : error.message === "A folder with that name already exists here."
              ? 409
              : 500;

    return res.status(status).json({
      message: "Failed to create folder.",
      error: error.message,
    });
  }
});

router.post("/upload", async (req, res) => {
  try {
    const actor = await getValidatedActor(req);
    const { fileName, mimeType, contentBase64 } = req.body ?? {};
    const folderId = req.body?.folderId == null ? null : Number(req.body.folderId);

    if (!fileName || !mimeType || !contentBase64) {
      return res.status(400).json({
        message: "fileName, mimeType, and contentBase64 are required.",
      });
    }

    if (folderId !== null && (!Number.isInteger(folderId) || folderId <= 0)) {
      return res.status(400).json({
        message: "Invalid folder id.",
      });
    }

    await getFolderRecord(actor, folderId);

    const byteSize = Buffer.byteLength(contentBase64, "base64");

    if (!Number.isFinite(byteSize) || byteSize <= 0) {
      return res.status(400).json({
        message: "Uploaded file is empty or invalid.",
      });
    }

    if (byteSize > MAX_FILE_SIZE_BYTES) {
      return res.status(413).json({
        message: `File is too large. Max size is ${MAX_FILE_SIZE_BYTES} bytes.`,
      });
    }

    const result = await pool.query(
      `
        INSERT INTO user_files (owner_username, folder_id, original_name, mime_type, byte_size, file_data)
        VALUES ($1, $2, $3, $4, $5, decode($6, 'base64'))
        RETURNING id, owner_username, folder_id, original_name, mime_type, byte_size, created_at, updated_at
      `,
      [actor, folderId, fileName, mimeType, byteSize, contentBase64]
    );

    await logAuditEvent(actor, "upload", fileName);

    return res.status(201).json({
      message: "File uploaded successfully.",
      file: result.rows[0],
    });
  } catch (error) {
    const status =
      error.message === "Authentication required."
        ? 401
        : error.message === "Unknown user."
          ? 403
          : error.message === "Folder not found."
            ? 404
            : 500;

    return res.status(status).json({
      message: "Failed to upload file.",
      error: error.message,
    });
  }
});

router.get("/mine", async (req, res) => {
  try {
    const actor = await getValidatedActor(req);
    const result = await pool.query(
      `
        SELECT id, owner_username, folder_id, original_name, mime_type, byte_size, created_at, updated_at
        FROM user_files
        WHERE owner_username = $1
        ORDER BY updated_at DESC, id DESC
      `,
      [actor]
    );

    await logAuditEvent(actor, "list_files", "/user_files");

    return res.json({
      files: result.rows,
    });
  } catch (error) {
    const status =
      error.message === "Authentication required."
        ? 401
        : error.message === "Unknown user."
          ? 403
          : 500;

    return res.status(status).json({
      message: "Failed to load files.",
      error: error.message,
    });
  }
});

router.patch("/files/:id/rename", async (req, res) => {
  try {
    const actor = await getValidatedActor(req);
    const id = Number(req.params.id);
    const name = String(req.body?.name || "").trim();

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid file id.",
      });
    }

    if (!name) {
      return res.status(400).json({
        message: "File name is required.",
      });
    }

    const result = await pool.query(
      `
        UPDATE user_files
        SET original_name = $3,
            updated_at = NOW()
        WHERE id = $1 AND owner_username = $2
        RETURNING id, owner_username, folder_id, original_name, mime_type, byte_size, created_at, updated_at
      `,
      [id, actor, name]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "File not found.",
      });
    }

    await logAuditEvent(actor, "rename_file", `${id}:${name}`);

    return res.json({
      message: "File renamed successfully.",
      file: result.rows[0],
    });
  } catch (error) {
    const status =
      error.message === "Authentication required."
        ? 401
        : error.message === "Unknown user."
          ? 403
          : 500;

    return res.status(status).json({
      message: "Failed to rename file.",
      error: error.message,
    });
  }
});

router.patch("/files/:id/move", async (req, res) => {
  try {
    const actor = await getValidatedActor(req);
    const id = Number(req.params.id);
    const targetFolderId = req.body?.targetFolderId == null ? null : Number(req.body.targetFolderId);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid file id.",
      });
    }

    if (targetFolderId !== null && (!Number.isInteger(targetFolderId) || targetFolderId <= 0)) {
      return res.status(400).json({
        message: "Invalid target folder id.",
      });
    }

    await getFolderRecord(actor, targetFolderId);

    const result = await pool.query(
      `
        UPDATE user_files
        SET folder_id = $3,
            updated_at = NOW()
        WHERE id = $1 AND owner_username = $2
        RETURNING id, owner_username, folder_id, original_name, mime_type, byte_size, created_at, updated_at
      `,
      [id, actor, targetFolderId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "File not found.",
      });
    }

    await logAuditEvent(actor, "move_file", `${id}:${targetFolderId ?? "root"}`);

    return res.json({
      message: "File moved successfully.",
      file: result.rows[0],
    });
  } catch (error) {
    const status =
      error.message === "Authentication required."
        ? 401
        : error.message === "Unknown user."
          ? 403
          : error.message === "Folder not found."
            ? 404
            : 500;

    return res.status(status).json({
      message: "Failed to move file.",
      error: error.message,
    });
  }
});

router.get("/download/:id", async (req, res) => {
  try {
    const actor = await getValidatedActor(req);
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid file id.",
      });
    }

    const result = await pool.query(
      `
        SELECT id, owner_username, original_name, mime_type, byte_size, file_data
        FROM user_files
        WHERE id = $1 AND owner_username = $2
      `,
      [id, actor]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "File not found.",
      });
    }

    const file = result.rows[0];
    await logAuditEvent(actor, "download", String(file.id));
    res.setHeader("Content-Type", file.mime_type);
    res.setHeader("Content-Length", file.byte_size);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.original_name)}"`);

    return res.send(file.file_data);
  } catch (error) {
    const status =
      error.message === "Authentication required."
        ? 401
        : error.message === "Unknown user."
          ? 403
          : 500;

    return res.status(status).json({
      message: "Failed to download file.",
      error: error.message,
    });
  }
});

router.get("/storage/browse", async (req, res) => {
  try {
    const relativePath = typeof req.query.path === "string" ? req.query.path : "";
    const directory = listDirectory(relativePath);
    await logAuditEvent(getActor(req), "browse", directory.currentPath || "/");

    res.json(directory);
  } catch (error) {
    const status = error.message === "Invalid storage path." ? 400 : 404;

    res.status(status).json({
      message: "Failed to browse storage.",
      error: error.message,
    });
  }
});

module.exports = router;
