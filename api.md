# DropMate Backend - Complete API Reference

## Service Overview

| Service | Port | Base URL | Purpose |
|---------|------|----------|---------|
| **Core API** | 8080 | `http://localhost:8080` | Main business logic, orders, shipments, users |
| **Location Service** | 8081 | `http://localhost:8081` | Real-time GPS tracking and location history |
| **Notification Service** | 8082 | `http://localhost:8082` | WebSocket-based real-time notifications |

---

# 🔐 Authentication & Roles

Most Core API endpoints require Firebase Authentication. Include the Firebase ID token in the request header:

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

**Endpoint Access Levels:**
- 🔒 **Authentication Required** - Must be logged in
- 🛍️ **Customer Only** - Only customers can access
- 🚗 **Driver Only** - Only drivers can access

## User Roles

### 🛍️ Customer
Users who create and track packages. Default role for new users.

**Capabilities:**
- Create shipments/packages
- Track their packages
- View order history

### 🚗 Driver
Users who claim and deliver packages.

**Capabilities:**
- View available packages
- Claim packages (auto-assigns to driver)
- Update delivery status
- Update location

---

# Core API (Port 8080)

Base URL: `http://localhost:8080/api`

## Health Check

### Get API Health Status
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "core-api"
}
```

---

## 👤 User Endpoints

All user endpoints require 🔒 Firebase authentication.

### Get Current User Profile
```http
GET /api/users/me 🔒
```

**Response:**
```json
{
  "id": 5,
  "email": "alice@test.com",
  "role": "customer",
  "firebase_uid": "fHesazNSXHglErKtyp37OgNDbMw2",
  "created_at": "2025-11-15T10:00:00.000Z",
  "customer_id": 3,
  "customer_name": "Alice Johnson",
  "phone": "555-0123",
  "driver_id": null,
  "driver_name": null
}
```

---

### Update User Profile
```http
PATCH /api/users/me 🔒
```

**Request Body:**
```json
{
  "name": "Alice Cooper",
  "phone": "555-9999"
}
```

**Response:** Updated customer profile

---

### Get User Statistics
```http
GET /api/users/me/stats 🔒
```

**Response:**
```json
{
  "total_orders": 5,
  "total_shipments": 7,
  "pending_shipments": 2,
  "in_transit_shipments": 1,
  "delivered_shipments": 4,
  "total_spent": "149.95"
}
```

---

### List User's Orders
```http
GET /api/users/me/orders 🔒
```

**Response:** Array of orders with nested shipments

```json
[
  {
    "id": 10,
    "total_amount": "29.99",
    "status": "pending",
    "created_at": "2025-11-16T21:00:00.000Z",
    "customer_name": "Alice Johnson",
    "shipments": [
      {
        "id": 5,
        "tracking_number": "DM-20251116-A3X9F2",
        "status": "pending",
        "driver_id": null,
        "pickup_address": "123 Main St",
        "delivery_address": "456 Market St"
      }
    ]
  }
]
```

---

### List User's Shipments
```http
GET /api/users/me/shipments 🔒
```

**Response:** Array of shipments with live tracking data

```json
[
  {
    "id": 5,
    "tracking_number": "DM-20251116-A3X9F2",
    "status": "in_transit",
    "pickup_address": "123 Main St, SF",
    "delivery_address": "456 Market St, SF",
    "order_id": 10,
    "total_amount": "29.99",
    "driver_id": 1,
    "driver_name": "John Driver",
    "vehicle_type": "Van",
    "current_location": {
      "latitude": 37.78688073,
      "longitude": -122.40744584,
      "accuracy": 10,
      "timestamp": "2025-11-16T21:05:00.000Z"
    }
  }
]
```

---

### Get Specific User Shipment
```http
GET /api/users/me/shipments/:id 🔒
```

**Parameters:**
- `id` - Shipment ID

**Response:** Shipment with live tracking (ownership verified)

---

### 🆕 Create New Shipment (Package)
```http
POST /api/users/me/shipments 🛍️
```

**Description**: Customer creates a new package for delivery

**Request Body:**
```json
{
  "pickupAddress": "123 Main St, San Francisco, CA 94102",
  "deliveryAddress": "456 Market St, San Francisco, CA 94103",
  "totalAmount": 29.99
}
```

**Response (201 Created):**
```json
{
  "message": "Shipment created successfully",
  "shipment": {
    "id": 5,
    "tracking_number": "DM-20251116-A3X9F2",
    "status": "pending",
    "pickup_address": "123 Main St, San Francisco, CA 94102",
    "delivery_address": "456 Market St, San Francisco, CA 94103",
    "created_at": "2025-11-16T21:00:00.000Z",
    "order_id": 10,
    "total_amount": "29.99"
  }
}
```

**Errors:**
- `400` - Missing required fields
- `403` - User is not a customer (drivers cannot create packages)
- `404` - Customer profile not found

---

## 🚗 Driver Registration

### Register as Driver
```http
POST /api/users/me/register-driver 🔒
```

**Description**: Convert your account to a driver account (creates driver profile)

**Request Body:**
```json
{
  "name": "John Driver",
  "vehicleType": "Van",
  "licenseNumber": "DL12345678"
}
```

**Response (201 Created):**
```json
{
  "message": "Driver profile created successfully",
  "driver": {
    "id": 3,
    "user_id": 5,
    "name": "John Driver",
    "vehicle_type": "Van",
    "license_number": "DL12345678",
    "status": "offline",
    "created_at": "2025-11-16T22:00:00.000Z"
  }
}
```

**What Happens**:
1. User's role is updated from `customer` to `driver`
2. Driver profile is created
3. Can now access all driver endpoints

**Errors:**
- `400` - Missing required fields
- `409` - User already has a driver profile

**Vehicle Types**: Car, Van, Truck, Motorcycle, Bicycle, SUV

---

### Update Driver Profile
```http
PATCH /api/users/me/driver-profile 🚗
```

**Description**: Update driver profile information

**Request Body** (all fields optional):
```json
{
  "name": "John Smith",
  "vehicleType": "Truck",
  "licenseNumber": "DL98765432"
}
```

**Response:**
```json
{
  "message": "Driver profile updated",
  "driver": {
    "id": 3,
    "name": "John Smith",
    "vehicle_type": "Truck",
    "license_number": "DL98765432"
  }
}
```

---

## 🚗 Driver-Only Endpoints

### Get Available Packages to Claim
```http
GET /api/users/me/available-packages?limit=50 🚗
```

**Description**: View packages available for drivers to claim (pending, unassigned)

**Query Parameters:**
- `limit` - Max packages to return (default: 50)

**Response:**
```json
{
  "count": 3,
  "packages": [
    {
      "id": 5,
      "tracking_number": "DM-20251116-A3X9F2",
      "pickup_address": "123 Main St, San Francisco",
      "delivery_address": "456 Market St, San Francisco",
      "status": "pending",
      "created_at": "2025-11-16T21:00:00.000Z",
      "order_id": 10,
      "total_amount": "29.99",
      "customer_name": "Alice Johnson",
      "customer_phone": "555-0123"
    }
  ]
}
```

**Errors:**
- `403` - User is not a driver

---

### Claim a Package
```http
POST /api/users/me/packages/:id/claim 🚗
```

**Description**: Driver claims an available package (auto-assigns to driver)

**Parameters:**
- `id` - Shipment/Package ID

**Response (201 Created):**
```json
{
  "message": "Package claimed successfully",
  "package": {
    "id": 5,
    "order_id": 10,
    "driver_id": 1,
    "tracking_number": "DM-20251116-A3X9F2",
    "status": "assigned",
    "updated_at": "2025-11-16T21:30:00.000Z"
  }
}
```

**Errors:**
- `403` - User is not a driver
- `404` - Package not found or driver profile not found
- `409` - Package already claimed or not in pending status

**WebSocket Event**: Emits `shipment_assigned`

---

### Get My Deliveries
```http
GET /api/users/me/deliveries 🚗
GET /api/users/me/deliveries?status=assigned
GET /api/users/me/deliveries?status=in_transit
```

**Description**: View all packages assigned to this driver

**Query Parameters:**
- `status` - Filter by status: `assigned`, `in_transit`, `delivered` (optional)

**Response:**
```json
{
  "driverId": 1,
  "count": 2,
  "deliveries": [
    {
      "id": 5,
      "tracking_number": "DM-20251116-A3X9F2",
      "pickup_address": "123 Main St",
      "delivery_address": "456 Market St",
      "status": "assigned",
      "created_at": "2025-11-16T21:00:00.000Z",
      "updated_at": "2025-11-16T21:30:00.000Z",
      "order_id": 10,
      "total_amount": "29.99",
      "customer_name": "Alice Johnson",
      "customer_phone": "555-0123"
    }
  ]
}
```

**Errors:**
- `403` - User is not a driver
- `404` - Driver profile not found

---

### Update Delivery Status
```http
PATCH /api/users/me/deliveries/:id/status 🚗
```

**Description**: Driver updates the status of their own delivery

**Parameters:**
- `id` - Shipment/Package ID

**Request Body:**
```json
{
  "status": "in_transit"
}
```

**Valid Status Values:**
- `in_transit` - Package is being delivered
- `delivered` - Package has been delivered

**Response:**
```json
{
  "message": "Delivery status updated",
  "delivery": {
    "id": 5,
    "tracking_number": "DM-20251116-A3X9F2",
    "status": "in_transit",
    "updated_at": "2025-11-16T21:35:00.000Z"
  }
}
```

**Errors:**
- `400` - Invalid status value
- `403` - User is not a driver OR delivery not assigned to this driver
- `404` - Delivery not found

**WebSocket Event**: Emits `shipment_updated`

---

## 📦 Shipment Endpoints

### List All Shipments
```http
GET /api/shipments
```

**Response:** Array of all shipments with driver info

---

### Get Shipment by ID
```http
GET /api/shipments/:id
```

**Parameters:**
- `id` - Shipment ID

**Response:**
```json
{
  "id": 5,
  "status": "in_transit",
  "tracking_number": "DM-20251116-A3X9F2",
  "driver_id": 1,
  "order_id": 10,
  "customer_id": 3,
  "driver_name": "John Driver",
  "vehicle_type": "Van"
}
```

---

### Track Shipment by Tracking Number
```http
GET /api/shipments/track/:trackingNumber
```

**Parameters:**
- `trackingNumber` - Tracking number (e.g., `DM-20251116-A3X9F2`)

**Response:** Shipment details (public endpoint)

**Example:**
```bash
curl http://localhost:8080/api/shipments/track/DM-20251116-A3X9F2
```

---

### Get Shipment with Live Location
```http
GET /api/shipments/:id/location
```

**Parameters:**
- `id` - Shipment ID

**Response:**
```json
{
  "id": 5,
  "tracking_number": "DM-20251116-A3X9F2",
  "status": "in_transit",
  "driver_id": 1,
  "customer_id": 3,
  "current_location": {
    "latitude": 37.78688073,
    "longitude": -122.40744584,
    "accuracy": 10,
    "timestamp": "2025-11-16T21:05:00.000Z"
  }
}
```

If no driver assigned:
```json
{
  "id": 5,
  "current_location": null,
  "message": "No driver assigned yet"
}
```

---

### Assign Driver to Shipment
```http
POST /api/shipments/:id/assign-driver
```

**Parameters:**
- `id` - Shipment ID

**Request Body:**
```json
{
  "driverId": 1
}
```

**Response:**
```json
{
  "id": 5,
  "order_id": 10,
  "driver_id": 1,
  "tracking_number": "DM-20251116-A3X9F2",
  "status": "assigned",
  "updated_at": "2025-11-16T21:00:30.000Z"
}
```

**WebSocket Event:** Emits `shipment_assigned` event

---

### Update Shipment Status
```http
PATCH /api/shipments/:id/status
```

**Parameters:**
- `id` - Shipment ID

**Request Body:**
```json
{
  "status": "in_transit"
}
```

**Valid Status Values:**
- `pending` - Created, awaiting driver
- `assigned` - Driver assigned
- `in_transit` - Being delivered
- `delivered` - Completed

**WebSocket Event:** Emits `shipment_updated` event

---

### Get Shipment Event History
```http
GET /api/shipments/:id/events
```

**Parameters:**
- `id` - Shipment ID

**Response:** Array of status change events
```json
[
  {
    "id": 123,
    "shipment_id": 5,
    "event_type": "status_change",
    "from_status": "assigned",
    "to_status": "in_transit",
    "occurred_at": "2025-11-16T21:05:00.000Z"
  }
]
```

---

## 📋 Order Endpoints

### List All Orders
```http
GET /api/orders
```

**Response:** Array of all orders

---

## 🚗 Driver Endpoints

### List All Drivers
```http
GET /api/drivers
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "John Driver",
    "vehicle_type": "Van",
    "license_number": "DL12345",
    "status": "available",
    "last_location": {
      "latitude": 37.78688073,
      "longitude": -122.40744584,
      "recorded_at": "2025-11-15T17:16:07.000Z"
    }
  }
]
```

---

### Update Driver Status
```http
PATCH /api/drivers/:id/status
```

**Parameters:**
- `id` - Driver ID

**Request Body:**
```json
{
  "status": "on_delivery"
}
```

**Valid Status Values:**
- `offline` - Not working
- `available` - Ready for assignments
- `on_delivery` - Currently delivering

**WebSocket Event:** Emits `driver_status_updated` event

---

### Add Driver Location
```http
POST /api/drivers/:id/location
```

**Parameters:**
- `id` - Driver ID

**Request Body:**
```json
{
  "latitude": 37.78688073,
  "longitude": -122.40744584,
  "accuracy": 10
}
```

**Response:**
```json
{
  "id": 456,
  "driver_id": 1,
  "latitude": 37.78688073,
  "longitude": -122.40744584,
  "accuracy": 10,
  "occurred_at": "2025-11-16T21:05:00.000Z"
}
```

**WebSocket Events:**
- `driver_location_updated` - General driver location
- `shipment_{shipmentId}_location` - For each active shipment

---

## 💬 Message Endpoints

### List All Message Threads
```http
GET /api/messages/threads
```

**Response:** Array of message threads

---

### Get Messages in Thread
```http
GET /api/messages/threads/:id
```

**Parameters:**
- `id` - Thread ID

**Response:** Array of messages in chronological order

---

### Create New Thread
```http
POST /api/messages/threads
```

**Request Body:**
```json
{
  "subject": "Question about delivery",
  "contextType": "shipment",
  "contextId": 5,
  "createdBy": 3
}
```

**Response:** Created thread object

---

### Send Message to Thread
```http
POST /api/messages/threads/:id
```

**Parameters:**
- `id` - Thread ID

**Request Body:**
```json
{
  "authorUserId": 3,
  "body": "When will my package arrive?"
}
```

**Response:** Created message

**WebSocket Event:** Emits `new_message` event

---

## 🔓 Auth Endpoints

### Test Auth Route
```http
GET /api/auth
```

**Response:** `"Auth route works ✅"`

---

# Location Service (Port 8081)

Base URL: `http://localhost:8081/api/location`

## Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "location-service",
  "timestamp": "2025-11-16T21:00:00.000Z"
}
```

---

## Record Driver Location

```http
POST /api/location/:driverId
```

**Parameters:**
- `driverId` - Driver ID

**Request Body:**
```json
{
  "latitude": 37.78688073,
  "longitude": -122.40744584,
  "accuracy": 10
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "event": {
    "id": 789,
    "driver_id": 1,
    "latitude": 37.78688073,
    "longitude": -122.40744584,
    "accuracy": 10,
    "occurred_at": "2025-11-16T21:05:00.000Z"
  },
  "broadcastedToShipments": 2
}
```

**Notes:**
- Stores location in partitioned database table
- Publishes to Redis for real-time broadcast
- Automatically broadcasts to all active shipments for this driver

---

## Get Latest Driver Location

```http
GET /api/location/:driverId/latest
```

**Parameters:**
- `driverId` - Driver ID

**Response:**
```json
{
  "latitude": 37.78688073,
  "longitude": -122.40744584,
  "accuracy": 10,
  "timestamp": "2025-11-16T21:05:00.000Z"
}
```

**Error (404):**
```json
{
  "error": "No location data found for this driver"
}
```

---

## Get Driver Location History

```http
GET /api/location/:driverId/history?limit=100&since=2025-11-16T00:00:00Z
```

**Parameters:**
- `driverId` - Driver ID

**Query Parameters:**
- `limit` - Max number of records (default: 100)
- `since` - ISO timestamp to filter from (optional)

**Response:**
```json
{
  "driverId": 1,
  "count": 50,
  "locations": [
    {
      "latitude": 37.78688073,
      "longitude": -122.40744584,
      "accuracy": 10,
      "timestamp": "2025-11-16T21:05:00.000Z"
    },
    {
      "latitude": 37.78588073,
      "longitude": -122.40644584,
      "accuracy": 12,
      "timestamp": "2025-11-16T21:04:30.000Z"
    }
  ]
}
```

---

## Get Shipment Current Location

```http
GET /api/location/shipment/:shipmentId
```

**Parameters:**
- `shipmentId` - Shipment ID

**Response:**
```json
{
  "shipment_id": 5,
  "tracking_number": "DM-20251116-A3X9F2",
  "shipment_status": "in_transit",
  "driver_id": 1,
  "driver_name": "John Driver",
  "vehicle_type": "Van",
  "current_location": {
    "latitude": 37.78688073,
    "longitude": -122.40744584,
    "accuracy": 10,
    "timestamp": "2025-11-16T21:05:00.000Z"
  }
}
```

If no driver assigned:
```json
{
  "shipment_id": 5,
  "current_location": null,
  "message": "No driver assigned yet"
}
```

---

# Notification Service (Port 8082)

WebSocket URL: `ws://localhost:8082`

