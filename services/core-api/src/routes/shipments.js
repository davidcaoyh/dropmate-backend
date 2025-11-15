import express from "express";
import {
  listShipments,
  getShipmentById,
  getShipmentByTrackingNumber,
  getShipmentWithLiveLocation,
  assignDriverToShipment,
  updateShipmentStatus,
} from "../models/shipmentsModel.js";

const router = express.Router();

// GET /api/shipments - list all shipments
router.get("/", async (_req, res) => {
  try {
    const shipments = await listShipments();
    res.json(shipments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch shipments" });
  }
});

// GET /api/shipments/:id - get shipment by ID
router.get("/:id", async (req, res) => {
  try {
    const shipment = await getShipmentById(req.params.id);
    if (!shipment) {
      return res.status(404).json({ error: "Shipment not found" });
    }
    res.json(shipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch shipment" });
  }
});

// GET /api/shipments/track/:trackingNumber - track by tracking number
router.get("/track/:trackingNumber", async (req, res) => {
  try {
    const shipment = await getShipmentByTrackingNumber(req.params.trackingNumber);
    if (!shipment) {
      return res.status(404).json({ error: "Shipment not found" });
    }
    res.json(shipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to track shipment" });
  }
});

// GET /api/shipments/:id/location - get shipment with live driver location
router.get("/:id/location", async (req, res) => {
  try {
    const shipment = await getShipmentWithLiveLocation(req.params.id);
    if (!shipment) {
      return res.status(404).json({ error: "Shipment not found" });
    }

    // If no driver assigned or no location data
    if (!shipment.driver_id) {
      return res.json({
        ...shipment,
        current_location: null,
        message: "No driver assigned yet",
      });
    }

    res.json(shipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch shipment location" });
  }
});

// POST /api/shipments/:id/assign-driver - assign driver to shipment
router.post("/:id/assign-driver", async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) {
      return res.status(400).json({ error: "Driver ID is required" });
    }

    const updated = await assignDriverToShipment(req.params.id, driverId);
    const io = req.app.get("io");
    io.emit("shipment_assigned", {
      shipmentId: updated.id,
      driverId: updated.driver_id,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to assign driver" });
  }
});

// PATCH /api/shipments/:id/status - update shipment status
router.patch("/:id/status", async (req, res) => {
  try {
    const updated = await updateShipmentStatus(req.params.id, req.body.status);
    const io = req.app.get("io");
    io.emit("shipment_updated", { id: updated.id, status: updated.status });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update shipment status" });
  }
});

export default router;
