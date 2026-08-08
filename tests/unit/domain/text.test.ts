import { describe, expect, it } from "vitest";
import textData from "../../../src/data/text.json";
import { createRng } from "../../../src/domain/rng";
import { narrate, render, type TextBank } from "../../../src/domain/text";
import { TRAITS, type Trait } from "../../../src/domain/types";

/** 실제 데이터 파일로 검증한다 — 엔진과 문안이 함께 맞아야 의미가 있다. */
const BANK: TextBank = textData;

const SEED = 99;

/** 상황마다 필요한 값을 넉넉히 채운 인자. 누락 테스트는 따로 만든다. */
const ALL_VARS = { name: "카린 벨트", client: "요한 그림", subject: "미라 로덴", risk: 87 };

function situationNames(): string[] {
  return Object.keys(BANK.situations);
}

describe("render", () => {
  it("test_placeholder_is_replaced_with_value", () => {
    // Arrange / Act
    const result = render("{name}은 {emotion}했다", { name: "카린", emotion: "분노" });

    // Assert
    expect(result).toBe("카린은 분노했다");
  });

  it("test_repeated_placeholder_is_replaced_everywhere", () => {
    const result = render("{name}, {name}!", { name: "카린" });

    expect(result).toBe("카린, 카린!");
  });

  it("test_number_value_is_stringified", () => {
    // 위험도가 자주 들어온다
    const result = render("위험도는 {risk}이다", { risk: 87 });

    expect(result).toBe("위험도는 87이다");
  });

  it("test_missing_value_throws", () => {
    // 조용히 넘어가면 화면에 "{emotion}"이 그대로 나가고 심사 중에 발견된다
    expect(() => render("{name}은 {emotion}했다", { name: "카린" })).toThrow(/emotion/);
  });

  it("test_empty_string_is_a_valid_value_not_a_missing_one", () => {
    // Edge: 빈 문자열은 누락과 구분한다
    const result = render("{prefix}{name}", { prefix: "", name: "카린" });

    expect(result).toBe("카린");
  });

  it("test_template_without_placeholders_is_returned_as_is", () => {
    expect(render("아무도 오지 않았다", {})).toBe("아무도 오지 않았다");
  });

  it("test_unused_vars_are_ignored", () => {
    expect(render("{name}", { name: "카린", unused: "무시됨" })).toBe("카린");
  });
});

describe("narrate", () => {
  it("test_same_seed_picks_the_same_variant", () => {
    // 결정론 — 같은 시드면 같은 문장이 나와야 회차 재생이 성립한다
    const first = narrate(BANK, "resultDead", ["bitter"], ALL_VARS, createRng(SEED));
    const second = narrate(BANK, "resultDead", ["bitter"], ALL_VARS, createRng(SEED));

    expect(second).toBe(first);
  });

  it("test_variants_actually_vary_across_seeds", () => {
    // 변형이 있는데 늘 같은 것만 나오면 어휘 집합이 장식이다.
    // 문안이 하나뿐인 어휘 집합도 정상이므로, 여럿인 곳을 골라 전제부터 확인한다.
    expect(BANK.situations.resultDead.lines.default.length).toBeGreaterThan(1);

    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      seen.add(narrate(BANK, "resultDead", [], ALL_VARS, createRng(seed)));
    }

    expect(seen.size).toBeGreaterThan(1);
  });

  it("test_bitter_and_boastful_do_not_share_a_line", () => {
    // 성격 분기의 핵심 — 왜곡의 방향이 어조로 드러나야 한다
    const bitterLines = new Set<string>();
    const boastfulLines = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      bitterLines.add(narrate(BANK, "rumorTold", ["bitter"], ALL_VARS, createRng(seed)));
      boastfulLines.add(narrate(BANK, "rumorTold", ["boastful"], ALL_VARS, createRng(seed)));
    }

    for (const line of bitterLines) {
      expect(boastfulLines.has(line)).toBe(false);
    }
  });

  it("test_unknown_trait_combination_falls_back_to_default", () => {
    // resultSuccess에 greedy 어휘가 없다 → default로 떨어진다
    const fallback = narrate(BANK, "resultSuccess", ["greedy"], ALL_VARS, createRng(SEED));
    const explicit = narrate(BANK, "resultSuccess", [], ALL_VARS, createRng(SEED));

    expect(fallback).toBe(explicit);
  });

  it("test_first_matching_trait_wins", () => {
    // 한 사람이 태그를 둘 가지므로 우선순위가 없으면 결정론이 깨진다
    const bitterFirst = narrate(BANK, "resultDead", ["bitter", "loyal"], ALL_VARS, createRng(SEED));
    const onlyBitter = narrate(BANK, "resultDead", ["bitter"], ALL_VARS, createRng(SEED));
    const onlyLoyal = narrate(BANK, "resultDead", ["loyal"], ALL_VARS, createRng(SEED));

    expect(bitterFirst).toBe(onlyBitter);
    expect(bitterFirst).not.toBe(onlyLoyal);
  });

  it("test_missing_required_var_throws_regardless_of_seed", () => {
    // 변형마다 쓰는 자리표시자가 달라도 시드와 무관하게 터져야 한다
    for (let seed = 0; seed < 30; seed += 1) {
      expect(() =>
        narrate(BANK, "rumorTold", ["bitter"], { name: "카린", client: "요한" }, createRng(seed)),
      ).toThrow(/risk/);
    }
  });

  it("test_unknown_situation_throws", () => {
    expect(() => narrate(BANK, "존재하지않음", [], ALL_VARS, createRng(SEED))).toThrow(/상황/);
  });

  it("test_situation_without_default_throws", () => {
    const broken: TextBank = {
      situations: { orphan: { _vars: [], lines: { bitter: ["오직 bitter만"] } } },
    };

    expect(() => narrate(broken, "orphan", ["loyal"], {}, createRng(SEED))).toThrow(/default/);
  });

  it("test_empty_variant_list_is_skipped_not_picked", () => {
    // 빈 배열을 rng.pick에 넘기면 엉뚱한 곳에서 터진다. 건너뛰고 default로 가야 한다.
    const sparse: TextBank = {
      situations: { thin: { _vars: [], lines: { bitter: [], default: ["기본 문장"] } } },
    };

    expect(narrate(sparse, "thin", ["bitter"], {}, createRng(SEED))).toBe("기본 문장");
  });
});

