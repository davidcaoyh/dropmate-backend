import express from 'express';
import { authenticateFirebase, requireCustomer, requireDriver } from '../middleware/auth.js';
import {
  getUserProfile,
  updateUserProfile,
  getUserOrders,
  getUserShipments,
  getUserShipmentById,
  getUserStats,
  createUserShipment
} from '../models/userModel.js';
import {
  getDriverIdByUserId,
  getAvailablePackages,
  claimPackage,
  getDriverDeliveries,
  createDriverProfile,
  updateDriverProfile
} from '../models/driverModel.js';
import { updateShipmentStatus } from '../models/shipmentsModel.js';

const router = express.Router();

// All routes require Firebase authentication
router.use(authenticateFirebase);

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get('/me', async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json(profile);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PATCH /api/users/me
 * Update current user profile
 * Body: { name?, phone? }
 */
router.patch('/me', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name && !phone) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'At least one field (name or phone) must be provided'
      });
    }

    const updated = await updateUserProfile(req.user.id, { name, phone });
    res.json(updated);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * GET /api/users/me/stats
 * Get user's delivery statistics
 */
router.get('/me/stats', async (req, res) => {
  try {
    const stats = await getUserStats(req.user.id);
    res.json(stats);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/users/me/orders
 * Get all orders for the logged-in user
 */
router.get('/me/orders', async (req, res) => {
  try {
    const orders = await getUserOrders(req.user.id);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/users/me/shipments
 * Get all shipments/packages for the logged-in user with live tracking
 */
router.get('/me/shipments', async (req, res) => {
  try {
    const shipments = await getUserShipments(req.user.id);
    res.json(shipments);
  } catch (err) {
    console.error('Error fetching shipments:', err);
    res.status(500).json({ error: 'Failed to fetch shipments' });
  }
});

/**
 * POST /api/users/me/shipments
 * Create a new shipment/package for the logged-in customer
 * Body: { pickupAddress, deliveryAddress, totalAmount? }
 * 🔒 Customer Only
 */
router.post('/me/shipments', requireCustomer, async (req, res) => {
  try {
    const { pickupAddress, deliveryAddress, totalAmount } = req.body;

    // Validate required fields
    if (!pickupAddress || !deliveryAddress) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'pickupAddress and deliveryAddress are required'
      });
    }

    // Create the shipment
    const shipment = await createUserShipment(req.user.id, {
      pickupAddress,
      deliveryAddress,
      totalAmount: totalAmount || 0
    });

    res.status(201).json({
      message: 'Shipment created successfully',
      shipment
    });
  } catch (err) {
    console.error('Error creating shipment:', err);

    if (err.message.includes('Customer profile not found')) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'Customer profile not found. Please complete your profile first.'
      });
    }

    res.status(500).json({ error: 'Failed to create shipment' });
  }
});

/**
 * GET /api/users/me/shipments/:id
 * Get a specific shipment with live tracking
 * Security: Automatically verifies ownership
 */
router.get('/me/shipments/:id', async (req, res) => {
  try {
    const shipmentId = req.params.id;
    const shipment = await getUserShipmentById(req.user.id, shipmentId);

    if (!shipment) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Shipment not found or does not belong to you'
      });
    }

    res.json(shipment);
  } catch (err) {
    console.error('Error fetching shipment:', err);
    res.status(500).json({ error: 'Failed to fetch shipment' });
  }
});

// =====================================================
// 🚗 DRIVER REGISTRATION & MANAGEMENT
// =====================================================

/**
 * POST /api/users/me/register-driver
 * Register current user as a driver
 * Body: { name, vehicleType, licenseNumber }
 * 🔒 Authentication Required
 */
