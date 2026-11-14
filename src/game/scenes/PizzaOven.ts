import * as Phaser from "phaser";
import { Scene } from "phaser";
import { EventBus } from "../EventBus";

const PEEL = { x: 240, y: 640 };
const OVEN = { x: 660, y: 530, width: 250, height: 230 };
const BOX = { x: 1180, y: 430, width: 260, height: 230 };
const TIMER_AT = { x: 785, y: 490 };
const PIZZA_SIZE = 260;
const BAKE_SECONDS = 5;
const OVEN_SHIFT = 5;

const LAYER_ORDER = ["dough", "tomato_sauce", "cheese", "pepperoni"];
const LAYER_KEYS: Record<string, string> = {
    dough: "dough_layer",
    tomato_sauce: "tomato_sauce_layer",
    cheese: "cheese_layer",
    pepperoni: "pepperoni_layer"
};
const OVEN_ORDERS = [
    ["dough", "cheese"],
    ["dough", "tomato_sauce", "cheese"],
    ["dough", "tomato_sauce", "pepperoni"],
    ["dough", "cheese", "pepperoni"],
    ["dough", "tomato_sauce", "cheese", "pepperoni"]
];

export class PizzaOven extends Scene {
    private bgX = 0;
    private bgY = 0;
    private bgScale = 1;
    private pizza!: Phaser.GameObjects.Container;
    private timerText!: Phaser.GameObjects.Text;
    private bakeTimer?: Phaser.Time.TimerEvent;
    private secondsLeft = BAKE_SECONDS;
    private baking = false;
    private ready = false;
    private packing = false;
    private bakedCount = 0;
    private shiftOver = false;

    constructor() {
        super("PizzaOven");
    }

    init() {
        this.baking = false;
        this.ready = false;
        this.packing = false;
        this.shiftOver = false;
        this.bakedCount = 0;
        this.secondsLeft = BAKE_SECONDS;
    }

    create() {
        this.cameras.main.roundPixels = true;

        const background = this.add.image(0, 0, "pizza_oven_background").setOrigin(0, 0);
        this.bgScale = Math.max(this.scale.width / background.width, this.scale.height / background.height);
        background.setScale(this.bgScale);
        this.bgX = (this.scale.width - background.width * this.bgScale) / 2;
        this.bgY = (this.scale.height - background.height * this.bgScale) / 2;
        background.setPosition(this.bgX, this.bgY);

        this.timerText = this.add.text(this.toX(TIMER_AT.x), this.toY(TIMER_AT.y), "", {
            fontFamily: "Courier New, monospace",
            fontSize: "28px",
            color: "#ecf0f1",
            backgroundColor: "#0f141d",
            padding: { x: 10, y: 4 }
        }).setOrigin(0.5).setDepth(20).setVisible(false);

        this.spawnPizza();

        this.input.on("drag", (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, x: number, y: number) => {
            if (obj !== this.pizza || this.baking || this.packing) return;
            obj.setPosition(x, y);
        });

        this.input.on("dragend", (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
            if (obj !== this.pizza || this.baking || this.packing) return;
            if (!this.ready && this.hits(OVEN)) {
                this.pizza.setPosition(this.toX(OVEN.x + OVEN.width / 2), this.toY(OVEN.y + OVEN.height / 2));
                this.startBake();
                return;
            }
            if (this.ready && this.hits(BOX)) {
                this.packPizza();
                return;
            }
            const home = this.ready
                ? { x: OVEN.x + OVEN.width / 2, y: OVEN.y + OVEN.height / 2 }
                : PEEL;
            this.pizza.setPosition(this.toX(home.x), this.toY(home.y));
        });

        const button = this.add.text(24, 20, "Exit", {
            fontFamily: "Courier New, monospace",
            fontSize: "22px",
            color: "#ecf0f1",
            backgroundColor: "#0f141d",
            padding: { x: 12, y: 6 }
        }).setOrigin(0, 0).setDepth(30).setInteractive({ useHandCursor: true });

        button.on("pointerover", () => button.setColor("#f39c12"));
        button.on("pointerout", () => button.setColor("#ecf0f1"));
        button.on("pointerdown", () => this.leaveToCity());

        this.input.keyboard?.on("keydown", () => {
            if (this.shiftOver) this.leaveToCity();
        });

        EventBus.emit("current-scene-ready", this);
    }

