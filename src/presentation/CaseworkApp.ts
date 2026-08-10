import portraitAtlas from '../assets/client-portrait-expressions.png';
import handbookImage from '../assets/counter-handbook.png';
import bestiaryPlate from '../assets/bestiary-creature-plate-v1.png';
import { CASES, DIRECTIVES, KNOWLEDGE, PARTIES, PREPARATION_OPTIONS } from '../data/casework';
import {
  CASES_PER_DAY, checkDirectives, dayOfCase, isLastCaseOfDay, knowledgeForDay, newDirectivesOn,
  type DirectiveRejection, type PendingDispatch,
} from '../domain/dayCycle';
import {
  COMMISSION_SLOTS, SLOT_LABELS, createSession, emptyCommission,
  type ClientCase, type CommissionSheet, type DispatchResult, type IntakeSession,
  type PartyApplication, type RiskGrade,
} from '../domain/casework';
import { getPartyApplications, resolveDispatch } from '../domain/dispatchEngine';
import { compareClaim, resolveTurn, type ClaimComparison } from '../domain/intakeEngine';
import { createClientAgent, type ClientAgent } from '../llm/clientAgent';

type AppPhase = 'briefing' | 'morning' | 'intake' | 'commission' | 'applications' | 'filed' | 'summary';
type Overlay = 'book' | 'ledger' | undefined;

export interface CaseworkAppOptions { agent?: ClientAgent; }

export class CaseworkApp {
  private phase: AppPhase = 'briefing';
  private caseIndex = 0;
  private session: IntakeSession = createSession(CASES[0]!);
  private readonly agent: ClientAgent;
  private busy = false;
  private draft = '';
  private error = '';
  private overlay: Overlay;
  private bookPage = 0;
  private bookTag = '전체';
  private selectedClaimId?: string;
  private selectedKnowledgeId?: string;
  private comparison?: ClaimComparison;
  private sealedSheet?: CommissionSheet;
  private applications: PartyApplication[] = [];
  /** 오늘 처리한 파견. 결과는 다음 날 아침 보고서에서만 열린다. */
  private pending: PendingDispatch[] = [];
  private reported: PendingDispatch[] = [];
  private rejections: DirectiveRejection[] = [];

  constructor(private readonly root: HTMLElement, options: CaseworkAppOptions = {}) {
    const endpoint = import.meta.env.VITE_AGENT_ENDPOINT as string | undefined;
    this.agent = options.agent ?? createClientAgent({ endpoint, development: import.meta.env.DEV && endpoint === undefined });
    this.render();
  }

  destroy(): void { this.root.replaceChildren(); }

  private get day(): number { return dayOfCase(this.caseIndex); }

  /** 오늘 펼칠 수 있는 자료. 내일 붙을 공문은 오늘 백과사전에 없다. */
  private get knowledge(): readonly (typeof KNOWLEDGE)[number][] {
    return knowledgeForDay(KNOWLEDGE, this.day);
  }

  private get caseData(): ClientCase {
    const value = CASES[this.caseIndex];
    if (!value) throw new Error('현재 사건을 찾을 수 없다.');
    return value;
  }

  private render(): void {
    if (this.phase === 'briefing') this.renderBriefing();
    else if (this.phase === 'intake') this.renderIntake();
    else if (this.phase === 'commission') this.renderCommission();
    else if (this.phase === 'applications') this.renderApplications();
    else if (this.phase === 'morning') this.renderMorning();
    else if (this.phase === 'filed') this.renderFiled();
    else this.renderSummary();
  }

  private renderBriefing(): void {
    this.root.innerHTML = `<main class="briefing safe-frame"><section class="briefing__paper" aria-labelledby="game-title">
      <p class="eyebrow">왕립 모험가 길드 · 신입 접수원 업무 시험</p><h1 id="game-title">HELP WANTED</h1>
      <p class="briefing__hook">당신이 놓친 한 줄이 모험가의 유서가 됩니다.</p>
      <div class="briefing__rules"><p><b>1.</b> 진술 쪽지를 자료집과 대조하십시오.</p><p><b>2.</b> 모순을 찾았다면 자신의 말로 추궁하십시오.</p><p><b>3.</b> 의뢰서를 게시하고 지원 파티를 승인하십시오.</p></div>
      <p class="connection" data-connection>AI 의뢰인 연결을 확인하지 않았습니다.</p><button class="seal-button" type="button" data-action="start">업무 시작</button>
      <p class="briefing__mode">${this.agent.mode === 'development' ? '규칙 폴백 모드 — AI Worker 없이도 완주할 수 있습니다' : 'AI Worker 연결 모드'}</p>
    </section></main>`;
    this.onClick('start', () => void this.start()); this.focus('[data-action="start"]');
  }

