// controllers/promptLibraryController.js
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const jwt = require('jsonwebtoken');

// Jekyll 블로그 루트 디렉토리 설정
const BLOG_ROOT = path.join(__dirname, '..', 'data', 'prompt-library');

// Front Matter 파싱 함수
const parseFrontMatter = (content) => {
  const result = {};
  
  // Front Matter 추출 (--- 사이의 내용)
  const matches = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  
  if (matches && matches[1]) {
    const frontMatter = matches[1];
    
    // 기본 속성 추출
    const titleMatch = frontMatter.match(/title:\s*"?([^"\n]*)"?/);
    const authorMatch = frontMatter.match(/author:\s*"?([^"\n]*)"?/);
    const dateMatch = frontMatter.match(/date:\s*([^\n]*)/);
    const modelMatch = frontMatter.match(/model:\s*"?([^"\n]*)"?/);
    const purposeMatch = frontMatter.match(/purpose:\s*"?([^"\n]*)"?/);
    const versionMatch = frontMatter.match(/version:\s*"?([^"\n]*)"?/);
    const tagsMatch = frontMatter.match(/tags:\s*([^\n]*)/);
    const categoriesMatch = frontMatter.match(/categories:\s*([^\n]*)/);
    
    if (titleMatch) result.title = titleMatch[1].trim();
    if (authorMatch) result.author = authorMatch[1].trim();
    if (dateMatch) result.date = dateMatch[1].trim();
    if (modelMatch) result.model = modelMatch[1].trim();
    if (purposeMatch) result.purpose = purposeMatch[1].trim();
    if (versionMatch) result.version = versionMatch[1].trim();
    
    if (tagsMatch) {
      // 태그가 [tag1, tag2] 형식일 수도 있고, tag1, tag2 형식일 수도 있음
      const tagsStr = tagsMatch[1].trim();
      if (tagsStr.startsWith('[') && tagsStr.endsWith(']')) {
        result.tags = tagsStr.slice(1, -1).split(',').map(tag => tag.trim());
      } else {
        result.tags = tagsStr.split(',').map(tag => tag.trim());
      }
    }
    
    if (categoriesMatch) {
      const categoriesStr = categoriesMatch[1].trim();
      if (categoriesStr.startsWith('[') && categoriesStr.endsWith(']')) {
        result.categories = categoriesStr.slice(1, -1).split(',').map(category => category.trim());
      } else {
        result.categories = categoriesStr.split(',').map(category => category.trim());
      }
    }
    
    // 내용 추출 (Front Matter 제외)
    result.content = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').trim();
  } else {
    // Front Matter가 없는 경우 전체 내용
    result.content = content;
  }
  
  return result;
};

