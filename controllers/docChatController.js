// controllers/docChatController.js
const fs = require('fs-extra');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Document } = require('langchain/document');
const { CharacterTextSplitter } = require('langchain/text_splitter');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { RetrievalQAChain } = require('langchain/chains');
const pdf = require('pdf-parse');
const { PromptTemplate } = require('@langchain/core/prompts');

// 환경변수에서 API 키 가져오기
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// 업로드 디렉토리 설정
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'documents');
const vectorStoreDir = path.join(__dirname, '..', 'public', 'uploads', 'vectorstores');

// 디렉토리 생성
fs.ensureDirSync(uploadDir);
fs.ensureDirSync(vectorStoreDir);

// Gemini AI 모델 설정
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// 벡터 스토어 관리를 위한 매핑 (메모리에 직접 저장)
const documentVectorStores = new Map();
const documentEmbeddings = new Map();

// 문서 처리 함수
async function processDocument(filePath, fileName) {
  try {
    console.log(`[processDocument] 시작 - 파일: ${fileName}`);
    const ext = path.extname(filePath).toLowerCase();
    let text = '';
    
    // PDF 파일 처리
    if (ext === '.pdf') {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdf(dataBuffer);
      text = pdfData.text;
    }
    // 텍스트 파일 처리
    else if (['.txt', '.md', '.doc', '.docx'].includes(ext)) {
      console.log(`[processDocument] 텍스트 파일 읽기 시작`);
      
      // 인코딩 문제를 해결하기 위해 여러 인코딩 시도
      const iconv = require('iconv-lite');
      const buffer = await fs.readFile(filePath);
      
      // 가능한 인코딩 목록
      const encodings = ['utf8', 'euc-kr', 'cp949', 'utf16le'];
      
      // 각 인코딩 시도
      for (const encoding of encodings) {
        try {
          let decodedText;
          if (encoding === 'utf8') {
            // UTF-8은 Buffer에서 직접 문자열로 변환
            decodedText = buffer.toString('utf8');
          } else {
            // 다른 인코딩은 iconv-lite 사용
            decodedText = iconv.decode(buffer, encoding);
          }
          
          // 디코딩 결과 확인
          const containsUnknownChars = decodedText.includes('\uFFFD') || /[\uFFFD]/.test(decodedText);
          const tooManyUnknownChars = (decodedText.match(/\uFFFD/g) || []).length > decodedText.length * 0.1;
          
          if (!containsUnknownChars || !tooManyUnknownChars) {
            text = decodedText;
            console.log(`[processDocument] 성공적인 인코딩 감지: ${encoding}`);
            break;
          }
        } catch (e) {
          console.log(`[processDocument] ${encoding} 디코딩 시도 실패:`, e.message);
        }
      }
      
      // 모든 인코딩 시도 후에도 텍스트가 비어있다면
      if (!text || text.length === 0) {
        // fallback으로 CP949 강제 시도
        try {
          text = iconv.decode(buffer, 'cp949');
          console.log(`[processDocument] Fallback CP949 인코딩 사용`);
        } catch (e) {
          console.error(`[processDocument] 모든 인코딩 시도 실패`);
        }
      }
      
      console.log(`[processDocument] 텍스트 길이: ${text.length}, 일부 텍스트: ${text.substring(0, 100)}...`);
    }
    
    if (!text) {
      console.log(`[processDocument] 오류 - 빈 텍스트`);
      throw new Error('문서에서 텍스트를 추출할 수 없습니다.');
    }
    
    // 텍스트 분할
    console.log(`[processDocument] 텍스트 분할 시작`);
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000,  // 청크 크기를 1000에서 2000으로 늘림
      chunkOverlap: 400, // 오버랩도 늘림
    });
    
    const docs = await textSplitter.createDocuments([text]);
    console.log(`[processDocument] 텍스트 분할 완료 - 청크 수: ${docs.length}`);
    
    // 임베딩 생성
    console.log(`[processDocument] 임베딩 생성 시작`);
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: GOOGLE_API_KEY,
      modelName: "models/embedding-001"
    });
    
    // 벡터 스토어 생성 (MemoryVectorStore 사용)
    console.log(`[processDocument] 벡터 스토어 생성 시작`);
    const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    console.log(`[processDocument] 벡터 스토어 생성 완료`);
    
    // 메모리에 캐싱
    documentVectorStores.set(fileName, vectorStore);
    documentEmbeddings.set(fileName, embeddings);
    
    // 벡터 스토어 데이터를 JSON으로 저장 
    try {
      // docs 데이터를 직렬화 가능한 형태로 변환
      const serializableDocs = docs.map(doc => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata
      }));
      
      const vectorStoreData = {
        docs: serializableDocs,
        fileName: fileName,
        timestamp: new Date().toISOString()
      };
      
      const vectorStorePath = path.join(vectorStoreDir, `${fileName}.json`);
      await fs.writeJSON(vectorStorePath, vectorStoreData, { spaces: 2 });
      console.log(`[processDocument] 벡터 스토어 JSON 저장 완료: ${vectorStorePath}`);
    } catch (saveError) {
      console.warn('[processDocument] 벡터 스토어 저장 오류, 메모리에만 저장됩니다:', saveError);
    }
    
    console.log(`[processDocument] 완료 - 문서 ID: ${fileName}`);
    return {
      success: true,
      documentId: fileName,
      chunks: docs.length
    };
  } catch (error) {
    console.error('[processDocument] 문서 처리 오류:', error);
    throw error;
  }
}

