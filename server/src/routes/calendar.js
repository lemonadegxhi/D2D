const express = require("express");

const pool = require("../config/db");

const router = express.Router();

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

function buildMonthRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function normalizeDate(value) {
  const eventDate = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    throw new Error("A valid event date is required.");
  }

  return eventDate;
}

function normalizeTime(value, fieldName) {
  if (value == null || String(value).trim() === "") {
    return null;
  }

  const normalized = String(value).trim();

  if (!/^\d{2}:\d{2}$/.test(normalized)) {
    throw new Error(`${fieldName} must use HH:MM format.`);
  }

  return normalized;
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

router.get("/events", async (req, res) => {
  try {
    const actor = await getValidatedActor(req);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
      return res.status(400).json({
        message: "Invalid year.",
      });
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({
        message: "Invalid month.",
      });
    }

    const { start, end } = buildMonthRange(year, month);
    const result = await pool.query(
      `
        SELECT id, owner_username, title, description, event_date, start_time, end_time, created_at, updated_at
        FROM calendar_events
        WHERE owner_username = $1
          AND event_date >= $2
          AND event_date < $3
        ORDER BY event_date ASC, start_time ASC NULLS FIRST, id ASC
      `,
      [actor, start, end]
    );

    await logAuditEvent(actor, "list_calendar_events", `${year}-${String(month).padStart(2, "0")}`);

    return res.json({
      events: result.rows.map((row) => ({
        id: row.id,
        owner_username: row.owner_username,
        title: row.title,
        description: row.description,
        eventDate: row.event_date,
        startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
        endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    const status =
      error.message === "Authentication required."
        ? 401
        : error.message === "Unknown user."
          ? 403
          : 500;

    return res.status(status).json({
      message: "Failed to load calendar events.",
      error: error.message,
    });
  }
});

router.post("/events", async (req, res) => {
  try {
    const actor = await getValidatedActor(req);
    const title = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "").trim();
    const eventDate = normalizeDate(req.body?.eventDate);
    const startTime = normalizeTime(req.body?.startTime, "Start time");
    const endTime = normalizeTime(req.body?.endTime, "End time");

    if (!title) {
      return res.status(400).json({
        message: "Event title is required.",
      });
    }

    if (startTime && endTime && startTime > endTime) {
      return res.status(400).json({
        message: "End time must be after start time.",
      });
    }

    const result = await pool.query(
      `
        INSERT INTO calendar_events (owner_username, title, description, event_date, start_time, end_time)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, owner_username, title, description, event_date, start_time, end_time, created_at, updated_at
      `,
      [actor, title, description, eventDate, startTime, endTime]
    );

    await logAuditEvent(actor, "create_calendar_event", `${eventDate}:${title}`);

    return res.status(201).json({
      message: "Calendar event created.",
      event: {
        id: result.rows[0].id,
        owner_username: result.rows[0].owner_username,
        title: result.rows[0].title,
        description: result.rows[0].description,
        eventDate: result.rows[0].event_date,
        startTime: result.rows[0].start_time ? String(result.rows[0].start_time).slice(0, 5) : null,
        endTime: result.rows[0].end_time ? String(result.rows[0].end_time).slice(0, 5) : null,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      },
    });
  } catch (error) {
    const isValidationError =
      error.message === "A valid event date is required." ||
      String(error.message || "").includes("must use HH:MM format.");
    const status =
      error.message === "Authentication required."
        ? 401
        : error.message === "Unknown user."
          ? 403
          : isValidationError
            ? 400
            : 500;

    return res.status(status).json({
      message: "Failed to create calendar event.",
      error: error.message,
    });
  }
});

router.delete("/events/:id", async (req, res) => {
  try {
    const actor = await getValidatedActor(req);
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid event id.",
      });
    }

    const result = await pool.query(
      `
        DELETE FROM calendar_events
        WHERE id = $1 AND owner_username = $2
        RETURNING id, title, event_date
      `,
      [id, actor]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Event not found.",
      });
    }

    await logAuditEvent(actor, "delete_calendar_event", `${result.rows[0].event_date}:${result.rows[0].title}`);

    return res.json({
      message: "Calendar event deleted.",
      event: {
        id: result.rows[0].id,
        title: result.rows[0].title,
        eventDate: result.rows[0].event_date,
      },
    });
  } catch (error) {
    const status =
      error.message === "Authentication required."
        ? 401
        : error.message === "Unknown user."
          ? 403
          : 500;

    return res.status(status).json({
      message: "Failed to delete calendar event.",
      error: error.message,
    });
  }
});

module.exports = router;
