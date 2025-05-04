// routes/calculateLeave.js
const express = require('express');
const router = express.Router();
const calculateLeaveController = require('../controllers/calculateLeaveController');

// 연차 계산 라우트
router.post('/calculate-leave', calculateLeaveController.calculateLeave);

// 공휴일 목록 조회 라우트
router.get('/holidays', calculateLeaveController.getHolidays);

// 근무일수 계산 라우트
router.post('/calculate-working-days', calculateLeaveController.calculateWorkingDays);

module.exports = router;