import * as Phaser from "phaser";

/**
 * Safely retrieves an active Web Audio API AudioContext from a Phaser Scene.
 * Returns null if the browser or test environment is running with audio disabled.
 */
function getAudioContext(scene: Phaser.Scene): AudioContext | null {
    const soundManager = scene.sound as Phaser.Sound.WebAudioSoundManager;
    if (!soundManager || !("context" in soundManager) || !soundManager.context) {
        return null;
    }

    const ctx = soundManager.context;
    if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
    }
    return ctx;
}

// Cooldown tracker so holding an arrow key against a wall doesn't spam the bump sound every frame
let lastWallBumpTime = 0;

/**
 * Cartoony "pew pew!" gunshot sound (two quick high-to-low frequency sweeps).
 */
export function playPewPew(scene: Phaser.Scene): void {
    const ctx = getAudioContext(scene);
    if (!ctx) return;

    const now = ctx.currentTime;

    // Two quick "pew" sweeps spaced 90ms apart
    [0, 0.09].forEach((offset) => {
        const start = now + offset;
        const duration = 0.08;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1100, start);
        osc.frequency.exponentialRampToValueAtTime(180, start + duration);

        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + duration);
    });
}

/**
 * Low, punchy "thud" sound when bumping into a wall or obstacle.
 * Uses a 500ms cooldown (matching classic Pokémon wall-bump cadence) and a louder square/triangle blend
 * so it cuts through clearly on all speakers without playing too frequently.
 */
export function playWallBump(scene: Phaser.Scene): void {
    const ctx = getAudioContext(scene);
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - lastWallBumpTime < 500) return;
    lastWallBumpTime = nowMs;

    const now = ctx.currentTime;
    const duration = 0.11;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Square wave through a low-pass filter gives the classic Game Boy "thud" warmth and volume
    osc.type = "square";
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(380, now);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
}

/**
 * Punchy melee hit / damage impact sound (low-end thud layered with a short noise crunch).
 */
export function playHitSound(scene: Phaser.Scene): void {
    const ctx = getAudioContext(scene);
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.14;

    // 1. Low-frequency impact punch
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + duration);

    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);

    // 2. Short filtered white-noise burst for the "smack" texture
    const bufferSize = Math.floor(ctx.sampleRate * 0.07);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(900, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.07);
}

/**
 * Bright ascending RPG chime for healing a unit.
 */
export function playHealSound(scene: Phaser.Scene): void {
    const ctx = getAudioContext(scene);
    if (!ctx) return;

    const now = ctx.currentTime;
    // Ascending C major / C6 arpeggio (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const stepTime = 0.065;

    notes.forEach((freq, idx) => {
        const start = now + idx * stepTime;
        const duration = 0.16;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.22, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + duration);
    });
}

/**
 * Upbeat "Order Up!" chime when completing a pizza order successfully.
 */
export function playPizzaSuccess(scene: Phaser.Scene): void {
    const ctx = getAudioContext(scene);
    if (!ctx) return;

    const now = ctx.currentTime;
    // Cheerful triad fanfare: G5 -> B5 -> D6
    const notes = [
        { freq: 783.99, delay: 0, duration: 0.09 },
        { freq: 987.77, delay: 0.08, duration: 0.09 },
        { freq: 1174.66, delay: 0.16, duration: 0.25 }
    ];

    notes.forEach(({ freq, delay, duration }) => {
        const start = now + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.28, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + duration);
    });
}

/**
 * Descending "womp-womp" buzzer when a pizza order fails or times out.
 */
export function playPizzaFailure(scene: Phaser.Scene): void {
    const ctx = getAudioContext(scene);
    if (!ctx) return;

    const now = ctx.currentTime;
    // Two descending low sawtooth tones
    const tones = [
        { startFreq: 260, endFreq: 210, delay: 0, duration: 0.16 },
        { startFreq: 200, endFreq: 130, delay: 0.17, duration: 0.3 }
    ];

    tones.forEach(({ startFreq, endFreq, delay, duration }) => {
        const start = now + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(startFreq, start);
        osc.frequency.linearRampToValueAtTime(endFreq, start + duration);

        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + duration);
    });
}