  private async start(): Promise<void> {
    const button = this.root.querySelector<HTMLButtonElement>('[data-action="start"]');
    const status = this.root.querySelector<HTMLElement>('[data-connection]');
    if (button) button.disabled = true;
    if (status) status.textContent = '봉랍 통신선을 확인하는 중…';
    await this.agent.checkHealth();
    this.phase = 'morning'; this.render();
  }

  private renderIntake(): void {
    const visibleFacts = this.caseData.facts.filter((fact) => this.session.disclosedFactIds.includes(fact.id));
    const recentTurns = this.session.turns.slice(-4);
    const canTalk = this.session.patience > 0;
    const claim = this.caseData.openingClaims.find((candidate) => candidate.id === this.selectedClaimId);
    const evidence = this.knowledge.find((entry) => entry.id === this.selectedKnowledgeId);
    const challengeMode = Boolean(this.comparison?.valid);
    this.root.innerHTML = `<main class="casework safe-frame">
      ${this.header('접수 심사')}
      <div class="desk-tools" aria-label="책상 도구">
        <button class="desk-object" type="button" data-action="book"><img src="${handbookImage}" alt=""><span>길드 백과사전</span><small>${evidence ? `증거: ${escapeHtml(evidence.title)}` : `${escapeHtml(this.bookTag)} · 도감/규정`}</small></button>
        <button class="desk-object desk-object--ledger" type="button" data-action="ledger"><span aria-hidden="true">≡</span><b>대화 장부</b><small>${this.session.turns.length}개 기록</small></button>
      </div>
      <section class="client-panel" aria-labelledby="client-name">
        <div class="client-card"><div class="portrait portrait--${this.session.emotion}" style="--portrait:url('${portraitAtlas}')" role="img" aria-label="${escapeHtml(this.caseData.clientName)}의 ${emotionLabel(this.session.emotion)} 표정"></div>
          <div><p class="eyebrow">${escapeHtml(this.caseData.occupation)}</p><h2 id="client-name">${escapeHtml(this.caseData.clientName)}</h2><p>${escapeHtml(this.caseData.premise)}</p><small class="client-demeanor">${escapeHtml(this.caseData.demeanor)}</small></div>
          <dl class="client-state"><div><dt>인내</dt><dd>${'●'.repeat(this.session.patience)}${'○'.repeat(4 - this.session.patience)}</dd></div><div><dt>보수</dt><dd>은화 ${this.session.reward}닢</dd></div></dl>
        </div>
        <div class="dialogue-log" aria-live="polite" data-dialogue>${recentTurns.map((turn) => dialogueHtml(turn, this.caseData.clientName)).join('')}${this.busy ? '<article class="dialogue dialogue--thinking"><b>의뢰인</b><p>대답을 고르는 중<span class="thinking-dots">...</span></p></article>' : ''}</div>
        <form class="utterance-form ${challengeMode ? 'utterance-form--challenge' : ''}" data-form="utterance">
          ${challengeMode ? `<div class="comparison-strip"><span>진술</span><b>${escapeHtml(claim?.text ?? '')}</b><i>⇄</i><span>증거</span><b>${escapeHtml(evidence?.title ?? '')}</b></div>` : ''}
          <label for="utterance">${challengeMode ? '이 대조를 근거로 무엇을 확인하시겠습니까?' : '자유롭게 질문하거나 보수를 협상하십시오'}</label>
          <div class="utterance-row"><textarea id="utterance" maxlength="240" rows="2" ${this.busy || !canTalk ? 'disabled' : ''} placeholder="${challengeMode ? '책 문장은 자동 입력되지 않습니다. 근거를 보고 직접 질문하십시오.' : '예: 직접 본 것과 추측한 것을 나눠서 말해 주십시오.'}">${escapeHtml(this.draft)}</textarea><button type="submit" ${this.busy || !canTalk ? 'disabled' : ''}>${challengeMode ? '근거 제시' : '질문'}</button></div>
          <div class="input-meta"><span>${this.error ? escapeHtml(this.error) : canTalk ? 'Enter 전송 · Shift+Enter 줄바꿈' : '의뢰인이 더는 대답하지 않습니다.'}</span><output data-count>${this.draft.length}/240</output></div>
        </form>
      </section>
      <aside class="evidence-board" aria-label="진술과 확인 기록"><section><p class="eyebrow">STATEMENTS</p><h2>진술 쪽지</h2><div class="claim-list">${this.caseData.openingClaims.map((item) => {
        const done = this.session.challengedClaimIds.includes(item.id);
        return `<button type="button" class="claim-slip ${item.id === this.selectedClaimId ? 'is-selected' : ''} ${done ? 'is-checked' : ''}" data-claim="${item.id}"><small>${SLOT_LABELS[item.slot]}</small><b>“${escapeHtml(item.text)}”</b><span>${done ? '대조 완료' : '대조할 진술 선택'}</span></button>`;
      }).join('')}</div><button class="compare-button" type="button" data-action="compare" ${!this.selectedClaimId || !this.selectedKnowledgeId ? 'disabled' : ''}>대조 도장</button></section>
      <section class="verified-list"><p class="eyebrow">VERIFIED</p><h2>확인 기록</h2><ol>${visibleFacts.map((fact) => `<li><span>${SLOT_LABELS[fact.slot]}</span><b>${escapeHtml(fact.value)}</b></li>`).join('') || '<li class="empty">아직 확인한 사실이 없습니다.</li>'}</ol><button class="seal-button seal-button--small" type="button" data-action="commission">의뢰서 작성</button></section></aside>
      ${this.overlay === 'book' ? this.bookOverlay() : ''}${this.overlay === 'ledger' ? this.ledgerOverlay() : ''}
    </main>`;
    this.bindIntake(canTalk);
  }

