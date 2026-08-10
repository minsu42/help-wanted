/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from 'vitest';
import { GameAudio } from '../../../src/audio/GameAudio';

const storageKey = 'help-wanted.audio-muted';
afterEach(() => window.localStorage.removeItem(storageKey));

describe('GameAudio', () => {
  it('Web Audio API가 없어도 음소거 상태를 저장하고 복원한다', () => {
    const audio = new GameAudio();
    expect(audio.muted).toBe(false);
    audio.toggleMuted();
    expect(audio.muted).toBe(true);
    expect(window.localStorage.getItem(storageKey)).toBe('true');
    const restored = new GameAudio();
    expect(restored.muted).toBe(true);
    audio.destroy();
    restored.destroy();
  });
});
