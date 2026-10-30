import * as Phaser from "phaser";
import { CONSTANTS } from "./utilities/Constants";

export class PlayerCharacter extends Phaser.Physics.Arcade.Sprite {
    private arrows!: Phaser.Types.Input.Keyboard.CursorKeys;
    private isMoving = false;
    private isFrozen = false;
    private collisionLayer?: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
    private currentDirection = "down";
    private facingFrames: {[key: string]: number } = {
        down: 0, 
        up: 1, 
        left: 2,
        right: 3 
    };

    constructor(scene: Phaser.Scene, x: number, y: number, texture: string = "PlayerCharacter") {
        super(scene, x, y, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Prevent moving off screen
        this.setCollideWorldBounds(true);

        // On spawn
        this.setTexture("player_stationary", this.facingFrames[this.currentDirection]);
        
        if (scene.input.keyboard) {
            this.arrows = scene.input.keyboard.createCursorKeys();
        }
    }

    public setCollisionLayer(layer: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer) {
        this.collisionLayer = layer;
    }

    public setFrozen(frozen: boolean) {
        this.isFrozen = frozen;
    }

    public getFrozen(): boolean {
        return this.isFrozen;
    }

    public stepDown() {
        this.currentDirection = "down";
        this.anims.play("player-down", true);
        this.moveTile(0, 1);
    }

    // Handle player input for movement
    update() {
        if (!this.arrows || this.isMoving || this.isFrozen) return;

        let moveX = 0;
        let moveY = 0;

        if (this.arrows.left.isDown) {
            moveX = -1;
            this.currentDirection = "left";
            this.anims.play("player-left", true);
        } else if (this.arrows.right.isDown) {
            moveX = 1;
            this.currentDirection = "right";
            this.anims.play("player-right", true);
        } else if (this.arrows.up.isDown) {
            moveY = -1;
            this.currentDirection = "up";
            this.anims.play("player-up", true);
        } else if (this.arrows.down.isDown) {
            moveY = 1;
            this.currentDirection = "down";
            this.anims.play("player-down", true);
        }

        if (moveX !== 0 || moveY !== 0) {
            this.moveTile(moveX, moveY);
        }
    }

    private moveTile(moveX: number, moveY: number) {
        const currentTileX = Math.floor(this.x / CONSTANTS.TILE_SIZE);
        const currentTileY = Math.floor(this.y / CONSTANTS.TILE_SIZE);
        const nextTileX = currentTileX + moveX;
        const nextTileY = currentTileY + moveY;

        if (this.collisionLayer) {
            // Check for edge of screen
            if (nextTileX < 0 || nextTileX >= this.collisionLayer.tilemap.width ||
                nextTileY < 0 || nextTileY >= this.collisionLayer.tilemap.height)
            {
                return;
            }
            // Check if next tile is a directional wall
            const currentTile = this.collisionLayer.getTileAt(currentTileX, currentTileY)
            const targetTile = this.collisionLayer.getTileAt(nextTileX, nextTileY);
            if (moveX === 1 && targetTile?.properties?.blockLeft) {
                return;
            } 
            if (moveX === -1 && currentTile?.properties?.blockLeft) {
                return;
            } 
            if (moveY === 1 && currentTile?.properties?.blockDown) {
                return;
            } 
            if (moveY === -1 && targetTile?.properties?.blockDown) {
                return;
            }

            // Regular walls get blocked from all sides
            if (targetTile && targetTile.collides) {
                const isDirectional = targetTile.properties?.blockLeft || targetTile.properties?.blockRight || 
                    targetTile.properties?.blockUp || targetTile.properties?.blockDown;

                if (!isDirectional) {
                    return;
                }
            }
        }

        // Perform movement tween
        this.isMoving = true;
        const targetPixelX = nextTileX * CONSTANTS.TILE_SIZE + CONSTANTS.TILE_SIZE / 2;
        const targetPixelY = nextTileY * CONSTANTS.TILE_SIZE + CONSTANTS.TILE_SIZE / 2;

        this.scene.tweens.add({
            targets: this,
            x: targetPixelX,
            y: targetPixelY,
            duration: CONSTANTS.MOVE_STEP_TIME,
            ease: 'Linear',
            onComplete: () => {
                this.isMoving = false;
                this.anims.stop();
                const targetFrame = this.facingFrames[this.currentDirection];
                this.setTexture('player_stationary', targetFrame);
                this.emit('tile-reached', nextTileX, nextTileY);
            }
        });
    }
}
