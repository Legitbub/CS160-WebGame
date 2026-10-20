import * as Phaser from "phaser";
import { CONSTANTS } from "./utilities/Constants";

type Direction = "down" | "up" | "left" | "right";

type Move = {
    x: number;
    y: number;
    direction: Direction;
};

export class PlayerCharacter extends Phaser.Physics.Arcade.Sprite {
    private arrows!: Phaser.Types.Input.Keyboard.CursorKeys;

    private isMoving = false;

    private movementTween?: Phaser.Tweens.Tween;

    private collisionLayer?:
        | Phaser.Tilemaps.TilemapLayer
        | Phaser.Tilemaps.TilemapGPULayer;

    private currentDirection: Direction = "down";

    private movementDirection: Direction = "down";

    private requestedMove: Move | null = null;

    private facingFrames: Record<Direction, number> = {
        down: 0,
        up: 1,
        left: 2,
        right: 3,
    };

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        texture: string = "PlayerCharacter"
    ) {
        super(scene, x, y, texture);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Prevent moving off screen
        this.setCollideWorldBounds(true);

        // Set initial texture
        this.setTexture(
            "player_stationary",
            this.facingFrames[this.currentDirection]
        );

        if (scene.input.keyboard) {
            this.arrows = scene.input.keyboard.createCursorKeys();

            // Listen for the most recently pressed direction
            this.arrows.left.on("down", () => {
                this.requestDirection({
                    x: -1,
                    y: 0,
                    direction: "left",
                });
            });

            this.arrows.right.on("down", () => {
                this.requestDirection({
                    x: 1,
                    y: 0,
                    direction: "right",
                });
            });

            this.arrows.up.on("down", () => {
                this.requestDirection({
                    x: 0,
                    y: -1,
                    direction: "up",
                });
            });

            this.arrows.down.on("down", () => {
                this.requestDirection({
                    x: 0,
                    y: 1,
                    direction: "down",
                });
            });
        }
    }

    public setCollisionLayer(
        layer:
            | Phaser.Tilemaps.TilemapLayer
            | Phaser.Tilemaps.TilemapGPULayer
    ) {
        this.collisionLayer = layer;
    }

    private requestDirection(move: Move) {
        this.requestedMove = move;

        // Change facing immediately
        this.setFacing(move.direction);

        // If moving in another direction, interrupt immediately
        if (
            this.isMoving &&
            this.movementDirection !== move.direction
        ) {
            this.interruptMovement();
        }

        // Start the new movement immediately
        if (!this.isMoving) {
            this.moveTile(move.x, move.y);
        }
    }

    public update() {
        if (!this.arrows || !this.requestedMove) {
            return;
        }

        const move = this.requestedMove;

        const keyStillHeld = this.isDirectionHeld(move.direction);

        if (!keyStillHeld) {
            this.requestedMove = null;
            return;
        }

        if (!this.isMoving) {
            this.moveTile(move.x, move.y);
        }
    }

    private isDirectionHeld(direction: Direction): boolean {
        switch (direction) {
            case "left":
                return this.arrows.left.isDown;

            case "right":
                return this.arrows.right.isDown;

            case "up":
                return this.arrows.up.isDown;

            case "down":
                return this.arrows.down.isDown;
        }
    }

    private setFacing(direction: Direction) {
        this.currentDirection = direction;

        this.anims.stop();

        this.setTexture(
            "player_stationary",
            this.facingFrames[direction]
        );
    }

    private playMovementAnimation(direction: Direction) {
        this.anims.play(`player-${direction}`, true);
    }

    private moveTile(moveX: number, moveY: number) {
        if (this.isMoving) {
            return;
        }

        const direction: Direction =
            moveX < 0
                ? "left"
                : moveX > 0
                  ? "right"
                  : moveY < 0
                    ? "up"
                    : "down";

        this.movementDirection = direction;
        this.currentDirection = direction;

        const halfTile = CONSTANTS.TILE_SIZE / 2;

        // Use rounding because the player's position is the center of a tile
        const currentTileX = Math.round(
            (this.x - halfTile) / CONSTANTS.TILE_SIZE
        );

        const currentTileY = Math.round(
            (this.y - halfTile) / CONSTANTS.TILE_SIZE
        );

        const nextTileX = currentTileX + moveX;
        const nextTileY = currentTileY + moveY;

        if (this.collisionLayer) {
            const tilemap = this.collisionLayer.tilemap;

            // Check map boundaries
            if (
                nextTileX < 0 ||
                nextTileX >= tilemap.width ||
                nextTileY < 0 ||
                nextTileY >= tilemap.height
            ) {
                this.stopAtCurrentTile();
                return;
            }

            const currentTile = this.collisionLayer.getTileAt(
                currentTileX,
                currentTileY
            );

            const targetTile = this.collisionLayer.getTileAt(
                nextTileX,
                nextTileY
            );

            // Directional wall checks
            if (
                moveX === 1 &&
                targetTile?.properties?.blockLeft
            ) {
                this.stopAtCurrentTile();
                return;
            }

            if (
                moveX === -1 &&
                currentTile?.properties?.blockLeft
            ) {
                this.stopAtCurrentTile();
                return;
            }

            if (
                moveY === 1 &&
                currentTile?.properties?.blockDown
            ) {
                this.stopAtCurrentTile();
                return;
            }

            if (
                moveY === -1 &&
                targetTile?.properties?.blockDown
            ) {
                this.stopAtCurrentTile();
                return;
            }

            // Regular walls block movement from all directions
            if (targetTile && targetTile.collides) {
                const isDirectional =
                    targetTile.properties?.blockLeft ||
                    targetTile.properties?.blockRight ||
                    targetTile.properties?.blockUp ||
                    targetTile.properties?.blockDown;

                if (!isDirectional) {
                    this.stopAtCurrentTile();
                    return;
                }
            }
        }

        const targetPixelX =
            nextTileX * CONSTANTS.TILE_SIZE + halfTile;

        const targetPixelY =
            nextTileY * CONSTANTS.TILE_SIZE + halfTile;

        this.isMoving = true;

        this.playMovementAnimation(direction);

        this.movementTween = this.scene.tweens.add({
            targets: this,
            x: targetPixelX,
            y: targetPixelY,
            duration: CONSTANTS.MOVE_STEP_TIME,
            ease: "Linear",

            onComplete: () => {
                this.isMoving = false;
                this.movementTween = undefined;

                this.emit(
                    "tile-reached",
                    nextTileX,
                    nextTileY
                );

                // Continue moving if the key remains held
                if (
                    this.requestedMove &&
                    this.isDirectionHeld(
                        this.requestedMove.direction
                    )
                ) {
                    this.moveTile(
                        this.requestedMove.x,
                        this.requestedMove.y
                    );
                } else {
                    this.stopAtCurrentTile();
                }
            },
        });
    }

    private interruptMovement() {
        if (this.movementTween) {
            this.movementTween.stop();
            this.movementTween = undefined;
        }

        this.isMoving = false;

        const halfTile = CONSTANTS.TILE_SIZE / 2;

        const nearestTileX = Math.round(
            (this.x - halfTile) / CONSTANTS.TILE_SIZE
        );

        const nearestTileY = Math.round(
            (this.y - halfTile) / CONSTANTS.TILE_SIZE
        );

        this.x =
            nearestTileX * CONSTANTS.TILE_SIZE + halfTile;

        this.y =
            nearestTileY * CONSTANTS.TILE_SIZE + halfTile;

        this.anims.stop();
    }

    private stopAtCurrentTile() {
        this.isMoving = false;

        if (this.movementTween) {
            this.movementTween.stop();
            this.movementTween = undefined;
        }

        this.anims.stop();

        this.setTexture(
            "player_stationary",
            this.facingFrames[this.currentDirection]
        );
    }
}