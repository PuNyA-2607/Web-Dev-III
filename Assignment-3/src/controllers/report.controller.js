import { reportService } from '../services/report.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getSalesReport = asyncHandler(async (req, res) => {
  const data = await reportService.getSalesReport(req.user, req.query);
  return ApiResponse.ok(res, 'Sales summary report generated successfully', data);
});

export const getBestSellers = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const data = await reportService.getBestSellers(req.user, limit);
  return ApiResponse.ok(res, 'Best sellers report generated successfully', data);
});

export const getInventorySummary = asyncHandler(async (req, res) => {
  const data = await reportService.getInventorySummary(req.user);
  return ApiResponse.ok(res, 'Inventory summary report generated successfully', data);
});
