import { RunnerEffects } from "./RunnerEffects";
import { PowerUpType } from "./RunnerTypes";

export class RunnerPowerUps {
    private scene: Phaser.Scene;
    private player: Phaser.Physics.Arcade.Sprite;
    private coins: Phaser.Physics.Arcade.Group;
    private effects: RunnerEffects;

    private group!: Phaser.Physics.Arcade.Group;

    private shieldActive = false;
    private boostTime = 0;
    private magnetTime = 0;
    private doublePointsTime = 0;

    private onCollect: () => void;

    constructor(
        scene: Phaser.Scene,
        player: Phaser.Physics.Arcade.Sprite,
        coins: Phaser.Physics.Arcade.Group,
        effects: RunnerEffects,
        onCollect: () => void,
        isCarNear: (
            lane: number,
            y: number
        ) => boolean
    ) {
        this.scene = scene;
        this.player = player;
        this.coins = coins;
        this.effects = effects;
        this.onCollect = onCollect;
        this.isCarNear = isCarNear;
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

    create(map: Phaser.Tilemaps.Tilemap) {
        this.createTextures();

        this.group =
            this.scene.physics.add.group();

        const layer =
            map.getObjectLayer("PowerUps");

        if (layer) {
            layer.objects.forEach((object: any) => {
                const type =
                    object.properties?.find(
                        (property: any) =>
                            property.name === "powerUp"
                    )?.value ?? "shield";

                this.spawn(
                    object.x,
                    object.y,
                    type
                );
            });
        } else {
            const positions = [
                { lane: 0, type: "shield" },
                { lane: 2, type: "boost" },
                { lane: 1, type: "magnet" },
                { lane: 0, type: "double" },
                { lane: 2, type: "shield" }
            ];

            positions.forEach((item, index) => {
                this.spawn(
                    [352, 416, 480][item.lane],
                    map.heightInPixels -
                        700 -
                        index * 850 +
                        this.randomBetween(-100, 100),
                    item.type
                );
            });
        }

        this.scene.physics.add.overlap(
            this.player,
            this.group,
            (_player: any, powerUp: any) => {
                this.collect(powerUp);
            }
        );
    }

    update(delta: number) {
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

        if (this.magnetTime <= 0) {
            return;
        }

        this.coins.getChildren().forEach(
            (coin: any) => {
                if (!coin.active) {
                    return;
                }

                const distance = Math.hypot(
                    this.player.x - coin.x,
                    this.player.y - coin.y
                );

                if (distance < 140) {
                    coin.x +=
                        (this.player.x - coin.x) *
                        0.15;

                    coin.y +=
                        (this.player.y - coin.y) *
                        0.15;
                }
            }
        );
    }

    consumeShield() {
        if (!this.shieldActive) {
            return false;
        }

        this.shieldActive = false;
        return true;
    }

    getSpeedMultiplier() {
        return this.boostTime > 0
            ? 1.35
            : 1;
    }

    getPointsMultiplier() {
        return this.doublePointsTime > 0
            ? 2
            : 1;
    }

    getActiveLabels(): string[] {
        const labels: string[] = [];

        if (this.shieldActive) {
            labels.push("SHIELD");
        }

        if (this.boostTime > 0) {
            labels.push(
                `BOOST ${Math.ceil(this.boostTime / 1000)}`
            );
        }

        if (this.magnetTime > 0) {
            labels.push(
                `MAGNET ${Math.ceil(this.magnetTime / 1000)}`
            );
        }

        if (this.doublePointsTime > 0) {
            labels.push(
                `2X POINTS ${Math.ceil(this.doublePointsTime / 1000)}`
            );
        }

        return labels;
    }

    private createTextures() {
        this.createTexture(
            "runnerShield",
            0x239cff
        );

        this.createTexture(
            "runnerBoost",
            0xff4d4d
        );

        this.createTexture(
            "runnerMagnet",
            0xb45cff
        );

        this.createTexture(
            "runnerDouble",
            0xffd700
        );
    }

    private createTexture(
        key: string,
        color: number
    ) {
        if (this.scene.textures.exists(key)) {
            return;
        }

        const graphics =
            this.scene.add.graphics();

        graphics.fillStyle(color, 1);
        graphics.fillCircle(12, 12, 10);

        graphics.lineStyle(
            2,
            0xffffff,
            1
        );

        graphics.strokeCircle(12, 12, 10);

        graphics.generateTexture(
            key,
            24,
            24
        );

        graphics.destroy();
    }

    private spawn(
        x: number,
        y: number,
        type: string
    ) {
        const lane = this.getLaneFromX(x);

        // Do not place power-ups inside or near cars
        if (this.isCarNear(lane, y)) {
            return;
        }

        const powerUpType =
            this.normalizeType(type);

        const texture =
            powerUpType === "shield"
                ? "runnerShield"
                : powerUpType === "boost"
                  ? "runnerBoost"
                  : powerUpType === "magnet"
                    ? "runnerMagnet"
                    : "runnerDouble";

        const powerUp =
            this.scene.physics.add.sprite(
                x,
                y,
                texture
            );

        powerUp.setDepth(16);
        powerUp.setScale(1.25);

        powerUp.setData(
            "powerUpType",
            powerUpType
        );

        if (powerUp.body) {
            powerUp.body.allowGravity = false;
        }

        this.group.add(powerUp);

        this.scene.tweens.add({
            targets: powerUp,
            y: y - 7,
            angle: 360,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });
    }

    private collect(powerUp: any) {
        if (!powerUp.active) {
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
        }

        if (type === "boost") {
            this.boostTime = 12000;
        }

        if (type === "magnet") {
            this.magnetTime = 10000;
        }

        if (type === "double") {
            this.doublePointsTime = 10000;
        }

        this.onCollect();

        const message =
            type === "shield"
                ? "SHIELD ACTIVE!"
                : type === "boost"
                  ? "SPEED BOOST!"
                  : type === "magnet"
                    ? "COIN MAGNET!"
                    : "DOUBLE POINTS!";

        this.effects.pickup(
            this.player.x,
            this.player.y - 40,
            message
        );

        this.scene.tweens.add({
            targets: powerUp,
            scale: 2,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                powerUp.destroy();
            }
        });
    }

    private normalizeType(
        type: string
    ): PowerUpType {
        if (
            type === "boost" ||
            type === "magnet" ||
            type === "double"
        ) {
            return type;
        }

        return "shield";
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

    private isCarNear: (
        lane: number,
        y: number
    ) => boolean;

    private laneX = [352, 416, 480];

}