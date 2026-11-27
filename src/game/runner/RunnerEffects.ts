export class RunnerEffects {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    nearMiss(x: number, y: number, message: string) {
        this.scene.cameras.main.flash(
            100,
            0,
            255,
            255
        );

        this.scene.cameras.main.shake(
            120,
            0.002
        );

        this.showText(
            x,
            y,
            message,
            "#00ffff"
        );
    }

    crash() {
        this.scene.cameras.main.flash(
            300,
            255,
            0,
            0
        );

        this.scene.cameras.main.shake(
            400,
            0.012
        );
    }

    pickup(
        x: number,
        y: number,
        message: string,
        color = "#ffe600"
    ) {
        this.showText(
            x,
            y,
            message,
            color
        );
    }

    sparkle(
        x: number,
        y: number,
        color: number
    ) {
        for (let i = 0; i < 6; i++) {
            const angle =
                (Math.PI * 2 * i) / 6;

            const spark = this.scene.add
                .circle(
                    x,
                    y,
                    3,
                    color,
                    1
                )
                .setDepth(110);

            this.scene.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * 22,
                y: y + Math.sin(angle) * 22,
                alpha: 0,
                scale: 0.2,
                duration: 350,
                onComplete: () => {
                    spark.destroy();
                }
            });
        }
    }

    showText(
        x: number,
        y: number,
        message: string,
        color: string
    ) {
        const text = this.scene.add
            .text(
                x,
                y,
                message,
                {
                    fontFamily: "Arial Black",
                    fontSize: "18px",
                    color,
                    align: "center",
                    stroke: "#000000",
                    strokeThickness: 4
                }
            )
            .setOrigin(0.5)
            .setDepth(110);

        this.scene.tweens.add({
            targets: text,
            y: y - 45,
            alpha: 0,
            duration: 800,
            onComplete: () => {
                text.destroy();
            }
        });
    }
}