import { Scene } from "phaser";
import { EventBus } from "../EventBus";

export class Runner extends Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private scoreText!: Phaser.GameObjects.Text;
    private coinGroup!: Phaser.Physics.Arcade.Group;

    private currentLane = 1;
    private isChangingLane = false;
    private gameEnded = false;

    private laneX = [352, 416, 480];

    private runSpeed = 180;
    private elapsedTime = 0;
    private score = 0;
    private coinsCollected = 0;

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
        // Reset the Runner scene every time it is entered
        this.gameEnded = false;
        this.isChangingLane = false;
        this.currentLane = 1;
        this.elapsedTime = 0;
        this.score = 0;
        this.coinsCollected = 0;
        this.runSpeed = 180;

        // Resume physics after returning from a previous game
        this.physics.resume();

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

        map.createLayer("Background", tileset, 0, 0);
        map.createLayer("Road", tileset, 0, 0);
        map.createLayer("Buildings", tileset, 0, 0);
        map.createLayer("Scenery", tileset, 0, 0);

        this.createCoinTexture();

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
            1
        );

        this.player.setDepth(20);
        this.player.setCollideWorldBounds(true);

        if (this.anims.exists("player-up")) {
            this.player.play("player-up");
        }

        this.createCars(map);
        this.createCoins(map);

        // Score display
        this.scoreText = this.add
            .text(24, 24, "SCORE: 0\nCOINS: 0", {
                fontFamily: "Arial Black",
                fontSize: "22px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 5
            })
            .setScrollFactor(0)
            .setDepth(100);

        // Set world bounds
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

        // Prevent browser scrolling with arrow keys
        this.input.keyboard?.addCapture([
            "LEFT",
            "RIGHT",
            "UP",
            "DOWN"
        ]);

        this.input.keyboard?.on("keydown-LEFT", () => {
            this.changeLane(-1);
        });

        this.input.keyboard?.on("keydown-RIGHT", () => {
            this.changeLane(1);
        });

        EventBus.emit("current-scene-ready", this);
    }

    private createCoinTexture() {
        if (this.textures.exists("runnerCoin")) {
            return;
        }

        const graphics = this.add.graphics();

        graphics.fillStyle(0xffd700, 1);
        graphics.fillCircle(8, 8, 7);

        graphics.lineStyle(2, 0xffa500, 1);
        graphics.strokeCircle(8, 8, 7);

        graphics.fillStyle(0xffff99, 1);
        graphics.fillCircle(6, 6, 2);

        graphics.generateTexture("runnerCoin", 16, 16);
        graphics.destroy();
    }

    private createCars(map: Phaser.Tilemaps.Tilemap) {
        const runnerObjects = map.getObjectLayer("RunnerObject");

        runnerObjects?.objects.forEach((object: any) => {
            if (object.gid === undefined) {
                return;
            }

            const car = this.add.sprite(
                object.x + object.width / 2,
                object.y - object.height / 2,
                "cityRunnerSheet",
                object.gid - 1
            );

            car.setDepth(10);
        });

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

        this.physics.add.collider(
            this.player,
            collisionGroup,
            () => this.endGame(false),
            undefined,
            this
        );
    }

    private createCoins(map: Phaser.Tilemaps.Tilemap) {
        this.coinGroup = this.physics.add.group();

        const coinLayer = map.getObjectLayer("Coins");

        if (!coinLayer) {
            console.warn(
                "Coins object layer was not found."
            );
            return;
        }

        coinLayer.objects.forEach((object: any) => {
            const width = object.width ?? 0;
            const height = object.height ?? 0;

            const coin = this.physics.add.sprite(
                object.x + width / 2,
                object.y + height / 2,
                "runnerCoin"
            );

            coin.setDepth(15);
            coin.setScale(1.4);
            coin.setImmovable(true);

            if (coin.body) {
                coin.body.allowGravity = false;
            }

            this.coinGroup.add(coin);

            this.tweens.add({
                targets: coin,
                y: coin.y - 5,
                duration: 500,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut"
            });

            this.tweens.add({
                targets: coin,
                scaleX: 0.25,
                duration: 450,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut"
            });
        });

        this.physics.add.overlap(
            this.player,
            this.coinGroup,
            (_player: any, coin: any) => {
                this.collectCoin(coin);
            },
            undefined,
            this
        );
    }

    private collectCoin(coin: any) {
        if (!coin.active) {
            return;
        }

        // Disable immediately to prevent repeated collection
        coin.setActive(false);

        if (coin.body) {
            coin.body.enable = false;
        }

        this.coinsCollected++;
        this.score += 100;

        const pickupText = this.add
            .text(coin.x, coin.y, "+100", {
                fontFamily: "Arial Black",
                fontSize: "18px",
                color: "#ffe600",
                stroke: "#000000",
                strokeThickness: 4
            })
            .setOrigin(0.5)
            .setDepth(110);

        this.tweens.add({
            targets: pickupText,
            y: pickupText.y - 35,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                pickupText.destroy();
            }
        });

        this.tweens.add({
            targets: coin,
            scale: 2,
            alpha: 0,
            duration: 150,
            onComplete: () => {
                coin.destroy();
            }
        });
    }

    update(_time: number, delta: number) {
        if (this.gameEnded) {
            return;
        }

        this.elapsedTime += delta;

        // Increase speed every 10 seconds
        const speedLevel = Math.floor(
            this.elapsedTime / 10000
        );

        this.runSpeed = Math.min(
            420,
            180 + speedLevel * 25
        );

        // Move player upward
        this.player.setVelocityY(-this.runSpeed);

        // Keep animation active
        if (!this.player.anims.isPlaying) {
            this.player.play("player-up");
        }

        // Passive score
        this.score += delta * 0.01;

        this.scoreText.setText(
            `SCORE: ${Math.floor(this.score)}\nCOINS: ${this.coinsCollected}`
        );

        // Win condition
        if (this.player.y <= 64) {
            this.endGame(true);
        }
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

    private endGame(won: boolean) {
        if (this.gameEnded) {
            return;
        }

        this.gameEnded = true;

        // Stop only the player, not the entire physics system
        this.player.setVelocity(0, 0);
        this.player.anims.stop();
        this.player.setTexture("player_stationary", 1);

        if (won) {
            this.registry.set("drivingCompleted", true);
            this.registry.set("runnerCompleted", true);
        } else {
            // Allow the player to re-enter Runner after losing
            this.registry.set("drivingCompleted", false);
            this.registry.set("runnerCompleted", false);
        }

        const message = won ? "YOU WIN!" : "GAME OVER";
        const color = won ? "#00ff66" : "#ff3333";

        this.add
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
                `${message}\nSCORE: ${Math.floor(this.score)}`,
                {
                    fontFamily: "Arial Black",
                    fontSize: "52px",
                    color,
                    align: "center",
                    stroke: "#000000",
                    strokeThickness: 8
                }
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(101);

        this.time.delayedCall(1800, () => {
            this.scene.start("City", {
                // Spawn away from the doorway
                spawnAt: {
                    x: 3,
                    y: 6
                }
            });
        });
    }
}