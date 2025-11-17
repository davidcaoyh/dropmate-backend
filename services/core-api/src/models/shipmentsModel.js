import db from "./db.js";

export async function listShipments() {
  const result = await db.query(
    `SELECT s.id, s.status, s.tracking_number, s.driver_id,
            o.id AS order_id, o.customer_id,
            d.name AS driver_name, d.vehicle_type
       FROM shipments s
       LEFT JOIN orders o ON o.id = s.order_id
       LEFT JOIN drivers d ON d.id = s.driver_id
       ORDER BY s.created_at DESC`
  );
  return result.rows;
}

export async function getShipmentById(id) {
  const result = await db.query(
    `SELECT s.*,
            o.customer_id,
            d.name AS driver_name, d.vehicle_type, d.status AS driver_status
       FROM shipments s
       LEFT JOIN orders o ON o.id = s.order_id
       LEFT JOIN drivers d ON d.id = s.driver_id
       WHERE s.id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function getShipmentByTrackingNumber(trackingNumber) {
  const result = await db.query(
    `SELECT s.*,
            o.customer_id,
            d.name AS driver_name, d.vehicle_type, d.status AS driver_status
       FROM shipments s
       LEFT JOIN orders o ON o.id = s.order_id
       LEFT JOIN drivers d ON d.id = s.driver_id
       WHERE s.tracking_number = $1`,
    [trackingNumber]
  );
  return result.rows[0];
}

export async function getShipmentWithLiveLocation(id) {
  const result = await db.query(
    `SELECT s.*,
            o.customer_id,
            d.id AS driver_id, d.name AS driver_name,
            d.vehicle_type, d.status AS driver_status,
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
       LEFT JOIN orders o ON o.id = s.order_id
       LEFT JOIN drivers d ON d.id = s.driver_id
       WHERE s.id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function assignDriverToShipment(shipmentId, driverId) {
  const result = await db.query(
    `UPDATE shipments
     SET driver_id=$1, status='assigned', updated_at=NOW()
     WHERE id=$2
     RETURNING *`,
    [driverId, shipmentId]
  );
  return result.rows[0];
}

export async function updateShipmentStatus(id, status, userId = null) {
  // Get current status before updating
  const currentResult = await db.query(
    "SELECT status FROM shipments WHERE id=$1",
    [id]
  );
  const fromStatus = currentResult.rows[0]?.status;

  // Update the status
  const result = await db.query(
    "UPDATE shipments SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
    [status, id]
  );

  // Log the status change event
  if (result.rows[0] && fromStatus !== status) {
    const { logStatusChange } = await import('./shipmentEventsModel.js');
    await logStatusChange(id, fromStatus, status, userId);
  }

  return result.rows[0];
}

/**
 * Generate a unique tracking number
 * Format: DM-YYYYMMDD-XXXXXX (DM = DropMate)
 */
function generateTrackingNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DM-${dateStr}-${random}`;
}

/**
 * Create a new shipment
 * @param {number} orderId - The order ID
 * @param {string} pickupAddress - Pickup address
 * @param {string} deliveryAddress - Delivery address
 * @returns {Promise<Object>} The created shipment
 */
export async function createShipment(orderId, pickupAddress, deliveryAddress, userId = null) {
  const trackingNumber = generateTrackingNumber();

  const result = await db.query(
    `INSERT INTO shipments (order_id, tracking_number, pickup_address, delivery_address, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [orderId, trackingNumber, pickupAddress, deliveryAddress]
  );

  // Log shipment creation event
  if (result.rows[0]) {
    const { logShipmentCreated } = await import('./shipmentEventsModel.js');
    await logShipmentCreated(result.rows[0].id, userId, {
      pickup_address: pickupAddress,
      delivery_address: deliveryAddress,
      tracking_number: trackingNumber
    });
  }

  return result.rows[0];
}
