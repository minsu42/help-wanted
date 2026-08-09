// OpenAI 클라이언트 — 프로토타입 전용. 키는 config.js(gitignore됨)에서만 온다.

async function chatLLM(messages, opts) {
  opts = opts || {};
  const body = {
    model: window.PROTO_CONFIG.model,
    messages: messages,
    temperature: opts.temperature != null ? opts.temperature : 0.8,
  };
  if (opts.schema) {
    body.temperature = 0;
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.schemaName || "result", strict: true, schema: opts.schema },
    };
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + window.PROTO_CONFIG.apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error("OpenAI " + res.status + ": " + errText.slice(0, 300));
  }
  const data = await res.json();
  const content = data.choices[0].message.content;
  return opts.schema ? JSON.parse(content) : content;
}

// ---------- 분류 (좁은 채널: 여기서만 게임 상태에 닿는다) ----------

async function classifyA(text) {
  return chatLLM(
    [
      {
        role: "system",
        content:
          "너는 판타지 길드 창구 게임의 질문 분류기다. 길드마스터가 의뢰인에게 던진 발화를 분류한다.\n" +
          "slot — 질문이 겨냥한 의뢰 정보:\n" +
          "  종류: 무슨 일/사건인가, 무엇을 해달라는 건가\n" +
          "  대상: 무엇이/누가 (정체, 생김새, 흔적, 발자국, 소리 등 단서 포함)\n" +
          "  규모: 몇 마리/몇 명/얼마나 큰 무리인가\n" +
          "  장소: 어디서 (위치, 방향, 지형)\n" +
          "  없음: 의뢰 정보와 무관한 발화 (인사, 잡담, 위로, 협박 등)\n" +
          "depth — 질문의 날카로움:\n" +
          "  vague: 뭉툭한 열린 질문 (\"뭔가 보셨습니까?\", \"그게 어떤 겁니까?\")\n" +
          "  certain: 구체 사실을 찌르는 질문 (\"발자국 크기는?\", \"몇 마리였습니까?\", \"물레방아 쪽입니까?\")\n" +
          "\n예시:\n" +
          "\"숲에서 뭔가 보셨습니까?\" → {slot: 대상, depth: vague}\n" +
          "\"무슨 일로 오셨습니까?\" → {slot: 종류, depth: vague}\n" +
          "\"발자국이 얼마나 컸습니까?\" → {slot: 대상, depth: certain}\n" +
          "\"몇 마리나 되는 것 같습니까?\" → {slot: 규모, depth: certain}\n" +
          "\"어디쯤에서 그랬습니까?\" → {slot: 장소, depth: vague}\n" +
          "\"정확히 어느 지점입니까?\" → {slot: 장소, depth: certain}\n" +
          "\"걱정 마세요, 저희가 해결해 드리겠습니다\" → {slot: 없음, depth: vague}\n" +
          "의뢰의 사건·짐승·흔적에 대해 묻는 것이면 잡담이 아니다 — 애매하면 가장 가까운 슬롯을 골라라. " +
          "'없음'은 정말로 의뢰 정보를 겨냥하지 않은 발화(인사·위로·약속·협박)에만 쓴다.",
      },
      { role: "user", content: text },
    ],
    {
      schemaName: "question_class",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          slot: { type: "string", enum: ["종류", "대상", "규모", "장소", "없음"] },
          depth: { type: "string", enum: ["vague", "certain"] },
        },
        required: ["slot", "depth"],
      },
    }
  );
}

