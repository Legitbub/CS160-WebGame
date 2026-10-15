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
    private spawnAt?: {x: number, y: number};
    private doors: DoorDetails[] = [];

    constructor ()
    {
        super('City');
    }

    preload() 
    {
        // Load tilemap (room layout) and tileset (building blocks)
        this.load.image('city', '/scene_tilemaps/Simple_City_Tileset/SIMPLE CITY 32X32.png');
        this.load.image('player_house', "/scene_tilemaps/Player_House_Tileset/House resized.png");
        this.load.tilemapTiledJSON('city_map', '/assets/city_scene.json');
    }

    init(data: {spawnAt: {x: number, y: number}}) {
        this.spawnAt = data.spawnAt;
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.roundPixels = true;

        // Create map and tileset
        const tilemap = this.make.tilemap({key: "city_map"});
        const tileset1 = tilemap.addTilesetImage("Simple City", "city")!;
        const tileset2 = tilemap.addTilesetImage("Player House", "player_house")!;

        const floorLayer = tilemap.createLayer('Ground', tileset1);
        const buildings = tilemap.createLayer("Buildings", tileset2);
        this.objectLayer = tilemap.createLayer('Object Tiles', tileset1)!;


        this.player = PlayerSpawn({
            scene: this,
            map: tilemap,
            wallsLayer: this.objectLayer,
            spawnTile: this.spawnAt
        });

        this.doors = makeDoors({
            scene: this,
            tilemap: tilemap,
            player: this.player,
            layer: "Doors"
        })

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