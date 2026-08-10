import { describe, expect, it } from 'vitest';
import balance from '../../../src/data/balance.json';
import questTemplates from '../../../src/data/quest-templates.json';
import { createRng } from '../../../src/domain/rng';
import {
  realizeIntake,
  type IntakeGenerationConfig,
} from '../../../src/domain/occupation';
import { SLOT_NAMES } from '../../../src/domain/slots';

const config = {
  occupations: balance.intake.occupations,
  seatedOccupations: balance.intake.seatedOccupations,
  questTypes: questTemplates.questTypes,
  patience: balance.intake.patience,
  openingStatementDepth: balance.intake.openingStatementDepth,
} as unknown as IntakeGenerationConfig;

describe('의뢰인 직업과 슬롯 실현', () => {
  it('같은 시드는 같은 직업·시나리오·슬롯을 만든다', () => {
    const a = realizeIntake(createRng(42), config);
    const b = realizeIntake(createRng(42), config);
    expect(a.occupation).toBe(b.occupation);
    expect(a.scenarioId).toBe(b.scenarioId);
    expect([...a.slots]).toEqual([...b.slots]);
  });

  it('P1 착석은 주민·상인·관리뿐이고 종류는 최소 vague다', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const realized = realizeIntake(createRng(seed), config);
      expect(config.seatedOccupations).toContain(realized.occupation);
      const kind = realized.slots.get('kind');
      expect(kind).toBeDefined();
      expect(kind?.knows).not.toBe('none');
      expect(kind?.tells).not.toBe('none');
      expect([...realized.slots.keys()]).toEqual(SLOT_NAMES.filter((slot) => realized.slots.has(slot)));
    }
  });
});