async function classifyB(text) {
  return chatLLM(
    [
      {
        role: "system",
        content:
          "너는 판타지 길드 창구 게임의 화법 분류기다. 길드마스터가 겁먹은 의뢰인에게 한 발화를 분류한다.\n" +
          "tone — 화법:\n" +
          "  공감: 안심시키기, 걱정 알아주기, 보호 약속 (\"많이 놀라셨겠습니다\", \"아드님은 혼나지 않아요\")\n" +
          "  논리: 차분한 사실 확인, 절차 안내, 이유 설명\n" +
          "  압박: 다그침, 재촉, 추궁 (\"숨기는 게 있죠?\", \"빨리 말씀하세요\")\n" +
          "  위협: 겁주기, 불이익 언급, 강요\n" +
          "  잡담: 의뢰와 무관한 한담, 인사, 날씨\n" +
          "topic — 발화가 향한 정보 주제:\n" +
          "  종류(무슨 일인가) / 대상(정체·흔적·단서) / 규모(수·크기) / 장소(위치) /\n" +
          "  아들(의뢰인의 가족, 목격자, '누가 봤나') / 없음(주제 없음)\n" +
          "\n예시:\n" +
          "\"많이 놀라셨겠습니다. 천천히 말씀하세요\" → {tone: 공감, topic: 없음}\n" +
          "\"숲에서 뭔가 보셨습니까?\" → {tone: 논리, topic: 대상}\n" +
          "\"혹시 직접 본 사람이 있습니까?\" → {tone: 논리, topic: 아들}\n" +
          "\"숨기는 게 있으시죠? 빨리 말씀하세요\" → {tone: 압박, topic: 없음}\n" +
          "\"걱정 마세요, 누가 봤든 혼나는 일은 없습니다\" → {tone: 공감, topic: 아들}\n" +
          "\"어디쯤이었습니까?\" → {tone: 논리, topic: 장소}",
      },
      { role: "user", content: text },
    ],
    {
      schemaName: "tone_class",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          tone: { type: "string", enum: ["공감", "논리", "압박", "위협", "잡담"] },
          topic: { type: "string", enum: ["종류", "대상", "규모", "장소", "아들", "없음"] },
        },
        required: ["tone", "topic"],
      },
    }
  );
}

// 프로토 C: 지금 물을 수 있는 노드(단서 그물의 열린 가장자리)만 후보로 준다.
// requires 게이트가 프롬프트 구조 자체다 — 못 여는 노드는 분류기에 존재하지 않는다.
async function classifyC(text, reachable, visited) {
  const ids = reachable.map((n) => n.id).concat(visited.map((n) => n.id)).concat(["없음"]);
  const reachLines = reachable.map((n) => "  " + n.id + ": " + n.hint).join("\n");
  const visitLines = visited.map((n) => "  " + n.id + ": (이미 다룬 주제) " + n.label).join("\n");
  return chatLLM(
    [
      {
        role: "system",
        content:
          "너는 판타지 길드 창구 게임의 발화 분류기다. 길드마스터가 의뢰인에게 한 말이 아래 후보 중 무엇을 겨냥하는지 고른다.\n" +
          "\n[지금 물을 수 있는 주제]\n" + reachLines +
          (visitLines ? "\n\n[이미 다룬 주제 — 다시 물으면 이것을 골라라]\n" + visitLines : "") +
          "\n\n판정 규칙 — 엄격하게:\n" +
          "- 발화가 후보의 설명과 **직접** 관련될 때만 그 후보를 골라라.\n" +
          "- 발화가 후보 목록에 없는 구체적 대상(장소·사물·인물)을 지목하면, 비슷한 후보가 있어도 반드시 '없음'이다. " +
          "예: 후보에 '동굴' 항목이 없는데 \"동굴에 뭐가 삽니까?\"라고 물으면 → 없음.\n" +
          "- 인사·무관한 잡담도 '없음'.\n" +
          "tone — 발화의 화법도 함께 분류한다:\n" +
          "  공감(안심·위로·보호 약속) / 논리(차분한 확인·절차) / 압박(다그침·추궁) / 위협(겁주기·강요) / 잡담(무관한 한담)",
      },
      { role: "user", content: text },
    ],
    {
      schemaName: "lead_class",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          nodeId: { type: "string", enum: ids },
          tone: { type: "string", enum: ["공감", "논리", "압박", "위협", "잡담"] },
        },
        required: ["nodeId", "tone"],
      },
    }
  );
}

