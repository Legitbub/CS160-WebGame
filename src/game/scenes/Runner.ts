import { Scene } from "phaser";
import { EventBus } from "../EventBus";

export class Runner extends Scene {
    constructor() {
        super("Runner");
    }

    preload() {
        this.load.image(
            "cityTiles",
            "/scene_tilemaps/Simple_City_Tileset/SIMPLE CITY 32X32.png"
        );

        this.load.spritesheet(
            "cityTilesSheet",
            "/scene_tilemaps/Simple_City_Tileset/SIMPLE CITY 32X32.png",
            {
                frameWidth: 32,
                frameHeight: 32
            }
        );

        this.load.tilemapTiledJSON(
            "runnerLevel",
            "/assets/runner_level.json"
        );
    }

    create() {
        const map = this.make.tilemap({
            key: "runnerLevel"
        });

        const tileset = map.addTilesetImage(
            "SIMPLE CITY 32X32",
            "cityTiles"
        );

        if (!tileset) {
            throw new Error(
                "Could not load the SIMPLE CITY 32X32 tileset."
            );
        }

        // Render the visual tile layers
        map.createLayer("Background", tileset, 0, 0);
        map.createLayer("Road", tileset, 0, 0);
        map.createLayer("Buildings", tileset, 0, 0);
        map.createLayer("Scenery", tileset, 0, 0);

        // Load cars from your object layer named RunnerObject
        const cars = map.createFromObjects("RunnerObject", {
            key: "cityTilesSheet"
        });

        console.log("Cars loaded:", cars.length);

        // Find the player spawn point
        const spawnLayer = map.getObjectLayer("PlayerSpawn");

        const spawn = spawnLayer?.objects.find(
            (object) =>
                object.name === "playerStart" ||
                object.type === "playerSpawn"
        );

        const playerX = spawn?.x ?? 448;
        const playerY = spawn?.y ?? 500;

        // Create the player
        const player = this.physics.add.sprite(
            playerX,
            playerY,
            "player_stationary",
            0
        );

        player.setCollideWorldBounds(true);
        player.setDepth(20);

        // Set map bounds
        this.cameras.main.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels
        );

        this.physics.world.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels
        );

        // Zoom and follow the player
        this.cameras.main.setZoom(2);
        this.cameras.main.startFollow(player, true);

        EventBus.emit("current-scene-ready", this);
    }
}