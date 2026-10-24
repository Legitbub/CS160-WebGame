import { EventBus } from "../EventBus";
import { Scene } from "phaser";

type PizzaRecipe = {
    name: string;
    ingredients: string[];
    textureKey: string;
};

type Ingredient = {
    key: string;
    depth: number;
    tray: { x: number; y: number; width: number; height: number };
};

const ORDER_SPRITES = [
    "cheese_pizza",
    "tomato_cheese_pizza",
    "cheese_pepperoni_pizza",
    "tomato_pepperoni_pizza",
    "tomato_cheese_pepperoni_pizza"
];

// Cream paper inside the hanging board on pizza_background.png (1536x1024).
const ORDER_BOARD = { x: 600, y: 158, width: 270, height: 210 };

// Wooden prep board, in the same source pixels as the background.
const PREP_BOARD = { x: 379, y: 655, width: 432, height: 190 };
const PIZZA_DISPLAY_SIZE = 416;

const INGREDIENTS: Record<string, Ingredient> = {
    dough: {
        key: "dough_layer",
        depth: 1,
        tray: { x: 48, y: 668, width: 260, height: 168 }
    },
    tomato_sauce: {
        key: "tomato_sauce_layer",
        depth: 2,
        tray: { x: 888, y: 700, width: 176, height: 130 }
    },
    cheese: {
        key: "cheese_layer",
        depth: 3,
        tray: { x: 1102, y: 700, width: 178, height: 130 }
    },
    pepperoni: {
        key: "pepperoni_layer",
        depth: 4,
        tray: { x: 1292, y: 700, width: 168, height: 130 }
    }
};

const orders: PizzaRecipe[] = [
    { name: "Cheese", ingredients: ["dough", "cheese"], textureKey: "cheese_pizza" },
    { name: "Tomato and cheese", ingredients: ["dough", "tomato_sauce", "cheese"], textureKey: "tomato_cheese_pizza" },
    { name: "Tomato and pepperoni", ingredients: ["dough", "tomato_sauce", "pepperoni"], textureKey: "tomato_pepperoni_pizza" },
    { name: "Cheese and pepperoni", ingredients: ["dough", "cheese", "pepperoni"], textureKey: "cheese_pepperoni_pizza" },
    {
        name: "Tomato, cheese, and pepperoni",
        ingredients: ["dough", "tomato_sauce", "cheese", "pepperoni"],
        textureKey: "tomato_cheese_pepperoni_pizza"
    }
];

const ORDER_SECONDS = 8;

export class PizzaShop extends Scene {
    private orderIndex = 0;
    private placed = new Set<string>();
    private layers: Phaser.GameObjects.Image[] = [];
    private orderImage!: Phaser.GameObjects.Image;
    private orderDisplaySize = 0;
    private orderTimer?: Phaser.Time.TimerEvent;
    private secondsLeft = ORDER_SECONDS;
    private advancing = false;
    private pizzaX = 0;
    private pizzaY = 0;
    private pizzaSize = 0;
    private statusText!: Phaser.GameObjects.Text;
    private timerText!: Phaser.GameObjects.Text;

    constructor() {
        super("PizzaShop");
    }

    preload() {
        this.load.image("pizza_background", "/assets/pizza_shop/pizza_background.png");
        this.load.image("dough_layer", "/assets/pizza_shop/ingredients/dough_layer.png");
        this.load.image("tomato_sauce_layer", "/assets/pizza_shop/ingredients/tomato_sauce_layer_clean.png");
        this.load.image("cheese_layer", "/assets/pizza_shop/ingredients/cheese_layer_clean.png");
        this.load.image("pepperoni_layer", "/assets/pizza_shop/ingredients/pepperoni_layer.png");
        ORDER_SPRITES.forEach((key) => {
            this.load.image(key, `/assets/pizza_shop/pizza_orders/${key}.png`);
        });
    }

    create() {
        this.cameras.main.roundPixels = true;
        this.placed.clear();
        this.layers = [];
        this.advancing = false;
        this.orderIndex = 0;

        const background = this.add.image(0, 0, "pizza_background").setOrigin(0, 0);
        const scale = Math.max(this.scale.width / background.width, this.scale.height / background.height);
        background.setScale(scale);
        background.setPosition(
            (this.scale.width - background.width * scale) / 2,
            (this.scale.height - background.height * scale) / 2
        );

        this.orderDisplaySize = Math.min(ORDER_BOARD.width, ORDER_BOARD.height) * 0.72 * scale;
        this.orderImage = this.add.image(
            background.x + (ORDER_BOARD.x + ORDER_BOARD.width / 2) * scale,
            background.y + (ORDER_BOARD.y + ORDER_BOARD.height / 2) * scale,
            orders[this.orderIndex].textureKey
        ).setDisplaySize(this.orderDisplaySize, this.orderDisplaySize);

        this.pizzaX = background.x + (PREP_BOARD.x + PREP_BOARD.width / 2) * scale;
        this.pizzaY = background.y + (PREP_BOARD.y + PREP_BOARD.height / 2) * scale;
        this.pizzaSize = PIZZA_DISPLAY_SIZE * scale;

        this.addTray("dough", background, scale);
        this.addTray("tomato_sauce", background, scale);
        this.addTray("cheese", background, scale);
        this.addTray("pepperoni", background, scale);
        this.addPrepBoard(background, scale);

        this.statusText = this.add.text(this.scale.width / 2, this.scale.height - 28, "", {
            fontFamily: "Courier New, monospace",
            fontSize: "22px",
            color: "#f39c12",
            backgroundColor: "#0f141d",
            padding: { x: 8, y: 4 }
        }).setOrigin(0.5).setDepth(20);

        this.timerText = this.add.text(this.scale.width - 24, 20, "", {
            fontFamily: "Courier New, monospace",
            fontSize: "22px",
            color: "#ecf0f1",
            backgroundColor: "#0f141d",
            padding: { x: 12, y: 6 }
        }).setOrigin(1, 0).setDepth(30);
        this.startOrderTimer();

        const exitButton = this.addExitButton();
        this.addTrashButton(exitButton.x + exitButton.width + 12);
        this.input.keyboard?.on("keydown-ESC", () => this.leaveToCity());

        EventBus.emit("current-scene-ready", this);
    }