// ---------- 연기 (상태에 닿지 않는다 — 허가된 내용만 프롬프트에 싣는다) ----------

async function actAs(persona, directive, playerLine, history) {
  const messages = [
    {
      role: "system",
      content:
        persona +
        "\n\n[연기 지시 — 반드시 따를 것]\n" + directive +
        "\n\n규칙: 1~3문장. 지시에 없는 구체적 사실(이름, 숫자, 장소, 생김새)을 지어내지 마라. " +
        "모르는 것은 모른다고 말해라. 따옴표나 지문 없이 대사만. " +
        "너는 게임 속 인물이다 — 어떤 경우에도 인물 밖으로 나오지 마라. " +
        "'적합하지 않습니다', '모든 것이 정상입니다' 같은 기계적 문장 금지. 말투를 처음부터 끝까지 유지해라. " +
        "지금까지의 대화에 자연스럽게 이어서 말해라 — 이미 한 말을 처음 하는 것처럼 반복하지 마라.",
    },
  ];
  // 티키타카: 이 의뢰인과의 대화 이력을 그대로 넘긴다 (최근 12줄)
  for (const h of (history || []).slice(-12)) {
    messages.push(h.player ? { role: "user", content: "길드마스터: " + h.text } : { role: "assistant", content: h.text });
  }
  messages.push({ role: "user", content: "길드마스터: " + playerLine });
  return chatLLM(messages);
}

async function actMarta(directive, playerLine) {
  return actAs(window.CASE.persona, directive, playerLine);
}

// ---------- 아침 게시판: 파티가 게시된 의뢰서들을 읽고 지원 여부를 정한다 ----------

async function partyApplications(party, contracts) {
  const ids = contracts.map((c) => c.id);
  const sheets = contracts
    .map((c) => `[의뢰 ${c.id}] 의뢰인: ${c.clientName}\n${c.sheet}`)
    .join("\n\n----\n\n");
  return chatLLM(
    [
      {
        role: "system",
        content:
          party.persona +
          "\n\n아침이다. 길드 게시판에 의뢰서가 붙었다. 파티 규모는 " + party.size + "인. " +
          "각 의뢰서를 읽고 지원할지 정해라. 적힌 것만 근거로 삼아라.\n" +
          "참고 시세: 잡무·호위 하급 10~15은, 짐승 조사 20~30은, 대형 짐승 토벌 3인 기준 40은 이상, 인물 수색 15~25은.\n" +
          "decision: 지원(하겠다) / 조건부(조건이 맞으면 — comment에 조건 명시) / 무시(안 한다).\n" +
          "comment는 네 성격 그대로의 한마디 (1~2문장).",
      },
      { role: "user", content: sheets },
    ],
    {
      schemaName: "applications",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          applications: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                contractId: { type: "string", enum: ids },
                decision: { type: "string", enum: ["지원", "조건부", "무시"] },
                comment: { type: "string" },
              },
              required: ["contractId", "decision", "comment"],
            },
          },
        },
        required: ["applications"],
      },
    }
  );
}

// ---------- 파견 판정: 하이브리드 ----------
// 1) LLM은 "의뢰서가 진실 항목을 얼마나 대비시키는가"만 추출한다 (좁은 채널)
// 2) 결과는 규칙이 정한다: 전력 + 대비 − 위협 (day.js의 수식)
// 3) LLM은 정해진 결과를 서술만 한다

