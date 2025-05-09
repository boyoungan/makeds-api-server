// routes/quizManual.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const quizManualController = require('../controllers/quizManualController');

// 업로드 디렉토리 설정
const uploadDir = path.join(__dirname, '..', 'uploads', 'quizmanual');
fs.ensureDirSync(uploadDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(file.mimetype) && ext === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('PDF 파일만 업로드할 수 있습니다.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// PDF 업로드 및 텍스트 추출
router.post('/upload-pdf', upload.single('file'), quizManualController.uploadAndExtract);

// 퀴즈 생성
router.post('/generate-quiz', quizManualController.generateQuiz);

module.exports = router;
