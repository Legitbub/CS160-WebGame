import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { PlayerCharacter } from '../PlayerCharacter';
import { CONSTANTS } from '../utilities/Constants';
import { PlayerSetupOptions, PlayerSpawn } from '../utilities/PlayerSpawn';
import { DoorDetails, makeDoors } from '../utilities/DoorSpawn';
import { showTextBox } from '../utilities/TextBox';
import { ENDING_CUTSCENE } from '../utilities/SlideDeck';

export class Home extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    gameText: Phaser.GameObjects.Text;
    private player!: PlayerCharacter;
    private wallsLayer!: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
    private spawnAt?: {x: number, y: number};
    private doors: DoorDetails[] = [];

    constructor ()
    {
        super('Home');
    }

    init(data: {spawnAt?: {x: number, y: number}}) {
        this.spawnAt = data?.spawnAt;
    }
    
    create ()
    {
        this.sound.stopByKey("menu_bgm");

        const bankCompleted = Boolean(this.registry.get("bankCompleted"));
        const pizzaCompleted = Boolean(this.registry.get("pizzaCompleted"));
        const runnerCompleted = Boolean(this.registry.get("runnerCompleted"));

        if (bankCompleted && pizzaCompleted && runnerCompleted) {
            this.registry.set("bankCompleted", false);
            this.registry.set("pizzaCompleted", false);
            this.registry.set("runnerCompleted", false);
            this.registry.set("hasSeenAllCompletedMessage", false);

            this.scene.start("Cutscene", ENDING_CUTSCENE);
            return;
        }

        this.camera = this.cameras.main;
        this.camera.roundPixels = true;

        // Create map and tileset
        const tilemap = this.make.tilemap({key: "tiles_map"});
        const tileset = tilemap.addTilesetImage("Cottage_Tileset", "tiles", 32, 32, 0, 0)!;

        const floorLayer = tilemap.createLayer('Room', tileset);
        this.wallsLayer = tilemap.createLayer('Walls', tileset)!;

        this.player = PlayerSpawn({
            scene: this,
            map: tilemap,
            wallsLayer: this.wallsLayer,
            zoom: 4.5,
            spawnTile: this.spawnAt
        });

        this.doors = makeDoors({
            scene: this,
            tilemap: tilemap,
            player: this.player,
            layer: "Doors"
        });

        if (!this.registry.get("hasSeenMoveTutorial")) {
            this.registry.set("hasSeenMoveTutorial", true);
            showTextBox({
                scene: this,
                player: this.player,
                pages: "Use arrow keys to move.",
                position: "bottom"
            });
        }

        EventBus.emit('current-scene-ready', this);
    }

    // Handle player input for movement
    update() {
        this.player.update();
    }

    changeScene ()
    {
        this.scene.start('City');
    }
}
