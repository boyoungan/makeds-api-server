const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });

// 파일 미리보기 (txt, md만 허용)
router.post('/changedoctype/preview', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = path.extname(file.originalname).toLowerCase();
  if (!['.txt', '.md'].includes(ext)) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Only txt or md files allowed' });
  }
  const content = fs.readFileSync(file.path, 'utf-8');
  fs.unlinkSync(file.path);
  res.json({ content });
});

// 변환 (특정 문자열/정규식 → 다른 문자열)
router.post('/changedoctype/convert', upload.single('file'), (req, res) => {
  const { find, replace } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = path.extname(file.originalname).toLowerCase();
  if (!['.txt', '.md'].includes(ext)) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Only txt or md files allowed' });
  }
  let content = fs.readFileSync(file.path, 'utf-8');
  fs.unlinkSync(file.path);
  // find가 \uXXXX 형태면 실제 유니코드로 변환
  let findStr = find;
  if (/^\\u[0-9a-fA-F]{4}$/.test(find)) {
    findStr = String.fromCharCode(parseInt(find.replace('\\u', ''), 16));
  }
  // 변환 (정규식 전체치환)
  const regex = new RegExp(findStr, 'g');
  const converted = content.replace(regex, replace);
  res.json({ converted });
});

module.exports = router;
