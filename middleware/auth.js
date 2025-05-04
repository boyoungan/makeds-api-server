// middleware/auth.js
const jwt = require('jsonwebtoken');

// JWT 시크릿 키
const JWT_SECRET = process.env.JWT_SECRET;

// 토큰 인증 미들웨어
exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN 형식에서 TOKEN 추출
  
  if (!token) {
    return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
      }
      return res.status(403).json({ message: '유효하지 않은 토큰입니다.' });
    }
    
    req.user = user;
    next();
  });
};

// 관리자 권한 확인 미들웨어
exports.isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: '인증이 필요합니다.' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
  }
  
  next();
};