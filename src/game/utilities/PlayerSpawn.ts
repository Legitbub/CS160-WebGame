import { Scene } from "phaser";
import { PlayerCharacter } from "../PlayerCharacter";
import { CONSTANTS } from "./Constants";

export interface PlayerSetupOptions {
    scene: Scene;
    map: Phaser.Tilemaps.Tilemap;
    wallsLayer?: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
    zoom?: number;
    spawnTile?: { x: number; y: number };
}

/**
 * Create the player sprite within the scene according to the given position
 * and set it so that it bumps into walls. The camera should follow the character.
 * Spawns in center of scene by default. 
 */
export function PlayerSpawn({ scene, map, wallsLayer, zoom = 3, spawnTile }: PlayerSetupOptions): PlayerCharacter {
    const tileX = spawnTile ? spawnTile.x : Math.floor(map.width / 2);
    const tileY = spawnTile ? spawnTile.y : Math.floor(map.height / 2);

    const playerX = tileX * CONSTANTS.TILE_SIZE + CONSTANTS.TILE_SIZE / 2;
    const playerY = tileY * CONSTANTS.TILE_SIZE + CONSTANTS.TILE_SIZE / 2;

    const player = new PlayerCharacter(scene, playerX, playerY, 'player');

    if (wallsLayer) {
        wallsLayer.setCollisionByExclusion([-1, 0]);
        player.setCollisionLayer(wallsLayer);
    }

    scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    scene.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    scene.cameras.main.setZoom(zoom);
    scene.cameras.main.startFollow(player, true);

    const visibleWidth = scene.scale.width / zoom;
    const visibleHeight = scene.scale.height / zoom;
    
    // 4 tiles of padding around the player
    const padding = CONSTANTS.TILE_SIZE * 4;
    const deadzoneWidth = Math.max(CONSTANTS.TILE_SIZE, visibleWidth - padding * 2);
    const deadzoneHeight = Math.max(CONSTANTS.TILE_SIZE, visibleHeight - padding * 2);
    scene.cameras.main.setDeadzone(deadzoneWidth, deadzoneHeight);

    return player;
}