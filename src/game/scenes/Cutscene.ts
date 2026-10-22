import Phaser from 'phaser';
import { Scene, Textures } from 'phaser';

export interface CutsceneSlide {
    // Asset keys loaded during preload or boot
    textureKey: string;
    animKey?: string;

    // Story dialogue
    text: string;
    textColor?: string; // e.g. '#ffff00', defaults to '#f0f0f0'

    // SF2 style camera parameters
    zoom?: number;
    panX?: number;       // relative pixel offset to drift
    panY?: number;
    duration?: number;   // tween duration in ms (defaults to 4000)

    // Audio cues
    sfxKey?: string;
    bgmKey?: string;
}

export interface CutscenePayload {
    slides: CutsceneSlide[];
    nextSceneKey: string;
    nextSceneData?: Record<string, unknown>;
}

export class Cutscene extends Scene {
    private slides: CutsceneSlide[] = [];
    private nextSceneKey: string = '';
    private nextSceneData?: Record<string, unknown>;

    private currentIndex: number = -1;
    private isTyping: boolean = false;
    private typewriterTimer?: Phaser.Time.TimerEvent;
    private fullCurrentText: string = '';

    // Display elements
    private currentArt?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
    private dialogueText!: Phaser.GameObjects.Text;
    private promptIndicator!: Phaser.GameObjects.Text;

    // Frame window layout
    private frameX: number = 0;
    private frameY: number = 0;
    private frameW: number = 0;
    private frameH: number = 0;

    constructor() {
        super({ key: 'Cutscene' });
    }

    init(data: CutscenePayload) {
        this.slides = data.slides || [];
        this.nextSceneKey = data.nextSceneKey;
        this.nextSceneData = data.nextSceneData;
        this.currentIndex = -1;
        this.isTyping = false;
    }

    preload() {
        if (!this.textures.exists('intro_slide')) {
            this.load.image('intro_slide', 'assets/cutscene_slides/intro slide.jpg');
        }
    }

    create() {
        const { width, height } = this.scale;

        this.cameras.main.setBackgroundColor('#5d0cf1');

        this.frameX = width * 0.5;
        this.frameY = height * 0.38;
        this.frameW = Math.min(width * 0.85, 896);
        this.frameH = Math.min(height * 0.85, 432);

        // Chunky arcade double-borders
        this.add.rectangle(this.frameX, this.frameY, this.frameW + 8, this.frameH + 8, 0x444455);
        this.add.rectangle(this.frameX, this.frameY, this.frameW + 4, this.frameH + 4, 0xffffff);
        this.add.rectangle(this.frameX, this.frameY, this.frameW, this.frameH, 0x050505);

        // Dialogue text below the art window
        this.dialogueText = this.add.text(width * 0.5, height * 0.88, '', {
            fontSize: '18px',
            fontFamily: '"Press Start 2P", monospace',
            color: '#ffff00',
            align: 'center',
            lineSpacing: 8,
            wordWrap: { width: width - 80 }
        }).setOrigin(0.5);

        // Blinking prompt indicator
        this.promptIndicator = this.add.text(width * 0.5, height - 30, '▼', {
            fontSize: '14px',
            color: '#ffffff'
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({
            targets: this.promptIndicator,
            alpha: 1,
            duration: 350,
            yoyo: true,
            repeat: -1
        });

        // Advance events
        this.input.keyboard?.on('keydown-SPACE', () => this.handleAdvance());
        this.input.keyboard?.on('keydown-ENTER', () => this.handleAdvance());
        this.input.on('pointerdown', () => this.handleAdvance());

        // Launch first slide
        this.handleAdvance();
    }

    private handleAdvance(): void {
        if (this.isTyping) {
            this.completeTyping();
            return;
        }

        this.currentIndex++;

        if (this.currentIndex >= this.slides.length) {
            this.exitCutscene();
            return;
        }

        this.renderSlide(this.slides[this.currentIndex]);
    }

    private renderSlide(slide: CutsceneSlide): void {
        // Teardown previous artwork & tweens
        if (this.currentArt) {
            this.tweens.killTweensOf(this.currentArt);
            this.currentArt.destroy();
        }

        // Instantiation: Animated Sprite vs Static Texture
        if (slide.animKey) {
            const sprite = this.add.sprite(this.frameX, this.frameY, slide.textureKey);
            sprite.play(slide.animKey);
            this.currentArt = sprite;
        } else {
            this.currentArt = this.add.image(this.frameX, this.frameY, slide.textureKey);
        }

        // Enforce nearest-neighbor pixel rendering & fit
        this.currentArt.texture.setFilter(Textures.FilterMode.NEAREST);
        this.currentArt.setDisplaySize(this.frameW, this.frameH);

        // Ken Burns camera drifts
        if (slide.zoom || slide.panX || slide.panY) {
            const targetScaleX = (this.frameW / this.currentArt.width) * (slide.zoom ?? 1);
            const targetScaleY = (this.frameH / this.currentArt.height) * (slide.zoom ?? 1);

            this.tweens.add({
                targets: this.currentArt,
                scaleX: targetScaleX,
                scaleY: targetScaleY,
                x: this.frameX + (slide.panX ?? 0),
                y: this.frameY + (slide.panY ?? 0),
                duration: slide.duration ?? 4000,
                ease: 'Quad.easeOut'
            });
        }

        // Optional audio cues
        if (slide.sfxKey) this.sound.play(slide.sfxKey);
        if (slide.bgmKey && !this.sound.get(slide.bgmKey)?.isPlaying) {
            this.sound.play(slide.bgmKey, { loop: true });
        }

        // Dialogue typing
        if (slide.textColor) this.dialogueText.setColor(slide.textColor);
        this.startTypewriter(slide.text);
    }

    private startTypewriter(text: string): void {
        if (this.typewriterTimer) this.typewriterTimer.remove();

        this.fullCurrentText = text;
        this.dialogueText.setText('');
        this.isTyping = true;
        this.promptIndicator.setVisible(false);

        let charIdx = 0;
        this.typewriterTimer = this.time.addEvent({
            delay: 35,
            repeat: text.length - 1,
            callback: () => {
                this.dialogueText.text += text[charIdx];
                charIdx++;
                if (charIdx >= text.length) {
                    this.completeTyping();
                }
            }
        });
    }

    private completeTyping(): void {
        if (this.typewriterTimer) {
            this.typewriterTimer.remove();
            this.typewriterTimer = undefined;
        }
        this.dialogueText.setText(this.fullCurrentText);
        this.isTyping = false;
        this.promptIndicator.setVisible(true);
    }

    private exitCutscene(): void {
        this.input.keyboard?.removeAllListeners();
        this.input.removeAllListeners();

        this.cameras.main.fade(800, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start(this.nextSceneKey, this.nextSceneData);
        });
    }
}