// prompt-data.json 파일 업데이트 함수
const updatePromptData = async () => {
  try {
    const postsDir = path.join(BLOG_ROOT, '_posts');
    const promptsData = [];
    
    // _posts 디렉토리가 존재하는지 확인
    const postsExists = await fs.pathExists(postsDir);
    console.log('[PromptLibraryController] postsExists:', postsExists);
    
    if (postsExists) {
      // _posts 디렉토리의 모든 마크다운 파일 읽기
      const files = await fs.readdir(postsDir);
      console.log('[PromptLibraryController] files:', files);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(postsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const frontMatter = parseFrontMatter(content);
          
          // 프롬프트 데이터에 필요한 정보만 추출
          // title 필드가 두 있는 경우 추가
          if (frontMatter.title) {
            const uniqueTitle = `${frontMatter.title}`;
            
            // 파일명에서 사용할 수 없는 문자를 제거하거나 대체
            const sanitizedTitle = uniqueTitle.replace(/[^a-zA-Z0-9가-힣]/g, '_');
            const uniqueFilename = `${sanitizedTitle}.md`; 
            
            // 파일 이름에서 날짜와 slug 추출
            const fileNameMatch = file.match(/^(\d{4}-\d{2}-\d{2})-(.*?)\.md$/);
            const slug = fileNameMatch ? fileNameMatch[2] : file.replace(/\.md$/, '');
            
            // 태그 처리
            let tags = [];
            if (frontMatter.tags) {
              // 태그가 문자열인 경우 (쉼표로 구분된 태그들)
              if (typeof frontMatter.tags === 'string') {
                tags = frontMatter.tags.split(',').map(tag => tag.trim());
              } 
              // 태그가 이미 배열인 경우
              else if (Array.isArray(frontMatter.tags)) {
                tags = frontMatter.tags;
              }
              // 기타 형식의 태그 (YAML 파싱 결과에 따라 다를 수 있음)
              else if (frontMatter.tags.indexOf && frontMatter.tags.indexOf('[') === 0) {
                // "[tag1, tag2]" 형식의 문자열인 경우
                tags = frontMatter.tags
                  .replace(/^\[|\]$/g, '')
                  .split(',')
                  .map(tag => tag.trim());
              }
            }
            
            // 카테고리 처리
            let categories = [];
            if (frontMatter.categories) {
              // 문자열인 경우
              if (typeof frontMatter.categories === 'string') {
                categories = frontMatter.categories.split(',').map(cat => cat.trim());
              }
              // 배열인 경우
              else if (Array.isArray(frontMatter.categories)) {
                categories = frontMatter.categories;
              }
            }
            
            // URL 생성 - Jekyll 설정의 permalink 형식에 맞춘 경로 생성
            let url = '';
            
            // 파일이름에서 날짜 제외
            const urlSlug = slug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
            
            if (categories && categories.length > 0) {
              url = `/${categories[0]}/${urlSlug}/`;
            } else {
              url = `/${urlSlug}/`;
            }
            
            // 실제 포스트 내용 추출 (Front Matter 제외)
            const postContent = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').trim();
            
            promptsData.push({
              title: uniqueTitle,
              purpose: frontMatter.purpose || frontMatter.description || '',
              prompt_text: frontMatter.prompt_text || postContent.substring(0, 500),
              model: frontMatter.model || 'GPT-4',
              version: frontMatter.version || '1.0',
              tags: tags,
              url: url,
              filename: uniqueFilename
            });
          }
        }
      }
    }
    
    // prompt-data.json 파일 저장
    const promptDataPath = path.join(BLOG_ROOT, 'assets/js/prompt-data.json');
    
    // 디렉토리 존재 여부 확인
    const dirExists = await fs.pathExists(path.dirname(promptDataPath));
    
    if (!dirExists) {
      await fs.mkdir(path.dirname(promptDataPath), { recursive: true });
    }
    
    await fs.writeFile(promptDataPath, JSON.stringify(promptsData, null, 2), 'utf8');
    
    // prompt-data.md 파일도 업데이트 (마크다운 형식)
    const promptDataMdPath = path.join(BLOG_ROOT, 'assets/js/prompt-data.md');
    
    let markdownContent = '# 프롬프트 목록\n\n';

    promptsData.forEach(prompt => {
      markdownContent += `## ${prompt.title}\n\n`;
      markdownContent += `- **목적**: ${prompt.purpose}\n`;
      markdownContent += `- **모델**: ${prompt.model}\n`;
      markdownContent += `- **버전**: ${prompt.version}\n`;
      markdownContent += `- **태그**: ${prompt.tags.join(', ')}\n`;
      markdownContent += `- **URL**: [바로가기](${prompt.url})\n\n`;
    });
    
    await fs.writeFile(promptDataMdPath, markdownContent, 'utf8');
    
    return promptsData;
  } catch (error) {
    console.error('prompt-data.json 업데이트 중 오류:', error);
    throw error;
  }
};

// prompt-data.json 업데이트 컨트롤러
exports.updatePromptData = async (req, res) => {
  try {
    const promptData = await updatePromptData();
    res.json({ 
      success: true, 
      message: 'prompt-data.json 파일이 업데이트되었습니다.',
      count: promptData.length
    });
  } catch (error) {
    console.error('prompt-data.json 업데이트 오류:', error);
    res.status(500).json({ error: 'prompt-data.json 업데이트 중 오류가 발생했습니다.' });
  }
};

// 포스트 저장 컨트롤러
exports.savePost = async (req, res) => {
  console.log('[PromptLibraryController] savePost 실행됨!');
  try {
    const { filename, content, isDraft } = req.body;
    console.log(`[PromptLibrary] POST /posts 저장 요청: filename=${filename}, isDraft=${isDraft}`);
    if (!filename || !content) {
      return res.status(400).json({ error: '파일명과 내용은 필수입니다.' });
    }
    
    // 파일 경로 설정
    const targetDir = isDraft ? path.join(BLOG_ROOT, '_drafts') : path.join(BLOG_ROOT, '_posts');
    
    // 디렉토리가 없으면 생성
    await fs.ensureDir(targetDir);
    
    const filePath = path.join(targetDir, filename);
  
    // 파일 저장
    console.log('[PromptLibrary] 실제 저장 경로:', filePath);
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`[PromptLibrary] 파일 저장 완료: ${filePath}`);
    
    // prompt-data.json 파일 업데이트
    try {
      await updatePromptData();
      console.log('[PromptLibrary] prompt-data.json 업데이트 완료');
    } catch (updateError) {
      console.error('포스트 저장 후 prompt-data.json 파일 업데이트 오류:', updateError);
      // 오류가 발생해도 포스트 저장은 계속 진행
    }
    
    // Jekyll 빌드 실행 (draft가 아닌 경우)
    // if (!isDraft) {
    //   exec(`cd "${BLOG_ROOT}" && bundle exec jekyll build`, (error, stdout, stderr) => {
    //     if (error) {
    //       console.error('Jekyll 빌드 오류:', error);
    //       console.error('표준 에러:', stderr);
    //     }
    //   });
    // }
    
    res.json({ 
      success: true, 
      message: isDraft ? '임시저장 되었습니다.' : '포스트가 발행되었습니다.',
      filePath: filePath
    });
    
  } catch (error) {
    console.error('포스트 저장 오류:', error);
    res.status(500).json({ error: '포스트 저장 중 오류가 발생했습니다.' });
  }
};

