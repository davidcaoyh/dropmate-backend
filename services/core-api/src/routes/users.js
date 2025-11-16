import express from 'express';
import { authenticateFirebase } from '../middleware/auth.js';
import {
  getUserProfile,
  updateUserProfile,
  getUserOrders,
  getUserShipments,
  getUserShipmentById,
  getUserStats
} from '../models/userModel.js';

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

export default router;