// 벡터 스토어 로드 함수
async function loadVectorStore(fileName) {
  try {
    console.log(`[loadVectorStore] 시작 - 파일: ${fileName}`);
    // 이미 메모리에 있는지 확인
    if (documentVectorStores.has(fileName)) {
      console.log(`[loadVectorStore] 메모리에서 벡터 스토어 찾음`);
      return documentVectorStores.get(fileName);
    }
    
    // 파일에서 JSON 데이터 로드 시도
    const vectorStorePath = path.join(vectorStoreDir, `${fileName}.json`);
    console.log(`[loadVectorStore] 벡터 스토어 파일 확인: ${vectorStorePath}`);
    
    if (await fs.pathExists(vectorStorePath)) {
      try {
        console.log(`[loadVectorStore] JSON에서 벡터 스토어 로드 시작`);
        const data = await fs.readJSON(vectorStorePath);
        
        // 임베딩 생성
        const embeddings = new GoogleGenerativeAIEmbeddings({
          apiKey: GOOGLE_API_KEY,
          modelName: "models/embedding-001"
        });
        
        // 문서 객체 복원
        const docs = data.docs.map(item => 
          new Document({
            pageContent: item.pageContent,
            metadata: item.metadata || {}
          })
        );
        
        console.log(`[loadVectorStore] 문서 청크 수: ${docs.length}`);
        
        // 새 벡터 스토어 생성
        const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
        
        // 메모리에 캐싱
        documentVectorStores.set(fileName, vectorStore);
        documentEmbeddings.set(fileName, embeddings);
        
        console.log(`[loadVectorStore] JSON에서 벡터 스토어 로드 완료`);
        return vectorStore;
      } catch (readError) {
        console.error('[loadVectorStore] 벡터 스토어 로드 실패, 문서를 다시 처리합니다:', readError);
      }
    }
    
    // JSON 로드 실패 시 원본 문서에서 다시 처리
    console.log(`[loadVectorStore] 원본 문서에서 처리 시도`);
    const filePath = path.join(uploadDir, fileName);
    if (await fs.pathExists(filePath)) {
      console.log(`[loadVectorStore] 원본 문서 발견, 재처리 시작`);
      await processDocument(filePath, fileName);
      console.log(`[loadVectorStore] 문서 재처리 완료`);
      return documentVectorStores.get(fileName);
    } else {
      console.log(`[loadVectorStore] 오류 - 원본 문서 찾을 수 없음: ${filePath}`);
      throw new Error('문서 파일을 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('[loadVectorStore] 벡터 스토어 로드 오류:', error);
    throw error;
  }
}

// 문서 업로드 컨트롤러
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '업로드할 파일이 없습니다.' });
    }
    
    const fileInfo = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path,
      url: `/uploads/documents/${req.file.filename}`
    };
    
    // 문서 처리 및 벡터 스토어 생성
    const result = await processDocument(req.file.path, req.file.filename);
    
    res.json({
      success: true,
      file: fileInfo,
      documentId: req.file.filename,
      filename: req.file.filename,
      message: '문서가 성공적으로 업로드되었습니다.'
    });
  } catch (error) {
    console.error('문서 업로드 오류:', error);
    res.status(500).json({ error: '문서 업로드 중 오류가 발생했습니다.' });
  }
};

