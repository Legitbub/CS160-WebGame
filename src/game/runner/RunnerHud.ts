import { RunnerState } from "./RunnerTypes";

export class RunnerHud {
    private scene: Phaser.Scene;
    private text!: Phaser.GameObjects.Text;
    private panel!: Phaser.GameObjects.Rectangle;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    create() {
        this.panel = this.scene.add
            .rectangle(
                165,
                82,
                330,
                175,
                0x111827,
                0.9
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(99);

        this.panel.setStrokeStyle(
            2,
            0xffd700,
            0.85
        );

        this.text = this.scene.add
            .text(24, 20, "", {
                fontFamily: "Arial Black",
                fontSize: "17px",
                color: "#ffffff",
                lineSpacing: 4,
                stroke: "#000000",
                strokeThickness: 4
            })
            .setScrollFactor(0)
            .setDepth(100);
    }

    update(state: RunnerState) {
        const combo =
            state.combo > 0
                ? `\nCOMBO: x${state.combo}`
                : "";

        const powerUps =
            state.activePowerUps.length > 0
                ? `\n${state.activePowerUps.join("\n")}`
                : "";

        this.text.setText(
            `SLAMAZON DELIVERY\n` +
            `LAP: ${state.lap}\n` +
            `SCORE: ${Math.floor(state.score)}\n` +
            `COINS: ${state.coins}\n` +
            `PACKAGE: ${state.packageCondition}%\n` +
            `SPEED: ${Math.floor(state.speed)}` +
            combo +
            powerUps
        );
    }
}