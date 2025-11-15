import express from 'express';
import { listOrders } from '../models/orderModel.js';

const router = express.Router();

router.get('/', async (req, res) => res.json(await listOrders()));
export default router;