// 문서 목록 조회 컨트롤러
exports.getDocuments = async (req, res) => {
  try {
    // 업로드 디렉토리 확인
    await fs.ensureDir(uploadDir);
    
    // 문서 파일 목록 조회
    const files = await fs.readdir(uploadDir);
    
    // 파일 정보 추출
    const documents = [];
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = await fs.stat(filePath);
      
      // 확장자 추출
      const ext = path.extname(file).toLowerCase();
      
      // 지원하는 문서 형식만 포함
      if (['.pdf', '.doc', '.docx', '.txt', '.md'].includes(ext)) {
        documents.push({
          filename: file,
          originalname: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          url: `/uploads/documents/${file}`,
          type: ext.slice(1) // 확장자에서 점(.) 제거
        });
      }
    }
    
    // 최근 수정일 기준 내림차순 정렬
    documents.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    
    res.json({ documents });
  } catch (error) {
    console.error('문서 목록 조회 오류:', error);
    res.status(500).json({ error: '문서 목록을 가져오는 중 오류가 발생했습니다.' });
  }
};

// 문서 삭제 컨트롤러
exports.deleteDocument = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: '파일명은 필수입니다.' });
    }
    
    // 파일 경로
    const filePath = path.join(uploadDir, filename);
    
    // 파일 존재 확인
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return res.status(404).json({ error: '삭제할 파일을 찾을 수 없습니다.' });
    }
    
    // 파일 삭제
    await fs.unlink(filePath);
    
    // 벡터 스토어 파일도 삭제
    const vectorStorePath = path.join(vectorStoreDir, `${filename}.json`);
    if (await fs.pathExists(vectorStorePath)) {
      await fs.remove(vectorStorePath);
    }
    
    // 메모리에서도 삭제
    if (documentVectorStores.has(filename)) {
      documentVectorStores.delete(filename);
    }
    if (documentEmbeddings.has(filename)) {
      documentEmbeddings.delete(filename);
    }
    
    res.json({
      success: true,
      message: '문서가 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('문서 삭제 오류:', error);
    res.status(500).json({ error: '문서 삭제 중 오류가 발생했습니다.' });
  }
};

