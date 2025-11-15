import express from "express";
import {
  listDrivers,
  updateDriverStatus,
  addDriverLocationEvent,
} from "../models/driverModel.js";

const router = express.Router();

// GET /api/drivers → list all drivers
router.get("/", async (_req, res) => {
  try {
    const drivers = await listDrivers();
    res.json(drivers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

// PATCH /api/drivers/:id/status
router.patch("/:id/status", async (req, res) => {
  try {
    const updated = await updateDriverStatus(req.params.id, req.body.status);
    const io = req.app.get("io");
    io.emit("driver_status_updated", updated);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update driver status" });
  }
});

// POST /api/drivers/:id/location
router.post("/:id/location", async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const event = await addDriverLocationEvent(
      req.params.id,
      latitude,
      longitude
    );

    // Broadcast real-time update
    const io = req.app.get("io");
    io.emit("driver_location_updated", {
      driverId: req.params.id,
      latitude,
      longitude,
    });

    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add driver location" });
  }
});

export default router;