router.post('/me/register-driver', async (req, res) => {
  try {
    const { name, vehicleType, licenseNumber } = req.body;

    // Validate required fields
    if (!name || !vehicleType || !licenseNumber) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'name, vehicleType, and licenseNumber are required'
      });
    }

    // Create driver profile
    const driverProfile = await createDriverProfile(req.user.id, {
      name,
      vehicleType,
      licenseNumber
    });

    res.status(201).json({
      message: 'Driver profile created successfully',
      driver: driverProfile
    });
  } catch (err) {
    console.error('Error creating driver profile:', err);

    if (err.message === 'User already has a driver profile') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You already have a driver profile'
      });
    }

    if (err.message === 'User not found') {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.status(500).json({ error: 'Failed to create driver profile' });
  }
});

/**
 * PATCH /api/users/me/driver-profile
 * Update driver profile information
 * Body: { name?, vehicleType?, licenseNumber? }
 * 🔒 Driver Only
 */
router.patch('/me/driver-profile', requireDriver, async (req, res) => {
  try {
    const { name, vehicleType, licenseNumber } = req.body;

    if (!name && !vehicleType && !licenseNumber) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'At least one field (name, vehicleType, licenseNumber) must be provided'
      });
    }

    // Get driver ID
    const driverId = await getDriverIdByUserId(req.user.id);

    if (!driverId) {
      return res.status(404).json({
        error: 'Driver profile not found'
      });
    }

    // Update driver profile
    const updated = await updateDriverProfile(driverId, {
      name,
      vehicleType,
      licenseNumber
    });

    res.json({
      message: 'Driver profile updated',
      driver: updated
    });
  } catch (err) {
    console.error('Error updating driver profile:', err);
    res.status(500).json({ error: 'Failed to update driver profile' });
  }
});

// =====================================================
// 🚗 DRIVER-ONLY ENDPOINTS
// =====================================================

/**
 * GET /api/users/me/available-packages
 * Get list of packages available for drivers to claim
 * 🔒 Driver Only
 */
router.get('/me/available-packages', requireDriver, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const packages = await getAvailablePackages(limit);

    res.json({
      count: packages.length,
      packages
    });
  } catch (err) {
    console.error('Error fetching available packages:', err);
    res.status(500).json({ error: 'Failed to fetch available packages' });
  }
});

/**
 * POST /api/users/me/packages/:id/claim
 * Claim an available package (assigns it to the driver)
 * 🔒 Driver Only
 */
router.post('/me/packages/:id/claim', requireDriver, async (req, res) => {
  try {
    const shipmentId = req.params.id;

    // Get driver ID for this user
    const driverId = await getDriverIdByUserId(req.user.id);

    if (!driverId) {
      return res.status(404).json({
        error: 'Driver profile not found',
        message: 'No driver profile associated with your account'
      });
    }

    // Claim the package (pass userId for event logging)
    const claimedPackage = await claimPackage(shipmentId, driverId, req.user.id);

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.emit('shipment_assigned', {
        shipmentId: claimedPackage.id,
        driverId: driverId,
        trackingNumber: claimedPackage.tracking_number
      });
    }

    res.json({
      message: 'Package claimed successfully',
      package: claimedPackage
    });
  } catch (err) {
    console.error('Error claiming package:', err);

    if (err.message === 'Package not found') {
      return res.status(404).json({ error: err.message });
    }

    if (err.message.includes('already claimed') || err.message.includes('cannot be claimed')) {
      return res.status(409).json({
        error: 'Package unavailable',
        message: err.message
      });
    }

    res.status(500).json({ error: 'Failed to claim package' });
  }
});

/**
 * GET /api/users/me/deliveries
 * Get all deliveries (packages) assigned to the driver
 * Query params: ?status=assigned|in_transit|delivered
 * 🔒 Driver Only
 */
