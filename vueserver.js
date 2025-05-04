const express = require('express');
const path = require('path');   

module.exports = function(app) {
  // Vue 빌드 디렉토리 경로 설정
  const distPath = path.join(__dirname, 'dist');
  
  // 1. /uploads 경로 처리
  app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
  
  // 2. Vue 앱의 정적 파일 서빙
  app.use(express.static(distPath));
  
  // 3. SPA 라우팅 처리 - 모든 요청을 index.html로 전달
  app.use((req, res, next) => {
    if (req.url.startsWith('/uploads/')) {
      next();
    } else {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
};
