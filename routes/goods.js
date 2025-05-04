// routes/goods.js
const express = require('express');
const router = express.Router();
const goodsController = require('../controllers/goodsController');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 이미지 업로드용 Multer 설정
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'images');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const imageUpload = multer({ storage: imageStorage });

// 엑셀 업로드용 Multer 설정 (임시 폴더 사용)
const excelStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'temp_uploads'); // 임시 폴더
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const excelUpload = multer({
  storage: excelStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.'), false);
    }
  }
});

// --- 상품 API 라우트 --- (순서 중요!)

// 엑셀 파일로 상품 내보내기 (/:id 보다 먼저 와야 함)
router.get('/export', authenticateToken, goodsController.exportGoodsToExcel);

// 카테고리 목록 조회 (/:id 보다 먼저 와야 함)
router.get('/categories/list', authenticateToken, goodsController.getCategories);

// 상품 목록 조회
router.get('/', authenticateToken, goodsController.getAllGoods);

// 상품 상세 조회 (가장 일반적인 /:id는 뒤로)
router.get('/:id', authenticateToken, goodsController.getGoodsById);

// 상품 등록 (이미지 포함)
router.post('/', authenticateToken, imageUpload.single('image'), goodsController.createGoods);

// 엑셀 파일로 상품 가져오기
router.post('/import', authenticateToken, excelUpload.single('excelFile'), goodsController.importGoodsFromExcel);

// 상품 수정 (이미지 포함)
router.put('/:id', authenticateToken, imageUpload.single('image'), goodsController.updateGoods);

// 상품 삭제
router.delete('/:id', authenticateToken, goodsController.deleteGoods);

module.exports = router;