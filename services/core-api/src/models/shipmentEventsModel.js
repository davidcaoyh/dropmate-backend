import db from './db.js';

/**
 * Event Types for Shipment Tracking
 */
export const EVENT_TYPES = {
  // Creation & Assignment
  SHIPMENT_CREATED: 'shipment_created',
  DRIVER_ASSIGNED: 'driver_assigned',
  DRIVER_ALLOCATED: 'driver_allocated', // Same as assigned, but from driver's perspective
  DRIVER_UNASSIGNED: 'driver_unassigned',

  // Pickup Phase
  DRIVER_EN_ROUTE_TO_PICKUP: 'driver_en_route_to_pickup',
  ARRIVED_AT_PICKUP: 'arrived_at_pickup',
  PACKAGE_PICKED_UP: 'package_picked_up',

  // Delivery Phase
  OUT_FOR_DELIVERY: 'out_for_delivery',
  IN_TRANSIT: 'in_transit',
  DRIVER_EN_ROUTE_TO_DELIVERY: 'driver_en_route_to_delivery',
  ARRIVED_AT_DESTINATION: 'arrived_at_destination',
  DELIVERY_ATTEMPTED: 'delivery_attempted',
  DELIVERED: 'delivered',

  // Status Changes
  STATUS_CHANGED: 'status_changed',

  // Issues & Notes
  PACKAGE_DELAYED: 'package_delayed',
  ISSUE_REPORTED: 'issue_reported',
  NOTE_ADDED: 'note_added',
  CANCELLED: 'cancelled',

  // Location Updates (optional, can be high volume)
  LOCATION_UPDATED: 'location_updated'
};

/**
 * User-friendly descriptions for each event type
 */
const EVENT_DESCRIPTIONS = {
  [EVENT_TYPES.SHIPMENT_CREATED]: 'Package created and awaiting driver',
  [EVENT_TYPES.DRIVER_ASSIGNED]: 'Driver assigned to package',
  [EVENT_TYPES.DRIVER_ALLOCATED]: 'Driver accepted delivery request',
  [EVENT_TYPES.DRIVER_UNASSIGNED]: 'Driver unassigned from package',
  [EVENT_TYPES.DRIVER_EN_ROUTE_TO_PICKUP]: 'Driver is heading to pickup location',
  [EVENT_TYPES.ARRIVED_AT_PICKUP]: 'Driver arrived at pickup location',
  [EVENT_TYPES.PACKAGE_PICKED_UP]: 'Package picked up from sender',
  [EVENT_TYPES.OUT_FOR_DELIVERY]: 'Package is out for delivery',
  [EVENT_TYPES.IN_TRANSIT]: 'Package is in transit',
  [EVENT_TYPES.DRIVER_EN_ROUTE_TO_DELIVERY]: 'Driver is heading to delivery location',
  [EVENT_TYPES.ARRIVED_AT_DESTINATION]: 'Driver arrived at delivery location',
  [EVENT_TYPES.DELIVERY_ATTEMPTED]: 'Delivery attempted but unsuccessful',
  [EVENT_TYPES.DELIVERED]: 'Package delivered successfully',
  [EVENT_TYPES.STATUS_CHANGED]: 'Package status updated',
  [EVENT_TYPES.PACKAGE_DELAYED]: 'Package delayed',
  [EVENT_TYPES.ISSUE_REPORTED]: 'Issue reported',
  [EVENT_TYPES.NOTE_ADDED]: 'Note added',
  [EVENT_TYPES.CANCELLED]: 'Package cancelled',
  [EVENT_TYPES.LOCATION_UPDATED]: 'Driver location updated'
};

/**
 * Log a shipment event
 * @param {Object} eventData - Event data
 * @param {number} eventData.shipmentId - Shipment ID
 * @param {string} eventData.eventType - Event type (use EVENT_TYPES constants)
 * @param {string} [eventData.description] - Custom description (optional, auto-generated if not provided)
 * @param {number} [eventData.userId] - User who triggered the event
 * @param {string} [eventData.fromStatus] - Previous status (for status changes)
 * @param {string} [eventData.toStatus] - New status (for status changes)
 * @param {number} [eventData.latitude] - Location latitude
 * @param {number} [eventData.longitude] - Location longitude
 * @param {Object} [eventData.metadata] - Additional metadata
 * @returns {Promise<Object>} Created event
 */
export async function logShipmentEvent({
  shipmentId,
  eventType,
  description,
  userId = null,
  fromStatus = null,
  toStatus = null,
  latitude = null,
  longitude = null,
  metadata = {}
}) {
  // Use auto-generated description if not provided
  const finalDescription = description || EVENT_DESCRIPTIONS[eventType] || eventType;

  const result = await db.query(
    `INSERT INTO shipment_events
      (shipment_id, event_type, description, created_by_user_id, from_status, to_status, latitude, longitude, metadata, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING *`,
    [
      shipmentId,
      eventType,
      finalDescription,
      userId,
      fromStatus,
      toStatus,
      latitude,
      longitude,
      JSON.stringify(metadata)
    ]
  );

  return result.rows[0];
}

/**
 * Get all events for a shipment
 * @param {number} shipmentId - Shipment ID
 * @param {Object} options - Query options
 * @param {number} [options.limit] - Max events to return
 * @param {boolean} [options.includeLocationUpdates] - Include location update events
 * @returns {Promise<Array>} Array of events
 */
