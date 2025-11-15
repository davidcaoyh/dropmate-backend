import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Setup Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

// Setup Redis Pub/Sub
const redisSubscriber = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisSubscriber.on("error", (err) => {
  console.error("Redis Subscriber Error:", err);
});

await redisSubscriber.connect();
console.log("✅ Connected to Redis");

// Track active WebSocket connections
const activeConnections = new Map();

// WebSocket connection handler
io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  activeConnections.set(socket.id, {
    connectedAt: new Date(),
    subscriptions: new Set(),
  });

  // Subscribe to driver location updates
  socket.on("subscribe:driver", (driverId) => {
    console.log(`📡 Client ${socket.id} subscribing to driver ${driverId}`);
    socket.join(`driver:${driverId}`);
    activeConnections.get(socket.id)?.subscriptions.add(`driver:${driverId}`);
  });

  // Subscribe to shipment location updates
  socket.on("subscribe:shipment", (shipmentId) => {
    console.log(`📦 Client ${socket.id} subscribing to shipment ${shipmentId}`);
    socket.join(`shipment:${shipmentId}`);
    activeConnections.get(socket.id)?.subscriptions.add(`shipment:${shipmentId}`);
  });

  // Unsubscribe from driver updates
  socket.on("unsubscribe:driver", (driverId) => {
    console.log(`📡 Client ${socket.id} unsubscribing from driver ${driverId}`);
    socket.leave(`driver:${driverId}`);
    activeConnections.get(socket.id)?.subscriptions.delete(`driver:${driverId}`);
  });

  // Unsubscribe from shipment updates
  socket.on("unsubscribe:shipment", (shipmentId) => {
    console.log(`📦 Client ${socket.id} unsubscribing from shipment ${shipmentId}`);
    socket.leave(`shipment:${shipmentId}`);
    activeConnections.get(socket.id)?.subscriptions.delete(`shipment:${shipmentId}`);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    activeConnections.delete(socket.id);
  });

  // Send welcome message
  socket.emit("connected", {
    message: "Connected to DropMate Notification Service",
    socketId: socket.id,
    timestamp: new Date().toISOString(),
  });
});

// Subscribe to all driver location updates using pattern
await redisSubscriber.pSubscribe("driver:*:location", (message, channel) => {
  try {
    const locationUpdate = JSON.parse(message);
    const driverId = channel.split(":")[1];

    // Broadcast to all clients subscribed to this driver
    io.to(`driver:${driverId}`).emit("driver_location_updated", locationUpdate);
  } catch (err) {
    console.error("Error processing driver location update:", err);
  }
});

// Subscribe to all shipment location updates using pattern
await redisSubscriber.pSubscribe("shipment:*:location", (message, channel) => {
  try {
    const locationUpdate = JSON.parse(message);
    const shipmentId = channel.split(":")[1];

    // Broadcast to all clients subscribed to this shipment
    io.to(`shipment:${shipmentId}`).emit("shipment_location_updated", locationUpdate);
  } catch (err) {
    console.error("Error processing shipment location update:", err);
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "notification-service",
    connections: activeConnections.size,
    timestamp: new Date().toISOString(),
  });
});

// Stats endpoint
app.get("/stats", (req, res) => {
  const subscriptions = {};
  for (const [socketId, data] of activeConnections) {
    subscriptions[socketId] = {
      connectedAt: data.connectedAt,
      subscriptions: Array.from(data.subscriptions),
    };
  }

  res.json({
    totalConnections: activeConnections.size,
    connections: subscriptions,
  });
});

const PORT = process.env.PORT || 8082;
httpServer.listen(PORT, () => {
  console.log(`🔔 Notification Service running on port ${PORT}`);
  console.log(`   WebSocket endpoint: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("👋 Shutting down gracefully...");
  await redisSubscriber.quit();
  httpServer.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
