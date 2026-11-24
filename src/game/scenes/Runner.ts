import * as Phaser from "phaser";
import { EventBus } from "../EventBus";

type PowerUpType =
    | "shield"
    | "boost"
    | "magnet"
    | "double";

interface CarObstacle {
    x: number;
    y: number;
    width: number;
    height: number;
    lane: number;
    nearMissAwarded: boolean;
}

export class Runner extends Phaser.Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private playerShadow!: Phaser.GameObjects.Ellipse;

    private scoreText!: Phaser.GameObjects.Text;
    private hudPanel!: Phaser.GameObjects.Rectangle;

    private coinGroup!: Phaser.Physics.Arcade.Group;
    private powerUpGroup!: Phaser.Physics.Arcade.Group;

    private carObstacles: CarObstacle[] = [];

    private currentLane = 1;
    private gameEnded = false;

    private laneX = [352, 416, 480];

    private runSpeed = 180;
    private elapsedTime = 0;
    private deliveryTimeLimit = 45;

    private score = 0;
    private coinsCollected = 0;
    private combo = 0;

    private packageCondition = 100;

    private shieldActive = false;
    private boostTime = 0;
    private magnetTime = 0;
    private doublePointsTime = 0;
    private shieldTime = 0;

    private comboTimer?: Phaser.Time.TimerEvent;

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
        this.gameEnded = false;
        this.currentLane = 1;
        this.elapsedTime = 0;
        this.score = 0;
        this.coinsCollected = 0;
        this.combo = 0;
        this.packageCondition = 100;

        this.shieldActive = false;
        this.boostTime = 0;
        this.magnetTime = 0;
        this.doublePointsTime = 0;

        this.runSpeed = 180;
        this.carObstacles = [];

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

        this.createTextures();

        const spawnLayer = map.getObjectLayer("PlayerSpawn");

        const spawn = spawnLayer?.objects.find(
            (object: any) =>
                object.type === "playerSpawn" ||
                object.name === "playerStart"
        );

        const playerX = spawn?.x ?? this.laneX[1];
        const playerY = spawn?.y ?? 4700;

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

        this.createCars(map);
        this.createCoins(map);
        this.createPowerUps(map);
        this.createHud();

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

        this.input.keyboard?.removeAllListeners();

        this.input.keyboard?.addCapture([
            "LEFT",
            "RIGHT",
            "UP",
            "DOWN",
            "SPACE",
            "ENTER"
        ]);

        this.input.keyboard?.on("keydown-LEFT", () => {
            this.changeLane(-1);
        });

        this.input.keyboard?.on("keydown-RIGHT", () => {
            this.changeLane(1);
        });

        EventBus.emit("current-scene-ready", this);
    }

    private createTextures() {
        this.createCoinTexture();
        this.createPowerUpTexture(
            "runnerShield",
            0x239cff
        );
        this.createPowerUpTexture(
            "runnerBoost",
            0xff4d4d
        );
        this.createPowerUpTexture(
            "runnerMagnet",
            0xb45cff
        );
        this.createPowerUpTexture(
            "runnerDouble",
            0xffd700
        );
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

        graphics.generateTexture(
            "runnerCoin",
            16,
            16
        );

        graphics.destroy();
    }

    private createPowerUpTexture(
        key: string,
        color: number
    ) {
        if (this.textures.exists(key)) {
            return;
        }

        const graphics = this.add.graphics();

        graphics.fillStyle(color, 1);
        graphics.fillCircle(12, 12, 10);

        graphics.lineStyle(2, 0xffffff, 1);
        graphics.strokeCircle(12, 12, 10);

        graphics.generateTexture(
            key,
            24,
            24
        );

        graphics.destroy();
    }

    private createHud() {
        this.hudPanel = this.add
            .rectangle(
                165,
                80,
                315,
                150,
                0x111827,
                0.9
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(99);

        this.hudPanel.setStrokeStyle(
            2,
            0xffd700,
            0.85
        );

        this.scoreText = this.add
            .text(
                24,
                20,
                "",
                {
                    fontFamily: "Arial Black",
                    fontSize: "17px",
                    color: "#ffffff",
                    lineSpacing: 4,
                    stroke: "#000000",
                    strokeThickness: 4
                }
            )
            .setScrollFactor(0)
            .setDepth(100);
    }

    private getLaneFromX(x: number): number {
        let closestLane = 0;
        let closestDistance = Infinity;

        this.laneX.forEach((laneX, index) => {
            const distance = Math.abs(x - laneX);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestLane = index;
            }
        });

        return closestLane;
    }

    private createCars(map: Phaser.Tilemaps.Tilemap) {
        const runnerObjects = map.getObjectLayer("RunnerObject");
        const collisionLayer = map.getObjectLayer("Collision");

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
                .setSize(
                    object.width,
                    object.height
                );

            this.physics.add.existing(
                collisionObject,
                true
            );

            collisionGroup.add(collisionObject);

            const carX =
                object.x + object.width / 2;

            this.carObstacles.push({
                x: carX,
                y: object.y + object.height / 2,
                width: object.width,
                height: object.height,
                lane: this.getLaneFromX(carX),
                nearMissAwarded: false
            });
        });

        this.physics.add.collider(
            this.player,
            collisionGroup,
            () => {
                this.handleCarCollision();
            },
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

    private createPowerUps(map: Phaser.Tilemaps.Tilemap) {
        this.powerUpGroup = this.physics.add.group();

        const powerUpLayer =
            map.getObjectLayer("PowerUps");

        if (powerUpLayer) {
            powerUpLayer.objects.forEach(
                (object: any) => {
                    const type =
                        object.properties?.find(
                            (property: any) =>
                                property.name === "powerUp"
                        )?.value ?? "shield";

                    this.spawnPowerUp(
                        object.x,
                        object.y,
                        type
                    );
                }
            );
        } else {
            // Automatic power-ups if the Tiled layer does not exist
            const defaultPowerUps: {
                y: number;
                lane: number;
                type: PowerUpType;
            }[] = [
                {
                    y: 3900,
                    lane: 0,
                    type: "shield"
                },
                {
                    y: 3200,
                    lane: 2,
                    type: "boost"
                },
                {
                    y: 2500,
                    lane: 1,
                    type: "magnet"
                },
                {
                    y: 1800,
                    lane: 0,
                    type: "double"
                },
                {
                    y: 1100,
                    lane: 2,
                    type: "shield"
                }
            ];

            defaultPowerUps.forEach((powerUp) => {
                this.spawnPowerUp(
                    this.laneX[powerUp.lane],
                    powerUp.y,
                    powerUp.type
                );
            });
        }

        this.physics.add.overlap(
            this.player,
            this.powerUpGroup,
            (_player: any, powerUp: any) => {
                this.collectPowerUp(powerUp);
            },
            undefined,
            this
        );
    }

    private spawnPowerUp(
        x: number,
        y: number,
        type: PowerUpType | string
    ) {
        const normalizedType: PowerUpType =
            type === "boost" ||
            type === "magnet" ||
            type === "double"
                ? type
                : "shield";

        const textureKey =
            normalizedType === "shield"
                ? "runnerShield"
                : normalizedType === "boost"
                  ? "runnerBoost"
                  : normalizedType === "magnet"
                    ? "runnerMagnet"
                    : "runnerDouble";

        const powerUp = this.physics.add.sprite(
            x,
            y,
            textureKey
        );

        powerUp.setDepth(16);
        powerUp.setScale(1.25);
        powerUp.setData(
            "powerUpType",
            normalizedType
        );

        if (powerUp.body) {
            powerUp.body.allowGravity = false;
        }

        this.powerUpGroup.add(powerUp);

        this.tweens.add({
            targets: powerUp,
            y: y - 7,
            angle: 360,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });
    }

    private collectPowerUp(powerUp: any) {
        if (!powerUp.active || this.gameEnded) {
            return;
        }

        const type =
            powerUp.getData(
                "powerUpType"
            ) as PowerUpType;

        powerUp.setActive(false);

        if (powerUp.body) {
            powerUp.body.enable = false;
        }

        if (type === "shield") {
            this.shieldActive = true;
            this.shieldTime = 10000;
        }

        if (type === "boost") {
            this.boostTime = 8000;
        }

        if (type === "magnet") {
            this.magnetTime = 10000;
        }

        if (type === "double") {
            this.doublePointsTime = 10000;
        }

        this.score += 250;

        const message =
            type === "shield"
                ? "SHIELD ACTIVE!"
                : type === "boost"
                  ? "SPEED BOOST!"
                  : type === "magnet"
                    ? "COIN MAGNET!"
                    : "DOUBLE POINTS!";

        const powerUpText = this.add
            .text(
                this.player.x,
                this.player.y - 40,
                message,
                {
                    fontFamily: "Arial Black",
                    fontSize: "18px",
                    color: "#ffe600",
                    stroke: "#000000",
                    strokeThickness: 4
                }
            )
            .setOrigin(0.5)
            .setDepth(110);

        this.tweens.add({
            targets: powerUpText,
            y: powerUpText.y - 40,
            alpha: 0,
            duration: 900,
            onComplete: () => {
                powerUpText.destroy();
            }
        });

        this.tweens.add({
            targets: powerUp,
            scale: 2,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                powerUp.destroy();
            }
        });
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

        let coinValue = 100;

        if (this.doublePointsTime > 0) {
            coinValue *= 2;
        }

        if (this.combo > 0) {
            coinValue *= this.combo + 1;
        }

        this.score += coinValue;

        const pickupText = this.add
            .text(
                coin.x,
                coin.y,
                `+${coinValue}`,
                {
                    fontFamily: "Arial Black",
                    fontSize: "18px",
                    color: "#ffe600",
                    stroke: "#000000",
                    strokeThickness: 4
                }
            )
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

    private checkLaneChangeNearMiss(
        targetLane: number,
        laneChangeY: number
    ) {
        if (this.gameEnded) {
            return;
        }

        const nearbyCar = this.carObstacles.find(
            (car) => {
                if (car.nearMissAwarded) {
                    return false;
                }

                if (car.lane !== targetLane) {
                    return false;
                }

                const distanceAhead =
                    laneChangeY - car.y;

                return (
                    distanceAhead >= 36 &&
                    distanceAhead <= 160
                );
            }
        );

        if (!nearbyCar) {
            return;
        }

        nearbyCar.nearMissAwarded = true;
        this.addNearMissBonus();
    }

    private addNearMissBonus() {
        if (this.gameEnded) {
            return;
        }

        this.combo = Math.min(
            this.combo + 1,
            5
        );

        const bonus = 50 * this.combo;

        this.score +=
            this.doublePointsTime > 0
                ? bonus * 2
                : bonus;

        this.comboTimer?.remove(false);

        this.comboTimer = this.time.delayedCall(
            2500,
            () => {
                this.combo = 0;
            }
        );

        this.cameras.main.flash(
            100,
            0,
            255,
            255
        );

        this.cameras.main.shake(
            120,
            0.002
        );

        const message =
            this.combo > 1
                ? `CLOSE CALL!\n+${bonus} COMBO x${this.combo}`
                : `CLOSE CALL!\n+${bonus}`;

        const bonusText = this.add
            .text(
                this.player.x,
                this.player.y - 45,
                message,
                {
                    fontFamily: "Arial Black",
                    fontSize: "18px",
                    color: "#00ffff",
                    align: "center",
                    stroke: "#000000",
                    strokeThickness: 4
                }
            )
            .setOrigin(0.5)
            .setDepth(110);

        this.tweens.add({
            targets: bonusText,
            y: bonusText.y - 45,
            alpha: 0,
            duration: 800,
            onComplete: () => {
                bonusText.destroy();
            }
        });
    }

    private handleCarCollision() {
        if (this.gameEnded) {
            return;
        }

        if (this.shieldActive) {
            this.shieldActive = false;
            this.packageCondition -= 25;
            this.score = Math.max(
                0,
                this.score - 100
            );

            this.cameras.main.shake(
                250,
                0.006
            );

            this.showStatusMessage(
                "SHIELD BROKE!\nPACKAGE DAMAGED",
                "#ff9933"
            );

            if (this.packageCondition > 0) {
                return;
            }
        }

        this.endGame(false);
    }

    private showStatusMessage(
        message: string,
        color: string
    ) {
        const statusText = this.add
            .text(
                this.player.x,
                this.player.y - 50,
                message,
                {
                    fontFamily: "Arial Black",
                    fontSize: "18px",
                    color,
                    align: "center",
                    stroke: "#000000",
                    strokeThickness: 4
                }
            )
            .setOrigin(0.5)
            .setDepth(110);

        this.tweens.add({
            targets: statusText,
            y: statusText.y - 45,
            alpha: 0,
            duration: 900,
            onComplete: () => {
                statusText.destroy();
            }
        });
    }

    private updatePowerUps(delta: number) {
        this.shieldTime = Math.max(
            0,
            this.shieldTime - delta
        );

        if (this.shieldTime <= 0) {
            this.shieldActive = false;
        }
        this.boostTime = Math.max(
            0,
            this.boostTime - delta
        );

        this.magnetTime = Math.max(
            0,
            this.magnetTime - delta
        );

        this.doublePointsTime = Math.max(
            0,
            this.doublePointsTime - delta
        );

        if (this.magnetTime > 0) {
            this.coinGroup.getChildren().forEach(
                (coinObject: any) => {
                    if (!coinObject.active) {
                        return;
                    }

                    const distance = Phaser.Math.Distance.Between(
                        this.player.x,
                        this.player.y,
                        coinObject.x,
                        coinObject.y
                    );

                    if (distance < 140) {
                        coinObject.x = Phaser.Math.Linear(
                            coinObject.x,
                            this.player.x,
                            0.15
                        );

                        coinObject.y = Phaser.Math.Linear(
                            coinObject.y,
                            this.player.y,
                            0.15
                        );
                    }
                }
            );
        }
    }

    update(_time: number, delta: number) {
        if (this.gameEnded) {
            return;
        }

        this.elapsedTime += delta;

        const speedLevel = Math.floor(
            this.elapsedTime / 10000
        );

        this.runSpeed = Math.min(
            420,
            180 + speedLevel * 25
        );

        if (this.boostTime > 0) {
            this.runSpeed *= 1.35;
        }

        this.updatePowerUps(delta);

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

        const secondsRemaining = Math.max(
            0,
            this.deliveryTimeLimit -
                this.elapsedTime / 1000
        );

        const comboText =
            this.combo > 0
                ? `\nCOMBO: x${this.combo}`
                : "";

        const activePowerUps: string[] = [];

        if (this.shieldActive) {
            activePowerUps.push("SHIELD");
        }

        if (this.boostTime > 0) {
            activePowerUps.push(
                `BOOST ${Math.ceil(this.boostTime / 1000)}`
            );
        }

        if (this.magnetTime > 0) {
            activePowerUps.push(
                `MAGNET ${Math.ceil(this.magnetTime / 1000)}`
            );
        }

        if (this.doublePointsTime > 0) {
            activePowerUps.push(
                `2X POINTS ${Math.ceil(this.doublePointsTime / 1000)}`
            );
        }

        const powerUpText =
            activePowerUps.length > 0
                ? `\n${activePowerUps.join("\n")}`
                : "";

        this.scoreText.setText(
            `SLAMAZON DELIVERY\n` +
            `SCORE: ${Math.floor(this.score)}\n` +
            `COINS: ${this.coinsCollected}\n` +
            `PACKAGE: ${this.packageCondition}%\n` +
            `TIME: ${secondsRemaining.toFixed(1)}` +
            comboText +
            powerUpText
        );

        if (secondsRemaining <= 0) {
            this.endGame(false);
            return;
        }

        if (this.player.y <= 64) {
            this.endGame(true);
        }
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

        const targetLane = nextLane;
        const laneChangeY = this.player.y;

        this.currentLane = targetLane;

        this.tweens.killTweensOf(
            this.player
        );

        // Smooth lane movement
        this.tweens.add({
            targets: this.player,
            x: this.laneX[targetLane],
            duration: 120,
            ease: "Cubic.easeOut"
        });

        // Squash/stretch animation
        this.player.setScale(1);

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

        // Close call only from a lane change
        this.time.delayedCall(120, () => {
            this.checkLaneChangeNearMiss(
                targetLane,
                laneChangeY
            );
        });
    }

    private endGame(won: boolean) {
        if (this.gameEnded) {
            return;
        }

        this.gameEnded = true;

        this.comboTimer?.remove(false);
        this.combo = 0;

        this.player.setVelocity(0, 0);
        this.player.anims.stop();
        this.player.setTexture(
            "player_stationary",
            1
        );

        this.playerShadow.setAlpha(0);

        if (won) {
            this.registry.set(
                "runnerCompleted",
                true
            );

            this.cameras.main.flash(
                500,
                0,
                255,
                100
            );
        } else {
            this.registry.set(
                "runnerCompleted",
                false
            );

            this.cameras.main.shake(
                400,
                0.012
            );

            this.cameras.main.flash(
                300,
                255,
                0,
                0
            );
        }

        const message = won
            ? this.packageCondition >= 80
                ? "PACKAGE DELIVERED!"
                : "PACKAGE DELIVERED...\nBARELY!"
            : this.elapsedTime / 1000 >=
                this.deliveryTimeLimit
              ? "DELIVERY TOO LATE!"
              : "GAME OVER";

        const color = won
            ? "#00ff66"
            : "#ff3333";

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
                this.scale.height / 2 - 30,
                `${message}\n\nSCORE: ${Math.floor(this.score)}\nCOINS: ${this.coinsCollected}\nPACKAGE: ${this.packageCondition}%`,
                {
                    fontFamily: "Arial Black",
                    fontSize: "36px",
                    color,
                    align: "center",
                    stroke: "#000000",
                    strokeThickness: 8
                }
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(101);

        if (won) {
            this.time.delayedCall(2400, () => {
                this.scene.start("City", {
                    spawnAt: {
                        x: 3,
                        y: 6
                    }
                });
            });
        } else {
            this.showGameOverButtons();
        }
    }

    private showGameOverButtons() {
        const options = ["Retry", "Exit"];
        let selectedIndex = 0;

        const centerX = this.scale.width / 2;
        const buttonY =
            this.scale.height / 2 + 170;
        const spacing = 180;

        const buttonTexts: Phaser.GameObjects.Text[] =
            options.map((label, index) => {
                const x =
                    centerX +
                    (index - 0.5) * spacing;

                const button = this.add
                    .text(
                        x,
                        buttonY,
                        label,
                        {
                            fontFamily:
                                '"Press Start 2P", monospace',
                            fontSize: "28px",
                            color: "#ffffff",
                            stroke: "#000000",
                            strokeThickness: 3,
                            padding: {
                                x: 16,
                                y: 8
                            }
                        }
                    )
                    .setOrigin(0.5)
                    .setScrollFactor(0)
                    .setDepth(102)
                    .setInteractive({
                        useHandCursor: true
                    });

                button.on("pointerover", () => {
                    selectedIndex = index;
                    updateSelection();
                });

                button.on("pointerdown", () => {
                    selectedIndex = index;
                    updateSelection();
                    confirmOption();
                });

                return button;
            });

        const updateSelection = () => {
            buttonTexts.forEach((button, index) => {
                const isSelected =
                    index === selectedIndex;

                button.setColor(
                    isSelected
                        ? "#ffe600"
                        : "#ffffff"
                );

                button.setScale(
                    isSelected ? 1.15 : 1
                );
            });
        };

        let actionTaken = false;

        const confirmOption = () => {
            if (actionTaken) {
                return;
            }

            actionTaken = true;

            this.input.keyboard?.off(
                "keydown-LEFT",
                movePrev
            );

            this.input.keyboard?.off(
                "keydown-UP",
                movePrev
            );

            this.input.keyboard?.off(
                "keydown-RIGHT",
                moveNext
            );

            this.input.keyboard?.off(
                "keydown-DOWN",
                moveNext
            );

            this.input.keyboard?.off(
                "keydown-SPACE",
                confirmOption
            );

            this.input.keyboard?.off(
                "keydown-ENTER",
                confirmOption
            );

            if (options[selectedIndex] === "Retry") {
                this.scene.restart();
            } else {
                this.scene.start("City", {
                    spawnAt: {
                        x: 3,
                        y: 6
                    }
                });
            }
        };

        const movePrev = () => {
            selectedIndex =
                (selectedIndex - 1 + options.length) %
                options.length;

            updateSelection();
        };

        const moveNext = () => {
            selectedIndex =
                (selectedIndex + 1) %
                options.length;

            updateSelection();
        };

        this.input.keyboard?.on(
            "keydown-LEFT",
            movePrev
        );

        this.input.keyboard?.on(
            "keydown-UP",
            movePrev
        );

        this.input.keyboard?.on(
            "keydown-RIGHT",
            moveNext
        );

        this.input.keyboard?.on(
            "keydown-DOWN",
            moveNext
        );

        this.input.keyboard?.on(
            "keydown-SPACE",
            confirmOption
        );

        this.input.keyboard?.on(
            "keydown-ENTER",
            confirmOption
        );

        updateSelection();
    }
}