    private spawnPizza() {
        const order = OVEN_ORDERS[Math.floor(Math.random() * OVEN_ORDERS.length)];
        const size = PIZZA_SIZE * this.bgScale;
        this.pizza = this.add.container(this.toX(PEEL.x), this.toY(PEEL.y));
        LAYER_ORDER.filter((id) => order.includes(id)).forEach((id, index) => {
            this.pizza.add(
                this.add.image(0, 0, LAYER_KEYS[id])
                    .setOrigin(0.5, 0.5)
                    .setDisplaySize(size, size)
                    .setDepth(index + 1)
            );
        });
        this.pizza.setDepth(10);
        this.ready = false;
        this.baking = false;
        this.timerText.setVisible(false);
        this.enableDrag();
    }

    private enableDrag() {
        const radius = (PIZZA_SIZE * this.bgScale) / 2;
        this.pizza.setInteractive(
            new Phaser.Geom.Circle(0, 0, radius),
            Phaser.Geom.Circle.Contains
        );
        this.input.setDraggable(this.pizza);
    }

    private toX(sourceX: number) {
        return this.bgX + sourceX * this.bgScale;
    }

    private toY(sourceY: number) {
        return this.bgY + sourceY * this.bgScale;
    }

    private hits(zone: { x: number; y: number; width: number; height: number }) {
        const left = this.toX(zone.x);
        const top = this.toY(zone.y);
        return this.pizza.x >= left
            && this.pizza.x <= left + zone.width * this.bgScale
            && this.pizza.y >= top
            && this.pizza.y <= top + zone.height * this.bgScale;
    }

    private startBake() {
        this.baking = true;
        this.pizza.disableInteractive();
        this.secondsLeft = BAKE_SECONDS;
        this.timerText.setVisible(true);
        this.updateTimerText();
        this.bakeTimer?.remove(false);
        this.bakeTimer = this.time.addEvent({
            delay: 1000,
            repeat: BAKE_SECONDS - 1,
            callback: () => {
                this.secondsLeft -= 1;
                this.updateTimerText();
                if (this.secondsLeft <= 0) this.finishBake();
            }
        });
    }

    private updateTimerText() {
        this.timerText.setText(`0:${this.secondsLeft.toString().padStart(2, "0")}`);
    }

    private finishBake() {
        this.baking = false;
        this.ready = true;
        this.bakeTimer = undefined;
        this.timerText.setText("Box it");
        this.enableDrag();
    }

    private packPizza() {
        this.packing = true;
        this.pizza.disableInteractive();
        this.timerText.setVisible(false);
        this.tweens.add({
            targets: this.pizza,
            alpha: 0,
            duration: 400,
            onComplete: () => {
                this.pizza.destroy();
                this.bakedCount += 1;
                this.packing = false;
                if (this.bakedCount >= OVEN_SHIFT) {
                    this.showShiftOver();
                    return;
                }
                this.spawnPizza();
            }
        });
    }

    private showShiftOver() {
        this.shiftOver = true;
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x0f141d, 0.72)
            .setDepth(40)
            .setInteractive();
        this.add.rectangle(width / 2, height / 2, 640, 220, 0x1a1208)
            .setStrokeStyle(4, 0xf39c12)
            .setDepth(41);
        this.add.text(width / 2, height / 2, "Thank you for your hard work today\nYour shift is over!", {
            fontFamily: "Courier New, monospace",
            fontSize: "24px",
            color: "#f39c12",
            align: "center"
        }).setOrigin(0.5).setDepth(42);
    }

    private leaveToCity() {
        this.bakeTimer?.remove(false);
        this.registry.set("pizzaCompleted", true);
        this.scene.start("City", { spawnAt: { x: 2, y: 16 } });
    }
}
