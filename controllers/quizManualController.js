// controllers/quizManualController.js
const fs = require('fs-extra');
const path = require('path');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 업로드 디렉토리 설정
const uploadDir = path.join(__dirname, '..', 'uploads', 'quizmanual');
fs.ensureDirSync(uploadDir);

// Google Generative AI 설정
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// PDF 업로드 및 텍스트 추출
exports.uploadAndExtract = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }
    const filePath = req.file.path;
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.pdf') {
      return res.status(400).json({ error: 'PDF 파일만 허용됩니다.' });
    }
    const dataBuffer = await fs.readFile(filePath);
    const pdfData = await pdf(dataBuffer);
    const text = pdfData.text;
    if (!text) {
      return res.status(400).json({ error: 'PDF에서 텍스트를 추출할 수 없습니다.' });
    }
    res.json({ success: true, text });
  } catch (err) {
    console.error('[QuizManual] PDF 추출 오류:', err);
    res.status(500).json({ error: '서버 오류: PDF 추출에 실패했습니다.' });
  }
};

// 퀴즈 생성 (Google Generative AI 활용)
exports.generateQuiz = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.length < 50) {
      return res.status(400).json({ error: '퀴즈 생성을 위한 충분한 텍스트가 필요합니다.' });
    }
    // 프롬프트 설계
    const prompt = `아래 텍스트를 바탕으로 다양한 유형(빈칸 채우기, OX, 객관식)으로 총 5문제의 퀴즈를 만들어줘. 각 문제는 다음 JSON 포맷으로 만들어줘.\n\n[
  {
    "type": "blank|ox|choice",
    "question": "문제 내용 (빈칸은 ___로 표시)",
    "options": ["선택지1", "선택지2", ...], // 객관식만
    "answer": "정답"
  },
  ...
]\n\n텍스트:\n${text.substring(0, 2000)}\n(텍스트가 길면 앞부분만 사용)
`;
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const raw = response.text();
    console.log('[QuizManual] Gemini 원본 응답:\n', raw);
    // JSON 파싱 시도
    let quizList = [];
    try {
      // 코드블록(```json ... ```)이 있으면 제거
      const jsonMatch = raw.match(/```json([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1] : raw;
      quizList = JSON.parse(jsonString);
    } catch (e) {
      // 파싱 실패 시, 전체 텍스트에서 JSON 부분만 추출 시도
      const arrMatch = raw.match(/\[([\s\S]*?)\]/);
      if (arrMatch) {
        try {
          quizList = JSON.parse('[' + arrMatch[1] + ']');
        } catch (e2) {
          quizList = [];
        }
      }
    }
    console.log('[QuizManual] 파싱된 quizList:\n', JSON.stringify(quizList, null, 2));
    if (!Array.isArray(quizList) || quizList.length === 0) {
      return res.status(500).json({ error: '퀴즈 생성에 실패했습니다.', raw });
    }
    res.json({ success: true, quizList });
  } catch (err) {
    console.error('[QuizManual] 퀴즈 생성 오류:', err);
    res.status(500).json({ error: '서버 오류: 퀴즈 생성에 실패했습니다.' });
  }
};
