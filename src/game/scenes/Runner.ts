import { Scene } from "phaser";
import { EventBus } from "../EventBus";

export class Runner extends Scene {
    private player!: Phaser.Physics.Arcade.Sprite;

    private currentLane = 1;
    private isChangingLane = false;
    private gameEnded = false;

    private laneX = [352, 416, 480];

    constructor() {
        super("Runner");
    }

    preload() {
        this.load.image(
            "cityRunnerTiles",
            "/scene_tilemaps/Simple_City_Tileset/SIMPLE CITY 32X32.png"
        );

        this.load.spritesheet(
            "cityRunnerSheet",
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
        this.currentLane = 1;
        this.isChangingLane = false;
        this.gameEnded = false;

        const map = this.make.tilemap({
            key: "runnerLevel"
        });

        const tileset = map.addTilesetImage(
            "SIMPLE CITY 32X32",
            "cityRunnerTiles"
        );

        if (!tileset) {
            throw new Error(
                "Could not load the SIMPLE CITY 32X32 tileset."
            );
        }

        // Render map layers
        map.createLayer("Background", tileset, 0, 0);
        map.createLayer("Road", tileset, 0, 0);
        map.createLayer("Buildings", tileset, 0, 0);
        map.createLayer("Scenery", tileset, 0, 0);

        // Render cars
        const runnerObjects = map.getObjectLayer("RunnerObject");

        runnerObjects?.objects.forEach((object: any) => {
            if (object.gid === undefined) {
                return;
            }

            const frame = object.gid - 1;

            const car = this.add.sprite(
                object.x + object.width / 2,
                object.y - object.height / 2,
                "cityRunnerSheet",
                frame
            );

            car.setDepth(10);
        });

        // Create collision bodies from the Collision object layer
        const collisionGroup = this.physics.add.staticGroup();
        const collisionLayer = map.getObjectLayer("Collision");

        collisionLayer?.objects.forEach((object: any) => {
            if (!object.width || !object.height) {
                return;
            }

            const collisionObject = this.add
                .zone(
                    object.x + object.width / 2,
                    object.y + object.height / 2,
                    object.width,
                    object.height
                )
                .setSize(object.width, object.height);

            this.physics.add.existing(collisionObject, true);
            collisionGroup.add(collisionObject);
        });

        // Find player spawn
        const spawnLayer = map.getObjectLayer("PlayerSpawn");

        const spawn = spawnLayer?.objects.find(
            (object: any) =>
                object.type === "playerSpawn" ||
                object.name === "playerStart"
        );

        const playerX = spawn?.x ?? this.laneX[1];
        const playerY = spawn?.y ?? 4700;

        // Create player
        this.player = this.physics.add.sprite(
            playerX,
            playerY,
            "player_stationary",
            0
        );

        this.player.setCollideWorldBounds(true);
        this.player.setDepth(20);
        this.player.setVelocityY(-180);

        // Detect collision with cars
        this.physics.add.collider(
            this.player,
            collisionGroup,
            () => this.endGame(false),
            undefined,
            this
        );

        // World and camera bounds
        this.physics.world.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels
        );

        this.cameras.main.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels
        );

        this.cameras.main.setZoom(2);
        this.cameras.main.startFollow(this.player, true);

        // Prevent browser scrolling
        this.input.keyboard?.addCapture([
            "LEFT",
            "RIGHT",
            "UP",
            "DOWN"
        ]);

        // Lane switching
        this.input.keyboard?.on("keydown-LEFT", () => {
            this.changeLane(-1);
        });

        this.input.keyboard?.on("keydown-RIGHT", () => {
            this.changeLane(1);
        });

        EventBus.emit("current-scene-ready", this);
    }

    update() {
        if (this.gameEnded || !this.player) {
            return;
        }

        // Player reached the end of the level
        if (this.player.y <= 64) {
            this.endGame(true);
        }
    }

    private endGame(won: boolean) {
        if (this.gameEnded) {
            return;
        }

        this.gameEnded = true;
        this.player.setVelocity(0, 0);

        if (won) {
            this.registry.set("drivingCompleted", true);
            this.registry.set("runnerCompleted", true);
        }

        const message = won ? "YOU WIN!" : "GAME OVER";
        const color = won ? "#00ff66" : "#ff3333";

        const overlay = this.add
            .rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0x000000,
                0.75
            )
            .setScrollFactor(0)
            .setDepth(100);

        this.add
            .text(
                this.scale.width / 2,
                this.scale.height / 2,
                message,
                {
                    fontFamily: "Arial Black",
                    fontSize: "64px",
                    color,
                    stroke: "#000000",
                    strokeThickness: 8,
                    align: "center"
                }
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(101);

        // Return to the city after showing the result
        this.time.delayedCall(1800, () => {
            this.scene.start("City", {
                spawnAt: {
                    x: 3,
                    y: 6
                }
            });
        });
    }

    private changeLane(direction: number) {
        if (this.isChangingLane || this.gameEnded) {
            return;
        }

        const nextLane = this.currentLane + direction;

        if (nextLane < 0 || nextLane > 2) {
            return;
        }

        this.currentLane = nextLane;
        this.isChangingLane = true;

        this.tweens.add({
            targets: this.player,
            x: this.laneX[this.currentLane],
            duration: 180,
            ease: "Power2",
            onComplete: () => {
                this.isChangingLane = false;
            }
        });
    }
}