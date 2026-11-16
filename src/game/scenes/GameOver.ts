import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameOverText : Phaser.GameObjects.Text;

    constructor ()
    {
        super('GameOver');
    }

    create ()
    {
        this.camera = this.cameras.main
        const {width, height} = this.scale;

        this.background = this.add.image(width / 2, height / 2, "title").setOrigin(0.5);

        this.input.once('pointerdown', () => this.changeScene());
        this.input.keyboard?.once('keydown', () => this.changeScene());
        
        EventBus.emit('current-scene-ready', this);
    }

    changeScene ()
    {
        this.scene.start('MainMenu');
    }
}
