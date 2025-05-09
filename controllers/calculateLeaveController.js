// controllers/calculateLeaveController.js

// 연차 일수 계산 함수
const calculateAnnualLeave = (startDate, isFirstYear, usedLeave) => {
  // 입사일을 Date 객체로 변환
  const startDateObj = new Date(startDate);
  const currentDate = new Date();
  
  // 입사일의 연도와 현재 연도 차이 계산
  const startYear = startDateObj.getFullYear();
  const currentYear = currentDate.getFullYear();
  const yearDiff = currentYear - startYear;
  
  // 월 차이 계산
  const startMonth = startDateObj.getMonth();
  const currentMonth = currentDate.getMonth();
  const monthDiff = (currentYear - startYear) * 12 + (currentMonth - startMonth);
  
  let annualLeave = 0;
  
  // 입사 첫해 근무 개월수에 따른 연차 계산
  if (isFirstYear) {
    // 근속 개월수에 따라 1개월 만근 시 1일 부여 (최대 11일)
    annualLeave = Math.min(monthDiff, 11);
  } else {
    // 1년 이상 근무한 경우
    if (yearDiff >= 1) {
      // 1년 이상 3년 미만: 15일
      if (yearDiff < 3) {
        annualLeave = 15;
      }
      // 3년 이상부터는 2년마다 1일씩 추가 (최대 25일)
      else {
        const additionalDays = Math.floor((yearDiff - 1) / 2);
        annualLeave = Math.min(15 + additionalDays, 25);
      }
    }
  }
  
  // 사용한 연차 차감
  const remainingLeave = Math.max(0, annualLeave - usedLeave);
  
  return {
    totalLeave: annualLeave,
    usedLeave,
    remainingLeave
  };
};

// 연차 계산 컨트롤러
exports.calculateLeave = (req, res) => {
  try {
    // 프론트엔드 필드명 매핑
    const joinDate = req.body.startDate || req.body.joinDate;
    const leaveDate = req.body.leaveDate;
    const usedDays = req.body.usedLeave ?? req.body.usedDays ?? 0;
    const monthlyWage = req.body.monthlyWage ?? 0;

    // 필수 필드 검증
    if (!joinDate) {
      return res.status(400).json({ message: '입사일은 필수 입력 항목입니다.' });
    }

    // 날짜 계산
    const start = new Date(joinDate);
    const end = leaveDate ? new Date(leaveDate) : new Date();
    const totalDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const serviceYears = `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()} ~ ${end.getFullYear()}-${end.getMonth() + 1}-${end.getDate()}`;
    const isUnderOneYear = (end.getFullYear() - start.getFullYear()) < 1 || (end - start) < 365 * 24 * 60 * 60 * 1000;

    // 연차 계산 (기존 함수 활용)
    const annualLeave = Math.max(0, calculateAnnualLeave(joinDate, isUnderOneYear, 0).totalLeave);
    const remainingDays = Math.max(0, annualLeave - usedDays);

    // 일일 임금 계산 (월급/209*8)
    const dailyWage = monthlyWage ? Math.round(monthlyWage * 1.463 / 209 * 8) : 0;
    // 보상금액 = 일일임금 * 미사용 연차
    const compensation = dailyWage * remainingDays;
    // 연차휴가보상비 = ROUNDUP(월급 * 1.463 / 209 * 8) × 미사용 연차
    const vacationCompensation = compensation;
    // 기본급 = 월급 / 월 총일수 * 근무일수 (퇴사월 11일 근무 기준)
    const basicSalary = monthlyWage ? Math.round(monthlyWage / 30 * 11) : 0;

    // 프론트엔드 기대 구조로 응답
    res.json({
      success: true,
      joinBased: {
        serviceYears,
        totalDays,
        annualLeave,
        usedDays,
        remainingDays,
        dailyWage,
        compensation,
        vacationCompensation,
        basicSalary,
        isUnderOneYear
      },
      fiscalBased: {
        // 실제 회계연도 기준 로직이 필요하다면 별도 구현, 일단 joinBased와 동일하게 반환
        serviceYears,
        totalDays,
        annualLeave,
        usedDays,
        remainingDays,
        dailyWage,
        compensation,
        vacationCompensation,
        basicSalary,
        isUnderOneYear,
        fiscalRatio: 1.0,
        workingMonths: Math.floor(totalDays / 30)
      }
    });
  } catch (error) {
    console.error('연차 계산 오류:', error);
    res.status(500).json({ message: '연차 계산 중 오류가 발생했습니다.' });
  }
};

// 법정 공휴일 목록 (2025년 기준)
const HOLIDAYS_2025 = [
  '2025-01-01', // 신정
  '2025-01-28', // 설날
  '2025-01-29', // 설날
  '2025-01-30', // 설날
  '2025-03-01', // 삼일절
  '2025-05-05', // 어린이날
  '2025-05-15', // 부처님오신날
  '2025-06-06', // 현충일
  '2025-08-15', // 광복절
  '2025-09-17', // 추석
  '2025-09-18', // 추석
  '2025-09-19', // 추석
  '2025-10-03', // 개천절
  '2025-10-09', // 한글날
  '2025-12-25', // 크리스마스
];

// 공휴일 목록 조회 컨트롤러
exports.getHolidays = (req, res) => {
  try {
    const { year } = req.query;
    
    // 년도별 공휴일 목록 (현재는 2025년 목록만 있음)
    let holidays;
    if (year === '2025') {
      holidays = HOLIDAYS_2025;
    } else {
      // 기본값으로 2025년 목록 반환
      holidays = HOLIDAYS_2025;
    }
    
    res.json({
      success: true,
      holidays
    });
  } catch (error) {
    console.error('공휴일 목록 조회 오류:', error);
    res.status(500).json({ message: '공휴일 목록 조회 중 오류가 발생했습니다.' });
  }
};

// 근무일수 계산 함수 (주말 및 공휴일 제외)
const calculateWorkingDays = (startDate, endDate, holidays = []) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // 시작일이 종료일보다 나중인 경우
  if (start > end) {
    return 0;
  }
  
  let count = 0;
  const holidaySet = new Set(holidays);
  
  // 각 날짜별로 주말이나 공휴일인지 확인
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateString = current.toISOString().split('T')[0]; // YYYY-MM-DD 형식
    
    // 주말(토:6, 일:0)이나 공휴일이 아닌 경우에만 카운트
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateString)) {
      count++;
    }
    
    // 다음 날짜로 이동
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

// 근무일수 계산 컨트롤러
exports.calculateWorkingDays = (req, res) => {
  try {
    const { startDate, endDate, includeHolidays } = req.body;
    
    // 필수 필드 검증
    if (!startDate || !endDate) {
      return res.status(400).json({ message: '시작일과 종료일은 필수 입력 항목입니다.' });
    }
    
    // 근무일수 계산
    const workingDays = calculateWorkingDays(
      startDate, 
      endDate, 
      includeHolidays === false ? [] : HOLIDAYS_2025
    );
    
    res.json({
      success: true,
      startDate,
      endDate,
      workingDays
    });
  } catch (error) {
    console.error('근무일수 계산 오류:', error);
    res.status(500).json({ message: '근무일수 계산 중 오류가 발생했습니다.' });
  }
};