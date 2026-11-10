import { Scene } from 'phaser';

const PIZZA_ORDER_SPRITES = [
    "cheese_pizza",
    "tomato_cheese_pizza",
    "cheese_pepperoni_pizza",
    "tomato_pepperoni_pizza",
    "tomato_cheese_pepperoni_pizza"
];

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(centerX, centerY, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(centerX - 230, centerY, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        // Main Menu & Player Sprites
        this.load.image("title", "/assets/title.jpg");
        this.load.spritesheet("player_stationary", "/assets/stationary Nerdy Guy sprites.png", {
            frameWidth: 32,
            frameHeight: 32
        });
        this.load.spritesheet("player_walking", "/assets/walking Nerdy Guy sprites.png", {
            frameWidth: 32,
            frameHeight: 32
        });

        // Cutscene Slides
        this.load.image("intro_slide", "/assets/cutscene_slides/intro slide.jpg");
        this.load.image("intro_slide_2", "/assets/cutscene_slides/intro slide 2.jpg");
        this.load.image("outside_bank", "/assets/cutscene_slides/outside the bank.jpg");
        this.load.image("entering_bank", "/assets/cutscene_slides/entering the bank.jpg");
        this.load.image("outside_pizza", "/assets/cutscene_slides/outside the pizza place.jpg");
        this.load.image("entering_pizza", "/assets/cutscene_slides/entering the pizza place.jpg");
        this.load.image("getting_back_home", "/assets/cutscene_slides/getting back home.jpg");
        this.load.image("frustrated", "/assets/cutscene_slides/frustrated.jpg");
        this.load.image("inspiration", "/assets/cutscene_slides/inspiration.jpg");
        this.load.image("gamedeving", "/assets/cutscene_slides/gamedeving.jpg");
        this.load.image("mom_arrives", "/assets/cutscene_slides/mom arrives.jpg");
        this.load.image("celebrate", "/assets/cutscene_slides/celebrate.jpg");
        this.load.image("ending", "/assets/cutscene_slides/ending.jpg");

        // House (Game) Scene Assets
        this.load.image("tiles", "/scene_tilemaps/Cottage_Tileset/Cottage_Tileset.png");
        this.load.tilemapTiledJSON("tiles_map", "/assets/test.json");

        // City Scene Assets
        this.load.image("city", "/scene_tilemaps/Simple_City_Tileset/SIMPLE CITY 32X32.png");
        this.load.image("player_house", "/scene_tilemaps/Player_House_Tileset/House resized.png");
        this.load.image("urban_city", "/scene_tilemaps/Urban_City_Tileset/Urban City Tileset Basic 32x32 Dlou Saiyan.png");
        this.load.tilemapTiledJSON("city_map", "/assets/city_scene.json");

        // Bank Battle Scene Assets
        this.load.image("floors", "/scene_tilemaps/Bank_Isometric_Tileset/Floors.png");
        this.load.image("walls", "/scene_tilemaps/Bank_Isometric_Tileset/Walls.png");
        this.load.tilemapTiledJSON("bank_battle_map", "/assets/bank_level.json");
        this.load.spritesheet("robber_stationary", "/assets/robber spritesheet.png", {
            frameWidth: 32,
            frameHeight: 32
        });
        this.load.spritesheet("robber_shooting", "/assets/robber shooting.png", {
            frameWidth: 32,
            frameHeight: 32
        });
        this.load.spritesheet("security_guard_stationary", "/assets/security guard sprites.png", {
            frameWidth: 32,
            frameHeight: 32
        });

        // Pizza Shop Scene Assets
        this.load.image("pizza_background", "/assets/pizza_shop/pizza_background.png");
        this.load.image("dough_layer", "/assets/pizza_shop/ingredients/dough_layer.png");
        this.load.image("tomato_sauce_layer", "/assets/pizza_shop/ingredients/tomato_sauce_layer_clean.png");
        this.load.image("cheese_layer", "/assets/pizza_shop/ingredients/cheese_layer_clean.png");
        this.load.image("pepperoni_layer", "/assets/pizza_shop/ingredients/pepperoni_layer.png");
        PIZZA_ORDER_SPRITES.forEach((key) => {
            this.load.image(key, `/assets/pizza_shop/pizza_orders/${key}.png`);
        });
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.
        // --- PLAYER DOWN ---
        this.anims.create({
            key: 'player-down',
            frames: [
            { key: 'player_stationary', frame: 0 },
            { key: 'player_walking',    frame: 4 }, // Adjust to your sheet's frame indices
            { key: 'player_stationary', frame: 0 },
            { key: 'player_walking',    frame: 5 }
            ],
            frameRate: 6,
            repeat: -1
        });

        // --- PLAYER UP ---
        this.anims.create({
            key: 'player-up',
            frames: [
            { key: 'player_stationary', frame: 1 },
            { key: 'player_walking',    frame: 2 },
            { key: 'player_stationary', frame: 1 },
            { key: 'player_walking',    frame: 3 }
            ],
            frameRate: 6,
            repeat: -1
        });

        // --- PLAYER LEFT ---
        this.anims.create({
            key: 'player-left',
            frames: [
            { key: 'player_stationary', frame: 2 },
            { key: 'player_walking',    frame: 0 },
            { key: 'player_stationary', frame: 2 },
            { key: 'player_walking',    frame: 0 }
            ],
            frameRate: 6,
            repeat: -1
        });

        // --- PLAYER RIGHT ---
        // (If you don't flip 'player-left' and have distinct right frames)
        this.anims.create({
            key: 'player-right',
            frames: [
            { key: 'player_stationary', frame: 3 },
            { key: 'player_walking',    frame: 1 },
            { key: 'player_stationary', frame: 3 },
            { key: 'player_walking',    frame: 1 }
            ],
            frameRate: 6,
            repeat: -1
        });

        this.scene.start('Runner');
    }
}
