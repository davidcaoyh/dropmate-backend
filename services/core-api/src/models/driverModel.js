import db from "./db.js";

/** List all active drivers with their last known location */
export async function listDrivers() {
  const query = `
    SELECT d.id,
           d.name,
           d.vehicle_type,
           d.license_number,
           d.status,
           COALESCE(
             (SELECT json_build_object(
                 'latitude', dle.latitude,
                 'longitude', dle.longitude,
                 'recorded_at', dle.occurred_at
              )
              FROM driver_location_events dle
              WHERE dle.driver_id = d.id
              ORDER BY dle.occurred_at DESC
              LIMIT 1),
           '{}'::json) AS last_location
      FROM drivers d
     ORDER BY d.name;
  `;
  const { rows } = await db.query(query);
  return rows;
}

/** Update driver status (e.g. active, on_duty, offline) */
export async function updateDriverStatus(id, status) {
  const { rows } = await db.query(
    `UPDATE drivers
        SET status=$1, updated_at=NOW()
      WHERE id=$2
  RETURNING *;`,
    [status, id]
  );
  return rows[0];
}

/** Insert a live location event for a driver */
export async function addDriverLocationEvent(driverId, latitude, longitude) {
  const { rows } = await db.query(
    `INSERT INTO driver_location_events (driver_id, latitude, longitude)
         VALUES ($1, $2, $3)
      RETURNING *;`,
    [driverId, latitude, longitude]
  );
  return rows[0];
}
