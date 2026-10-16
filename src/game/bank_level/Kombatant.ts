/**
 * This class defines what one of the characters on the battlefield
 * can do. Each character will have a different set of abilities 
 * (though it's gonna be pretty short since it's just for 1 level)
 */

import { gridToScreen } from "./GridConversion";

export class Kombatant {
  name: string;
  gridX: number;
  gridY: number;
  moveRange: number = 3;
  attackRange: number = 1;
  hp: number = 100;
  maxHp: number = 100;
  speed: number;
  ct: number = 0;
  isPlayer: boolean;
  hasMoved: boolean = false;
  hasActed: boolean = false;
  sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, name: string, x: number, y: number,
                        speed: number, isPlayer: boolean) {
    this.name = name;
    this.gridX = x;
    this.gridY = y;
    this.speed = speed;
    this.isPlayer = isPlayer;

    const screen = gridToScreen(x, y);
    // Origin at (0.5, 0.75) aligns a character's feet with the diamond center
    this.sprite = scene.add.sprite(screen.x, screen.y, 'unit').setOrigin(0.5, 0.75);
    this.updateDepth();
  }

  updateDepth() {
    // Offset + 1 ensures the unit renders in front of the tile floor
    this.sprite.setDepth((this.gridX + this.gridY) * 10 + 1);
  }
}