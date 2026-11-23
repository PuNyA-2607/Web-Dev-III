import { Router } from 'express';
import {
  getSalesReport,
  getBestSellers,
  getInventorySummary,
} from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  salesReportQuerySchema,
  bestSellersQuerySchema,
} from '../validations/report.validation.js';

const router = Router();

// Reports are restricted to sellers and platform administrators only
router.use(authenticate, authorize('seller', 'admin'));

/**
 * @route   GET /api/v1/reports/sales
 * @desc    Sales summary aggregated by day ($match, $group by day with $dateToString, $sort)
 * @access  Private (Seller, Admin)
 */
router.get('/sales', validate(salesReportQuerySchema, 'query'), getSalesReport);

/**
 * @route   GET /api/v1/reports/best-sellers
 * @desc    Top selling products ($unwind, $group, $sort, $limit, $lookup)
 * @access  Private (Seller, Admin)
 */
router.get('/best-sellers', validate(bestSellersQuerySchema, 'query'), getBestSellers);

/**
 * @route   GET /api/v1/reports/inventory
 * @desc    Inventory valuation & low stock summary by category ($match, $group, $lookup)
 * @access  Private (Seller, Admin)
 */
router.get('/inventory', getInventorySummary);

export default router;
