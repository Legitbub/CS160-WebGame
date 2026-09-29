import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameText: Phaser.GameObjects.Text;
    private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    private arrows!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wallsLayer!: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
    private readonly TILE_SIZE = 32;
    private readonly MOVE_STEP_TIME = 250;
    private isMoving = false;

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
        const tileset = tilemap.addTilesetImage("Cottage_Tileset", "tiles", 32, 32, 0, 0);
        if (!tileset) return;

        const floorLayer = tilemap.createLayer('Tile Layer 1', tileset, 0, 0);
        this.wallsLayer = tilemap.createLayer('Walls', tileset, 0, 0)!;

        // Placeholder texture for the player sprite
        const gfx = this.make.graphics({ x: 0, y: 0 });
        gfx.fillStyle(0x3b82f6, 1); // Blue box
        gfx.fillRect(0, 0, 32, 32);
        gfx.generateTexture('player_box', 32, 32);
        gfx.destroy();

        const playerX = Math.floor(tilemap.width / 2) * this.TILE_SIZE + (this.TILE_SIZE / 2);
        const playerY = Math.floor(tilemap.height / 2) * this.TILE_SIZE + (this.TILE_SIZE / 2);
        this.player = this.physics.add.sprite(playerX, playerY, 'player_box');

        // Set collisions so character bumps into walls
        this.wallsLayer.setCollisionByExclusion([-1, 0]);
        this.player.setCollideWorldBounds(true);
        this.physics.world.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);

        this.camera.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);
        this.camera.setZoom(3);
        this.camera.startFollow(this.player, true, 0.1, 0.1);

        // Arrow key controls
        if (this.input.keyboard) {
            this.arrows = this.input.keyboard.createCursorKeys();
        }

        EventBus.emit('current-scene-ready', this);
    }

    // Handle player input for movement
    update() {
        if (!this.arrows || !this.player || this.isMoving) return;

        let moveX = 0;
        let moveY = 0;

        if (this.arrows.left.isDown) {
            moveX = -1;
        } else if (this.arrows.right.isDown) {
            moveX = 1;
        } else if (this.arrows.up.isDown) {
            moveY = -1;
        } else if (this.arrows.down.isDown) {
            moveY = 1
        }

        if (moveX !== 0 || moveY !== 0) {
            this.moveTile(moveX, moveY);
        }
    }

    private moveTile(moveX: number, moveY: number) {
        const currentTileX = Math.floor(this.player.x / this.TILE_SIZE);
        const currentTileY = Math.floor(this.player.y / this.TILE_SIZE);
        const nextTileX = currentTileX + moveX;
        const nextTileY = currentTileY + moveY;

        // Check for edge of screen
        if (nextTileX < 0 || nextTileX >= this.wallsLayer.tilemap.width ||
            nextTileY < 0 || nextTileY >= this.wallsLayer.tilemap.height)
        {
            return;
        }

        // Check if next tile is a wall
        const targetTile = this.wallsLayer.getTileAt(nextTileX, nextTileY);
        if (targetTile && targetTile.collides) {
            return;
        }

        // Perform movement tween
        this.isMoving = true;
        const targetPixelX = nextTileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const targetPixelY = nextTileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        this.tweens.add({
            targets: this.player,
            x: targetPixelX,
            y: targetPixelY,
            duration: this.MOVE_STEP_TIME,
            ease: 'Linear',
            onComplete: () => {
                this.isMoving = false;
            }
        });
    }

    changeScene ()
    {
        this.scene.start('GameOver');
    }
}
