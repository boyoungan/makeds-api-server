// controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, PasswordHistory, sequelize } = require('../models');
const { Op } = require('sequelize');

// 환경 변수
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not set in environment variables');
  process.exit(1);
}

const SALT_ROUNDS = 10;

// 비밀번호 정책 검증 함수
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  
  // 8~16자 검증
  if (password.length < 8 || password.length > 16) return false;
  
  // 공백 검증
  if (password.includes(' ')) return false;
  
  // 영문/숫자/특수문자 중 2종류 이상 포함 검증
  const containsLetter = /[a-zA-Z]/.test(password);
  const containsNumber = /[0-9]/.test(password);
  const containsSpecial = /[!@#$%^&*\-_=+\\|;:,.<>/?]/.test(password);
  
  const typeCount = [containsLetter, containsNumber, containsSpecial]
    .filter(type => type).length;
  
  return typeCount >= 2;
};

// 로그인 컨트롤러
exports.login = async (req, res) => {
  const { employee_number, company_id, password } = req.body;

  try {
    // 사용자 조회
    const user = await User.findOne({
      where: {
        employee_number,
        company_id
      }
    });

    if (!user) {
      return res.status(401).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 계정 잠금 확인
    if (user.is_locked) {
      return res.status(401).json({ message: '계정이 잠겼습니다. 관리자에게 문의하세요.' });
    }

    // 비밀번호 검증
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      // 로그인 실패 횟수 증가
      const newFailedAttempts = (user.failed_attempts || 0) + 1;
      const shouldLock = newFailedAttempts >= 5;

      await user.update({
        failed_attempts: newFailedAttempts,
        is_locked: shouldLock
      });

      if (shouldLock) {
        return res.status(401).json({ message: '5회 실패로 계정이 잠겼습니다. 관리자에게 문의하세요.' });
      }

      return res.status(401).json({ 
        message: '비밀번호가 일치하지 않습니다.',
        remainingAttempts: 5 - newFailedAttempts
      });
    }

    // 로그인 성공: 실패 횟수 초기화 및 마지막 로그인 시간 업데이트
    await user.update({
      failed_attempts: 0,
      last_login: new Date()
    });

    // JWT 토큰 생성
    const token = jwt.sign({
      id: user.id,
      employee_number: user.employee_number,
      company_id: user.company_id,
      username: user.username,
      role: user.role || 'user'
    }, JWT_SECRET, { expiresIn: '2h' });

    res.json({ 
      token,
      user: {
        id: user.id,
        employee_number: user.employee_number,
        company_id: user.company_id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('로그인 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 회원가입 컨트롤러
exports.register = async (req, res) => {
  const { employee_number, username, company_id } = req.body;

  try {
    // 기존 사용자 확인
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { employee_number },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ message: '이미 등록된 사번 또는 사용자명입니다.' });
    }

    // 초기 비밀번호 생성 (사번+!@#)
    const initialPassword = `${employee_number}!@#`;
    const passwordHash = await bcrypt.hash(initialPassword, SALT_ROUNDS);

    // 사용자 등록
    const user = await User.create({
      employee_number,
      username,
      company_id,
      password_hash: passwordHash,
      password_salt: '',
      failed_attempts: 0,
      is_locked: false,
      role: 'user'
    });

    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      user: {
        id: user.id,
        employee_number,
        username,
        company_id
      }
    });
  } catch (error) {
    console.error('회원가입 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 비밀번호 변경 컨트롤러
exports.changePassword = async (req, res) => {
  const { employee_number, company_id, current_password, new_password } = req.body;

  try {
    // 비밀번호 정책 검증
    if (!validatePassword(new_password)) {
      return res.status(400).json({
        message: '새 비밀번호가 정책에 맞지 않습니다.',
        requirements: '8~16자, 영문/숫자/특수문자 중 2종류 이상 포함, 공백 제외'
      });
    }

    // 사용자 조회
    const user = await User.findOne({
      where: {
        employee_number,
        company_id
      }
    });

    if (!user) {
      return res.status(401).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
    }

    // 이전 비밀번호 히스토리 확인
    const passwordHistories = await PasswordHistory.findAll({
      where: { user_id: user.id },
      order: [['changed_at', 'DESC']],
      limit: 3
    });

    // 이전 3개의 비밀번호와 비교
    for (const history of passwordHistories) {
      const isSameAsHistory = await bcrypt.compare(new_password, history.password_hash);
      if (isSameAsHistory) {
        return res.status(400).json({ message: '최근 3회 이내에 사용한 비밀번호는 사용할 수 없습니다.' });
      }
    }

    // 새 비밀번호 해시
    const newPasswordHash = await bcrypt.hash(new_password, SALT_ROUNDS);

    // 트랜잭션 시작
    const t = await sequelize.transaction();

    try {
      // 현재 비밀번호를 히스토리에 저장
      await PasswordHistory.create({
        user_id: user.id,
        password_hash: user.password_hash
      }, { transaction: t });

      // 새 비밀번호로 업데이트
      await user.update({
        password_hash: newPasswordHash
      }, { transaction: t });

      await t.commit();
      res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    console.error('비밀번호 변경 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};