import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import { PlayerCharacter } from "../PlayerCharacter";
import { CONSTANTS } from "../utilities/Constants";
import { PlayerSpawn } from "../utilities/PlayerSpawn";
import { DoorDetails, makeDoors } from "../utilities/DoorSpawn";

export class City extends Phaser.Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    gameText: Phaser.GameObjects.Text;
    
    private player!: PlayerCharacter;
    private objectLayer!: | Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
    private spawnAt?: { x: number; y: number; };
    private doors: DoorDetails[] = [];

    constructor() {
        super("City");
    }

    preload() {
        // Load city tileset
        this.load.image(
            "city",
            "/scene_tilemaps/Simple_City_Tileset/SIMPLE CITY 32X32.png"
        );

        // Load player house tileset
        this.load.image(
            "player_house",
            "/scene_tilemaps/Player_House_Tileset/House resized.png"
        );

        // Load city tilemap
        this.load.tilemapTiledJSON(
            "city_map",
            "/assets/city_scene.json"
        );
    }

    init(data: {
        spawnAt: {
            x: number;
            y: number;
        };
    }) {
        this.spawnAt = data.spawnAt;
    }

    create() {
        this.camera = this.cameras.main;
        this.camera.roundPixels = true;

        // Create the tilemap
        const tilemap = this.make.tilemap({
            key: "city_map",
        });

        // Add tilesets
        const tileset1 = tilemap.addTilesetImage(
            "Simple City",
            "city"
        )!;

        const tileset2 = tilemap.addTilesetImage(
            "Player House",
            "player_house"
        )!;

        // Create map layers
        tilemap.createLayer(
            "Ground",
            tileset1
        );

        tilemap.createLayer(
            "Buildings",
            [tileset1, tileset2]
        );

        this.objectLayer = tilemap.createLayer(
            "Object Tiles",
            tileset1
        )!;

        // Create the player
        this.player = PlayerSpawn({
            scene: this,
            map: tilemap,
            wallsLayer: this.objectLayer,
            spawnTile: this.spawnAt,
        });

        // Keep the camera inside the city map
        this.camera.setBounds(
            0,
            0,
            tilemap.widthInPixels,
            tilemap.heightInPixels
        );

        // Set the camera zoom
        this.camera.setZoom(3.5);

        // Follow the player without camera lag
        this.camera.startFollow(
            this.player,
            true,
            1,
            1
        );

        const visibleWorldWidth =
            this.scale.width / this.camera.zoom;

        const visibleWorldHeight =
            this.scale.height / this.camera.zoom;

        // Two tiles of padding around the player
        const cameraPadding =
            CONSTANTS.TILE_SIZE * 2;

        const deadzoneWidth = Math.max(
            CONSTANTS.TILE_SIZE,
            visibleWorldWidth - cameraPadding * 2
        );

        const deadzoneHeight = Math.max(
            CONSTANTS.TILE_SIZE,
            visibleWorldHeight - cameraPadding * 2
        );

        this.camera.setDeadzone(
            deadzoneWidth,
            deadzoneHeight
        );

        // Create doors
        this.doors = makeDoors({
            scene: this,
            tilemap: tilemap,
            player: this.player,
            layer: "Doors",
        });

        EventBus.emit(
            "current-scene-ready",
            this
        );
    }

    update() {
        this.player.update();
    }

    changeScene() {
        this.scene.start("GameOver");
    }
}