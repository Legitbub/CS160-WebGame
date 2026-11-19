import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import { PlayerCharacter } from "../PlayerCharacter";
import { CONSTANTS } from "../utilities/Constants"
import { PlayerSetupOptions, PlayerSpawn } from "../utilities/PlayerSpawn";
import { DoorDetails, makeDoors } from "../utilities/DoorSpawn";
import { CITY_DOOR_CUTSCENES } from "../utilities/SlideDeck";
import { showTextBox } from "../utilities/TextBox";

export class City extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    private player!: PlayerCharacter;
    private objectLayer!: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
    private spawnAt?: {x: number, y: number};
    private doors: DoorDetails[] = [];

    constructor ()
    {
        super('City');
    }

    init(data: {spawnAt?: {x: number, y: number}}) {
        this.spawnAt = data?.spawnAt;
    }

    create ()
    {
        const bankCompleted = Boolean(this.registry.get("bankCompleted"));
        const pizzaCompleted = Boolean(this.registry.get("pizzaCompleted"));
        const runnerCompleted = Boolean(this.registry.get("runnerCompleted"));

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
        if (runnerCompleted) {
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

        if (bankCompleted && pizzaCompleted && runnerCompleted && !this.registry.get("hasSeenAllCompletedMessage")) {
            this.registry.set("hasSeenAllCompletedMessage", true);
            this.camera.centerOn(this.player.x, this.player.y);
            this.camera.preRender();
            showTextBox({
                scene: this,
                player: this.player,
                pages: [
                    "Man, that was a lot of hard work!",
                    "No luck finding a long term job. Guess I should head home..."
                ],
                position: "center"
            });
        }

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
