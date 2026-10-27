/**
 * This class defines what one of the characters on the battlefield
 * can do. Each character will have a different set of abilities 
 * (though it's gonna be pretty short since it's just for 1 level)
 */

import * as Phaser from "phaser";
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
  hpBar?: Phaser.GameObjects.Graphics;

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

    this.hpBar = scene.add.graphics();

    this.hpText = scene.add.text(screen.x, screen.y - 26, `${this.hp}/${this.maxHp}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: isPlayer ? '#a8ffbf' : '#ffcccc',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2
    }).setOrigin(0.5, 1).setScale(0.45);

    this.drawHpBar();
    this.updateDepth();
  }

  setPosition(x: number, y: number) {
    this.gridX = x;
    this.gridY = y;
    const screen = gridToScreen(x, y);
    this.sprite.setPosition(screen.x, screen.y);
    this.syncOverheadUI();
    this.updateDepth();
  }

  syncOverheadUI() {
    if (this.hpText) {
      this.hpText.setPosition(this.sprite.x, this.sprite.y - 26);
    }
    this.drawHpBar();
  }

  drawHpBar() {
    if (!this.hpBar) return;
    this.hpBar.clear();
    if (this.hp <= 0) return;

    const barWidth = 24;
    const barHeight = 4;
    const x = this.sprite.x - barWidth / 2;
    const y = this.sprite.y - 25;
    const ratio = Math.max(0, Math.min(1, this.hp / this.maxHp));

    // Dark background + border
    this.hpBar.fillStyle(0x000000, 0.85);
    this.hpBar.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2);

    // Missing health background
    this.hpBar.fillStyle(0x441111, 0.9);
    this.hpBar.fillRect(x, y, barWidth, barHeight);

    // Current HP fill
    const fillColor = this.isPlayer ? 0x2ecc71 : 0xe74c3c;
    this.hpBar.fillStyle(fillColor, 1);
    this.hpBar.fillRect(x, y, Math.round(barWidth * ratio), barHeight);
  }

  updateDepth() {
    // Offset + 1 ensures the unit renders in front of the tile floor
    const baseDepth = (this.gridX + this.gridY) * 10 + 1;
    this.sprite.setDepth(baseDepth);
    if (this.hpBar) {
      this.hpBar.setDepth(baseDepth + 1);
    }
    if (this.hpText) {
      this.hpText.setDepth(baseDepth + 2);
    }
  }

  updateHpText() {
    if (this.hpText) {
      this.hpText.setText(`${Math.max(0, this.hp)}/${this.maxHp}`);
    }
    this.drawHpBar();
  }
}
