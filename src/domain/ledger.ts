import type { DispatchResult } from './casework';

/**
 * 접수원 개인 장부.
 *
 * 길드 금고가 아니라 **접수원의 급여**를 다룬다. 유족 보상금은 길드가 내고,
 * 접수원에게 오는 것은 감봉이다 — 창구 직원이 길드 돈을 물어주는 구조는 성립하지 않는다.
 */
export const WAGE = {
  /** 접수든 거절이든 '처리'하면 나오는 건당 수수료. */
  perCase: 5,
  rent: 12,
  food: 5,
  heat: 3,
  /** 의뢰서의 빈 칸 하나당 감봉. 결과와 무관하게 서류만 보고 매긴다. */
  blankField: 2,
  /** 서류 과실이 있는 상태에서 난 사고에만 붙는 감봉. */
  deathFault: 10,
  injuryFault: 4,
} as const;

export interface LedgerLine {
  label: string;
  amount: number;
  detail?: string;
}

export interface DayLedger {
  day: number;
  lines: LedgerLine[];
  income: number;
  expense: number;
  net: number;
  balance: number;
}

export interface LedgerInput {
  day: number;
  /** 오늘 처리한 건수 — 접수·거절·미인계 모두 포함한다. */
  handled: number;
  /** 오늘 게시한 서류들의 빈 칸 수 합계. */
  blankFields: number;
  /** 오늘 아침에 도착한 어제치 파견 보고. */
  reports: readonly DispatchResult[];
  balance: number;
}

/**
 * 사고 감봉은 **결과가 아니라 서류 과실**에 붙는다.
 *
 * 정확히 적었는데 파티가 죽으면 접수원 과실이 아니고, 대충 적었는데 운 좋게 살아
 * 돌아와도 서류는 이미 틀려 있었다. 결과로만 매기면 정직한 의뢰인 사건이
 * "아무렇게나 적어도 통과"가 되어 게임의 절반이 무의미해진다.
 */
export function faultPenalty(report: DispatchResult): number {
  const flawless = report.completeness >= 4;
  if (flawless) return 0;
  if (report.outcome === 'death') return WAGE.deathFault;
  if (report.outcome === 'injured' || report.outcome === 'failed') return WAGE.injuryFault;
  return 0;
}

export function closeDay(input: LedgerInput): DayLedger {
  const pay = input.handled * WAGE.perCase;
  const blanks = input.blankFields * WAGE.blankField;
  const faults = input.reports.reduce((sum, report) => sum + faultPenalty(report), 0);
  const lines: LedgerLine[] = [
    { label: '처리 수수료', amount: pay, detail: `${input.handled}건 × ${WAGE.perCase}닢` },
    { label: '서류 미비 감봉', amount: -blanks, detail: `빈 칸 ${input.blankFields}개 × ${WAGE.blankField}닢` },
    { label: '사고 감봉', amount: -faults, detail: faults ? '서류 과실이 확인된 파견' : '해당 없음' },
    { label: '창구 임대료', amount: -WAGE.rent },
    { label: '식비', amount: -WAGE.food },
    { label: '난방', amount: -WAGE.heat },
  ];
  const income = lines.filter((line) => line.amount > 0).reduce((sum, line) => sum + line.amount, 0);
  const expense = lines.filter((line) => line.amount < 0).reduce((sum, line) => sum - line.amount, 0);
  const net = income - expense;
  return { day: input.day, lines, income, expense, net, balance: input.balance + net };
}