router.get('/me/deliveries', requireDriver, async (req, res) => {
  try {
    // Get driver ID for this user
    const driverId = await getDriverIdByUserId(req.user.id);

    if (!driverId) {
      return res.status(404).json({
        error: 'Driver profile not found',
        message: 'No driver profile associated with your account'
      });
    }

    const statusFilter = req.query.status || null;
    const deliveries = await getDriverDeliveries(driverId, statusFilter);

    res.json({
      driverId,
      count: deliveries.length,
      deliveries
    });
  } catch (err) {
    console.error('Error fetching deliveries:', err);
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
});

/**
 * PATCH /api/users/me/deliveries/:id/status
 * Update delivery status (driver updates their own delivery)
 * Body: { status: "in_transit" | "delivered" }
 * 🔒 Driver Only
 */
router.patch('/me/deliveries/:id/status', requireDriver, async (req, res) => {
  try {
    const shipmentId = req.params.id;
    const { status } = req.body;

    // Get driver ID for this user
    const driverId = await getDriverIdByUserId(req.user.id);

    if (!driverId) {
      return res.status(404).json({
        error: 'Driver profile not found'
      });
    }

    // Verify this shipment belongs to this driver
    const db = (await import('../models/db.js')).default;
    const verifyResult = await db.query(
      'SELECT id, driver_id FROM shipments WHERE id = $1',
      [shipmentId]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    if (verifyResult.rows[0].driver_id !== driverId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This delivery is not assigned to you'
      });
    }

    // Validate status
    const validStatuses = ['in_transit', 'delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Update status (pass userId for event logging)
    const updated = await updateShipmentStatus(shipmentId, status, req.user.id);

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.emit('shipment_updated', {
        id: updated.id,
        status: updated.status,
        trackingNumber: updated.tracking_number
      });
    }

    res.json({
      message: 'Delivery status updated',
      delivery: updated
    });
  } catch (err) {
    console.error('Error updating delivery status:', err);
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
});

// =====================================================
// 📜 SHIPMENT HISTORY & EVENTS
// =====================================================

/**
 * GET /api/users/me/shipments/:id/history
 * Get customer-friendly shipment history
 * 🔒 Authentication Required
 */
router.get('/me/shipments/:id/history', async (req, res) => {
  try {
    const shipmentId = req.params.id;

    // Verify ownership
    const verifyResult = await (await import('../models/db.js')).default.query(
      `SELECT s.id FROM shipments s
       JOIN orders o ON o.id = s.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE s.id = $1 AND c.user_id = $2`,
      [shipmentId, req.user.id]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Shipment not found or does not belong to you'
      });
    }

    // Get customer-visible events
    const { getCustomerVisibleEvents } = await import('../models/shipmentEventsModel.js');
    const events = await getCustomerVisibleEvents(shipmentId);

    res.json({
      shipmentId: parseInt(shipmentId),
      count: events.length,
      events
    });
  } catch (err) {
    console.error('Error fetching shipment history:', err);
    res.status(500).json({ error: 'Failed to fetch shipment history' });
  }
});

/**
 * POST /api/users/me/deliveries/:id/events
 * Add a manual event/note to a delivery (Driver only)
 * Body: { eventType, description, latitude?, longitude? }
 * 🔒 Driver Only
 */
router.post('/me/deliveries/:id/events', requireDriver, async (req, res) => {
  try {
    const shipmentId = req.params.id;
    const { eventType, description, latitude, longitude } = req.body;

    if (!eventType || !description) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'eventType and description are required'
      });
    }

    // Get driver ID
    const driverId = await getDriverIdByUserId(req.user.id);
    if (!driverId) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    // Verify this shipment belongs to this driver
    const db = (await import('../models/db.js')).default;
    const verifyResult = await db.query(
      'SELECT id FROM shipments WHERE id = $1 AND driver_id = $2',
      [shipmentId, driverId]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This delivery is not assigned to you'
      });
    }

    // Log the event
    const { logShipmentEvent, EVENT_TYPES } = await import('../models/shipmentEventsModel.js');

    const event = await logShipmentEvent({
      shipmentId: parseInt(shipmentId),
      eventType,
      description,
      userId: req.user.id,
      latitude,
      longitude
    });

    // Emit WebSocket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('shipment_event', {
        shipmentId: parseInt(shipmentId),
        event: {
          type: eventType,
          description,
          occurred_at: event.occurred_at
        }
      });
    }

    res.status(201).json({
      message: 'Event logged successfully',
      event
    });
  } catch (err) {
    console.error('Error logging event:', err);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

export default router;
