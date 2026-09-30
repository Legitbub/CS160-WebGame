import Phaser from "phaser";
import { CONSTANTS } from "./Constants";

export class PlayerCharacter extends Phaser.Physics.Arcade.Sprite {
    private arrows!: Phaser.Types.Input.Keyboard.CursorKeys;
    private isMoving = false;
    private collisionLayer?: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;

    constructor(scene: Phaser.Scene, x: number, y: number, texture: string = "PlayerCharacter") {
        super(scene, x, y, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Prevent moving off screen
        this.setCollideWorldBounds(true);

        if (scene.input.keyboard) {
            this.arrows = scene.input.keyboard.createCursorKeys();
        }
    }

    public setCollisionLayer(layer: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer) {
        this.collisionLayer = layer;
    }

    // Handle player input for movement
    update() {
        if (!this.arrows || this.isMoving) return;

        let moveX = 0;
        let moveY = 0;

        if (this.arrows.left.isDown) {
            moveX = -1;
        } else if (this.arrows.right.isDown) {
            moveX = 1;
        } else if (this.arrows.up.isDown) {
            moveY = -1;
        } else if (this.arrows.down.isDown) {
            moveY = 1
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
            // Check if next tile is a wall
            const targetTile = this.collisionLayer.getTileAt(nextTileX, nextTileY);
            if (targetTile && targetTile.collides) {
                return;
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
            }
        });
    }
}