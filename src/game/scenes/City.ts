import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import { PlayerCharacter } from "../PlayerCharacter";
import { CONSTANTS } from "../utilities/Constants"
import { PlayerSetupOptions, PlayerSpawn } from "../utilities/PlayerSpawn";
import { DoorDetails, makeDoors } from "../utilities/DoorSpawn";
import { CutsceneSlide } from "./Cutscene";

export class City extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    gameText: Phaser.GameObjects.Text;
    private player!: PlayerCharacter;
    private objectLayer!: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
    private spawnAt?: {x: number, y: number};
    private doors: DoorDetails[] = [];

    constructor ()
    {
        super('City');
    }

    preload() 
    {
        // Load tilemap (room layout) and tileset (building blocks)
        this.load.image('city', '/scene_tilemaps/Simple_City_Tileset/SIMPLE CITY 32X32.png');
        this.load.image('player_house', "/scene_tilemaps/Player_House_Tileset/House resized.png");
        this.load.image('urban_city', "/scene_tilemaps/Urban_City_Tileset/Urban City Tileset Basic 32x32 Dlou Saiyan.png");
        this.load.tilemapTiledJSON('city_map', '/assets/city_scene.json');
        this.load.image('outside_bank', '/assets/cutscene_slides/outside the bank.jpg');
        this.load.image('entering_bank', '/assets/cutscene_slides/entering the bank.jpg');
        this.load.image('outside_pizza', '/assets/cutscene_slides/outside the pizza place.jpg');
        this.load.image('entering_pizza', '/assets/cutscene_slides/entering the pizza place.jpg');
    }

    init(data: {spawnAt: {x: number, y: number}}) {
        this.spawnAt = data.spawnAt;
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.roundPixels = true;

        // Create map and tileset
        const tilemap = this.make.tilemap({key: "city_map"});
        const tileset1 = tilemap.addTilesetImage("Simple City", "city")!;
        const tileset2 = tilemap.addTilesetImage("Player House", "player_house")!;
        const tileset3 = tilemap.addTilesetImage("Urban City", "urban_city")!;

        const floorLayer = tilemap.createLayer('Ground', tileset1);
        const buildings = tilemap.createLayer("Buildings", [tileset1, tileset2, tileset3]);
        this.objectLayer = tilemap.createLayer('Object Tiles', tileset1)!;


        this.player = PlayerSpawn({
            scene: this,
            map: tilemap,
            wallsLayer: this.objectLayer,
            spawnTile: this.spawnAt
        });

        const doorCutscenes: Record<string, CutsceneSlide[]> = {
            Battle_in_Bank: [
                {
                    textureKey: "outside_bank",
                    text: "*Sigh* I guess I could try at the bank... Hopefully this goes well.",
                    textColor: '#ffffff',
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                },
                {
                    textureKey: "outside_bank",
                    text: "*BANG!*",
                    textColor: '#ffffff',
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                },
                {
                    textureKey: "outside_bank",
                    text: "Huh?!",
                    textColor: '#ffffff',
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                },
                {
                    textureKey: "entering_bank",
                    text: "You there! We're being robbed!",
                    textColor: '#ffffff',
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                },
                {
                    textureKey: "entering_bank",
                    text: "I was just looking for a job...",
                    textColor: '#ffffff',
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                },
                {
                    textureKey: "entering_bank",
                    text: "Then you're security now! Get over here and help me fight these punks off!",
                    textColor: '#ffffff',
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                },
                {
                    textureKey: "entering_bank",
                    text: "Wait what?!",
                    textColor: '#ffffff',
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                }
            ],
            PizzaShop: [
                {
                    textureKey: "outside_pizza",
                    text: "Oh look, a 'Help Wanted' sign at the pizza shop! Surely making pizzas is safe...",
                    textColor: '#ffffff',
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                },
                {
                    textureKey: "entering_pizza",
                    text: "Mamma mia! Thank goodness you're here! The lunch rush is out of control!",
                    textColor: '#ffffff',
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                },
                {
                    textureKey: "entering_pizza",
                    text: "Uh, hi, I just saw the sign in the window—",
                    textColor: '#ffffff',
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                },
                {
                    textureKey: "entering_pizza",
                    text: ("No time for interviews! Get behind the counter and start making " + 
                        "those pies before this whole place burns down!\nWe got some hungry bambinos to feed!"),
                    textColor: '#ffffff',
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                }
            ]
        };

        this.doors = makeDoors({
            scene: this,
            tilemap: tilemap,
            player: this.player,
            layer: "Doors",
            cutscenes: doorCutscenes
        });

        EventBus.emit('current-scene-ready', this);
    }

    // Handle player input for movement
    update() {
        this.player.update();
    }

    changeScene ()
    {
        this.scene.start('GameOver');
    }
}
