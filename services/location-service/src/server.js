import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./db.js";
import redis from "./redis.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "location-service",
    timestamp: new Date().toISOString(),
  });
});

// POST /api/location/:driverId - Record driver GPS location
app.post("/api/location/:driverId", async (req, res) => {
  try {
    const { driverId } = req.params;
    const { latitude, longitude, accuracy } = req.body;

    // Validate input
    if (!latitude || !longitude) {
      return res.status(400).json({
        error: "latitude and longitude are required",
      });
    }

    // Store in database (partitioned table for high performance)
    const result = await db.query(
      `INSERT INTO driver_location_events (driver_id, latitude, longitude, accuracy)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [driverId, latitude, longitude, accuracy || null]
    );

    const event = result.rows[0];

    // Publish to Redis for real-time broadcast
    const locationUpdate = {
      driverId,
      latitude,
      longitude,
      accuracy,
      timestamp: event.occurred_at,
    };

    // Publish to driver-specific channel
    await redis.publish(
      `driver:${driverId}:location`,
      JSON.stringify(locationUpdate)
    );

    // Also get active shipments and publish to shipment channels
    const { rows: activeShipments } = await db.query(
      `SELECT id FROM shipments
       WHERE driver_id = $1
       AND status IN ('assigned', 'in_transit')`,
      [driverId]
    );

    // Publish to each shipment channel
    for (const shipment of activeShipments) {
      await redis.publish(
        `shipment:${shipment.id}:location`,
        JSON.stringify({
          ...locationUpdate,
          shipmentId: shipment.id,
        })
      );
    }

    res.status(201).json({
      success: true,
      event,
      broadcastedToShipments: activeShipments.length,
    });
  } catch (err) {
    console.error("Error recording location:", err);
    res.status(500).json({ error: "Failed to record location" });
  }
});

// GET /api/location/:driverId/latest - Get latest location for driver
app.get("/api/location/:driverId/latest", async (req, res) => {
  try {
    const { driverId } = req.params;

    const result = await db.query(
      `SELECT latitude, longitude, accuracy, occurred_at as timestamp
       FROM driver_location_events
       WHERE driver_id = $1
       ORDER BY occurred_at DESC
       LIMIT 1`,
      [driverId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "No location data found for this driver",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching location:", err);
    res.status(500).json({ error: "Failed to fetch location" });
  }
});

// GET /api/location/:driverId/history - Get location history
app.get("/api/location/:driverId/history", async (req, res) => {
  try {
    const { driverId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const since = req.query.since; // ISO timestamp

    let query = `
      SELECT latitude, longitude, accuracy, occurred_at as timestamp
      FROM driver_location_events
      WHERE driver_id = $1
    `;

    const params = [driverId];

    if (since) {
      query += ` AND occurred_at >= $2`;
      params.push(since);
    }

    query += ` ORDER BY occurred_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);

    res.json({
      driverId,
      count: result.rows.length,
      locations: result.rows,
    });
  } catch (err) {
    console.error("Error fetching location history:", err);
    res.status(500).json({ error: "Failed to fetch location history" });
  }
});

// GET /api/location/shipment/:shipmentId - Get current location for a shipment's driver
app.get("/api/location/shipment/:shipmentId", async (req, res) => {
  try {
    const { shipmentId } = req.params;

    const result = await db.query(
      `SELECT
         s.id as shipment_id,
         s.tracking_number,
         s.status as shipment_status,
         d.id as driver_id,
         d.name as driver_name,
         d.vehicle_type,
         (SELECT json_build_object(
            'latitude', dle.latitude,
            'longitude', dle.longitude,
            'accuracy', dle.accuracy,
            'timestamp', dle.occurred_at
          )
          FROM driver_location_events dle
          WHERE dle.driver_id = s.driver_id
          ORDER BY dle.occurred_at DESC
          LIMIT 1) AS current_location
       FROM shipments s
       LEFT JOIN drivers d ON d.id = s.driver_id
       WHERE s.id = $1`,
      [shipmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Shipment not found" });
    }

    const shipment = result.rows[0];

    if (!shipment.driver_id) {
      return res.json({
        ...shipment,
        current_location: null,
        message: "No driver assigned yet",
      });
    }

    res.json(shipment);
  } catch (err) {
    console.error("Error fetching shipment location:", err);
    res.status(500).json({ error: "Failed to fetch shipment location" });
  }
});

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`🚗 Location Service running on port ${PORT}`);
});
