#!/usr/bin/env node

/**
 * Driver Location Simulator
 *
 * Simulates a driver moving along a route and posting GPS coordinates
 * to the DropMate backend.
 *
 * Usage:
 *   node scripts/simulate-driver.js <driverId> [options]
 *
 * Options:
 *   --api-url <url>       Backend API URL (default: http://localhost:8080)
 *   --interval <ms>       Update interval in milliseconds (default: 5000)
 *   --route <route>       Predefined route: simple, city, highway (default: city)
 *
 * Example:
 *   node scripts/simulate-driver.js 1 --interval 3000 --route city
 */

import { setTimeout } from "timers/promises";

// Configuration
const args = process.argv.slice(2);
const driverId = args[0];
const apiUrl = args.find((arg, i) => args[i - 1] === "--api-url") || "http://localhost:8080";
const interval = parseInt(args.find((arg, i) => args[i - 1] === "--interval")) || 5000;
const routeType = args.find((arg, i) => args[i - 1] === "--route") || "city";

if (!driverId) {
  console.error("❌ Error: Driver ID is required");
  console.log("\nUsage: node scripts/simulate-driver.js <driverId> [options]");
  console.log("\nOptions:");
  console.log("  --api-url <url>       Backend API URL (default: http://localhost:8080)");
  console.log("  --interval <ms>       Update interval in milliseconds (default: 5000)");
  console.log("  --route <route>       Route type: simple, city, highway (default: city)");
  process.exit(1);
}

// Predefined routes (lat, lng coordinates)
const ROUTES = {
  simple: [
    { lat: 40.7128, lng: -74.0060, name: "Start - New York" },
    { lat: 40.7200, lng: -74.0000, name: "Heading North" },
    { lat: 40.7300, lng: -73.9950, name: "Central Park" },
    { lat: 40.7400, lng: -73.9900, name: "Upper Manhattan" },
    { lat: 40.7500, lng: -73.9850, name: "Delivery Point" },
  ],
  city: [
    { lat: 37.7749, lng: -122.4194, name: "San Francisco - Start" },
    { lat: 37.7849, lng: -122.4094, name: "Financial District" },
    { lat: 37.7949, lng: -122.3994, name: "Chinatown" },
    { lat: 37.8049, lng: -122.3894, name: "North Beach" },
    { lat: 37.8149, lng: -122.3794, name: "Fisherman's Wharf" },
    { lat: 37.8249, lng: -122.3694, name: "Fort Mason" },
    { lat: 37.8049, lng: -122.4194, name: "Marina District" },
    { lat: 37.7849, lng: -122.4294, name: "Golden Gate Park" },
  ],
  highway: [
    { lat: 34.0522, lng: -118.2437, name: "Los Angeles - Start" },
    { lat: 34.1522, lng: -118.3437, name: "Highway Exit 1" },
    { lat: 34.2522, lng: -118.4437, name: "Highway Exit 2" },
    { lat: 34.3522, lng: -118.5437, name: "Rest Stop" },
    { lat: 34.4522, lng: -118.6437, name: "Mountain Pass" },
    { lat: 34.5522, lng: -118.7437, name: "Valley Entrance" },
    { lat: 34.6522, lng: -118.8437, name: "Destination City" },
  ],
};

// Get selected route
const route = ROUTES[routeType] || ROUTES.city;

// Interpolate points between two coordinates
function interpolateCoordinates(start, end, steps) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const lat = start.lat + (end.lat - start.lat) * ratio;
    const lng = start.lng + (end.lng - start.lng) * ratio;
    // Add some random GPS noise for realism
    const noiseLat = (Math.random() - 0.5) * 0.0001;
    const noiseLng = (Math.random() - 0.5) * 0.0001;
    points.push({
      latitude: lat + noiseLat,
      longitude: lng + noiseLng,
      accuracy: 5 + Math.random() * 15, // 5-20 meters accuracy
    });
  }
  return points;
}

// Generate smooth route with interpolation
function generateSmoothRoute(waypoints, stepsPerSegment = 10) {
  const smoothRoute = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const segment = interpolateCoordinates(waypoints[i], waypoints[i + 1], stepsPerSegment);
    smoothRoute.push(...segment);
  }
  return smoothRoute;
}

// Post location to API
async function postLocation(driverId, location) {
  try {
    const response = await fetch(`${apiUrl}/api/drivers/${driverId}/location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(location),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Failed to post location:`, error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`❌ Network error:`, err.message);
    return false;
  }
}

// Main simulation loop
async function simulateDriver() {
  console.log(`🚗 Starting driver simulation`);
  console.log(`   Driver ID: ${driverId}`);
  console.log(`   API URL: ${apiUrl}`);
  console.log(`   Route: ${routeType} (${route.length} waypoints)`);
  console.log(`   Update interval: ${interval}ms`);
  console.log(`\n📍 Route waypoints:`);
  route.forEach((point, i) => {
    console.log(`   ${i + 1}. ${point.name} (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`);
  });

  // Generate smooth route
  const smoothRoute = generateSmoothRoute(route, 5);
  console.log(`\n🛣️  Generated ${smoothRoute.length} GPS points\n`);

  let index = 0;
  let totalSuccess = 0;
  let totalFailed = 0;

  // Infinite loop - cycles through the route
  while (true) {
    const location = smoothRoute[index % smoothRoute.length];
    const waypointIndex = Math.floor((index % smoothRoute.length) / 5);
    const currentWaypoint = route[waypointIndex];

    const timestamp = new Date().toISOString().substring(11, 19);
    const success = await postLocation(driverId, location);

    if (success) {
      totalSuccess++;
      console.log(
        `[${timestamp}] ✅ Posted location #${index + 1} | ` +
          `${currentWaypoint?.name || "In transit"} | ` +
          `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} | ` +
          `±${location.accuracy.toFixed(1)}m | ` +
          `Success: ${totalSuccess}, Failed: ${totalFailed}`
      );
    } else {
      totalFailed++;
    }

    index++;

    // Loop back to start after completing route
    if (index % smoothRoute.length === 0) {
      console.log(`\n🔄 Completed route cycle ${Math.floor(index / smoothRoute.length)}, restarting...\n`);
    }

    await setTimeout(interval);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Stopping driver simulation...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n\n👋 Stopping driver simulation...");
  process.exit(0);
});

// Start simulation
simulateDriver().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