// 문서 내용 조회 컨트롤러 (텍스트 기반 문서의 경우)
exports.getDocumentContent = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: '파일명은 필수입니다.' });
    }
    
    // 파일 경로
    const filePath = path.join(uploadDir, filename);
    
    // 파일 존재 확인
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }
    
    // 확장자 추출
    const ext = path.extname(filename).toLowerCase();
    
    // 텍스트 기반 문서만 내용 조회 가능
    if (['.txt', '.md'].includes(ext)) {
      // 인코딩 문제를 해결하기 위해 여러 인코딩 시도
      const iconv = require('iconv-lite');
      const buffer = await fs.readFile(filePath);
      
      // 가능한 인코딩 목록
      const encodings = ['utf8', 'euc-kr', 'cp949', 'utf16le'];
      let content = '';
      
      // 각 인코딩 시도
      for (const encoding of encodings) {
        try {
          let decodedText;
          if (encoding === 'utf8') {
            // UTF-8은 Buffer에서 직접 문자열로 변환
            decodedText = buffer.toString('utf8');
          } else {
            // 다른 인코딩은 iconv-lite 사용
            decodedText = iconv.decode(buffer, encoding);
          }
          
          // 디코딩 결과 확인
          const containsUnknownChars = decodedText.includes('\uFFFD') || /[\uFFFD]/.test(decodedText);
          const tooManyUnknownChars = (decodedText.match(/\uFFFD/g) || []).length > decodedText.length * 0.1;
          
          if (!containsUnknownChars || !tooManyUnknownChars) {
            content = decodedText;
            console.log(`[getDocumentContent] 성공적인 인코딩 감지: ${encoding}`);
            break;
          }
        } catch (e) {
          console.log(`[getDocumentContent] ${encoding} 디코딩 시도 실패:`, e.message);
        }
      }
      
      // 모든 인코딩 시도 후에도 텍스트가 비어있다면
      if (!content || content.length === 0) {
        // fallback으로 CP949 강제 시도
        try {
          content = iconv.decode(buffer, 'cp949');
          console.log(`[getDocumentContent] Fallback CP949 인코딩 사용`);
        } catch (e) {
          console.error(`[getDocumentContent] 모든 인코딩 시도 실패`);
        }
      }
      
      res.json({
        success: true,
        filename,
        content
      });
    } else if (ext === '.pdf') {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdf(dataBuffer);
      
      res.json({
        success: true,
        filename,
        content: pdfData.text
      });
    } else {
      res.status(400).json({ error: '지원하지 않는 파일 형식입니다. 텍스트 기반 문서만 내용 조회가 가능합니다.' });
    }
  } catch (error) {
    console.error('문서 내용 조회 오류:', error);
    res.status(500).json({ error: '문서 내용을 가져오는 중 오류가 발생했습니다.' });
  }
};

