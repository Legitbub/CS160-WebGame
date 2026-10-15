import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { PlayerCharacter } from '../PlayerCharacter';
import { CONSTANTS } from '../utilities/Constants';
import { PlayerSetupOptions, PlayerSpawn } from '../utilities/PlayerSpawn';
import { DoorDetails, makeDoors } from '../utilities/DoorSpawn';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    gameText: Phaser.GameObjects.Text;
    private player!: PlayerCharacter;
    private wallsLayer!: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
    private spawnAt?: {x: number, y: number};
    private doors: DoorDetails[] = [];

    constructor ()
    {
        super('Game');
    }

    preload() 
    {
        // Load tilemap (room layout) and tileset (building blocks)
        this.load.image('tiles', '/scene_tilemaps/Cottage_Tileset/Cottage_Tileset.png');
        this.load.tilemapTiledJSON('tiles_map', '/assets/test.json');
        this.load.spritesheet("player_stationary", "/assets/stationary Nerdy Guy sprites.png", {
            frameWidth: 32,
            frameHeight: 32
        });
    }

    init(data: {spawnAt: {x: number, y: number}}) {
        this.spawnAt = data.spawnAt;
    }
    
    create ()
    {
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
