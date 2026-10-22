import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import { PlayerCharacter } from "../PlayerCharacter";
import { CONSTANTS } from "../Constants"

export class City extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    gameText: Phaser.GameObjects.Text;
    private player!: PlayerCharacter;
    private objectLayer!: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;

    constructor ()
    {
        super('City');
    }

    preload() 
    {
        // Skip files the menu already downloaded.
        if (!this.textures.exists('city')) {
            this.load.image('city', '/scene_tilemaps/Simple_City_Tileset/SIMPLE CITY 32X32.png');
        }
        if (!this.cache.tilemap.exists('city_map')) {
            this.load.tilemapTiledJSON('city_map', '/assets/city_scene.json');
        }
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.roundPixels = true;

        // Create map and tileset
        const tilemap = this.make.tilemap({key: "city_map"});
        const tileset = tilemap.addTilesetImage("Simple City", "city", 32, 32, 0, 0);
        if (!tileset) {
            console.log("failed to create tileset");
            return;
        }
        const floorLayer = tilemap.createLayer('Ground', tileset, 0, 0);
        this.objectLayer = tilemap.createLayer('Object Tiles', tileset, 0, 0)!;

        // Placeholder texture for the player sprite
        if (!this.textures.exists('player_box')) {
            const gfx = this.make.graphics({ x: 0, y: 0 });
            gfx.fillStyle(0x3b82f6, 1); // Blue box
            gfx.fillRect(0, 0, 32, 32);
            gfx.generateTexture('player_box', 32, 32);
            gfx.destroy();
        }

        const playerX = Math.floor(tilemap.width / 2) * CONSTANTS.TILE_SIZE + (CONSTANTS.TILE_SIZE / 2);
        const playerY = Math.floor(tilemap.height / 2) * CONSTANTS.TILE_SIZE + (CONSTANTS.TILE_SIZE/ 2);
        this.player = new PlayerCharacter(this, playerX, playerY, "player_box");

        // Set collisions so character bumps into walls
        this.objectLayer.setCollisionByExclusion([-1, 0]);
        this.player.setCollisionLayer(this.objectLayer);
        this.physics.world.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);

        this.camera.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);
        this.camera.setZoom(3);
        this.camera.startFollow(this.player, true);

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