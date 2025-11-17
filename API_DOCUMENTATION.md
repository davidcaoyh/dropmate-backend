# DropMate Backend API Documentation

## Base URLs
- **Core API**: `http://localhost:8080/api`
- **Location Service**: `http://localhost:8081`
- **Notification Service**: `http://localhost:8082` (WebSocket: `ws://localhost:8082`)

## Authentication
Most endpoints require Firebase Authentication. Include the Firebase ID token in the `Authorization` header:
```
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

---

## 🆕 Package/Shipment Creation Flow

### 1. Create a New Package (Shipment)
**Endpoint**: `POST /api/users/me/shipments`

**Authentication**: Required (Firebase)

**Description**: Creates a new shipment/package for the authenticated user. This automatically creates an order and generates a unique tracking number.

**Request Body**:
```json
{
  "pickupAddress": "123 Main St, San Francisco, CA 94102",
  "deliveryAddress": "456 Market St, San Francisco, CA 94103",
  "totalAmount": 29.99  // Optional, defaults to 0
}
```

**Response** (201 Created):
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
    "updated_at": "2025-11-16T21:00:00.000Z",
    "order_id": 10,
    "total_amount": "29.99",
    "order_status": "pending"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields
- `404 Not Found`: Customer profile not found for user
- `401 Unauthorized`: Invalid or missing Firebase token

---

### 2. Assign Driver to Shipment
**Endpoint**: `POST /api/shipments/:id/assign-driver`

**Authentication**: Not required (admin endpoint)

**Description**: Assigns a driver to a shipment for delivery and live tracking.

**Request Body**:
```json
{
  "driverId": 1
}
```

**Response** (200 OK):
```json
{
  "id": 5,
  "order_id": 10,
  "driver_id": 1,
  "tracking_number": "DM-20251116-A3X9F2",
  "status": "assigned",
  "pickup_address": "123 Main St, San Francisco, CA 94102",
  "delivery_address": "456 Market St, San Francisco, CA 94103",
  "created_at": "2025-11-16T21:00:00.000Z",
  "updated_at": "2025-11-16T21:00:30.000Z"
}
```

**Note**: This also broadcasts a `shipment_assigned` event via WebSocket for real-time updates.

---

### 3. Track Shipment with Live Location
**Endpoint**: `GET /api/users/me/shipments/:id`

**Authentication**: Required (Firebase)

**Description**: Get a specific shipment with live driver location. Automatically verifies the shipment belongs to the authenticated user.

**Response** (200 OK):
```json
{
  "id": 5,
  "tracking_number": "DM-20251116-A3X9F2",
  "status": "in_transit",
  "pickup_address": "123 Main St, San Francisco, CA 94102",
  "delivery_address": "456 Market St, San Francisco, CA 94103",
  "created_at": "2025-11-16T21:00:00.000Z",
  "updated_at": "2025-11-16T21:05:00.000Z",
  "order_id": 10,
  "customer_id": 3,
  "driver_id": 1,
  "driver_name": "John Driver",
  "vehicle_type": "Van",
  "license_number": "DL12345",
  "driver_status": "on_delivery",
  "driver_phone": "555-0101",
  "current_location": {
    "latitude": 37.78688073,
    "longitude": -122.40744584,
    "accuracy": 10,
    "timestamp": "2025-11-16T21:05:00.000Z"
  }
}
```

---

### 4. Public Tracking by Tracking Number
**Endpoint**: `GET /api/shipments/track/:trackingNumber`

**Authentication**: Not required

**Description**: Track a shipment using its tracking number (public endpoint).

**Example**: `GET /api/shipments/track/DM-20251116-A3X9F2`

**Response** (200 OK):
```json
{
  "id": 5,
  "tracking_number": "DM-20251116-A3X9F2",
  "status": "in_transit",
  "pickup_address": "123 Main St, San Francisco, CA 94102",
  "delivery_address": "456 Market St, San Francisco, CA 94103",
  "driver_name": "John Driver",
  "vehicle_type": "Van",
  "driver_status": "on_delivery"
}
```

---

## User Endpoints

### Get User Profile
**GET** `/api/users/me`
- Returns user profile with customer/driver info
- Requires authentication

### Update User Profile
**PATCH** `/api/users/me`
- Update user's name and phone
- Requires authentication
- Body: `{ name?, phone? }`

### Get User Statistics
**GET** `/api/users/me/stats`
- Returns delivery statistics (total orders, shipments, etc.)
- Requires authentication

### List User's Orders
**GET** `/api/users/me/orders`
- Returns all orders with shipments for the user
- Requires authentication

### List User's Shipments
**GET** `/api/users/me/shipments`
- Returns all shipments with live tracking
- Requires authentication

---

## Shipment Management Endpoints

### List All Shipments
**GET** `/api/shipments`
- Returns all shipments (admin view)

### Get Shipment by ID
**GET** `/api/shipments/:id`
- Returns shipment details

### Get Shipment with Live Location
**GET** `/api/shipments/:id/location`
- Returns shipment with current driver location

### Update Shipment Status
**PATCH** `/api/shipments/:id/status`
- Update shipment status
- Body: `{ status: "pending" | "assigned" | "in_transit" | "delivered" }`

### Get Shipment Events History
**GET** `/api/shipments/:id/events`
- Returns status change history for a shipment

---

## Driver Endpoints

### List All Drivers
**GET** `/api/drivers`

### Get Driver by ID
**GET** `/api/drivers/:id`

### Update Driver Location
**POST** `/api/location/update`
- Body:
```json
{
  "driverId": 1,
  "latitude": 37.78688073,
  "longitude": -122.40744584,
  "accuracy": 10
}
```

### Get Driver's Current Location
**GET** `/api/location/driver/:driverId`

---

## Order Endpoints

### List All Orders
**GET** `/api/orders`
- Returns all orders

---

## WebSocket Real-time Updates

Connect to: `ws://localhost:8082`

