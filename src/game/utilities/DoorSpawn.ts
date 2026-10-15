import { Scene } from "phaser";
import { CONSTANTS } from "./Constants";
import { PlayerCharacter } from "../PlayerCharacter";

export interface DoorDetails {
    tileX: number;
    tileY: number;
    exitTo: string;
    spawnAt?: { x: number; y: number };
}

export interface DoorLocation {
    scene: Scene;
    tilemap: Phaser.Tilemaps.Tilemap;
    player: PlayerCharacter;
    layer?: string;
    fadeTime?: number;
}

// Make a list of the doors in the scene and assign them exit properties
export function makeDoors({scene, tilemap, player, layer, fadeTime = 750}
    : DoorLocation): DoorDetails[] {
    const doorObjects = tilemap.getObjectLayer(layer)?.objects || [];
    const doors: DoorDetails[] = doorObjects.map((d) => {
        const exitTo = d.properties?.find((p: any) => p.name === "exitTo")?.value;
        const spawnX = d.properties?.find((p: any) => p.name === "spawnX")?.value;
        const spawnY = d.properties?.find((p: any) => p.name === "spawnY")?.value;

        return {
            tileX: Math.floor((d.x ?? 0) / CONSTANTS.TILE_SIZE),
            tileY: Math.floor((d.y ?? 0) / CONSTANTS.TILE_SIZE),
            exitTo: exitTo,
            spawnAt: {x: spawnX, y: spawnY}
        };
    });

    // Allow only 1 fade at a time
    let fading = false;

    // Listen for player reaching door; fade screen when it lands on the tile
    player.on('tile-reached', (tileX: number, tileY: number) => {
        if (fading) return;

        const matchingDoor = doors.find(d => d.tileX === tileX && d.tileY === tileY);
        if (matchingDoor) {
            fading = true;
            scene.cameras.main.fadeOut(fadeTime, 0, 0, 0);
            scene.cameras.main.once('camerafadeoutcomplete', () => {
                scene.scene.start(matchingDoor.exitTo, {
                    spawnAt: matchingDoor.spawnAt
                });
            });
        }
    });

    return doors;
}