describe("text.json 데이터 무결성", () => {
  it("test_required_situation_categories_exist", () => {
    // AC: 최소 상황 4종 — 파견 결과 / 소문 전달 / 협상 반박 / 영입 인사
    for (const required of [
      "resultSuccess",
      "resultInjured",
      "resultDead",
      "rumorTold",
      "counterReward",
      "counterAdvance",
      "recruitGreeting",
    ]) {
      expect(situationNames()).toContain(required);
    }
  });

  it("test_every_situation_has_a_default_variant", () => {
    for (const name of situationNames()) {
      const entry = BANK.situations[name];
      expect(entry.lines.default, `${name}에 default가 없다`).toBeDefined();
      expect(entry.lines.default.length).toBeGreaterThan(0);
    }
  });

  it("test_every_line_only_uses_declared_vars", () => {
    // 선언되지 않은 자리표시자를 쓰면 _vars 사전 검사를 빠져나가 런타임에 터진다
    for (const name of situationNames()) {
      const entry = BANK.situations[name];
      const declared = new Set(entry._vars);

      for (const lines of Object.values(entry.lines)) {
        for (const line of lines) {
          for (const [, key] of line.matchAll(/\{(\w+)\}/g)) {
            expect(declared.has(key), `${name}의 "${line}"이 미선언 {${key}}를 쓴다`).toBe(true);
          }
        }
      }
    }
  });

  it("test_every_situation_renders_for_every_trait", () => {
    // 어떤 성격 조합이 와도 문장이 나와야 한다 — 화면에서 빈칸이 되면 안 된다
    for (const name of situationNames()) {
      for (const trait of TRAITS) {
        for (let seed = 0; seed < 5; seed += 1) {
          const line = narrate(BANK, name, [trait], ALL_VARS, createRng(seed));
          expect(line.length).toBeGreaterThan(0);
          expect(line).not.toMatch(/\{|\}/);
        }
      }
    }
  });

  it("test_no_duplicate_lines_within_a_variant", () => {
    // 같은 문장이 두 번 있으면 그 변형만 두 배로 자주 나온다
    for (const name of situationNames()) {
      for (const [variant, lines] of Object.entries(BANK.situations[name].lines)) {
        expect(new Set(lines).size, `${name}.${variant}에 중복 문장이 있다`).toBe(lines.length);
      }
    }
  });

  it("test_variant_keys_are_known_traits_or_default", () => {
    // 오타난 태그 키는 영원히 선택되지 않는 죽은 어휘가 된다
    const allowed = new Set<string>([...TRAITS, "default"]);

    for (const name of situationNames()) {
      for (const variant of Object.keys(BANK.situations[name].lines)) {
        expect(allowed.has(variant), `${name}의 "${variant}"는 알려진 태그가 아니다`).toBe(true);
      }
    }
  });

  it("test_distortion_carrying_situation_declares_the_risk_slot", () => {
    // 왜곡값은 템플릿 슬롯으로 정확히 박힌다 — 어조가 아니라 숫자가 정보다
    expect(BANK.situations.rumorTold._vars).toContain("risk");
  });

  it("test_trait_specific_vocabulary_exists_beyond_default", () => {
    // 전부 default뿐이면 "성격으로 어휘를 고른다"가 거짓말이 된다
    const withTraitLines = situationNames().filter((name) =>
      Object.keys(BANK.situations[name].lines).some((key) => (TRAITS as readonly string[]).includes(key)),
    );

    expect(withTraitLines.length).toBe(situationNames().length);
  });
});

/** TRAITS를 Trait[]로 쓰는 곳이 있어 타입만 고정해 둔다. */
const _traitCheck: readonly Trait[] = TRAITS;
void _traitCheck;
