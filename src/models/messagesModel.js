import db from "./db.js";

/** List message threads (e.g., per shipment or order) */
export async function listThreads() {
  const { rows } = await db.query(`
    SELECT mt.id,
           mt.subject,
           mt.context_type,
           mt.context_id,
           mt.created_by,
           mt.created_at,
           COUNT(m.id) AS message_count
      FROM message_threads mt
      LEFT JOIN messages m ON m.thread_id = mt.id
  GROUP BY mt.id
  ORDER BY mt.created_at DESC;
  `);
  return rows;
}

/** Fetch messages in a specific thread */
export async function getMessagesByThread(threadId) {
  const { rows } = await db.query(
    `
    SELECT m.id,
           m.author_user_id,
           m.author_driver_id,
           m.body,
           m.sent_at
      FROM messages m
     WHERE m.thread_id = $1
  ORDER BY m.sent_at ASC;`,
    [threadId]
  );
  return rows;
}

/** Create a new message thread */
export async function createThread(subject, contextType, contextId, createdBy) {
  const { rows } = await db.query(
    `
    INSERT INTO message_threads (subject, context_type, context_id, created_by)
         VALUES ($1, $2, $3, $4)
      RETURNING *;
    `,
    [subject, contextType, contextId, createdBy]
  );
  return rows[0];
}

/** Post a new message */
export async function createMessage(threadId, authorUserId, body) {
  const { rows } = await db.query(
    `
    INSERT INTO messages (thread_id, author_user_id, body)
         VALUES ($1, $2, $3)
      RETURNING *;
    `,
    [threadId, authorUserId, body]
  );
  return rows[0];
}
