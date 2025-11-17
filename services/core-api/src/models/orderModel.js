import db from './db.js';

export async function listOrders() {
    const [rows] = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
    return rows;
}

/**
 * Create a new order for a customer
 * @param {number} customerId - The customer ID
 * @param {number} totalAmount - Total order amount
 * @returns {Promise<Object>} The created order
 */
export async function createOrder(customerId, totalAmount = 0) {
    const result = await db.query(
        `INSERT INTO orders (customer_id, total_amount, status)
         VALUES ($1, $2, 'pending')
         RETURNING *`,
        [customerId, totalAmount]
    );
    return result.rows[0];
}