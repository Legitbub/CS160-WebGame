import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import { PlayerCharacter } from "../PlayerCharacter";
import { TILE_HEIGHT, TILE_WIDTH, gridToScreen } from "../bank_level/GridConversion";

export class Battle_in_Bank extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    gameText: Phaser.GameObjects.Text;
    private player!: PlayerCharacter;

    constructor() {
        super("Battle_in_Bank");
    }

    preload() {
        this.load.image("floors", "/scene_tilemaps/Bank_Isometric_Tileset/Floors.png");
        this.load.image("walls", "/scene_tilemaps/Bank_Isometric_Tileset/Walls.png");
        this.load.tilemapTiledJSON("bank_battle_map", "/assets/bank_level.json");
    }

    create() {
        this.camera = this.cameras.main;
        this.camera.roundPixels = true;

        const tilemap = this.make.tilemap({key: "bank_battle_map"});
        const mapConverted = gridToScreen(tilemap.width / 2, tilemap.height / 2);
        this.camera.centerOn(mapConverted.x, mapConverted.y);
        this.camera.setZoom(2.5);

        const tileset1 = tilemap.addTilesetImage("Iso Floors", "floors")!;

        const floorLayer = tilemap.createLayer("Tile Layer 1", tileset1);

        EventBus.emit('current-scene-ready', this);
    }

    update() {

    }

    changeScene() {

    }
}