// routes/jekyll/promptLibrary.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const promptLibraryController = require('../../controllers/jekyll/promptLibraryController');
const { authenticateToken } = require('../../middleware/auth');

// Jekyll 블로그 루트 디렉토리 설정
const BLOG_ROOT = path.join(__dirname, '..', '..', '..', 'prompt-engineering-library');

// 이미지 업로드 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // assets/images 디렉토리에 저장
    const uploadDir = path.join(BLOG_ROOT, 'assets', 'images');
    fs.ensureDirSync(uploadDir); // 디렉토리가 없으면 생성
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 고유한 파일명 생성
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB 제한
  }
});

// prompt-data.json 업데이트
router.post('/update-prompt-data', authenticateToken, promptLibraryController.updatePromptData);

// 포스트 저장
router.post('/posts', authenticateToken, promptLibraryController.savePost);

// 포스트 목록 조회
router.get('/posts', authenticateToken, promptLibraryController.getPosts);

// 포스트 삭제
router.post('/prompts/delete', authenticateToken, promptLibraryController.deletePost);

// 파일 업로드 (이미지)
router.post('/upload', authenticateToken, upload.array('files', 10), promptLibraryController.uploadFiles);

module.exports = router;