/**
 * Heavy, crunchy 2-part "CH-CHK!" door sound:
 * Balanced between crisp mechanical crunch and warm low-mid door weight,
 * with a controlled volume and rounded top end so it doesn't sound like a sharp slap.
 */
export function playDoorSound(scene: Phaser.Scene): void {
    const ctx = getAudioContext(scene);
    if (!ctx) return;

    const now = ctx.currentTime;

    const playStroke = (
        startTime: number,
        duration: number,
        peakFreqStart: number,
        peakFreqEnd: number,
        bodyStartFreq: number,
        bodyEndFreq: number,
        volume: number
    ) => {
        // 1. Mid-range latch transient (lowered from 3200Hz to 1350Hz so it thuds instead of slapping)
        const snapDur = 0.038;
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();

        snapOsc.type = "triangle";
        snapOsc.frequency.setValueAtTime(1350, startTime);
        snapOsc.frequency.exponentialRampToValueAtTime(210, startTime + snapDur);

        snapGain.gain.setValueAtTime(volume * 0.4, startTime);
        snapGain.gain.exponentialRampToValueAtTime(0.001, startTime + snapDur);

        snapOsc.connect(snapGain);
        snapGain.connect(ctx.destination);

        snapOsc.start(startTime);
        snapOsc.stop(startTime + snapDur);

        // 2. Heavy grainy "CH" crunch with a warm 2400Hz low-pass ceiling to take off the harsh slap
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        const holdSamples = 6; // Medium step keeps the gravelly crunch while softening piercing highs
        let currentSample = 0;
        for (let i = 0; i < bufferSize; i++) {
            if (i % holdSamples === 0) {
                const raw = Math.random() * 2 - 1;
                currentSample = Math.sign(raw) * Math.pow(Math.abs(raw), 0.65);
            }
            const t = i / bufferSize;
            // Very brief 3% attack edge prevents a sharp pop/slap while staying immediate
            const attack = t < 0.03 ? t / 0.03 : 1;
            const grain = 0.78 + 0.22 * Math.sin(i * 0.16);
            const env = attack * Math.pow(1 - t, 1.25);
            output[i] = currentSample * env * grain;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        // Keep low-mids down to 180Hz for heavier door weight
        const highpass = ctx.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.setValueAtTime(180, startTime);

        // Roll off harsh frequencies above 2400Hz so it sounds like a heavy door mechanism
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(2400, startTime);

        // Moderate peaking sweep for the "CH-CHK" vocal movement
        const crunchBoost = ctx.createBiquadFilter();
        crunchBoost.type = "peaking";
        crunchBoost.Q.setValueAtTime(1.4, startTime);
        crunchBoost.gain.setValueAtTime(4.5, startTime);
        crunchBoost.frequency.setValueAtTime(peakFreqStart, startTime);
        crunchBoost.frequency.exponentialRampToValueAtTime(peakFreqEnd, startTime + duration);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(volume, startTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.008, startTime + duration);

        noise.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(crunchBoost);
        crunchBoost.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        noise.start(startTime);
        noise.stop(startTime + duration);

        // 3. Deeper, heavier door body underneath
        const osc = ctx.createOscillator();
        const oscFilter = ctx.createBiquadFilter();
        const oscGain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(bodyStartFreq, startTime);
        osc.frequency.exponentialRampToValueAtTime(bodyEndFreq, startTime + duration);

        oscFilter.type = "lowpass";
        oscFilter.frequency.setValueAtTime(1350, startTime);

        oscGain.gain.setValueAtTime(volume * 0.7, startTime);
        oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(oscFilter);
        oscFilter.connect(oscGain);
        oscGain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
    };

    // Stroke 1 ("CH-" at 0ms, 180ms long): Heavier, quieter mechanical unlatch
    playStroke(now, 0.18, 1100, 2100, 145, 215, 0.42);

    // Stroke 2 ("-CHK!" at 340ms, 220ms long): Distinct pause before the deep downward door lock
    playStroke(now + 0.34, 0.22, 1950, 780, 185, 55, 0.52);
}
