import db from './db.js';

/**
 * Get user profile with customer/driver info
 */
export async function getUserProfile(userId) {
  const result = await db.query(
    `SELECT u.id, u.email, u.role, u.firebase_uid, u.created_at,
            c.id as customer_id, c.name as customer_name, c.phone,
            d.id as driver_id, d.name as driver_name,
            d.vehicle_type, d.license_number, d.status as driver_status
     FROM users u
     LEFT JOIN customers c ON c.user_id = u.id
     LEFT JOIN drivers d ON d.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0];
}

/**
 * Update user profile (customer info)
 */
export async function updateUserProfile(userId, { name, phone }) {
  // Update customer profile
  const result = await db.query(
    `UPDATE customers
     SET name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         updated_at = NOW()
     WHERE user_id = $3
     RETURNING *`,
    [name, phone, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Customer profile not found');
  }

  return result.rows[0];
}

/**
 * Get user's orders with shipments
 */
export async function getUserOrders(userId) {
  const result = await db.query(
    `SELECT o.id, o.total_amount, o.status, o.created_at, o.updated_at,
            c.name as customer_name,
            json_agg(
              json_build_object(
                'id', s.id,
                'tracking_number', s.tracking_number,
                'status', s.status,
                'driver_id', s.driver_id,
                'driver_name', d.name,
                'pickup_address', s.pickup_address,
                'delivery_address', s.delivery_address,
                'created_at', s.created_at
              ) ORDER BY s.created_at DESC
            ) FILTER (WHERE s.id IS NOT NULL) as shipments
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     LEFT JOIN shipments s ON s.order_id = o.id
     LEFT JOIN drivers d ON d.id = s.driver_id
     WHERE c.user_id = $1
     GROUP BY o.id, c.name
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Get user's shipments with live tracking
 */
export async function getUserShipments(userId) {
  const result = await db.query(
    `SELECT s.id, s.tracking_number, s.status,
            s.pickup_address, s.delivery_address,
            s.created_at, s.updated_at,
            o.id as order_id, o.total_amount, o.status as order_status,
            d.id as driver_id, d.name as driver_name,
            d.vehicle_type, d.license_number,
            d.status as driver_status,
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
     JOIN orders o ON o.id = s.order_id
     JOIN customers c ON c.id = o.customer_id
     LEFT JOIN drivers d ON d.id = s.driver_id
     WHERE c.user_id = $1
     ORDER BY s.created_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Get a specific shipment for a user (with ownership check)
 */
export async function getUserShipmentById(userId, shipmentId) {
  const result = await db.query(
    `SELECT s.id, s.tracking_number, s.status,
            s.pickup_address, s.delivery_address,
            s.created_at, s.updated_at,
            o.id as order_id, o.customer_id,
            d.id as driver_id, d.name as driver_name,
            d.vehicle_type, d.license_number,
            d.status as driver_status,
            d.phone as driver_phone,
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
     JOIN orders o ON o.id = s.order_id
     JOIN customers c ON c.id = o.customer_id
     LEFT JOIN drivers d ON d.id = s.driver_id
     WHERE s.id = $1 AND c.user_id = $2`,
    [shipmentId, userId]
  );

  return result.rows[0];
}

/**
 * Verify shipment belongs to user
 */
export async function verifyShipmentOwnership(userId, shipmentId) {
  const result = await db.query(
    `SELECT 1 FROM shipments s
     JOIN orders o ON o.id = s.order_id
     JOIN customers c ON c.id = o.customer_id
     WHERE s.id = $1 AND c.user_id = $2`,
    [shipmentId, userId]
  );
  return result.rows.length > 0;
}

/**
 * Get user's delivery statistics
 */
export async function getUserStats(userId) {
  const result = await db.query(
    `SELECT
       COUNT(DISTINCT o.id) as total_orders,
       COUNT(DISTINCT s.id) as total_shipments,
       COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'pending') as pending_shipments,
       COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'in_transit') as in_transit_shipments,
       COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'delivered') as delivered_shipments,
       COALESCE(SUM(o.total_amount), 0) as total_spent
     FROM customers c
     LEFT JOIN orders o ON o.customer_id = c.id
     LEFT JOIN shipments s ON s.order_id = o.id
     WHERE c.user_id = $1
     GROUP BY c.id`,
    [userId]
  );

  if (result.rows.length === 0) {
    return {
      total_orders: 0,
      total_shipments: 0,
      pending_shipments: 0,
      in_transit_shipments: 0,
      delivered_shipments: 0,
      total_spent: 0
    };
  }

  return result.rows[0];
}