### Events:
- `shipment_assigned` - When a driver is assigned to a shipment
- `shipment_updated` - When shipment status changes
- `driver_location_update` - Real-time driver location updates

### Subscribe to Driver Location:
```javascript
socket.emit('subscribe_driver', { driverId: 1 });
```

### Subscribe to Shipment Updates:
```javascript
socket.emit('subscribe_shipment', { shipmentId: 5 });
```

---

## Shipment Status Flow

1. **pending** - Shipment created, awaiting driver assignment
2. **assigned** - Driver assigned to shipment
3. **in_transit** - Package is being delivered
4. **delivered** - Package delivered to destination

---

## Complete Flow Example

### 1. User Creates a Package
```bash
curl -X POST http://localhost:8080/api/users/me/shipments \
  -H "Authorization: Bearer <FIREBASE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupAddress": "123 Main St, SF",
    "deliveryAddress": "456 Market St, SF",
    "totalAmount": 29.99
  }'
```

### 2. Admin Assigns Driver
```bash
curl -X POST http://localhost:8080/api/shipments/5/assign-driver \
  -H "Content-Type: application/json" \
  -d '{ "driverId": 1 }'
```

### 3. Driver Updates Location
```bash
curl -X POST http://localhost:8081/update \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": 1,
    "latitude": 37.78688073,
    "longitude": -122.40744584,
    "accuracy": 10
  }'
```

### 4. User Tracks Package
```bash
curl http://localhost:8080/api/users/me/shipments/5 \
  -H "Authorization: Bearer <FIREBASE_TOKEN>"
```

### 5. Update Status to In Transit
```bash
curl -X PATCH http://localhost:8080/api/shipments/5/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "in_transit" }'
```

### 6. Mark as Delivered
```bash
curl -X PATCH http://localhost:8080/api/shipments/5/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "delivered" }'
```

---

## Testing

### Using the Test Scripts

1. **Get Firebase Token**:
```bash
FIREBASE_API_KEY=your_api_key node get-test-token.js alice
```

2. **Run Complete Flow Test**:
```bash
node test-shipment-flow.js <FIREBASE_TOKEN>
```

### Manual Testing with cURL

See examples in the "Complete Flow Example" section above.

---

## Error Codes

- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Notes

- All timestamps are in ISO 8601 format
- Tracking numbers follow format: `DM-YYYYMMDD-XXXXXX`
- Location coordinates use decimal degrees (latitude, longitude)
- Driver location updates are broadcast in real-time via WebSocket
- User can only view their own shipments (automatic ownership verification)
