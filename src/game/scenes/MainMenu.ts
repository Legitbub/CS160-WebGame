import { GameObjects, Scene, Types, Input } from 'phaser';

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
        this.add.text(width / 2, height * 0.2, "Get a Job!", {
            fontFamily: 'Bangers', fontSize: 70, color: '#f4d03f', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(width / 2, height * 0.33, 'A Tactical Job Search Adventure', {
            fontFamily: 'Courier New, monospace',
            fontSize: '20px',
            color: '#95a5a6'
        }).setOrigin(0.5);

        // Option pointer
        this.pointer = this.add.text(0, 0, '▶', {
            fontFamily: 'Courier New, monospace',
            fontSize: '24px',
            color: '#45b154'
        }).setOrigin(1, 0.5);

        // Create menu buttons
        const startY = height * 0.6;
        const spacing = 50;
        this.menuButtons.forEach((label, index) => {
            const itemText = this.add.text(width / 2, startY + (index * spacing), label, {
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

        EventBus.emit('current-scene-ready', this);
    }
    
    // This will activate once the user starts selecting a button
    update () {
        if (!this.input.keyboard) return;

        // Navigate Up
        if (Input.Keyboard.JustDown(this.arrows.up)) {
            this.selected = (this.selected - 1 + this.menuButtons.length) % this.menuButtons.length;
            this.updateMenuHighlight();
        }

        // Navigate Down
        if (Input.Keyboard.JustDown(this.arrows.down)) {
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
            this.scene.start("Game");
        } else if (chosen === "Settings") {

        }
    }
}
