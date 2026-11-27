import { Scene } from "phaser";
import { EventBus } from "../EventBus";

import { RunnerEffects } from "../runner/RunnerEffects";
import { RunnerHud } from "../runner/RunnerHud";
import { RunnerCars } from "../runner/RunnerCars";
import { RunnerPowerUps } from "../runner/RunnerPowerUps";
import { RunnerState } from "../runner/RunnerTypes";

interface RunnerStartData {
    score?: number;
    coins?: number;
    lap?: number;
    packageCondition?: number;
    elapsedTime?: number;
}

export class Runner extends Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private playerShadow!: Phaser.GameObjects.Ellipse;

    private coinGroup!: Phaser.Physics.Arcade.Group;

    private cars!: RunnerCars;
    private powerUps!: RunnerPowerUps;
    private hud!: RunnerHud;
    private effects!: RunnerEffects;

    private laneX = [352, 416, 480];

    private currentLane = 1;
    private gameEnded = false;

    private runSpeed = 180;
    private elapsedTime = 0;

    private score = 0;
    private coinsCollected = 0;
    private lap = 1;
    private combo = 0;
    private packageCondition = 100;

    private startingScore = 0;
    private startingCoins = 0;
    private startingLap = 1;
    private startingElapsedTime = 0;
    private startingPackageCondition = 100;

    private lapGoal = 5;

    private comboTimer?: Phaser.Time.TimerEvent;

    constructor() {
        super("Runner");
    }

    init(data: RunnerStartData = {}) {
        this.startingScore = data.score ?? 0;
        this.startingCoins = data.coins ?? 0;
        this.startingLap = data.lap ?? 1;
        this.startingElapsedTime =
            data.elapsedTime ?? 0;
        this.startingPackageCondition =
            data.packageCondition ?? 100;
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
        this.gameEnded = false;
        this.currentLane = 1;
        this.combo = 0;

        this.score = this.startingScore;
        this.coinsCollected =
            this.startingCoins;
        this.lap = this.startingLap;
        this.elapsedTime =
            this.startingElapsedTime;
        this.packageCondition =
            this.startingPackageCondition;

        this.runSpeed = this.getCurrentSpeed();

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

        const spawnLayer =
            map.getObjectLayer("PlayerSpawn");

        const spawn =
            spawnLayer?.objects.find(
                (object: any) =>
                    object.type === "playerSpawn" ||
                    object.name === "playerStart"
            );

        const playerX =
            spawn?.x ?? this.laneX[1];

        const playerY =
            spawn?.y ?? map.heightInPixels - 100;

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

        this.playerShadow = this.add
            .ellipse(
                playerX,
                playerY + 14,
                24,
                9,
                0x000000,
                0.35
            )
            .setDepth(19);

        this.coinGroup =
            this.physics.add.group();

        this.effects =
            new RunnerEffects(this);

        this.hud =
            new RunnerHud(this);

        this.cars =
            new RunnerCars(
                this,
                this.player,
                this.laneX,
                () => this.handleCarCollision(),
                () => this.handleNearMiss()
            );

        this.cars.create(map);

        this.createRandomCoins(map);

        this.powerUps =
            new RunnerPowerUps(
                this,
                this.player,
                this.coinGroup,
                this.effects,
                () => {
                    this.score += 250;
                },
                (lane: number, y: number) => {
                    return this.cars.isCarNear(
                        lane,
                        y
                    );
                }
            );

        this.powerUps.create(map);
        this.hud.create();

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
        this.cameras.main.startFollow(
            this.player,
            true
        );

        this.input.keyboard?.removeAllListeners();

        this.input.keyboard?.addCapture([
            "LEFT",
            "RIGHT",
            "UP",
            "DOWN",
            "SPACE",
            "ENTER"
        ]);

        this.input.keyboard?.on(
            "keydown-LEFT",
            () => this.changeLane(-1)
        );

        this.input.keyboard?.on(
            "keydown-RIGHT",
            () => this.changeLane(1)
        );

        EventBus.emit(
            "current-scene-ready",
            this
        );
    }

    update(
        _time: number,
        delta: number
    ) {
        if (this.gameEnded) {
            return;
        }

        this.elapsedTime += delta;

        this.runSpeed =
            this.getCurrentSpeed() *
            this.powerUps.getSpeedMultiplier();

        this.powerUps.update(delta);

        this.player.setVelocityY(
            -this.runSpeed
        );

        if (!this.player.anims.isPlaying) {
            this.player.play("player-up");
        }

        this.playerShadow.setPosition(
            this.player.x,
            this.player.y + 14
        );

        const state: RunnerState = {
            score: this.score,
            coins: this.coinsCollected,
            combo: this.combo,
            lap: this.lap,
            speed: this.runSpeed,
            packageCondition:
                this.packageCondition,
            activePowerUps:
                this.powerUps.getActiveLabels()
        };

        this.hud.update(state);

        // Recycle the route when the player reaches the top
        if (this.player.y <= 64) {
            this.completeLap();
        }
    }

    private getCurrentSpeed() {
        const timeLevel =
            Math.floor(
                this.elapsedTime / 10000
            );

        const lapLevel =
            (this.lap - 1) * 20;

        return Math.min(
            600,
            180 +
                timeLevel * 25 +
                lapLevel
        );
    }

    private completeLap() {
        if (this.gameEnded) {
            return;
        }

        if (this.lap >= this.lapGoal) {
            this.finishDelivery();
            return;
        }

        this.gameEnded = true;

        const lapBonus = 500 * this.lap;
        this.score += lapBonus;

        this.player.setVelocity(0, 0);

        this.add
            .text(
                this.scale.width / 2,
                this.scale.height / 2,
                `LAP ${this.lap} COMPLETE!\n+${lapBonus} POINTS`,
                {
                    fontFamily: "Arial Black",
                    fontSize: "42px",
                    color: "#ffe600",
                    align: "center",
                    stroke: "#000000",
                    strokeThickness: 8
                }
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(101);

        this.time.delayedCall(900, () => {
            this.scene.restart({
                score: this.score,
                coins: this.coinsCollected,
                lap: this.lap + 1,
                elapsedTime: this.elapsedTime,
                packageCondition: this.packageCondition
            });
        });
    }

    private finishDelivery() {
        this.gameEnded = true;

        this.player.setVelocity(0, 0);
        this.player.anims.stop();

        this.add
            .rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0x000000,
                0.8
            )
            .setScrollFactor(0)
            .setDepth(100);

        this.add
            .text(
                this.scale.width / 2,
                this.scale.height / 2,
                `PACKAGE DELIVERED!\n\nFINAL SCORE: ${Math.floor(this.score)}`,
                {
                    fontFamily: "Arial Black",
                    fontSize: "42px",
                    color: "#00ff66",
                    align: "center",
                    stroke: "#000000",
                    strokeThickness: 8
                }
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(101);

        this.time.delayedCall(2500, () => {
            this.scene.start("City", {
                spawnAt: {
                    x: 3,
                    y: 6
                }
            });
        });
    }

    private createCoinTexture() {
        if (this.textures.exists("runnerCoin")) {
            return;
        }

        const graphics =
            this.add.graphics();

        graphics.fillStyle(
            0xffd700,
            1
        );

        graphics.fillCircle(
            8,
            8,
            7
        );

        graphics.lineStyle(
            2,
            0xffa500,
            1
        );

        graphics.strokeCircle(
            8,
            8,
            7
        );

        graphics.generateTexture(
            "runnerCoin",
            16,
            16
        );

        graphics.destroy();
    }

    private createRandomCoins(
        map: Phaser.Tilemaps.Tilemap
    ) {
        const coinCount = 85;
        const startY =
            map.heightInPixels - 350;

        for (let i = 0; i < coinCount; i++) {
            const y =
                startY -
                i * 50 +
                this.randomBetween(-12, 12);

            let lanes: number[];

            if (i % 6 === 0) {
                lanes = [0, 1, 2];
            } else {
                lanes = [
                    Math.floor(
                        Math.random() * 3
                    )
                ];
            }

            lanes.forEach((lane) => {
                // Do not place a coin inside or too close to a car
                if (this.cars.isCarNear(lane, y)) {
                    return;
                }

                const coin =
                    this.physics.add.sprite(
                        this.laneX[lane],
                        y,
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
        }

        this.physics.add.overlap(
            this.player,
            this.coinGroup,
            (_player: any, coin: any) => {
                this.collectCoin(coin);
            }
        );
    }

    private collectCoin(coin: any) {
        if (!coin.active || this.gameEnded) {
            return;
        }

        coin.setActive(false);

        if (coin.body) {
            coin.body.enable = false;
        }

        this.coinsCollected++;

        const comboMultiplier =
            this.combo > 0
                ? this.combo + 1
                : 1;

        const value =
            100 *
            comboMultiplier *
            this.powerUps.getPointsMultiplier();

        this.score += value;

        this.effects.sparkle(
            coin.x,
            coin.y,
            0xffd700
        );

        this.effects.pickup(
            coin.x,
            coin.y,
            `+${value}`
        );

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

    private changeLane(direction: number) {
        if (this.gameEnded) {
            return;
        }

        const nextLane =
            this.currentLane + direction;

        if (nextLane < 0 || nextLane > 2) {
            return;
        }

        const targetLane =
            nextLane;

        const laneChangeY =
            this.player.y;

        this.currentLane =
            targetLane;

        this.tweens.killTweensOf(
            this.player
        );

        this.tweens.add({
            targets: this.player,
            x: this.laneX[targetLane],
            duration: 120,
            ease: "Cubic.easeOut"
        });

        this.tweens.add({
            targets: this.player,
            scaleX: 0.82,
            scaleY: 1.12,
            duration: 70,
            yoyo: true,
            ease: "Quad.easeOut",
            onComplete: () => {
                this.player.setScale(1);
            }
        });

        this.time.delayedCall(
            120,
            () => {
                this.cars.checkLaneChangeNearMiss(
                    targetLane,
                    laneChangeY
                );
            }
        );
    }

    private handleNearMiss() {
        if (this.gameEnded) {
            return;
        }

        this.combo =
            Math.min(
                5,
                this.combo + 1
            );

        const bonus =
            50 * this.combo;

        this.score +=
            bonus *
            this.powerUps.getPointsMultiplier();

        this.comboTimer?.remove(false);

        this.comboTimer =
            this.time.delayedCall(
                2500,
                () => {
                    this.combo = 0;
                }
            );

        this.effects.nearMiss(
            this.player.x,
            this.player.y - 45,
            `CLOSE CALL!\n+${bonus} COMBO x${this.combo}`
        );
    }

    private handleCarCollision() {
        if (this.gameEnded) {
            return;
        }

        if (this.powerUps.consumeShield()) {
            this.packageCondition -= 25;
            this.score = Math.max(
                0,
                this.score - 100
            );

            this.effects.crash();

            this.effects.showText(
                this.player.x,
                this.player.y - 45,
                "SHIELD BROKE!\nPACKAGE DAMAGED",
                "#ff9933"
            );

            if (this.packageCondition > 0) {
                return;
            }
        }

        this.endGame();
    }

    private endGame() {
        if (this.gameEnded) {
            return;
        }

        this.gameEnded = true;

        this.comboTimer?.remove(false);

        this.player.setVelocity(0, 0);
        this.player.anims.stop();
        this.player.setTexture(
            "player_stationary",
            1
        );

        this.playerShadow.setAlpha(0);

        this.effects.crash();

        this.add
            .rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0x000000,
                0.82
            )
            .setScrollFactor(0)
            .setDepth(100);

        this.add
            .text(
                this.scale.width / 2,
                this.scale.height / 2 - 50,
                `DELIVERY FAILED\n\n` +
                `SCORE: ${Math.floor(this.score)}\n` +
                `LAPS: ${this.lap}\n` +
                `COINS: ${this.coinsCollected}`,
                {
                    fontFamily: "Arial Black",
                    fontSize: "38px",
                    color: "#ff3333",
                    align: "center",
                    stroke: "#000000",
                    strokeThickness: 8
                }
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(101);

        this.showGameOverButtons();
    }

    private showGameOverButtons() {
        const retry = this.add
            .text(
                this.scale.width / 2 - 100,
                this.scale.height / 2 + 130,
                "RETRY",
                {
                    fontFamily: "Arial Black",
                    fontSize: "26px",
                    color: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 4
                }
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(102)
            .setInteractive({
                useHandCursor: true
            });

        const exit = this.add
            .text(
                this.scale.width / 2 + 100,
                this.scale.height / 2 + 130,
                "EXIT",
                {
                    fontFamily: "Arial Black",
                    fontSize: "26px",
                    color: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 4
                }
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(102)
            .setInteractive({
                useHandCursor: true
            });

        retry.on("pointerover", () => {
            retry.setColor("#ffe600");
        });

        retry.on("pointerout", () => {
            retry.setColor("#ffffff");
        });

        exit.on("pointerover", () => {
            exit.setColor("#ffe600");
        });

        exit.on("pointerout", () => {
            exit.setColor("#ffffff");
        });

        retry.on("pointerdown", () => {
            this.scene.restart();
        });

        exit.on("pointerdown", () => {
            this.scene.start("City", {
                spawnAt: {
                    x: 3,
                    y: 6
                }
            });
        });
    }

    private randomBetween(
        min: number,
        max: number
    ) {
        return (
            Math.random() *
                (max - min) +
            min
        );
    }
}