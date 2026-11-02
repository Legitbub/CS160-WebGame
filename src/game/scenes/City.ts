import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import { PlayerCharacter } from "../PlayerCharacter";
import { CONSTANTS } from "../utilities/Constants"
import { PlayerSetupOptions, PlayerSpawn } from "../utilities/PlayerSpawn";
import { DoorDetails, makeDoors } from "../utilities/DoorSpawn";
import { CITY_DOOR_CUTSCENES, ENDING_CUTSCENE } from "../utilities/SlideDeck";

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
        this.load.image('urban_city', "/scene_tilemaps/Urban_City_Tileset/Urban City Tileset Basic 32x32 Dlou Saiyan.png");
        this.load.tilemapTiledJSON('city_map', '/assets/city_scene.json');
        this.load.image('outside_bank', '/assets/cutscene_slides/outside the bank.jpg');
        this.load.image('entering_bank', '/assets/cutscene_slides/entering the bank.jpg');
        this.load.image('outside_pizza', '/assets/cutscene_slides/outside the pizza place.jpg');
        this.load.image('entering_pizza', '/assets/cutscene_slides/entering the pizza place.jpg');
        this.load.image('getting_back_home', '/assets/cutscene_slides/getting back home.jpg');
        this.load.image('frustrated', '/assets/cutscene_slides/frustrated.jpg');
        this.load.image('inspiration', '/assets/cutscene_slides/inspiration.jpg');
        this.load.image('gamedeving', '/assets/cutscene_slides/gamedeving.jpg');
        this.load.image('mom_arrives', '/assets/cutscene_slides/mom arrives.jpg');
        this.load.image('celebrate', '/assets/cutscene_slides/celebrate.jpg');
        this.load.image('ending', '/assets/cutscene_slides/ending.jpg');
    }

    init(data: {spawnAt?: {x: number, y: number}}) {
        this.spawnAt = data?.spawnAt;
    }

    create ()
    {
        const bankCompleted = Boolean(this.registry.get("bankCompleted"));
        const pizzaCompleted = Boolean(this.registry.get("pizzaCompleted"));
        const drivingCompleted = Boolean(
            this.registry.get("drivingCompleted") || this.registry.get("runnerCompleted")
        );

        if (bankCompleted && pizzaCompleted && drivingCompleted) {
            this.registry.set("bankCompleted", false);
            this.registry.set("pizzaCompleted", false);
            this.registry.set("drivingCompleted", false);
            this.registry.set("runnerCompleted", false);

            this.scene.start("Cutscene", ENDING_CUTSCENE);
            return;
        }

        this.camera = this.cameras.main;
        this.camera.roundPixels = true;

        // Create map and tileset
        const tilemap = this.make.tilemap({key: "city_map"});
        const tileset1 = tilemap.addTilesetImage("Simple City", "city")!;
        const tileset2 = tilemap.addTilesetImage("Player House", "player_house")!;
        const tileset3 = tilemap.addTilesetImage("Urban City", "urban_city")!;

        const floorLayer = tilemap.createLayer('Ground', [tileset1, tileset3]);
        const buildings = tilemap.createLayer("Buildings", [tileset1, tileset2, tileset3]);
        this.objectLayer = tilemap.createLayer('Object Tiles', [tileset1, tileset3])!;


        this.player = PlayerSpawn({
            scene: this,
            map: tilemap,
            wallsLayer: this.objectLayer,
            spawnTile: this.spawnAt
        });

        const blockedDoors: Record<string, string | string[]> = {};
        if (bankCompleted) {
            blockedDoors.Battle_in_Bank = "You already beat the bank!";
        }
        if (pizzaCompleted) {
            blockedDoors.PizzaShop = "You already finished your shift at the pizza shop!";
        }
        if (drivingCompleted) {
            blockedDoors.Runner = "You already finished your delivery shift!";
        }

        this.doors = makeDoors({
            scene: this,
            tilemap: tilemap,
            player: this.player,
            layer: "Doors",
            cutscenes: CITY_DOOR_CUTSCENES,
            blockedDoors: blockedDoors
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
