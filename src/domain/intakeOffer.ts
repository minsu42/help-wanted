import type { OccupationBalance } from './occupation';
import type { Client, Occupation } from './types';

export interface IntakeWalletConfig {
  readonly easyRatio: number;
  readonly counterRatio: number;
  readonly riskPremiumMultiplier: number;
}

export interface IntakeOfferTerms {
  readonly proposed: number;
  readonly market: number;
  readonly premium: number;
  readonly easy: number;
  readonly counter: number;
  readonly cap: number;
}

export type IntakeOfferResult =
  | { readonly outcome: 'comfortable' | 'strained'; readonly agreedReward: number }
  | { readonly outcome: 'countered'; readonly counter: number };

/**
 * 의뢰인의 숨은 지갑과 화면에 내놓을 세 금액을 한 번에 실현한다.
 * `wealth`는 이미 시드로 고정된 0~1 값이므로 별도 RNG를 소비하지 않는다.
 */
export function intakeOfferTerms(
  client: Client,
  marketReward: number,
  occupations: Readonly<Record<Occupation, OccupationBalance>>,
  config: IntakeWalletConfig,
): IntakeOfferTerms {
  const [minimum, maximum] = occupations[client.occupation].walletMult;
  const walletMultiplier = minimum + (maximum - minimum) * client.wealth;
  const market = Math.max(1, Math.round(marketReward));
  const cap = Math.max(3, Math.round(market * walletMultiplier));
  // 선제 제안은 지불 한도가 높더라도 통상 시세보다 커지지 않는다. 재력이 낮으면
  // 실제 한도가 기준이 되고, 재력이 높으면 시세가 기준이 된다.
  const easy = clamp(Math.round(Math.min(market, cap) * config.easyRatio), 1, cap);
  const counter = clamp(Math.round(cap * config.counterRatio), easy + 1, cap);
  if (!(0 < easy && easy < counter && counter <= cap)) {
    throw new Error(`잘못된 지갑 계수다 (${easy} < ${counter} <= ${cap})`);
  }

  return {
    proposed: easy,
    market,
    premium: Math.max(1, Math.round(market * config.riskPremiumMultiplier)),
    easy,
    counter,
    cap,
  };
}

/** 제시액의 결과는 완전 결정론이다. */
export function resolveIntakeOffer(amount: number, terms: IntakeOfferTerms): IntakeOfferResult {
  const rounded = Math.max(1, Math.round(amount));
  if (rounded <= terms.easy) return { outcome: 'comfortable', agreedReward: rounded };
  if (rounded <= terms.cap) return { outcome: 'strained', agreedReward: rounded };
  return { outcome: 'countered', counter: terms.counter };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
