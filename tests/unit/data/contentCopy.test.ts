import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import text from '../../../src/data/text.json';

const runtimeCopySources = [
  'src/data/text.json',
  'src/data/handbook.json',
  'src/data/quest-templates.json',
  'src/presentation/ui/IntakeScreen.ts',
  'src/presentation/ui/DispatchScreen.ts',
  'src/presentation/ui/OutcomeScreen.ts',
  'src/presentation/ui/GuildHallScreen.ts',
  'src/presentation/ui/EndingScreen.ts',
];

describe('제출판 콘텐츠 문구 잠금', () => {
  it('초회 안내와 결과 원인 9조합이 모두 비어 있지 않다', () => {
    expect(text.ui.intake.firstAction.trim()).not.toBe('');
    for (const outcome of ['success', 'injured', 'dead'] as const) {
      for (const margin of ['comfortable', 'risky', 'reckless'] as const) {
        expect(text.ui.outcome.reasons[outcome][margin].trim()).not.toBe('');
      }
    }
  });

  it('런타임 문구 출처에 플레이스홀더·개발 상태 문구가 없다', () => {
    const source = runtimeCopySources.map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(source).not.toMatch(/\b(?:TODO|FIXME|TBD|Lorem ipsum)\b|준비 중|개발용 문구|임시 문구/i);
  });
});
