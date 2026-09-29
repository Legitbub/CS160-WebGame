import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameText: Phaser.GameObjects.Text;
    private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    private arrows!: Phaser.Types.Input.Keyboard.CursorKeys;
    private readonly SPEED = 200;

    constructor ()
    {
        super('Game');
    }

    preload() 
    {
        // Load tilemap (room layout) and tileset (building blocks)
        this.load.image('tiles', '/scene_tilemaps/Cottage_Tileset/Cottage_Tileset.png');
        this.load.tilemapTiledJSON('tiles_map', '/assets/test.json');
    }
    
    create ()
    {
        this.camera = this.cameras.main;

        // Create map and tileset
        const tilemap = this.make.tilemap({key: "tiles_map"});
        const tileset = tilemap.addTilesetImage("Cottage", "tiles", 32, 32, 0, 0);
        if (!tileset) return;

        const floorLayer = tilemap.createLayer('Tile Layer 1', tileset, 0, 0);
        const wallsLayer = tilemap.createLayer('Bump', tileset, 0, 0);

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

        // Set collisions so character bumps into walls
        wallsLayer?.setCollisionByExclusion([-1]);
        this.player.setCollideWorldBounds(true);
        this.physics.world.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);
        
        if (wallsLayer) {
            this.physics.add.collider(this.player, wallsLayer);
        }

        this.camera.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);
        this.camera.setZoom(2);
        this.camera.startFollow(this.player, true, 0.1, 0.1);

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