## HTTP Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "notification-service",
  "connections": 5,
  "timestamp": "2025-11-16T21:00:00.000Z"
}
```

---

### Connection Statistics
```http
GET /stats
```

**Response:**
```json
{
  "totalConnections": 3,
  "connections": {
    "socket_123": {
      "connectedAt": "2025-11-16T21:00:00.000Z",
      "subscriptions": [
        "driver:1",
        "shipment:5"
      ]
    }
  }
}
```

---

## WebSocket Events

### Connection

**Client → Server:** Establish WebSocket connection

```javascript
const socket = io('ws://localhost:8082');
```

**Server → Client:** Welcome message
```json
{
  "event": "connected",
  "data": {
    "message": "Connected to DropMate Notification Service",
    "socketId": "socket_123",
    "timestamp": "2025-11-16T21:00:00.000Z"
  }
}
```

---

### Subscribe to Driver Updates

**Client → Server:**
```javascript
socket.emit('subscribe:driver', 1); // Driver ID
```

**Server → Client:** Location updates
```json
{
  "event": "driver_location_updated",
  "data": {
    "driverId": 1,
    "latitude": 37.78688073,
    "longitude": -122.40744584,
    "accuracy": 10,
    "timestamp": "2025-11-16T21:05:00.000Z"
  }
}
```

---

### Subscribe to Shipment Updates

**Client → Server:**
```javascript
socket.emit('subscribe:shipment', 5); // Shipment ID
```

**Server → Client:** Location updates
```json
{
  "event": "shipment_location_updated",
  "data": {
    "shipmentId": 5,
    "driverId": 1,
    "latitude": 37.78688073,
    "longitude": -122.40744584,
    "accuracy": 10,
    "timestamp": "2025-11-16T21:05:00.000Z"
  }
}
```

---

### Unsubscribe from Driver

**Client → Server:**
```javascript
socket.emit('unsubscribe:driver', 1);
```

---

### Unsubscribe from Shipment

**Client → Server:**
```javascript
socket.emit('unsubscribe:shipment', 5);
```

---

### Disconnect

**Client → Server:**
```javascript
socket.disconnect();
```

---

# Complete Usage Examples

## Example 1: Create and Track a Package

### Step 1: Create Package
```bash
curl -X POST http://localhost:8080/api/users/me/shipments \
  -H "Authorization: Bearer <FIREBASE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupAddress": "123 Main St, San Francisco",
    "deliveryAddress": "456 Market St, San Francisco",
    "totalAmount": 29.99
  }'
