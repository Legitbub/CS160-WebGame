import { GameObjects, Scene, Types, Input } from 'phaser';
import { CutscenePayload, CutsceneSlide } from './Cutscene';
import { Preloader } from './Preloader';
import { EventBus } from '../EventBus';

export class MainMenu extends Scene
{
    private menuButtons: string[] = ["New Game", "Settings"];
    private menuText: GameObjects.Text[] = [];
    private selected: number = 0;
    private pointer!: GameObjects.Text;
    private arrows!: Types.Input.Keyboard.CursorKeys;
    private enterKey!: Input.Keyboard.Key;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        const {width, height} = this.scale;

        this.cameras.main.setBackgroundColor(0x0f141d);

        // Title
        const title = this.add.image(width / 2, height / 2, "title").setOrigin(0.5);
        const scalex = width / title.width;
        const scaley = width / title.width;
        const scaled = Math.max(scalex, scaley)
        title.setScale(scaled);

        // 1. Smooth Floating / Bobbing
        this.tweens.add({
            targets: title,
            y: title.y - 12,               // Move up slightly
            duration: 2000,                // 2 seconds
            ease: 'Sine.easeInOut',
            yoyo: true,                    // Return down
            repeat: -1                     // Loop forever
        });

        // Subtitle

        // Option pointer
        this.pointer = this.add.text(0, 0, '▶', {
            fontFamily: 'Courier New, monospace',
            fontSize: '24px',
            color: '#45b154'
        }).setOrigin(1, 0.5);

        // Create menu buttons
        const startX = width * 0.2;
        const spacing = 800;
        this.menuButtons.forEach((label, index) => {
            const itemText = this.add.text(startX + (index * spacing), height * 0.9, label, {
                fontFamily: 'Courier New, monospace',
                fontSize: '26px',
                color: '#ecf0f1'
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        
            // Mouse hover & click support
            itemText.on('pointerover', () => {
                this.selected = index;
                this.updateMenuHighlight();
            });

            itemText.on('pointerdown', () => {
                this.confirmSelection();
            });

            this.menuText.push(itemText);
        });

        // Arrow key controls
        if (this.input.keyboard) {
            this.arrows = this.input.keyboard.createCursorKeys();
            this.enterKey = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ENTER);
        }
    
        this.updateMenuHighlight();
        this.preloadIntro();

        EventBus.emit('current-scene-ready', this);
    }

    // The intro art is large, so download it while the title is already on screen.
    private preloadIntro() {
        if (this.textures.exists('intro_slide')) return;
        this.load.image('intro_slide', 'assets/cutscene_slides/intro slide.jpg');
        this.load.start();
    }
    
    // This will activate once the user starts selecting a button
    update () {
        if (!this.input.keyboard) return;

        // Navigate Up
        if (Input.Keyboard.JustDown(this.arrows.up) || Input.Keyboard.JustDown(this.arrows.left)) {
            this.selected = (this.selected - 1 + this.menuButtons.length) % this.menuButtons.length;
            this.updateMenuHighlight();
        }

        // Navigate Down
        if (Input.Keyboard.JustDown(this.arrows.down) || Input.Keyboard.JustDown(this.arrows.right)) {
            this.selected = (this.selected + 1) % this.menuButtons.length;
            this.updateMenuHighlight();
        }

        // Confirm Selection
        if (Input.Keyboard.JustDown(this.enterKey)) {
            this.confirmSelection();
        }
    }

    private updateMenuHighlight () {
        this.menuText.forEach((buttonText, index) => {
            const chosen = (index === this.selected);
            buttonText.setColor(chosen ? '#f39c12' : '#ecf0f1');
            buttonText.setScale(chosen ? 1.08 : 1.0);
            if (chosen) {
                // Position the '>' indicator to the left of the active text
                this.pointer.setPosition(buttonText.x - (buttonText.width / 2) - 25, buttonText.y);
            }
        });
    }

    private confirmSelection() {
        const chosen = this.menuButtons[this.selected];
        if (chosen === "New Game") {
            const introSetup: CutscenePayload = {
                slides: [
                    {
                        textureKey: "intro_slide",
                        text: "Hi sweetie, it's Mom! I am so excited to visit you! How is the new job?",
                        textColor: '#ffffff',
                        // Ken Burns arcade zoom/pan: subtle punch-in toward mom's thought bubble
                        zoom: 1.15,
                        panX: -20,
                        panY: 10,
                        duration: 5000,
                        // sfxKey: 'phone_ring',
                        // // bgmKey: 'intro_bgm'
                    },
                    {
                        textureKey: "intro_slide",
                        text: "Uh yeah...it's great Mom, haha...",
                        textColor: '#ffffff',
                        zoom: 1,
                        panX: 0,
                        panY: 0,
                        duration: 1000,
                        // sfxKey: 'phone_ring', 
                        // bgmKey: 'intro_bgm'
                    },
                    {
                        textureKey: "intro_slide",
                        text: "Ok, can't wait to see you tonight! Goodbye sweetie!",
                        textColor: '#ffffff',
                        zoom: 1,
                        panX: 0,
                        panY: 0,
                        duration: 5000,
                        // sfxKey: 'phone_ring', 
                        // bgmKey: 'intro_bgm'
                    }
                ],
                nextSceneKey: "Game",
                nextSceneData: {}
            }
            this.scene.start("Cutscene", introSetup);
        } else if (chosen === "Settings") {

        }
    }
}
