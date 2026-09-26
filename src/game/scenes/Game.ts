import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameText: Phaser.GameObjects.Text;
    private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    private arrows!: Phaser.Types.Input.Keyboard.CursorKeys;
    private readonly SPEED = 160;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x00ff00);

        // Placeholder texture for the player sprite
        const gfx = this.make.graphics({ x: 0, y: 0 });
        gfx.fillStyle(0x3b82f6, 1); // Blue box
        gfx.fillRect(0, 0, 32, 32);
        gfx.generateTexture('player_box', 32, 32);
        gfx.destroy();

        this.player = this.physics.add.sprite(
            this.scale.width / 2,
            this.scale.height / 2,
            'player_box'
        );
        this.player.setCollideWorldBounds(true);

        // Arrow key controls
        if (this.input.keyboard) {
            this.arrows = this.input.keyboard.createCursorKeys();
        }

        EventBus.emit('current-scene-ready', this);
    }

    // Handle player input for movement
    update() {
        if (!this.arrows || !this.player) return;

        // Reset velocity every frame
        this.player.setVelocity(0);

        if (this.arrows.left.isDown) {
            this.player.setVelocityX(-this.SPEED);
        } else if (this.arrows.right.isDown) {
            this.player.setVelocityX(this.SPEED);
        } else if (this.arrows.up.isDown) {
            this.player.setVelocityY(-this.SPEED);
        } else if (this.arrows.down.isDown) {
            this.player.setVelocityY(this.SPEED);
        }
    }

    changeScene ()
    {
        this.scene.start('GameOver');
    }
}