  private bindIntake(canTalk: boolean): void {
    const form = this.root.querySelector<HTMLFormElement>('[data-form="utterance"]');
    const textarea = this.root.querySelector<HTMLTextAreaElement>('#utterance');
    const count = this.root.querySelector<HTMLOutputElement>('[data-count]');
    textarea?.addEventListener('input', () => { this.draft = textarea.value; if (count) count.value = `${textarea.value.length}/240`; });
    textarea?.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form?.requestSubmit(); } });
    form?.addEventListener('submit', (event) => { event.preventDefault(); void this.submitUtterance(); });
    this.onClick('book', () => { this.overlay = 'book'; this.render(); });
    this.onClick('ledger', () => { this.overlay = 'ledger'; this.render(); });
    this.onClick('close-overlay', () => { this.overlay = undefined; this.render(); });
    this.onClick('book-prev', () => { this.bookPage = Math.max(0, this.bookPage - 2); this.render(); });
    this.onClick('book-next', () => { this.bookPage = Math.min(Math.max(0, this.filteredKnowledge.length - 2), this.bookPage + 2); this.render(); });
    this.root.querySelectorAll<HTMLButtonElement>('[data-book-tag]').forEach((button) => button.addEventListener('click', () => { this.bookTag = button.dataset.bookTag ?? '전체'; this.bookPage = 0; this.render(); }));
    this.root.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((button) => button.addEventListener('click', () => { this.selectedClaimId = button.dataset.claim; this.comparison = undefined; this.error = ''; this.render(); }));
    this.root.querySelectorAll<HTMLButtonElement>('[data-knowledge]').forEach((button) => button.addEventListener('click', () => { this.selectedKnowledgeId = button.dataset.knowledge; this.overlay = undefined; this.comparison = undefined; this.render(); }));
    this.onClick('compare', () => this.applyComparison());
    this.onClick('commission', () => { this.phase = 'commission'; this.error = ''; this.overlay = undefined; this.render(); });
    if (!this.busy && canTalk && this.overlay === undefined) this.focus('#utterance');
  }

  private applyComparison(): void {
    if (!this.selectedClaimId || !this.selectedKnowledgeId) return;
    const comparison = compareClaim(this.caseData, this.selectedClaimId, this.selectedKnowledgeId, this.knowledge);
    this.comparison = comparison.valid ? comparison : undefined;
    this.error = comparison.valid ? '' : '이 진술을 확인하는 근거가 아닙니다. 종류 태그를 바꾸거나 다른 문장을 골라 보십시오.';
    this.render();
  }

  private async submitUtterance(): Promise<void> {
    const text = this.draft.trim(); if (!text || this.busy || this.session.patience === 0) return;
    const previous = this.session; const activeComparison = this.comparison;
    const turnId = `${this.caseData.id}-${Date.now()}-${previous.usedTurnIds.length + 1}`;
    this.busy = true; this.error = ''; this.render();
    try {
      const interpreted = await this.agent.interpret({ turnId, utterance: text, caseData: this.caseData, session: previous, knowledge: this.knowledge });
      const interpretation = activeComparison ? {
        ...interpreted, intent: 'challenge' as const,
        targetSlots: [activeComparison.slot],
        citedKnowledgeIds: [...new Set([...interpreted.citedKnowledgeIds, activeComparison.knowledgeId])],
      } : interpreted;
      const resolved = resolveTurn(this.caseData, previous, turnId, interpretation, this.knowledge);
      const utterance = await this.agent.respond({ turnId, utterance: text, caseData: this.caseData, session: resolved.session, receipt: resolved.receipt });
      this.session = { ...resolved.session, challengedClaimIds: activeComparison ? [...new Set([...resolved.session.challengedClaimIds, activeComparison.claimId])] : resolved.session.challengedClaimIds,
        turns: [...previous.turns, { id: `${turnId}-player`, speaker: 'player', text }, { id: `${turnId}-client`, speaker: 'client', text: utterance }] };
      this.draft = ''; this.comparison = undefined; this.selectedClaimId = undefined; this.selectedKnowledgeId = undefined;
    } catch { this.session = previous; this.error = 'AI 응답을 받지 못했습니다. 문장을 보존했습니다. 다시 전송해 주십시오.'; }
    finally { this.busy = false; this.render(); }
  }

  private bookOverlay(): string {
    const filtered = this.filteredKnowledge;
    const pages = filtered.slice(this.bookPage, this.bookPage + 2);
    // '공문'은 그날 붙은 조항이 있을 때만 노출한다 — 빈 태그를 눌러 빈 책장을 보게 하지 않는다.
    const tags = ['전체', '괴물', '규정', '공문', '위장종', '정령종', '거인종', '마력', '시세', '구조']
      .filter((tag) => tag === '전체' || this.knowledge.some((entry) => entry.tags.includes(tag)));
    return `<div class="overlay" role="dialog" aria-modal="true" aria-label="길드 백과사전"><button class="overlay-close" type="button" data-action="close-overlay" aria-label="닫기">×</button>
      <section class="book-spread"><header><div><p class="eyebrow">ROYAL GUILD CODEX</p><h2>길드 백과사전</h2></div><div class="book-tags" aria-label="백과사전 종류">${tags.map((tag) => `<button type="button" data-book-tag="${tag}" class="${tag === this.bookTag ? 'is-selected' : ''}">${tag}</button>`).join('')}</div><span>${filtered.length ? `${this.bookPage + 1}–${Math.min(this.bookPage + 2, filtered.length)} / ${filtered.length}` : '0 / 0'}</span></header>
      <div class="book-pages">${pages.map((entry) => `<article class="book-page"><p class="book-category">${escapeHtml(entry.category)}</p><h3>${escapeHtml(entry.title)}</h3>${entry.imageQuadrant ? `<div class="bestiary-art bestiary-art--${entry.imageQuadrant}" style="--plate:url('${bestiaryPlate}')" role="img" aria-label="${escapeHtml(entry.title)} 삽화"></div>` : '<div class="rule-crest" aria-hidden="true">§</div>'}
        ${entry.size ? `<dl class="creature-stats"><div><dt>크기</dt><dd>${escapeHtml(entry.size)}</dd></div><div><dt>서식</dt><dd>${escapeHtml(entry.habitat ?? '')}</dd></div><div><dt>흔적</dt><dd>${escapeHtml(entry.traces ?? '')}</dd></div><div><dt>특성</dt><dd>${escapeHtml(entry.traits ?? '')}</dd></div><div><dt>약점</dt><dd>${escapeHtml(entry.weakness ?? '')}</dd></div><div><dt>위험</dt><dd>${entry.danger ?? '-'}</dd></div></dl>` : ''}
        <button type="button" class="knowledge-line ${entry.id === this.selectedKnowledgeId ? 'is-selected' : ''}" data-knowledge="${entry.id}"><span>이 문장을 증거 슬롯에 끼우기</span>${escapeHtml(entry.text)}</button></article>`).join('') || '<p class="book-empty">이 종류에 해당하는 항목이 없습니다.</p>'}</div>
      <p class="book-help">문장은 입력창에 복사되지 않습니다. 진술과 근거를 대조한 뒤, 내용을 보고 직접 질문하십시오.</p><nav><button type="button" data-action="book-prev" ${this.bookPage === 0 ? 'disabled' : ''}>← 이전 장</button><button type="button" data-action="book-next" ${this.bookPage + 2 >= filtered.length ? 'disabled' : ''}>다음 장 →</button></nav></section></div>`;
  }

  private get filteredKnowledge(): readonly (typeof KNOWLEDGE)[number][] {
    return this.bookTag === '전체' ? this.knowledge : this.knowledge.filter((entry) => entry.tags.includes(this.bookTag));
  }

  private ledgerOverlay(): string {
    return `<div class="overlay" role="dialog" aria-modal="true" aria-label="대화 장부"><button class="overlay-close" type="button" data-action="close-overlay" aria-label="닫기">×</button><section class="ledger"><p class="eyebrow">FULL TRANSCRIPT</p><h2>접수 대화 장부</h2><div class="ledger__turns">${this.session.turns.map((turn) => dialogueHtml(turn, this.caseData.clientName)).join('')}</div></section></div>`;
  }

  private renderCommission(): void {
    const disclosed = this.caseData.facts.filter((fact) => this.session.disclosedFactIds.includes(fact.id));
    const preparations = PREPARATION_OPTIONS;
    this.root.innerHTML = `<main class="document-screen safe-frame">${this.header('의뢰서 작성')}<form class="commission-sheet" data-form="commission">
      <div class="commission-sheet__heading"><div><p class="eyebrow">GUILD COMMISSION</p><h2>${escapeHtml(this.caseData.premise)}</h2></div><p>합의 보수 <b>은화 ${this.session.reward}닢</b></p></div>
      <section class="commission-fields">${COMMISSION_SLOTS.map((slot) => `<fieldset><legend>${SLOT_LABELS[slot]}</legend><select name="fact-${slot}"><option value="">미상</option>${disclosed.filter((fact) => fact.slot === slot).map((fact) => `<option value="${fact.id}">${escapeHtml(fact.value)}</option>`).join('')}</select><select name="confidence-${slot}"><option value="unknown">미상</option><option value="inferred">추정</option><option value="confirmed">확정</option></select></fieldset>`).join('')}</section>
      <div class="commission-lower"><fieldset><legend>위험 등급</legend><div class="grade-row">${(['D','C','B','A','S'] as const).map((grade) => `<label><input type="radio" name="risk" value="${grade}" ${grade === 'D' ? 'checked' : ''}><span>${grade}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend>파티에 요구할 준비</legend><div class="check-grid">${preparations.map((item) => `<label><input type="checkbox" name="preparation" value="${escapeHtml(item)}">${escapeHtml(item)}</label>`).join('')}</div></fieldset>
      <fieldset><legend>처리 결정</legend><label><input type="radio" name="decision" value="accept" checked> 게시판에 의뢰 게시</label><label><input type="radio" name="decision" value="reject"> 의뢰 거절</label></fieldset></div>
      ${this.rejections.length ? `<section class="rejection-stamp" role="alert"><p class="eyebrow">REJECTED</p><h3>게시 반려</h3><ul>${this.rejections.map((item) => `<li><b>${escapeHtml(item.title)}</b> — ${escapeHtml(item.reason)}</li>`).join('')}</ul></section>` : ''}
      <p class="form-note">도장을 찍으면 내용이 잠기며, 모험가들은 이 서류만 보고 지원합니다.</p><div class="document-actions"><button type="button" data-action="back">심문으로 돌아가기</button><button class="seal-button" type="submit">게시 도장 찍기</button></div>
    </form></main>`;
    this.onClick('back', () => { this.phase = 'intake'; this.render(); });
    this.root.querySelector<HTMLFormElement>('[data-form="commission"]')?.addEventListener('submit', (event) => { event.preventDefault(); this.submitCommission(new FormData(event.currentTarget as HTMLFormElement)); });
    this.focus('[name="fact-objective"]');
  }

  private submitCommission(form: FormData): void {
    const sheet = emptyCommission();
    for (const slot of COMMISSION_SLOTS) {
      const factId = stringValue(form.get(`fact-${slot}`)); const confidence = stringValue(form.get(`confidence-${slot}`));
      sheet.entries[slot] = { factId: factId || undefined, confidence: confidence === 'confirmed' || confidence === 'inferred' ? confidence : 'unknown' };
    }
    sheet.risk = riskValue(form.get('risk')); sheet.preparations = form.getAll('preparation').map(stringValue).filter(Boolean); sheet.accepted = form.get('decision') !== 'reject';
    // 거절은 게시가 아니므로 공문 심사를 거치지 않는다 — 반려는 게시판에 붙일 서류에만 찍힌다.
    this.rejections = sheet.accepted ? checkDirectives(DIRECTIVES, this.day, sheet) : [];
    if (this.rejections.length) { this.render(); return; }
    this.sealedSheet = sheet;
    if (!sheet.accepted) { this.finishDispatch(undefined); return; }
    this.applications = getPartyApplications(sheet, PARTIES, this.session.reward);
    this.phase = 'applications'; this.render();
  }

  private renderApplications(): void {
    if (!this.sealedSheet) throw new Error('게시된 의뢰서가 없다.');
    const applied = this.applications.filter((item) => item.status === 'applied').slice(0, 3);
    const refused = this.applications.filter((item) => item.status === 'refused').slice(0, 2);
    this.root.innerHTML = `<main class="document-screen safe-frame">${this.header('지원 파티 검토')}<section class="application-board"><div class="posted-sheet"><p class="eyebrow">POSTED</p><h2>${escapeHtml(this.caseData.premise)}</h2><dl><div><dt>기록 위험</dt><dd>${this.sealedSheet.risk}급</dd></div><div><dt>보수</dt><dd>은화 ${this.session.reward}닢</dd></div><div><dt>준비</dt><dd>${escapeHtml(this.sealedSheet.preparations.join(' · ') || '기재 없음')}</dd></div></dl><p>모험가들은 실제 사건이 아니라 이 게시문만 읽고 지원했습니다.</p></div>
      <section class="applications"><p class="eyebrow">APPLICATIONS</p><h2>도착한 지원서</h2>${applied.length ? `<div class="party-grid">${applied.map((application) => { const party = PARTIES.find((item) => item.id === application.partyId)!; return `<article class="party-application"><span class="grade-medal">${party.grade}</span><h3>${escapeHtml(party.name)}</h3><p>${escapeHtml(party.specialties.join(' · '))}</p><blockquote>“${escapeHtml(party.quote)}”</blockquote><small>${escapeHtml(application.reason)}</small><button class="seal-button" type="button" data-party="${party.id}">인계 승인</button></article>`; }).join('')}</div>` : '<p class="no-applications">지원한 파티가 없습니다. 위험 등급이나 보수가 맞지 않았습니다.</p>'}
      ${refused.length ? `<details class="refusal-notes"><summary>지원하지 않은 파티 기록</summary>${refused.map((application) => { const party = PARTIES.find((item) => item.id === application.partyId)!; return `<p><b>${escapeHtml(party.name)}</b> — ${escapeHtml(application.reason)}</p>`; }).join('')}</details>` : ''}
      <div class="document-actions">${applied.length
        ? '<button type="button" data-action="close-unassigned">인계 없이 마감</button>'
        : '<button type="button" data-action="revise">의뢰서 다시 작성</button>'}</div></section></section></main>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-party]').forEach((button) => button.addEventListener('click', () => this.finishDispatch(button.dataset.party)));
    this.onClick('close-unassigned', () => this.finishDispatch(undefined));
    this.onClick('revise', () => { this.sealedSheet = undefined; this.applications = []; this.phase = 'commission'; this.render(); });
  }

  private finishDispatch(partyId?: string): void {
    if (!this.sealedSheet) throw new Error('의뢰서가 없다.');
    this.sealedSheet.partyId = partyId;
    const party = PARTIES.find((candidate) => candidate.id === partyId);
    const result = resolveDispatch(this.caseData, this.sealedSheet, party, this.session.reward, this.session.disclosedFactIds);
    this.pending.push({ caseIndex: this.caseIndex, clientName: this.caseData.clientName, premise: this.caseData.premise, result });
    this.phase = 'filed'; this.render();
  }

  /**
   * 서류를 접수한 직후 화면. 결과는 여기서 열지 않는다.
   *
   * 오늘의 서류가 오늘 채점되면 잘못 쓴 대가가 즉시 보정 가능한 실수로 끝난다.
   * 결과는 다음 날 아침 보고서로 미뤄야 어제의 서명이 오늘 나를 찾아온다.
   */
  private renderFiled(): void {
    const dayClosed = isLastCaseOfDay(this.caseIndex, CASES.length);
    const filed = this.pending[this.pending.length - 1];
    this.root.innerHTML = `<main class="outcome-screen safe-frame">${this.header('서류 접수')}<section class="filed-note"><p class="eyebrow">FILED</p><h2>${escapeHtml(filed?.premise ?? '')}</h2>
      <p class="filed-lead">서류가 파발로 넘어갔습니다. ${filed?.result.outcome === 'rejected' ? '거절 처리된 의뢰는 게시판에 붙지 않습니다.' : '파견 결과는 내일 아침 보고서로 돌아옵니다.'}</p>
      <p class="filed-hint">지금은 무엇이 잘못됐는지 알 수 없습니다. 그것을 아는 사람은 이미 길 위에 있습니다.</p>
      <div class="document-actions"><button class="seal-button" type="button" data-action="continue">${dayClosed ? `${dayOfCase(this.caseIndex)}일차 근무 종료` : '다음 의뢰인 호출'}</button></div></section></main>`;
    this.onClick('continue', () => this.advance()); this.focus('[data-action="continue"]');
  }

  private advance(): void {
    if (!isLastCaseOfDay(this.caseIndex, CASES.length)) { this.caseIndex += 1; this.resetCase(); this.phase = 'intake'; this.render(); return; }
    if (this.caseIndex + 1 >= CASES.length) { this.reported = [...this.reported, ...this.pending]; this.pending = []; this.phase = 'summary'; this.render(); return; }
    this.caseIndex += 1; this.resetCase(); this.phase = 'morning'; this.render();
  }

  /** 하루의 시작. 어제 보낸 사람들의 소식과 오늘부터 걸리는 공문이 같이 온다. */
  private renderMorning(): void {
    const day = dayOfCase(this.caseIndex);
    const overnight = this.pending;
    const fresh = newDirectivesOn(DIRECTIVES, day);
    this.root.innerHTML = `<main class="morning-screen safe-frame">${this.header(`${day}일차 아침`)}<section class="morning-paper">
      <p class="eyebrow">MORNING POST</p><h1>${day}일차 근무</h1>
      ${overnight.length ? `<section class="overnight"><h2>지난밤 도착한 파견 보고</h2><ol class="overnight-list">${overnight.map((item) => {
        const copy = outcomeCopy(item.result.outcome);
        const detail = item.result.outcome === 'rejected' || item.result.outcome === 'unassigned'
          ? '파견 없음'
          : `정보 ${item.result.completeness} · 준비 ${item.result.preparation} · 위협 ${CASES[item.caseIndex]?.threat ?? 0} → 점수 ${item.result.score}`;
        return `<li class="overnight-item overnight-item--${item.result.outcome}"><div><b>${escapeHtml(item.clientName)}</b><span>${escapeHtml(item.premise)}</span></div><div><b>${copy.title}</b><small>${escapeHtml(detail)}</small></div><p>${escapeHtml(item.result.notes[0] ?? '')}</p></li>`;
      }).join('')}</ol></section>` : ''}
      ${fresh.length ? `<section class="directives"><h2>오늘부터 적용되는 공문</h2>${fresh.map((directive) => `<article class="directive"><b>${escapeHtml(directive.title)}</b><p>${escapeHtml(directive.text)}</p></article>`).join('')}<p class="directive-note">어제 통하던 게시가 오늘은 반려될 수 있습니다. 백과사전 규정 항목에도 실렸습니다.</p></section>` : ''}
      <div class="document-actions"><button class="seal-button" type="button" data-action="open-counter">창구 열기</button></div>
    </section></main>`;
    this.onClick('open-counter', () => { this.reported = [...this.reported, ...this.pending]; this.pending = []; this.phase = 'intake'; this.render(); });
    this.focus('[data-action="open-counter"]');
  }
  private renderSummary(): void {
    const results = this.reported.map((item) => item.result);
    const totalReward = results.reduce((sum, result) => sum + result.reward, 0); const deaths = results.filter((result) => result.outcome === 'death').length; const successful = results.filter((result) => result.outcome === 'complete' || result.outcome === 'success').length;
    this.root.innerHTML = `<main class="summary-screen safe-frame"><section class="summary-paper"><p class="eyebrow">SHIFT CLOSED</p><h1>오늘의 접수 결산</h1><div class="summary-numbers"><article><b>${totalReward}</b><span>획득 은화</span></article><article><b>${successful}</b><span>성공 의뢰</span></article><article><b>${deaths}</b><span>사망자</span></article></div><ol>${this.reported.map((item) => `<li><span>${escapeHtml(item.clientName)}</span><b>${outcomeCopy(item.result.outcome).title}</b><small>정보 ${item.result.completeness} · 준비 ${item.result.preparation}</small></li>`).join('')}</ol><p class="summary-verdict">${deaths > 0 ? '서류의 빈칸은 전장에서 피로 채워졌습니다.' : successful === CASES.length ? '정확한 질문이 모두를 집으로 돌려보냈습니다.' : '살아 돌아온 이들이 다음 접수를 기다립니다.'}</p><button class="seal-button" type="button" data-action="restart">새 근무 시작</button></section></main>`;
    this.onClick('restart', () => { this.caseIndex = 0; this.pending = []; this.reported = []; this.resetCase(); this.phase = 'briefing'; this.render(); });
  }

  private resetCase(): void { this.session = createSession(this.caseData); this.draft = ''; this.error = ''; this.overlay = undefined; this.bookPage = 0; this.bookTag = '전체'; this.selectedClaimId = undefined; this.selectedKnowledgeId = undefined; this.comparison = undefined; this.sealedSheet = undefined; this.applications = []; this.rejections = []; }
  private header(stage: string): string { return `<header class="shift-header"><div><p class="eyebrow">HELP WANTED</p><h1>길드 접수 창구</h1></div><div class="shift-progress"><span>${escapeHtml(stage)} · <i class="agent-status agent-status--${this.agent.mode}">${this.agent.mode === 'remote' ? '실시간 AI' : '규칙 폴백'}</i></span><b>${this.day}일차 · 오늘 ${(this.caseIndex % CASES_PER_DAY) + 1} / ${CASES_PER_DAY}</b>${this.agent.mode === 'remote' ? '' : '<small class="agent-notice">AI 연결에 실패해 규칙 폴백으로 진행합니다.</small>'}</div></header>`; }
  private focus(selector: string): void { window.setTimeout(() => this.root.querySelector<HTMLElement>(selector)?.focus(), 0); }
  private onClick(action: string, handler: () => void): void { this.root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.addEventListener('click', handler); }
}

