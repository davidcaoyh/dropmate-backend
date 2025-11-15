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
    const { latitude, longitude, accuracy } = req.body;
    const driverId = req.params.id;

    const event = await addDriverLocationEvent(driverId, latitude, longitude);

    // Get all active shipments for this driver
    const db = (await import("../models/db.js")).default;
    const { rows: activeShipments } = await db.query(
      `SELECT id FROM shipments
       WHERE driver_id = $1
       AND status IN ('assigned', 'in_transit')`,
      [driverId]
    );

    const io = req.app.get("io");

    // Broadcast general driver location update
    io.emit("driver_location_updated", {
      driverId,
      latitude,
      longitude,
      accuracy,
      timestamp: event.occurred_at,
    });

    // Emit package-specific location updates for tracking
    activeShipments.forEach((shipment) => {
      io.emit(`shipment_${shipment.id}_location`, {
        shipmentId: shipment.id,
        driverId,
        latitude,
        longitude,
        accuracy,
        timestamp: event.occurred_at,
      });
    });

    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add driver location" });
  }
});

export default router;
