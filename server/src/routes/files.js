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

router.post("/upload", async (req, res) => {
  try {
    const actor = await getValidatedActor(req);
    const { fileName, mimeType, contentBase64 } = req.body ?? {};

    if (!fileName || !mimeType || !contentBase64) {
      return res.status(400).json({
        message: "fileName, mimeType, and contentBase64 are required.",
      });
    }

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
        INSERT INTO user_files (owner_username, original_name, mime_type, byte_size, file_data)
        VALUES ($1, $2, $3, $4, decode($5, 'base64'))
        RETURNING id, owner_username, original_name, mime_type, byte_size, created_at
      `,
      [actor, fileName, mimeType, byteSize, contentBase64]
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
        SELECT id, owner_username, original_name, mime_type, byte_size, created_at
        FROM user_files
        WHERE owner_username = $1
        ORDER BY created_at DESC
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

module.exports = router;