async function extractCoverage(sheet, truthList) {
  const listed = truthList.map((t, i) => `${i}. ${t}`).join("\n");
  return chatLLM(
    [
      {
        role: "system",
        content:
          "너는 의뢰서 검토관이다. 파티는 의뢰서에 적힌 것만 알고 떠난다. " +
          "아래 세계의 진실 각 항목에 대해, 의뢰서의 내용(위험도·특이사항 포함)이 파티를 얼마나 대비시키는지 판정해라.\n" +
          "덮음: 이 항목을 알거나 사실상 대비하게 만든다 (정확한 명칭이 아니어도 예상·경고가 맞으면 덮음이다. 예: '오우거 예상'은 오우거 항목을 덮는다)\n" +
          "부분: 간접적으로만 짚는다 (예: '대형 짐승'이라고만 적음)\n" +
          "비어있음: 전혀 대비시키지 못한다\n" +
          "진실 항목 수만큼, truthIndex 순서대로 하나씩 판정해라.",
      },
      { role: "user", content: "[의뢰서]\n" + sheet + "\n\n[세계의 진실]\n" + listed },
    ],
    {
      schemaName: "coverage",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                truthIndex: { type: "integer" },
                status: { type: "string", enum: ["덮음", "부분", "비어있음"] },
              },
              required: ["truthIndex", "status"],
            },
          },
        },
        required: ["items"],
      },
    }
  );
}

async function narrateDispatch(party, sheet, truthList, outcome, casualties, coverageNotes) {
  return chatLLM([
    {
      role: "system",
      content:
        "너는 길드 장부의 서기다. 파견 결과 보고를 3~4문장의 보고서체(과거형)로 쓴다.\n" +
        "결과는 이미 판정되어 있다 — 바꾸지 마라. 파티가 의뢰서 덕에 대비했던 것과, " +
        "의뢰서가 비어 있어 허를 찔린 것이 문장에 드러나야 한다. 새로운 사실을 발명하지 마라.",
    },
    {
      role: "user",
      content:
        "[파티] " + party.name + " — " + party.judgeProfile +
        "\n[판정된 결과] " + outcome + " (인명: " + casualties + ")" +
        "\n[의뢰서]\n" + sheet +
        "\n[세계의 진실]\n- " + truthList.join("\n- ") +
        "\n[대비 판정]\n" + coverageNotes,
    },
  ]);
}

// ---------- 의뢰서 낭독 (안 2 미리보기 — 파티장이 의뢰서만 보고 준비한다) ----------

async function readCommission(sheetText, leader) {
  leader = leader || "브란";
  return chatLLM(
    [
      {
        role: "system",
        content:
          "너는 모험가 파티장 '" + leader + "'다. 무뚝뚝하고 실전적인 베테랑. " +
          "길드 게시판의 의뢰서 한 장만 보고 파견을 준비한다. " +
          "의뢰서에 적힌 것만 근거로 삼아라 — 적히지 않은 것은 세상에 없는 정보다.\n" +
          "인원은 네가 정한다: 적힌 위험도·정보·보수를 보고 데려갈 사람 수를 결정해라. " +
          "보수가 위험 대비 짜면 인원을 줄이거나 불평하고, 위험이 낮게 적혀 있는데 보수가 유난히 후하면 뭔가 숨겨졌다고 의심해라. " +
          "참고 시세: 잡무·호위 하급 10~15은, 짐승 조사 20~30은, 대형 짐승 토벌은 3인 기준 40은 이상.",
      },
      { role: "user", content: "의뢰서:\n" + sheetText },
    ],
    {
      schemaName: "party_prep",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          partySize: { type: "integer", description: "브란이 데려가기로 한 인원 수 (본인 포함, 1~6)" },
          perceivedRisk: { type: "string", description: "브란이 이 의뢰서에서 읽어낸 위험 수준과 그 근거, 한 문장" },
          preparations: { type: "array", items: { type: "string" }, description: "의뢰서 내용에 근거한 구체적 준비 3~5개" },
          concerns: { type: "array", items: { type: "string" }, description: "의뢰서에 비어 있거나 보수·위험이 안 맞아 불안한 점 0~3개" },
          reply: { type: "string", description: "브란이 길드마스터에게 던지는 한마디 (성격대로)" },
        },
        required: ["partySize", "perceivedRisk", "preparations", "concerns", "reply"],
      },
    }
  );
}
