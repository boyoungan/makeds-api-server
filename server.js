// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

// 앱 초기화
const app = express();
const db = require('./models');

// 환경변수
const PORT = process.env.PORT || 3000;
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:4000', 'http://127.0.0.1:4000', 'http://localhost:8080', 'http://127.0.0.1:8080'];

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 설정
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// 정적 파일 서빙 설정
app.use(express.static(path.join(__dirname, 'public')));
const uploadsPath = path.join(__dirname, 'public', 'uploads');
fs.ensureDirSync(uploadsPath); // 디렉토리가 없으면 생성
console.log('Static files path:', uploadsPath);

// 정적 파일 경로 설정
app.use('/uploads', express.static(uploadsPath));

// API 라우트 설정
const authRouter = require('./routes/auth');
const goodsRouter = require('./routes/goods');
const purchaseRequestRouter = require('./routes/purchaseRequest');
const purchaseOrderRouter = require('./routes/purchaseOrder');
const calculateLeaveRouter = require('./routes/calculateLeave');
const docChatRouter = require('./routes/docChat');
const promptLibraryRouter = require('./routes/jekyll/promptLibrary');

// API 라우트 등록
app.use('/api/auth', authRouter);
app.use('/api/goods', goodsRouter);
app.use('/api/purchase-requests', purchaseRequestRouter);
app.use('/api/purchase-orders', purchaseOrderRouter);
app.use('/api', calculateLeaveRouter);
app.use('/api/docChat', docChatRouter);
app.use('/api', promptLibraryRouter);

// 오류 처리 미들웨어
const multer = require('multer');
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  // Multer 오류 처리
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '파일 크기가 너무 큽니다.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: '필드 이름이 올바르지 않습니다.' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  // 파일 형식 오류 처리
  if (err.message && err.message.includes('지원하지 않는 파일 형식')) {
    return res.status(400).json({ error: err.message });
  }
  
  // 기타 서버 오류
  res.status(500).json({ error: '서버 오류가 발생했습니다.', details: err.message });
});

// Vue 앱 설정
const vueServer = require('./vueserver');
vueServer(app);

// 서버 시작
db.sequelize.sync()
  .then(() => {
    console.log('Database connected');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to database:', err);
  });