function dialogueHtml(turn: IntakeSession['turns'][number], clientName: string): string { return `<article class="dialogue dialogue--${turn.speaker}"><b>${turn.speaker === 'client' ? escapeHtml(clientName) : turn.speaker === 'player' ? '접수원' : '시스템'}</b><p>${escapeHtml(turn.text)}</p></article>`; }
function escapeHtml(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function stringValue(value: FormDataEntryValue | null): string { return typeof value === 'string' ? value : ''; }
function riskValue(value: FormDataEntryValue | null): RiskGrade { return value === 'C' || value === 'B' || value === 'A' || value === 'S' ? value : 'D'; }
function emotionLabel(value: IntakeSession['emotion']): string { return { calm: '평정', uneasy: '동요', guarded: '경계', angry: '분노' }[value]; }
function outcomeCopy(value: DispatchResult['outcome']): { title: string; body: string } { return {
  complete: { title: '완전 성공', body: '파티는 목표를 완수하고 아무도 다치지 않은 채 돌아왔습니다.' }, success: { title: '성공', body: '예상 밖의 저항이 있었지만 의뢰는 완수했습니다.' }, injured: { title: '부상 귀환', body: '의뢰는 일부 달성했지만 모험가들이 대가를 치렀습니다.' }, failed: { title: '파견 실패', body: '준비와 정보가 부족해 파티가 임무를 포기하고 돌아왔습니다.' }, death: { title: '사망 보고', body: '잘못된 의뢰서가 파티를 돌아올 수 없는 위험으로 보냈습니다.' }, rejected: { title: '접수 거절', body: '파견은 이루어지지 않았습니다. 거절 또한 접수원의 판단입니다.' }, unassigned: { title: '미인계 마감', body: '게시는 했지만 어느 파티에도 인계하지 않아 의뢰는 그대로 남았습니다.' },
}[value]; }
