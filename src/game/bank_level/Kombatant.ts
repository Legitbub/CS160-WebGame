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
  moveRange: number = 4;
  attackRange: number = 1;
  hp: number = 100;
  maxHp: number = 100;
  speed: number;
  ct: number = 0;
  isPlayer: boolean;
  hasMoved: boolean = false;
  hasActed: boolean = false;
  sprite: Phaser.GameObjects.Sprite;
  hpText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, name: string, x: number, y: number,
                        speed: number, isPlayer: boolean, textureKey: string = 'player_stationary') {
    this.name = name;
    this.gridX = x;
    this.gridY = y;
    this.speed = speed;
    this.isPlayer = isPlayer;

    const screen = gridToScreen(x, y);
    // Origin at (0.5, 0.75) aligns a character's feet with the diamond center
    this.sprite = scene.add.sprite(screen.x, screen.y, textureKey, 0).setOrigin(0.5, 0.75);
    if (!isPlayer) {
      this.sprite.setTint(0xff5555);
    }

    this.hpText = scene.add.text(screen.x, screen.y - 22, `${this.hp}/${this.maxHp}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: isPlayer ? '#a8ffbf' : '#ffaaaa',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2
    }).setOrigin(0.5, 1).setScale(0.45);

    this.updateDepth();
  }

  setPosition(x: number, y: number) {
    this.gridX = x;
    this.gridY = y;
    const screen = gridToScreen(x, y);
    this.sprite.setPosition(screen.x, screen.y);
    if (this.hpText) {
      this.hpText.setPosition(screen.x, screen.y - 22);
    }
    this.updateDepth();
  }

  updateDepth() {
    // Offset + 1 ensures the unit renders in front of the tile floor
    this.sprite.setDepth((this.gridX + this.gridY) * 10 + 1);
    if (this.hpText) {
      this.hpText.setDepth((this.gridX + this.gridY) * 10 + 2);
    }
  }

  updateHpText() {
    if (this.hpText) {
      this.hpText.setText(`${Math.max(0, this.hp)}/${this.maxHp}`);
    }
  }
}
