import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { roundMoney } from './cart.service.js';

export const reportService = {
  /**
   * Aggregation 1: Sales Summary by Date
   * Pipeline: $match -> ($unwind) -> $group with $dateToString -> $sort
   * Sellers see only sales of their own products; Admins see whole-platform revenue.
   */
  getSalesReport: async (currentUser, { from, to }) => {
    const match = { status: { $ne: 'cancelled' } };

    if (from || to) {
      match.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (isNaN(fromDate.getTime())) {
          throw ApiError.badRequest('Invalid "from" date format');
        }
        match.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (isNaN(toDate.getTime())) {
          throw ApiError.badRequest('Invalid "to" date format');
        }
        toDate.setHours(23, 59, 59, 999);
        match.createdAt.$lte = toDate;
      }
    }

    let pipeline = [];

    if (currentUser.role === 'seller') {
      // Seller pipeline: unwind items to isolate seller-specific products & prices
      pipeline = [
        { $match: match },
        { $unwind: '$items' },
        { $match: { 'items.seller': new mongoose.Types.ObjectId(currentUser._id) } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            dailyRevenue: {
              $sum: { $multiply: ['$items.priceSnapshot', '$items.quantity'] },
            },
            itemsSold: { $sum: '$items.quantity' },
            distinctOrders: { $addToSet: '$_id' },
          },
        },
        {
          $project: {
            date: '$_id',
            _id: 0,
            revenue: { $round: ['$dailyRevenue', 2] },
            itemsSold: 1,
            ordersCount: { $size: '$distinctOrders' },
          },
        },
        { $sort: { date: 1 } },
      ];
    } else {
      // Admin pipeline: aggregate across all platform orders
      pipeline = [
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$total' },
            ordersCount: { $sum: 1 },
            itemsSold: { $sum: { $sum: '$items.quantity' } },
          },
        },
        {
          $project: {
            date: '$_id',
            _id: 0,
            revenue: { $round: ['$revenue', 2] },
            ordersCount: 1,
            itemsSold: 1,
          },
        },
        { $sort: { date: 1 } },
      ];
    }

    const dailyBreakdown = await Order.aggregate(pipeline);

    const totals = dailyBreakdown.reduce(
      (acc, curr) => ({
        totalRevenue: roundMoney(acc.totalRevenue + curr.revenue),
        totalOrders: acc.totalOrders + curr.ordersCount,
        totalItemsSold: acc.totalItemsSold + curr.itemsSold,
      }),
      { totalRevenue: 0, totalOrders: 0, totalItemsSold: 0 }
    );

    return {
      summary: totals,
      dailyBreakdown,
    };
  },

  /**
   * Aggregation 2: Best Selling Products
   * Pipeline: $match -> $unwind -> ($match seller) -> $group -> $sort -> $limit -> $lookup
   */
  getBestSellers: async (currentUser, limit = 10) => {
    const pipeline = [
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
    ];

    if (currentUser.role === 'seller') {
      pipeline.push({
        $match: { 'items.seller': new mongoose.Types.ObjectId(currentUser._id) },
      });
    }

    pipeline.push(
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          totalUnitsSold: { $sum: '$items.quantity' },
          totalRevenue: {
            $sum: { $multiply: ['$items.priceSnapshot', '$items.quantity'] },
          },
        },
      },
      { $sort: { totalUnitsSold: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDoc',
        },
      },
      {
        $project: {
          productId: '$_id',
          _id: 0,
          name: 1,
          totalUnitsSold: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          currentStock: { $ifNull: [{ $arrayElemAt: ['$productDoc.stock', 0] }, 0] },
          isActive: { $ifNull: [{ $arrayElemAt: ['$productDoc.isActive', 0] }, false] },
        },
      }
    );

    return await Order.aggregate(pipeline);
  },

  /**
   * Aggregation 3: Inventory Summary by Category
   * Pipeline: $match -> $group -> $lookup categories -> $project -> $sort
   * Summarizes stock count, total valuation, and items at or below lowStockThreshold.
   */
  getInventorySummary: async (currentUser) => {
    const match = { isActive: true };

    if (currentUser.role === 'seller') {
      match.seller = new mongoose.Types.ObjectId(currentUser._id);
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$stock' },
          totalStockValue: { $sum: { $multiply: ['$price', '$stock'] } },
          lowStockProductsCount: {
            $sum: {
              $cond: [{ $lte: ['$stock', '$lowStockThreshold'] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryDoc',
        },
      },
      {
        $project: {
          categoryId: '$_id',
          _id: 0,
          categoryName: {
            $ifNull: [{ $arrayElemAt: ['$categoryDoc.name', 0] }, 'Uncategorized'],
          },
          totalProducts: 1,
          totalStock: 1,
          totalStockValue: { $round: ['$totalStockValue', 2] },
          lowStockProductsCount: 1,
        },
      },
      { $sort: { totalStockValue: -1 } },
    ];

    return await Product.aggregate(pipeline);
  },
};
