import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import { PlayerCharacter } from "../PlayerCharacter";
import { CONSTANTS } from "../utilities/Constants"
import { PlayerSetupOptions, PlayerSpawn } from "../utilities/PlayerSpawn";
import { DoorDetails, makeDoors } from "../utilities/DoorSpawn";

export class City extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    gameText: Phaser.GameObjects.Text;
    private player!: PlayerCharacter;
    private objectLayer!: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
    private doors: DoorDetails[] = [];

    constructor ()
    {
        super('City');
    }

    preload() 
    {
        // Load tilemap (room layout) and tileset (building blocks)
        this.load.image('city', '/scene_tilemaps/Simple_City_Tileset/SIMPLE CITY 32X32.png');
        this.load.tilemapTiledJSON('city_map', '/assets/city_scene.json');
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.roundPixels = true;

        // Create map and tileset
        const tilemap = this.make.tilemap({key: "city_map"});
        const tileset = tilemap.addTilesetImage("Simple City", "city", 32, 32, 0, 0)!;

        const floorLayer = tilemap.createLayer('Ground', tileset, 0, 0);
        this.objectLayer = tilemap.createLayer('Object Tiles', tileset, 0, 0)!;

        this.player = PlayerSpawn({
            scene: this,
            map: tilemap,
            wallsLayer: this.objectLayer
        });

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