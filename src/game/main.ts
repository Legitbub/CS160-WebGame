import * as Scenes from "./scenes";
import { AUTO, Game } from 'phaser';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#028af8',
    render: {
        pixelArt: true,
        roundPixels: true
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: {x: 0, y: 0},
            debug: false
        }
    },
    scene: [
        Scenes.Boot,
        Scenes.Preloader,
        Scenes.MainMenu,
        Scenes.Game,
        Scenes.City,
        Scenes.Battle_in_Bank,
        Scenes.GameOver
    ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