// 문서 챗 대화 처리 컨트롤러
exports.processChat = async (req, res) => {
  try {
    const { question, documentId, answerStyle = '전문적', temperature = 0.7 } = req.body;
    
    if (!documentId || !question) {
      return res.status(400).json({ error: '문서 ID와 질문은 필수입니다.' });
    }
    
    console.log(`[processChat] 시작 - 문서: ${documentId}, 질문: ${question}`);
    
    // 문서 존재 확인
    const documentPath = path.join(uploadDir, documentId);
    const exists = await fs.pathExists(documentPath);
    if (!exists) {
      console.log(`[processChat] 오류 - 문서 찾을 수 없음: ${documentPath}`);
      return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
    }
    
    console.log(`[processChat] 문서 존재 확인 완료: ${documentPath}`);
    
    // 벡터 스토어 로드
    console.log(`[processChat] 벡터 스토어 로드 시작`);
    const vectorStore = await loadVectorStore(documentId);
    console.log(`[processChat] 벡터 스토어 로드 완료`);
    
    // 답변 스타일에 따른 시스템 프롬프트 설정
    let systemPrompt = '';
    switch (answerStyle) {
      case '전문적':
        systemPrompt = '당신은 문서 내용에 기반하여 정확하고 전문적인 답변을 제공하는 AI 어시스턴트입니다. 주어진 문서의 정보에 기반하여 명확하고 사실적인 답변을 제공하세요.';
        break;
      case '친근한':
        systemPrompt = '당신은 문서 내용에 기반하여 친근하고 이해하기 쉬운 답변을 제공하는 AI 어시스턴트입니다. 복잡한 개념도 쉽게 설명하고 친근한 어조로 답변해주세요.';
        break;
      case '간결한':
        systemPrompt = '당신은 문서 내용에 기반하여 간결하고 핵심적인 답변을 제공하는 AI 어시스턴트입니다. 불필요한 내용 없이 핵심 정보만 간략하게 전달해주세요.';
        break;
      default:
        systemPrompt = '당신은 문서 내용에 기반하여 정확한 답변을 제공하는 AI 어시스턴트입니다. 주어진 문서의 정보에 기반하여 답변해주세요.';
    }
    
    // LLM 모델 설정
    const llm = new ChatGoogleGenerativeAI({
      apiKey: GOOGLE_API_KEY,
      modelName: "gemini-1.5-flash", // 올바른 모델명으로 변경
      temperature: parseFloat(temperature),
      maxOutputTokens: 1024,
    });
    
    // 벡터 검색 및 결과 가져오기
    console.log(`[processChat] 검색 시작: ${question}`);
    
    // 하이브리드 검색 구현
    // 1. 벡터 검색으로 관련 문서 찾기
    const vectorSearchResults = await vectorStore.similaritySearchWithScore(question, 10);
    console.log(`[processChat] 벡터 검색 결과 (상위 최대 10개):`);
    vectorSearchResults.forEach((result, idx) => {
      const [doc, score] = result;
      console.log(`[processChat] 결과 #${idx + 1} 점수: ${score}, 내용: ${doc.pageContent.substring(0, 100)}...`);
    });
    
    // 2. 키워드 기반 검색 수행
    // 원본 문서에서 모든 청크 가져오기
    let allDocs = [];
    try {
      const vectorStorePath = path.join(vectorStoreDir, `${documentId}.json`);
      if (await fs.pathExists(vectorStorePath)) {
        const data = await fs.readJSON(vectorStorePath);
        allDocs = data.docs.map(item => 
          new Document({
            pageContent: item.pageContent,
            metadata: item.metadata || {}
          })
        );
      }
    } catch (err) {
      console.error(`[processChat] 문서 청크 가져오기 오류:`, err);
    }
    
    // 질문에서 키워드 추출 (간단한 방법)
    const keywords = question.toLowerCase()
      .replace(/[^\wㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1)
      .filter(word => !['은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '으로', '로'].includes(word));
    
    console.log(`[processChat] 추출된 키워드:`, keywords);
    
    // 키워드 기반 검색 수행
    const keywordMatchResults = [];
    for (const doc of allDocs) {
      const content = doc.pageContent.toLowerCase();
      const matchingKeywords = keywords.filter(keyword => content.includes(keyword));
      if (matchingKeywords.length > 0) {
        keywordMatchResults.push({
          doc,
          matchCount: matchingKeywords.length,
          matchedKeywords: matchingKeywords
        });
      }
    }
    
    // 매칭 키워드 수에 따라 정렬
    keywordMatchResults.sort((a, b) => b.matchCount - a.matchCount);
    
    console.log(`[processChat] 키워드 검색 결과 (매칭된 문서 수: ${keywordMatchResults.length}):`);
    keywordMatchResults.slice(0, 5).forEach((result, idx) => {
      console.log(`[processChat] 키워드 결과 #${idx + 1} 매칭 단어 수: ${result.matchCount}, 매칭 단어: [${result.matchedKeywords.join(', ')}], 내용: ${result.doc.pageContent.substring(0, 100)}...`);
    });
    
    // 3. 하이브리드 결과 조합
    // 벡터 검색 결과를 문서만 포함하는 배열로 변환
    const vectorDocs = vectorSearchResults.map(([doc]) => doc);
    
    // 키워드 검색 결과에서 상위 5개 문서 가져오기
    const keywordDocs = keywordMatchResults.slice(0, 5).map(result => result.doc);
    
    // 두 결과 병합 (중복 제거)
    const seenContents = new Set();
    const combinedDocs = [];
    
    // 먼저 키워드 검색 결과 추가 (더 정확한 매칭일 가능성이 높음)
    keywordDocs.forEach(doc => {
      if (!seenContents.has(doc.pageContent)) {
        combinedDocs.push(doc);
        seenContents.add(doc.pageContent);
      }
    });
    
    // 벡터 검색 결과 추가 (중복 제외)
    vectorDocs.forEach(doc => {
      if (!seenContents.has(doc.pageContent)) {
        combinedDocs.push(doc);
        seenContents.add(doc.pageContent);
      }
    });
    
    // 최대 10개로 제한
    const finalDocs = combinedDocs.slice(0, 10);
    console.log(`[processChat] 최종 결합된 문서 수: ${finalDocs.length}`);
    
    // LangChain의 PromptTemplate 가져오기
    const { PromptTemplate } = require('@langchain/core/prompts');
    
    // 검색 결과를 문맥으로 포함하는 프롬프트 생성
    let contextText = '';
    finalDocs.forEach((doc, idx) => {
      contextText += `문서 청크 ${idx + 1}:\n${doc.pageContent}\n\n`;
    });
    
    // 프롬프트 템플릿 생성
    const promptTemplate = PromptTemplate.fromTemplate(
      `${systemPrompt}
      
      다음은 문서에서 추출한 관련 정보입니다:
      
      ${contextText}
      
      질문: {query}
      
      위 문서 정보를 기반으로 질문에 답변해주세요. 문서에 명시된 내용만 사용하고, 문서에 없는 내용은 추가하지 마세요. 관련 정보가 없다면 '죄송합니다. 문서에서 관련 정보를 찾을 수 없습니다.'라고 답변해주세요.`
    );
    
    // LLM으로 답변 생성
    console.log(`[processChat] LLM 답변 생성 시작`);
    const llmPrompt = await promptTemplate.format({ query: question });
    const llmResult = await llm.invoke(llmPrompt);
    const answer = llmResult.content;
    console.log(`[processChat] LLM 답변 생성 완료: ${answer.substring(0, 50)}...`);
    
    // 소스 문서 가공
    const sources = finalDocs.map((doc, index) => ({
      id: index,
      content: doc.pageContent,
      source: doc.metadata?.source || '문서 내용'
    }));
    
    console.log(`[processChat] 검색된 소스 문서 수: ${sources.length}`);
    
    // 가독성을 높이는 응답 포맷 구성
    // 답변을 단락으로 나누고 마크다운 형식 적용
    const formattedAnswer = formatAnswerForReadability(answer);
    
    // 소스 인용 정보를 더 명확하게 구성
    const formattedSources = sources.map((source, index) => ({
      id: index,
      content: truncateAndFormat(source.content),
      relevance: index < keywordMatchResults.length ? '높음' : '중간',
      source: source.source
    }));
    
    res.json({
      success: true,
      answer: formattedAnswer,
      sources: formattedSources,
      meta: {
        documentId,
        questionType: classifyQuestionType(question),
        keywordsFound: keywords,
        totalSources: sources.length
      }
    });
  } catch (error) {
    console.error('문서 챗 처리 오류:', error);
    res.status(500).json({ error: '문서 챗 처리 중 오류가 발생했습니다.' });
  }
};

// 답변의 가독성을 개선하는 함수
function formatAnswerForReadability(answer) {
  if (!answer) return '';
  
  // 줄바꿈 처리 및 마크다운 서식 적용
  let formatted = answer
    // 문장 끝에서 줄바꿈 추가
    .replace(/\.\s+/g, '.\n\n')
    // 목록 항목 강조
    .replace(/^(\d+\.\s+)/gm, '**$1**')
    .replace(/^(-\s+)/gm, '• ')
    // 중요 키워드 강조 (필요시 커스터마이즈)
    .replace(/(IT감사계획|감사|계획|리스크|통제)/g, '**$1**');
  
  // 여러 줄바꿈 정리
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  return formatted;
}

// 소스 내용을 적절한 길이로 자르고 가독성 개선
function truncateAndFormat(content) {
  if (!content) return '';
  
  // 긴 내용 자르기 (최대 250자)
  const truncated = content.length > 250 
    ? content.substring(0, 250) + '...' 
    : content;
  
  // 가독성 개선
  return truncated
    .replace(/\n{2,}/g, ' ')  // 여러 줄바꿈을 공백으로
    .replace(/\s{2,}/g, ' ');  // 여러 공백을 하나로
}

// 질문 유형 분류 (간단한 키워드 기반)
function classifyQuestionType(question) {
  const lowerQuestion = question.toLowerCase();
  
  if (lowerQuestion.includes('계획') || lowerQuestion.includes('감사계획'))
    return '감사계획';
  if (lowerQuestion.includes('리스크') || lowerQuestion.includes('위험'))
    return '리스크 관리';
  if (lowerQuestion.includes('통제') || lowerQuestion.includes('내부통제'))
    return '내부통제';
  return '일반 문의';
}