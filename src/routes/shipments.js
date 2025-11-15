import express from "express";
import { listShipments, updateShipmentStatus } from "../models/shipmentsModel.js";

const router = express.Router();

router.get("/", async (_req, res) => res.json(await listShipments()));
router.patch("/:id/status", async (req, res) => {
  const updated = await updateShipmentStatus(req.params.id, req.body.status);
  const io = req.app.get("io");
  io.emit("shipment_updated", { id: updated.id, status: updated.status });
  res.json(updated);
});

export default router;