```

**Response:** Tracking number `DM-20251116-A3X9F2`

---

### Step 2: Assign Driver
```bash
curl -X POST http://localhost:8080/api/shipments/5/assign-driver \
  -H "Content-Type: application/json" \
  -d '{"driverId": 1}'
```

---

### Step 3: Driver Updates Location
```bash
curl -X POST http://localhost:8081/api/location/1 \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 37.78688073,
    "longitude": -122.40744584,
    "accuracy": 10
  }'
```

---

### Step 4: Track Package
```bash
curl http://localhost:8080/api/users/me/shipments/5 \
  -H "Authorization: Bearer <FIREBASE_TOKEN>"
```

---

## Example 2: Real-time Tracking via WebSocket

```javascript
const io = require('socket.io-client');
const socket = io('ws://localhost:8082');

socket.on('connect', () => {
  console.log('Connected to notification service');

  // Subscribe to shipment updates
  socket.emit('subscribe:shipment', 5);
});

socket.on('shipment_location_updated', (data) => {
  console.log('Package location:', data.latitude, data.longitude);
  // Update map in real-time
});
```

---

## Example 3: Public Package Tracking

```bash
# No authentication required
curl http://localhost:8080/api/shipments/track/DM-20251116-A3X9F2
```

---

# Data Models

## Shipment Status Flow

```
pending → assigned → in_transit → delivered
```

## Driver Status Values

- `offline` - Not working
- `available` - Ready for deliveries
- `on_delivery` - Currently on a delivery

## Tracking Number Format

`DM-YYYYMMDD-XXXXXX`

Example: `DM-20251116-A3X9F2`

- `DM` - DropMate prefix
- `20251116` - Date (November 16, 2025)
- `A3X9F2` - Random 6-character suffix

---

# Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid auth token |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

# Rate Limiting

Currently no rate limiting is implemented. Consider adding in production.

---

# CORS Policy

All services allow CORS from any origin (`*`) in development. Update for production.

---

# Testing

See test scripts:
- `test-shipment-flow.js` - End-to-end shipment creation and tracking
- `get-test-token.js` - Get Firebase auth tokens for testing

---

# Notes

- All timestamps are in ISO 8601 format
- Coordinates use decimal degrees (latitude, longitude)
- WebSocket connections auto-reconnect on disconnect
- Location data is stored in partitioned tables for performance
- Real-time updates use Redis pub/sub for scalability
