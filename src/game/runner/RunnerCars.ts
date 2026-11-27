import { CarObstacle } from "./RunnerTypes";

interface VisualTemplate {
    frame: number;
    offsetX: number;
    offsetY: number;
}

export class RunnerCars {
    private scene: Phaser.Scene;
    private player: Phaser.Physics.Arcade.Sprite;
    private laneX: number[];

    private cars: CarObstacle[] = [];

    private onCollision: () => void;
    private onNearMiss: () => void;

    constructor(
        scene: Phaser.Scene,
        player: Phaser.Physics.Arcade.Sprite,
        laneX: number[],
        onCollision: () => void,
        onNearMiss: () => void
    ) {
        this.scene = scene;
        this.player = player;
        this.laneX = laneX;
        this.onCollision = onCollision;
        this.onNearMiss = onNearMiss;
    }

    create(map: Phaser.Tilemaps.Tilemap) {
        const runnerObjects =
            map.getObjectLayer("RunnerObject");

        const collisionLayer =
            map.getObjectLayer("Collision");

        const collisionTemplates =
            collisionLayer?.objects ?? [];

        const visualObjects =
            runnerObjects?.objects ?? [];

        const collisionGroup =
            this.scene.physics.add.staticGroup();

        const carCount = Math.max(
            10,
            collisionTemplates.length
        );

        const spacing =
            (map.heightInPixels - 700) /
            carCount;

        for (let i = 0; i < carCount; i++) {
            const template =
                collisionTemplates[
                    i % collisionTemplates.length
                ];

            if (!template) {
                continue;
            }

            const lane = this.getRandomLane(i);

            const y =
                map.heightInPixels -
                450 -
                i * spacing +
                this.randomBetween(-60, 60);

            const x = this.laneX[lane];

            const collisionObject = this.scene.add
                .zone(
                    x,
                    y,
                    template.width ?? 22,
                    template.height ?? 30
                )
                .setSize(
                    template.width ?? 22,
                    template.height ?? 30
                );

            this.scene.physics.add.existing(
                collisionObject,
                true
            );

            collisionGroup.add(collisionObject);

            this.createRandomCarVisuals(
                visualObjects,
                template,
                x,
                y
            );

            this.cars.push({
                x,
                y,
                width: template.width ?? 22,
                height: template.height ?? 30,
                lane,
                nearMissAwarded: false
            });
        }

        this.scene.physics.add.collider(
            this.player,
            collisionGroup,
            () => {
                this.onCollision();
            }
        );
    }

    public isCarNear(
        lane: number,
        y: number,
        distance = 110
    ): boolean {
        return this.cars.some((car) => {
            return (
                car.lane === lane &&
                Math.abs(car.y - y) < distance
            );
        });
    }

    public checkLaneChangeNearMiss(
        targetLane: number,
        laneChangeY: number
    ) {
        const nearbyCar = this.cars.find(
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
        this.onNearMiss();
    }

    private createRandomCarVisuals(
        visualObjects: any[],
        collisionTemplate: any,
        x: number,
        y: number
    ) {
        const originalX =
            collisionTemplate.x +
            (collisionTemplate.width ?? 0) / 2;

        const originalY =
            collisionTemplate.y +
            (collisionTemplate.height ?? 0) / 2;

        const templates: VisualTemplate[] =
            visualObjects
                .filter((object: any) => {
                    const objectX =
                        object.x +
                        (object.width ?? 32) / 2;

                    const objectY =
                        object.y -
                        (object.height ?? 32) / 2;

                    return (
                        Math.abs(objectX - originalX) < 45 &&
                        Math.abs(objectY - originalY) < 65 &&
                        object.gid !== undefined
                    );
                })
                .map((object: any) => {
                    const objectX =
                        object.x +
                        (object.width ?? 32) / 2;

                    const objectY =
                        object.y -
                        (object.height ?? 32) / 2;

                    return {
                        frame: object.gid - 1,
                        offsetX: objectX - originalX,
                        offsetY: objectY - originalY
                    };
                });

        templates.forEach((template) => {
            const car = this.scene.add.sprite(
                x + template.offsetX,
                y + template.offsetY,
                "cityRunnerSheet",
                template.frame
            );

            car.setDepth(10);
        });
    }

    private getRandomLane(index: number) {
        let lane =
            Math.floor(
                Math.random() * this.laneX.length
            );

        if (index > 0 && Math.random() < 0.45) {
            lane =
                (lane + 1) %
                this.laneX.length;
        }

        return lane;
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