// 포스트 목록 조회 컨트롤러
exports.getPosts = async (req, res) => {
  try {
    // console.log('[PromptLibrary] GET /posts 요청');
    const postsDir = path.join(BLOG_ROOT, '_posts');
    const draftsDir = path.join(BLOG_ROOT, '_drafts');
    
    // 디렉토리 존재 확인
    const [postsExists, draftsExists] = await Promise.all([
      fs.pathExists(postsDir),
      fs.pathExists(draftsDir)
    ]);
    const posts = [];
    // 발행된 포스트 가져오기
    if (postsExists) {
      const postFiles = await fs.readdir(postsDir);
      for (const file of postFiles) {
        if (file.endsWith('.md')) {
          const content = await fs.readFile(path.join(postsDir, file), 'utf8');
          const frontMatter = parseFrontMatter(content);
          posts.push({
            filename: file,
            path: `_posts/${file}`,
            ...frontMatter,
            isDraft: false
          });
        }
      }
    }
    
    // 임시저장 포스트 가져오기
    if (draftsExists) {
      const draftFiles = await fs.readdir(draftsDir);
      for (const file of draftFiles) {
        if (file.endsWith('.md')) {
          const content = await fs.readFile(path.join(draftsDir, file), 'utf8');
          const frontMatter = parseFrontMatter(content);
          console.log(`[PromptLibrary] 읽은 드래프트: ${file}, title: ${frontMatter.title}`);
          posts.push({
            filename: file,
            path: `_drafts/${file}`,
            ...frontMatter,
            isDraft: true
          });
        }
      }
    }
    
    // 날짜 기준 정렬
    posts.sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB - dateA;
    });
    
    res.json({ posts });
    
  } catch (error) {
    // console.error('포스트 목록 조회 오류:', error);
    res.status(500).json({ error: '포스트 목록을 가져오는 중 오류가 발생했습니다.' });
  }
};

// 포스트 삭제 컨트롤러
exports.deletePost = async (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: '파일명은 필수입니다.' });
    }
    
    // 파일 경로 확인 (포스트 또는 드래프트 디렉토리)
    const postsPath = path.join(BLOG_ROOT, '_posts', filename);
    const draftsPath = path.join(BLOG_ROOT, '_drafts', filename);
    
    // 파일 존재 확인
    const [postsExists, draftsExists] = await Promise.all([
      fs.pathExists(postsPath),
      fs.pathExists(draftsPath)
    ]);
    
    // 파일이 존재하는 경로에서 삭제
    if (postsExists) {
      await fs.unlink(postsPath);
    } else if (draftsExists) {
      await fs.unlink(draftsPath);
    } else {
      return res.status(404).json({ error: '삭제할 파일을 찾을 수 없습니다.' });
    }
    
    // prompt-data.json 갱신
    await updatePromptData();
    
    // Jekyll 빌드 실행
    // exec(`cd "${BLOG_ROOT}" && bundle exec jekyll build`, (error, stdout, stderr) => {
    //   if (error) {
    //     console.error('Jekyll 빌드 오류:', error);
    //     console.error('표준 에러:', stderr);
    //   }
    // });
    
    res.json({ 
      success: true, 
      message: '포스트가 성공적으로 삭제되었습니다.' 
    });
    
  } catch (error) {
    console.error('포스트 삭제 오류:', error);
    res.status(500).json({ error: '포스트를 삭제하는 중 오류가 발생했습니다.' });
  }
};

// 파일 업로드 컨트롤러
exports.uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '업로드할 파일이 없습니다.' });
    }
    
    const uploadedFiles = req.files.map(file => {
      return {
        filename: file.filename,
        originalname: file.originalname,
        size: file.size,
        url: `/assets/images/${file.filename}`
      };
    });
    
    res.json({
      success: true,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('파일 업로드 오류:', error);
    res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
  }
};

exports.authenticateToken = (req, res, next) => {
  console.log('[Auth] 인증 미들웨어 진입');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    console.log('[Auth] 토큰 없음');
    return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('[Auth] 토큰 검증 실패:', err);
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
      }
      return res.status(403).json({ message: '유효하지 않은 토큰입니다.' });
    }
    console.log('[Auth] 토큰 검증 성공');
    req.user = user;
    next();
  });
};