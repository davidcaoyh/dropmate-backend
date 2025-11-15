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

export async function updateShipmentStatus(id, status) {
  const result = await db.query(
    "UPDATE shipments SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
    [status, id]
  );
  return result.rows[0];
}
