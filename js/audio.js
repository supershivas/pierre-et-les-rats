/* La flûte de Pierre : un petit synthétiseur WebAudio (deux sinus, un souffle,
   un vibrato qui arrive après l'attaque). La mélodie tourne tant qu'il joue,
   un air en ré mineur, lent, un peu triste. */
const A4 = 440;
const freq = semi => A4 * 2 ** (semi / 12);
// [demi-tons depuis le la 440, durée en temps]
const AIR = [
  [5, 1], [8, 1], [12, 2], [10, 1], [8, 1], [7, 2],
  [5, 1], [7, 1], [8, 1], [10, 1], [8, 3], [-1, 1],
  [12, 1], [10, 1], [8, 1], [7, 1], [5, 2], [3, 1], [5, 1],
  [7, 1], [8, 1], [7, 1], [3, 1], [5, 3], [-1, 1],
].map(([s, d]) => [s < 0 ? null : s + 2 - 12, d]);
const BEAT = 0.3;

export function makeFlute() {
  let ctx = null, out = null, volume = 0.7;
  let index = 0, nextAt = 0, playing = false, onNote = null;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = volume * 0.35;
    out.connect(ctx.destination);
    return true;
  }

  function note(semi, dur, at) {
    const f = freq(semi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.9, at + 0.05);
    g.gain.linearRampToValueAtTime(0.65, at + 0.15);
    g.gain.setValueAtTime(0.65, at + dur * 0.85);
    g.gain.linearRampToValueAtTime(0, at + dur);
    g.connect(out);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = f;
    o2.type = 'triangle'; o2.frequency.value = f * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.08;
    // vibrato, qui ne vient qu'après l'attaque
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 5.2;
    depth.gain.setValueAtTime(0, at);
    depth.gain.linearRampToValueAtTime(f * 0.006, at + Math.min(0.35, dur));
    lfo.connect(depth); depth.connect(o1.frequency); depth.connect(o2.frequency);
    o1.connect(g); o2.connect(g2); g2.connect(g);
    // le souffle
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.04;
    const breath = ctx.createBufferSource(); breath.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2;
    breath.connect(bp); bp.connect(g);
    for (const n of [o1, o2, lfo, breath]) { n.start(at); n.stop(at + dur + 0.05); }
  }

  // Appelé à chaque image : programme les notes un peu à l'avance
  function tick() {
    if (!playing || !ctx) return;
    while (nextAt < ctx.currentTime + 0.15) {
      const [semi, beats] = AIR[index % AIR.length];
      const dur = beats * BEAT;
      if (semi !== null && volume > 0) note(semi, dur * 0.95, nextAt);
      if (semi !== null && onNote) {
        const delay = Math.max(0, (nextAt - ctx.currentTime) * 1000);
        setTimeout(() => onNote(semi), delay);
      }
      nextAt += dur;
      index++;
    }
  }

  return {
    start() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (!playing) { playing = true; nextAt = Math.max(ctx.currentTime + 0.02, nextAt); }
    },
    stop() { playing = false; },
    tick,
    setVolume(v) { volume = v; if (out) out.gain.value = v * 0.35; },
    set onNote(fn) { onNote = fn; },
    get playing() { return playing; },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  };
}
