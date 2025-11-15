import db from "./db.js";

export async function listShipments() {
  const result = await db.query(
    `SELECT s.id, s.status, s.tracking_number, o.id AS order_id, o.customer_id
       FROM shipments s
       LEFT JOIN orders o ON o.id = s.order_id
       ORDER BY s.created_at DESC`
  );
  return result.rows;
}

export async function updateShipmentStatus(id, status) {
  const result = await db.query(
    "UPDATE shipments SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
    [status, id]
  );
  return result.rows[0];
}
