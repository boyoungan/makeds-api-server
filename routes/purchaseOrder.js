// routes/purchaseOrder.js
const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// 구매발주 목록 조회
router.get('/', authenticateToken, purchaseOrderController.getAllPurchaseOrders);

// 구매발주 상세 조회
router.get('/:id', authenticateToken, purchaseOrderController.getPurchaseOrderById);

// 구매발주 생성
router.post('/', authenticateToken, purchaseOrderController.createPurchaseOrder);

// 구매발주 상태 변경
router.put('/:id/status', authenticateToken, purchaseOrderController.updatePurchaseOrderStatus);

// 구매발주 삭제
router.delete('/:id', authenticateToken, purchaseOrderController.deletePurchaseOrder);

module.exports = router;