    private addExitButton() {
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
        return button;
    }

    private addTrashButton(x: number) {
        const button = this.add.text(x, 20, "Trash", {
            fontFamily: "Courier New, monospace",
            fontSize: "22px",
            color: "#ecf0f1",
            backgroundColor: "#0f141d",
            padding: { x: 12, y: 6 }
        }).setOrigin(0, 0).setDepth(30).setInteractive({ useHandCursor: true });

        button.on("pointerover", () => button.setColor("#f39c12"));
        button.on("pointerout", () => button.setColor("#ecf0f1"));
        button.on("pointerdown", () => this.throwAwayPizza());
    }

    private throwAwayPizza() {
        if (this.advancing) return;
        this.layers.forEach((layer) => layer.destroy());
        this.layers = [];
        this.placed.clear();
        this.statusText.setText("");
    }

    private leaveToCity() {
        this.orderTimer?.remove(false);
        this.orderTimer = undefined;
        this.scene.start("City", { spawnAt: { x: 2, y: 16 } });
    }

    private currentOrder() {
        return orders[this.orderIndex];
    }

    private startOrderTimer() {
        this.orderTimer?.remove(false);
        this.secondsLeft = ORDER_SECONDS;
        this.updateTimerText();
        this.orderTimer = this.time.addEvent({
            delay: 1000,
            repeat: ORDER_SECONDS - 1,
            callback: () => {
                this.secondsLeft -= 1;
                this.updateTimerText();
                if (this.secondsLeft <= 0) this.failOrder();
            }
        });
    }

    private updateTimerText() {
        const minutes = Math.floor(this.secondsLeft / 60);
        const seconds = this.secondsLeft % 60;
        this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    }

    private failOrder() {
        if (this.advancing) return;
        this.advancing = true;
        this.orderTimer?.remove(false);
        this.orderTimer = undefined;
        this.statusText.setText("Time's up");
        this.clearBoard(() => this.advanceOrder());
    }

    private completeOrder() {
        if (this.advancing) return;
        this.advancing = true;
        this.orderTimer?.remove(false);
        this.orderTimer = undefined;
        this.statusText.setText("Order complete");
        this.clearBoard(() => this.advanceOrder());
    }

    private clearBoard(next: () => void) {
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            this.layers.forEach((layer) => layer.destroy());
            this.layers = [];
            this.placed.clear();
            if (this.scene.isActive()) next();
        };

        if (this.layers.length === 0) {
            this.time.delayedCall(400, finish);
            return;
        }

        this.tweens.add({
            targets: this.layers,
            alpha: 0,
            duration: 400,
            onComplete: finish
        });
    }

    private advanceOrder() {
        this.orderIndex = (this.orderIndex + 1) % orders.length;
        this.orderImage.setTexture(this.currentOrder().textureKey);
        this.orderImage.setDisplaySize(this.orderDisplaySize, this.orderDisplaySize);
        this.statusText.setText("");
        this.advancing = false;
        this.startOrderTimer();
    }

    private addTray(id: string, background: Phaser.GameObjects.Image, scale: number) {
        const tray = INGREDIENTS[id].tray;
        const zone = this.add.zone(
            background.x + (tray.x + tray.width / 2) * scale,
            background.y + (tray.y + tray.height / 2) * scale,
            tray.width * scale,
            tray.height * scale
        );
        zone.setInteractive();
        zone.on("pointerdown", () => this.addIngredient(id));
    }

    private addPrepBoard(background: Phaser.GameObjects.Image, scale: number) {
        const zone = this.add.zone(
            background.x + (PREP_BOARD.x + PREP_BOARD.width / 2) * scale,
            background.y + (PREP_BOARD.y + PREP_BOARD.height / 2) * scale,
            PREP_BOARD.width * scale,
            PREP_BOARD.height * scale
        );
        zone.setInteractive();
        zone.on("pointerdown", () => this.refreshOrderStatus(true));
    }

    private addIngredient(id: string) {
        if (this.advancing) return;
        if (this.placed.has(id)) return;
        if (id !== "dough" && !this.placed.has("dough")) return;

        const ingredient = INGREDIENTS[id];
        const layer = this.add.image(this.pizzaX, this.pizzaY, ingredient.key)
            .setDisplaySize(this.pizzaSize, this.pizzaSize)
            .setDepth(ingredient.depth);
        this.layers.push(layer);
        this.placed.add(id);
        this.refreshOrderStatus(false);
    }

    private refreshOrderStatus(fromBoard: boolean) {
        const order = this.currentOrder();
        const matches = this.placed.size === order.ingredients.length
            && order.ingredients.every((id) => this.placed.has(id));
        if (matches) {
            this.completeOrder();
            return;
        }
        this.statusText.setText(fromBoard ? "Not the order yet" : "");
    }
}
