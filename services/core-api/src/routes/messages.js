import express from "express";
import {
  listThreads,
  getMessagesByThread,
  createThread,
  createMessage,
} from "../models/messagesModel.js";

const router = express.Router();

// GET /api/messages/threads
router.get("/threads", async (_req, res) => {
  try {
    const threads = await listThreads();
    res.json(threads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load threads" });
  }
});

// GET /api/messages/threads/:id
router.get("/threads/:id", async (req, res) => {
  try {
    const messages = await getMessagesByThread(req.params.id);
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// POST /api/messages/threads
router.post("/threads", async (req, res) => {
  try {
    const { subject, contextType, contextId, createdBy } = req.body;
    const thread = await createThread(subject, contextType, contextId, createdBy);
    res.json(thread);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create thread" });
  }
});

// POST /api/messages/threads/:id
router.post("/threads/:id", async (req, res) => {
  try {
    const { authorUserId, body } = req.body;
    const message = await createMessage(req.params.id, authorUserId, body);

    const io = req.app.get("io");
    io.emit("new_message", message);

    res.json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
