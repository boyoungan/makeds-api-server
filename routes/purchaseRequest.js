// routes/purchaseRequest.js
const express = require('express');
const router = express.Router();
const purchaseRequestController = require('../controllers/purchaseRequestController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// 구매요청 목록 조회
router.get('/', authenticateToken, purchaseRequestController.getAllPurchaseRequests);

// 구매요청 상세 조회
router.get('/:id', authenticateToken, purchaseRequestController.getPurchaseRequestById);

// 구매요청 생성
router.post('/', authenticateToken, purchaseRequestController.createPurchaseRequest);

// 구매요청 상태 변경 (승인/거절)
router.put('/:id/status', authenticateToken, purchaseRequestController.updatePurchaseRequestStatus);

// 구매요청 삭제
router.delete('/:id', authenticateToken, purchaseRequestController.deletePurchaseRequest);

module.exports = router;