export async function getShipmentEvents(shipmentId, options = {}) {
  const { limit = 100, includeLocationUpdates = false } = options;

  let query = `
    SELECT e.*,
           u.email as created_by_email,
           CASE
             WHEN u.role = 'driver' THEN d.name
             WHEN u.role = 'customer' THEN c.name
             ELSE u.email
           END as created_by_name
    FROM shipment_events e
    LEFT JOIN users u ON u.id = e.created_by_user_id
    LEFT JOIN drivers d ON d.user_id = u.id
    LEFT JOIN customers c ON c.user_id = u.id
    WHERE e.shipment_id = $1
  `;

  const params = [shipmentId];

  // Optionally exclude high-volume location updates
  if (!includeLocationUpdates) {
    query += ` AND e.event_type != $2`;
    params.push(EVENT_TYPES.LOCATION_UPDATED);
  }

  query += ` ORDER BY e.occurred_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Get customer-friendly event history (excludes internal events)
 * @param {number} shipmentId - Shipment ID
 * @returns {Promise<Array>} Customer-visible events
 */
export async function getCustomerVisibleEvents(shipmentId) {
  const hiddenEventTypes = [
    EVENT_TYPES.LOCATION_UPDATED
  ];

  const result = await db.query(
    `SELECT e.event_type, e.description, e.occurred_at, e.to_status,
            CASE
              WHEN u.role = 'driver' THEN d.name
              ELSE NULL
            END as driver_name
     FROM shipment_events e
     LEFT JOIN users u ON u.id = e.created_by_user_id
     LEFT JOIN drivers d ON d.user_id = u.id
     WHERE e.shipment_id = $1
       AND e.event_type != ALL($2::varchar[])
     ORDER BY e.occurred_at ASC`,
    [shipmentId, hiddenEventTypes]
  );

  return result.rows;
}

// ============================================
// Convenience functions for common events
// ============================================

/**
 * Log shipment creation
 */
export async function logShipmentCreated(shipmentId, userId, metadata = {}) {
  return logShipmentEvent({
    shipmentId,
    eventType: EVENT_TYPES.SHIPMENT_CREATED,
    userId,
    toStatus: 'pending',
    metadata
  });
}

/**
 * Log driver assignment/allocation
 */
export async function logDriverAssigned(shipmentId, driverId, userId, metadata = {}) {
  return logShipmentEvent({
    shipmentId,
    eventType: EVENT_TYPES.DRIVER_ALLOCATED,
    userId,
    fromStatus: 'pending',
    toStatus: 'assigned',
    metadata: { driver_id: driverId, ...metadata }
  });
}

/**
 * Log status change
 */
export async function logStatusChange(shipmentId, fromStatus, toStatus, userId, metadata = {}) {
  // Determine specific event type based on status change
  let eventType = EVENT_TYPES.STATUS_CHANGED;

  if (toStatus === 'in_transit') {
    eventType = EVENT_TYPES.OUT_FOR_DELIVERY;
  } else if (toStatus === 'delivered') {
    eventType = EVENT_TYPES.DELIVERED;
  } else if (toStatus === 'assigned') {
    eventType = EVENT_TYPES.DRIVER_ASSIGNED;
  }

  return logShipmentEvent({
    shipmentId,
    eventType,
    userId,
    fromStatus,
    toStatus,
    metadata
  });
}

/**
 * Log package picked up from sender
 */
export async function logPackagePickedUp(shipmentId, userId, latitude, longitude, metadata = {}) {
  return logShipmentEvent({
    shipmentId,
    eventType: EVENT_TYPES.PACKAGE_PICKED_UP,
    userId,
    latitude,
    longitude,
    metadata
  });
}

/**
 * Log arrival at destination
 */
export async function logArrivedAtDestination(shipmentId, userId, latitude, longitude, metadata = {}) {
  return logShipmentEvent({
    shipmentId,
    eventType: EVENT_TYPES.ARRIVED_AT_DESTINATION,
    userId,
    latitude,
    longitude,
    metadata
  });
}

/**
 * Log delivery attempted (failed)
 */
export async function logDeliveryAttempted(shipmentId, userId, reason, metadata = {}) {
  return logShipmentEvent({
    shipmentId,
    eventType: EVENT_TYPES.DELIVERY_ATTEMPTED,
    description: `Delivery attempted: ${reason}`,
    userId,
    metadata: { reason, ...metadata }
  });
}

/**
 * Log successful delivery
 */
export async function logDelivered(shipmentId, userId, latitude, longitude, metadata = {}) {
  return logShipmentEvent({
    shipmentId,
    eventType: EVENT_TYPES.DELIVERED,
    userId,
    toStatus: 'delivered',
    latitude,
    longitude,
    metadata
  });
}

/**
 * Log manual note
 */
export async function logNote(shipmentId, userId, note, metadata = {}) {
  return logShipmentEvent({
    shipmentId,
    eventType: EVENT_TYPES.NOTE_ADDED,
    description: note,
    userId,
    metadata
  });
}

/**
 * Log issue/problem
 */
export async function logIssue(shipmentId, userId, issue, metadata = {}) {
  return logShipmentEvent({
    shipmentId,
    eventType: EVENT_TYPES.ISSUE_REPORTED,
    description: issue,
    userId,
    metadata
  });
}

/**
 * Delete old location update events (cleanup)
 * Keep only the last N location updates per shipment
 */
export async function cleanupOldLocationEvents(daysToKeep = 30) {
  const result = await db.query(
    `DELETE FROM shipment_events
     WHERE event_type = $1
       AND occurred_at < NOW() - INTERVAL '${daysToKeep} days'
     RETURNING id`,
    [EVENT_TYPES.LOCATION_UPDATED]
  );

  return result.rows.length;
}
