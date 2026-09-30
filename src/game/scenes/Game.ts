import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { PlayerCharacter } from '../PlayerCharacter';
import { CONSTANTS } from '../Constants';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    gameText: Phaser.GameObjects.Text;
    private player!: PlayerCharacter;
    private wallsLayer!: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;

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

        const playerX = Math.floor(tilemap.width / 2) * CONSTANTS.TILE_SIZE + (CONSTANTS.TILE_SIZE / 2);
        const playerY = Math.floor(tilemap.height / 2) * CONSTANTS.TILE_SIZE + (CONSTANTS.TILE_SIZE/ 2);
        this.player = new PlayerCharacter(this, playerX, playerX, "player_box");

        // Set collisions so character bumps into walls
        this.wallsLayer.setCollisionByExclusion([-1, 0]);
        
        this.physics.world.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);

        this.camera.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);
        this.camera.setZoom(3);
        this.camera.startFollow(this.player, true, 0.1, 0.1);

        EventBus.emit('current-scene-ready', this);
    }

    // Handle player input for movement
    update() {
        this.player.update();
    }

    changeScene ()
    {
        this.scene.start('GameOver');
    }
}
