// routes/docChat.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const docChatController = require('../controllers/docChatController');
const { authenticateToken } = require('../middleware/auth');

// 업로드 디렉토리 설정
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'documents');

// 디렉토리가 없으면 생성
fs.ensureDirSync(uploadDir);

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 원본 파일명을 유지하되, 중복을 피하기 위해 타임스탬프 추가
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// 업로드 필터 - 문서 형식만 허용
const fileFilter = (req, file, cb) => {
  console.log('업로드된 파일 정보:', {
    mimetype: file.mimetype,
    originalname: file.originalname,
    fieldname: file.fieldname
  });
  
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    // 추가 MIME 타입
    'application/x-pdf',
    'application/acrobat',
    'applications/vnd.pdf',
    'application/octet-stream'
  ];
  
  // 파일 확장자 확인
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.pdf', '.txt', '.doc', '.docx', '.md'];
  
  // MIME 타입 또는 확장자가 허용되는 경우 허용
  if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    console.log('허용되지 않는 파일 형식:', file.mimetype, ext);
    cb(new Error('지원하지 않는 파일 형식입니다. PDF, TXT, DOC, DOCX, MD 형식만 허용됩니다.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  }
});

// 문서 업로드
router.post('/upload', authenticateToken, upload.single('file'), docChatController.uploadDocument);

// 문서 목록 조회
router.get('/documents', authenticateToken, docChatController.getDocuments);

// 문서 삭제
router.delete('/documents/:filename', authenticateToken, docChatController.deleteDocument);

// 문서 내용 조회 (텍스트 기반 문서)
router.get('/documents/:filename/content', authenticateToken, docChatController.getDocumentContent);

// 문서 챗 대화 처리
router.post('/chat', authenticateToken, docChatController.processChat);

module.exports = router;

