import { Scene } from "phaser";
import { PlayerCharacter } from "../PlayerCharacter";

export interface TextBoxOptions {
    scene: Scene;
    player?: PlayerCharacter;
    pages: string | string[];
    onComplete?: () => void;
}

/**
 * Displays a multi-page Pokemon-style dialogue box at the bottom of the camera view.
 * Freezes player movement while open and advances pages / closes with SPACEBAR.
 */
export function showTextBox({ scene, player, pages, onComplete }: TextBoxOptions): void {
    const pageList = Array.isArray(pages) ? pages : [pages];
    if (pageList.length === 0) {
        onComplete?.();
        return;
    }

    // Freeze the player while reading the text box
    player?.setFrozen(true);

    const cam = scene.cameras.main;
    const invZoom = 1 / cam.zoom;
    const viewW = scene.scale.width / cam.zoom;
    const viewH = scene.scale.height / cam.zoom;
    const centerX = cam.worldView.width > 0 ? cam.worldView.centerX : cam.midPoint.x;
    const bottomY = cam.worldView.height > 0 ? cam.worldView.bottom : cam.midPoint.y + viewH / 2;

    const boxScreenW = Math.min(scene.scale.width - 80, 760);
    const boxScreenH = 110;
    const boxY = bottomY - (boxScreenH / 2 + 18) * invZoom;

    const container = scene.add.container(centerX, boxY)
        .setScale(invZoom)
        .setDepth(2000);

    // Pokemon-style double-bordered dialogue box
    const bg = scene.add.graphics();
    bg.fillStyle(0x0f141d, 0.96);
    bg.fillRoundedRect(-boxScreenW / 2, -boxScreenH / 2, boxScreenW, boxScreenH, 8);
    bg.lineStyle(4, 0xffffff, 1);
    bg.strokeRoundedRect(-boxScreenW / 2, -boxScreenH / 2, boxScreenW, boxScreenH, 8);
    bg.lineStyle(2, 0xf39c12, 1);
    bg.strokeRoundedRect(-boxScreenW / 2 + 5, -boxScreenH / 2 + 5, boxScreenW - 10, boxScreenH - 10, 6);
    container.add(bg);

    let currentPage = 0;

    const textObj = scene.add.text(-boxScreenW / 2 + 24, -boxScreenH / 2 + 20, pageList[0], {
        fontFamily: "Courier New, monospace",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#ffffff",
        wordWrap: { width: boxScreenW - 64 },
        lineSpacing: 6,
        resolution: 2
    }).setOrigin(0, 0);
    container.add(textObj);

    // Blinking prompt indicator in bottom-right corner of the box
    const promptIndicator = scene.add.text(boxScreenW / 2 - 22, boxScreenH / 2 - 18, "▼ [SPACE]", {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#f39c12",
        resolution: 2
    }).setOrigin(1, 1);
    container.add(promptIndicator);

    scene.tweens.add({
        targets: promptIndicator,
        alpha: 0.25,
        duration: 450,
        yoyo: true,
        repeat: -1
    });

    const handleSpace = () => {
        currentPage++;
        if (currentPage < pageList.length) {
            textObj.setText(pageList[currentPage]);
        } else {
            scene.input.keyboard?.off("keydown-SPACE", handleSpace);
            container.destroy();
            player?.setFrozen(false);
            onComplete?.();
        }
    };

    scene.input.keyboard?.on("keydown-SPACE", handleSpace);
}

