import { EventBus } from "../EventBus";
import * as Phaser from "phaser";
import { Input, Scene, Types } from "phaser";
import { TILE_WIDTH, gridToScreen, screenToGrid, getTileCorners } from "../bank_level/GridConversion";
import { BattleGrid, BattleSquare } from "../bank_level/Battlefield";
import { Kombatant } from "../bank_level/Kombatant";
import {
    BankBattleLogic,
    BankBattleView,
    INITIAL_BANK_UNITS,
    MenuOption
} from "../bank_level/BankBattleLogic";

export class Battle_in_Bank extends Scene implements BankBattleView {
    camera: Phaser.Cameras.Scene2D.Camera;
    gameText: Phaser.GameObjects.Text;

    private battle!: BankBattleLogic;

    private highlightGraphics!: Phaser.GameObjects.Graphics;
    private cursorGraphics!: Phaser.GameObjects.Graphics;
    private actionMenuContainer!: Phaser.GameObjects.Container;
    private actionMenuItems: Phaser.GameObjects.Text[] = [];
    private actionMenuSelection: number = 0;
    private infoText!: Phaser.GameObjects.Text;
    private turnBannerText!: Phaser.GameObjects.Text;
    private controlsGuideText!: Phaser.GameObjects.Text;
    private unitStatusText!: Phaser.GameObjects.Text;

    private currentMenuOptions: MenuOption[] = [];
    private menuTitleText!: Phaser.GameObjects.Text;
    private menuBg!: Phaser.GameObjects.Graphics;
    private menuPointer!: Phaser.GameObjects.Text;

    private hoveredGridPos: { x: number; y: number } | null = null;

    private cursors?: Types.Input.Keyboard.CursorKeys;
    private keyW?: Input.Keyboard.Key;
    private keyS?: Input.Keyboard.Key;
    private enterKey?: Input.Keyboard.Key;
    private spaceKey?: Input.Keyboard.Key;
    private escKey?: Input.Keyboard.Key;

    constructor() {
        super("Battle_in_Bank");
    }

    create() {
        this.camera = this.cameras.main;
        this.camera.roundPixels = true;
        this.camera.setBackgroundColor(0x141824);

        const tilemap = this.make.tilemap({ key: "bank_battle_map" });
        const mapConverted = gridToScreen(tilemap.width / 2, tilemap.height / 2);
        this.camera.setZoom(2.5);
        this.camera.centerOn(mapConverted.x, mapConverted.y);

        const tileset1 = tilemap.addTilesetImage("Iso Floors", "floors")!;
        const floorLayer = tilemap.createLayer("Tile Layer 1", tileset1);

        // Floors.png contains 32x32 sprites where the 32x16 isometric top diamond
        // has its top vertex at (x=16, y=4) and bank_level.json sets tileoffset.y = 11.
        // Shifting the layer by (-TILE_WIDTH / 2, 7) aligns the painted diamond top surface
        // with gridToScreen(), getTileCorners(), and screenToGrid().
        if (floorLayer) {
            floorLayer.setPosition(-TILE_WIDTH / 2, 7);
            floorLayer.setDepth(0);
        }

        // Graphics layers for isometric tile highlights and hover cursor
        this.highlightGraphics = this.add.graphics().setDepth(2);
        this.cursorGraphics = this.add.graphics().setDepth(3);

        // Initialize battle grid and spawn initial units
        const grid = new BattleGrid(tilemap.width, tilemap.height);
        const units = INITIAL_BANK_UNITS.map(cfg => {
            const unit = new Kombatant(
                this,
                cfg.name,
                cfg.x,
                cfg.y,
                cfg.speed,
                cfg.isPlayer,
                cfg.textureKey,
                cfg.hasGunAttack,
                cfg.shootingTextureKey
            );
            unit.setDirection(cfg.isPlayer ? 'right' : 'left');
            grid.squares[cfg.x][cfg.y].occupiedBy = unit;
            return unit;
        });

        this.battle = new BankBattleLogic(grid, units, this);

        // Build UI (Turn banner, Controls Guide, Unit Status HUD, Info bar, and FFT-style Options Menu)
        this.createUI();
        this.setupInput();

        this.battle.startBattle();

        EventBus.emit('current-scene-ready', this);
    }

    // --- BankBattleView Implementation ---

    setTurnBanner(text: string) {
        this.turnBannerText.setText(text);
    }

    setInfoText(text: string) {
        this.infoText.setText(text);
    }

    updateUnitStatusPanel() {
        if (!this.unitStatusText) return;
        const lines: string[] = ["UNIT STATUS"];
        for (const u of this.battle.units) {
            const side = u.isPlayer ? "ALLY " : "ENEMY";
            const status = u.hp > 0 ? `HP ${u.hp}/${u.maxHp}` : "DEFEATED";
            lines.push(`[${side}] ${u.name}: ${status}`);
        }
        this.unitStatusText.setText(lines.join("\n"));
    }

    showMenu(title: string, options: MenuOption[]) {
        this.populateMenu(title, options);
    }

    hideMenu() {
        this.actionMenuContainer.setVisible(false);
    }

    updateHighlights() {
        this.drawHighlights();
    }

    delay(ms: number, callback: () => void) {
        this.time.delayedCall(ms, callback);
    }

    onVictory() {
        this.registry.set("bankCompleted", true);
    }

    animateMove(unit: Kombatant, steps: BattleSquare[], onComplete: () => void) {
        const stepNext = (index: number) => {
            if (index >= steps.length) {
                onComplete();
                return;
            }

            const nextSquare = steps[index];
            const dx = nextSquare.x - unit.gridX;
            const dy = nextSquare.y - unit.gridY;
            this.updateSpriteDirection(unit, dx, dy);

            const destScreen = gridToScreen(nextSquare.x, nextSquare.y);
            this.tweens.add({
                targets: unit.sprite,
                x: destScreen.x,
                y: destScreen.y,
                duration: 140,
                onUpdate: () => {
                    unit.syncOverheadUI();
                },
                onComplete: () => {
                    unit.setPosition(nextSquare.x, nextSquare.y);
                    stepNext(index + 1);
                }
            });
        };

        stepNext(0);
    }

    animateAttack(
        attacker: Kombatant,
        defender: Kombatant,
        targetSquare: BattleSquare,
        onHit: () => void,
        onComplete: () => void
    ) {
        const dx = targetSquare.x - attacker.gridX;
        const dy = targetSquare.y - attacker.gridY;
        this.updateSpriteDirection(attacker, dx, dy);

        const origScreen = gridToScreen(attacker.gridX, attacker.gridY);
        const defScreen = gridToScreen(defender.gridX, defender.gridY);

        if (attacker.hasGunAttack) {
            attacker.setShooting(true);

            const bullet = this.add.circle(origScreen.x, origScreen.y - 10, 2.5, 0xffe066)
                .setStrokeStyle(1, 0xff6b00)
                .setDepth(1000);

            this.tweens.add({
                targets: bullet,
                x: defScreen.x,
                y: defScreen.y - 10,
                duration: 180,
                onComplete: () => {
                    bullet.destroy();
                    onHit();
                }
            });

            // Subtle recoil while holding the directional shooting sprite
            const dirNorm = Math.hypot(defScreen.x - origScreen.x, defScreen.y - origScreen.y) || 1;
            const recoilX = origScreen.x - ((defScreen.x - origScreen.x) / dirNorm) * 3;
            const recoilY = origScreen.y - ((defScreen.y - origScreen.y) / dirNorm) * 3;

            this.tweens.add({
                targets: attacker.sprite,
                x: recoilX,
                y: recoilY,
                duration: 90,
                yoyo: true,
                onUpdate: () => {
                    attacker.syncOverheadUI();
                },
                onComplete: () => {
                    this.time.delayedCall(260, () => {
                        attacker.setShooting(false);
                        onComplete();
                    });
                }
            });
            return;
        }

        const lungeX = origScreen.x + (defScreen.x - origScreen.x) * 0.45;
        const lungeY = origScreen.y + (defScreen.y - origScreen.y) * 0.45;

        // Guard flag because Phaser's onYoyo fires once per tweened property (x and y)
        let damageApplied = false;

        this.tweens.add({
            targets: attacker.sprite,
            x: lungeX,
            y: lungeY,
            duration: 130,
            yoyo: true,
            onYoyo: () => {
                if (damageApplied) return;
                damageApplied = true;
                onHit();
            },
            onUpdate: () => {
                attacker.syncOverheadUI();
            },
            onComplete
        });
    }

    showDamageOrHealEffect(target: Kombatant, delta: number, actualDelta: number) {
        // Hit flash & shake feedback when damaged
        if (delta < 0 && target.hp > 0) {
            target.sprite.setTint(0xffff66);
            const baseScreen = gridToScreen(target.gridX, target.gridY);
            this.tweens.add({
                targets: target.sprite,
                x: baseScreen.x + 3,
                duration: 45,
                yoyo: true,
                repeat: 3,
                onComplete: () => {
                    target.sprite.x = baseScreen.x;
                    target.sprite.clearTint();
                }
            });
        }

        const screen = gridToScreen(target.gridX, target.gridY);
        const shownAmount = delta >= 0 ? actualDelta : delta;
        const label = delta >= 0 ? `+${shownAmount} HP` : `${shownAmount} HP`;
        const color = delta >= 0 ? "#2ecc71" : "#ff3b3b";

        const popText = this.add.text(screen.x, screen.y - 34, label, {
            fontFamily: "Courier New, monospace",
            fontSize: "20px",
            fontStyle: "bold",
            color,
            stroke: "#000000",
            strokeThickness: 4,
            resolution: 2
        }).setOrigin(0.5).setScale(0.45).setDepth(1001);

        this.tweens.add({
            targets: popText,
            y: popText.y - 18,
            alpha: 0,
            duration: 1000,
            onComplete: () => popText.destroy()
        });
    }

    // --- UI & Rendering Helpers ---

    /**
     * Computes the visible world bounds directly from camera.midPoint and zoom.
     * Unlike camera.worldView (which is 0,0,0,0 until the first preRender step),
     * this is immediately accurate inside create().
     */
    private getCameraViewBounds() {
        const viewW = this.scale.width / this.camera.zoom;
        const viewH = this.scale.height / this.camera.zoom;
        const cx = this.camera.midPoint.x;
        const cy = this.camera.midPoint.y;
        return {
            left: cx - viewW / 2,
            right: cx + viewW / 2,
            top: cy - viewH / 2,
            bottom: cy + viewH / 2,
            centerX: cx,
            centerY: cy,
            width: viewW,
            height: viewH
        };
    }

    private createUI() {
        const invZoom = 1 / this.camera.zoom; // Scale UI so it renders at 1:1 screen pixels at zoom 2.5
        const view = this.getCameraViewBounds();

        // Top turn banner
        this.turnBannerText = this.add.text(view.centerX, view.top + 8, "", {
            fontFamily: "Courier New, monospace",
            fontSize: "22px",
            fontStyle: "bold",
            color: "#f1c40f",
            backgroundColor: "#0d1322dd",
            padding: { x: 14, y: 6 },
            stroke: "#000000",
            strokeThickness: 3,
            resolution: 2
        })
        .setOrigin(0.5, 0)
        .setScale(invZoom)
        .setDepth(1000);

        // Top-left Unit HP Status Roster so all units' HP is clearly visible at all times
        this.unitStatusText = this.add.text(view.left + 8, view.top + 8, "", {
            fontFamily: "Courier New, monospace",
            fontSize: "13px",
            color: "#ecf0f1",
            backgroundColor: "#10182be6",
            padding: { x: 10, y: 8 },
            stroke: "#000000",
            strokeThickness: 2,
            lineSpacing: 4,
            resolution: 2
        })
        .setOrigin(0, 0)
        .setScale(invZoom)
        .setDepth(1000);

        // Top-right Controls Guide box so the player immediately sees how to navigate
        const guideLines = [
            "CONTROLS GUIDE",
            "↑/↓ or W/S : Navigate Menu",
            "ENTER/CLICK: Select Option",
            "CLICK TILE : Move / Target",
            "ESC/R-CLICK: Cancel / Back"
        ];
        this.controlsGuideText = this.add.text(view.right - 8, view.top + 8, guideLines.join("\n"), {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: "#d6eaf8",
            backgroundColor: "#10182be6",
            padding: { x: 10, y: 8 },
            stroke: "#000000",
            strokeThickness: 2,
            lineSpacing: 4,
            resolution: 2
        })
        .setOrigin(1, 0)
        .setScale(invZoom)
        .setDepth(1000);

        // Bottom info/help text bar
        this.infoText = this.add.text(view.centerX, view.bottom - 8, "", {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: "#ecf0f1",
            backgroundColor: "#0d1322e6",
            padding: { x: 12, y: 5 },
            stroke: "#000000",
            strokeThickness: 2,
            resolution: 2
        })
        .setOrigin(0.5, 1)
        .setScale(invZoom)
        .setDepth(1000);

        // FFT-style Command Options Menu Container (pinned to bottom-left of camera view)
        this.actionMenuContainer = this.add.container(view.left + 10, view.bottom - 110)
            .setScale(invZoom)
            .setDepth(1000);

        this.menuBg = this.add.graphics();
        this.actionMenuContainer.add(this.menuBg);

        this.menuTitleText = this.add.text(14, 10, "", {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            fontStyle: "bold",
            color: "#f39c12",
            resolution: 2
        });
        this.actionMenuContainer.add(this.menuTitleText);

        this.menuPointer = this.add.text(14, 42, "▶", {
            fontFamily: "Courier New, monospace",
            fontSize: "18px",
            color: "#45b154",
            resolution: 2
        });
        this.actionMenuContainer.add(this.menuPointer);

        this.actionMenuContainer.setVisible(false);
    }

    private populateMenu(title: string, options: MenuOption[]) {
        this.currentMenuOptions = options;
        this.actionMenuSelection = 0;

        // Default selection to the first enabled option
        const firstEnabled = options.findIndex(o => o.enabled);
        if (firstEnabled !== -1) {
            this.actionMenuSelection = firstEnabled;
        }

        // Remove previous text items
        this.actionMenuItems.forEach(item => item.destroy());
        this.actionMenuItems = [];

        this.menuTitleText.setText(title);

        const menuWidth = 285;
        const rowHeight = 30;
        const menuHeight = 48 + options.length * rowHeight;

        // Draw FFT-inspired dark blue window frame
        this.menuBg.clear();
        this.menuBg.fillStyle(0x10182b, 0.94);
        this.menuBg.fillRoundedRect(0, 0, menuWidth, menuHeight, 6);
        this.menuBg.lineStyle(2, 0xc8b078, 1);
        this.menuBg.strokeRoundedRect(0, 0, menuWidth, menuHeight, 6);
        this.menuBg.lineStyle(1, 0x4a5a80, 0.8);
        this.menuBg.lineBetween(10, 34, menuWidth - 10, 34);

        // Anchor container to bottom-left of the visible camera area
        const view = this.getCameraViewBounds();
        const invZoom = 1 / this.camera.zoom;
        this.actionMenuContainer.setPosition(view.left + 10, view.bottom - (menuHeight * invZoom) - 28);

        options.forEach((opt, idx) => {
            const itemY = 42 + idx * rowHeight;
            const textObj = this.add.text(36, itemY, opt.label, {
                fontFamily: "Courier New, monospace",
                fontSize: "17px",
                color: opt.enabled ? "#ecf0f1" : "#6c7a89",
                resolution: 2
            });

            textObj.setInteractive({ useHandCursor: opt.enabled });
            textObj.on("pointerover", () => {
                this.actionMenuSelection = idx;
                this.updateMenuVisuals();
            });
            textObj.on("pointerdown", (_pointer: Input.Pointer, _localX: number, _localY: number, event: Types.Input.EventData) => {
                event.stopPropagation();
                this.actionMenuSelection = idx;
                this.updateMenuVisuals();
                this.confirmMenuSelection();
            });

            this.actionMenuContainer.add(textObj);
            this.actionMenuItems.push(textObj);
        });

        this.actionMenuContainer.setVisible(true);
        this.updateMenuVisuals();
    }

    private updateMenuVisuals() {
        this.actionMenuItems.forEach((item, idx) => {
            const opt = this.currentMenuOptions[idx];
            const isSelected = idx === this.actionMenuSelection;
            if (!opt.enabled) {
                item.setColor(isSelected ? "#95a5a6" : "#6c7a89");
                item.setScale(1.0);
            } else if (isSelected) {
                item.setColor("#f39c12");
                item.setScale(1.03);
            } else {
                item.setColor("#ecf0f1");
                item.setScale(1.0);
            }

            if (isSelected) {
                this.menuPointer.setPosition(14, item.y);
            }
        });
    }

    private confirmMenuSelection() {
        const chosen = this.currentMenuOptions[this.actionMenuSelection];
        if (!chosen) return;
        if (chosen.enabled) {
            chosen.action();
        } else if (chosen.disabledReason) {
            this.infoText.setText(chosen.disabledReason);
        }
    }

    private updateSpriteDirection(unit: Kombatant, dx: number, dy: number) {
        if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx > 0) {
                unit.setDirection('right');
            } else if (dx < 0) {
                unit.setDirection('left');
            }
        } else {
            if (dy > 0) {
                unit.setDirection('down');
            } else if (dy < 0) {
                unit.setDirection('up');
            }
        }
    }

    /**
     * Resolves a click in world coordinates to a highlighted BattleSquare.
     * Checks both the isometric floor diamond AND the sprite bounds of units
     * standing on highlighted squares (since character sprites extend above their floor diamond).
     */
    private findClickedHighlightedSquare(worldX: number, worldY: number): BattleSquare | undefined {
        // 1. Check if the user clicked directly on a unit's sprite standing on a highlighted square
        for (const sq of this.battle.highlightedSquares) {
            if (sq.occupiedBy && sq.occupiedBy.hp > 0) {
                const bounds = sq.occupiedBy.sprite.getBounds();
                if (bounds.contains(worldX, worldY)) {
                    return sq;
                }
            }
        }

        // 2. Otherwise check the isometric floor tile diamond
        const { x, y } = screenToGrid(worldX, worldY);
        if (!this.battle.grid.isValidSquare(x, y)) return undefined;
        return this.battle.highlightedSquares.find(s => s.x === x && s.y === y);
    }

    private setupInput() {
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.keyW = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.W);
            this.keyS = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.S);
            this.enterKey = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ENTER);
            this.spaceKey = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.SPACE);
            this.escKey = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ESC);
        }

        this.input.mouse?.disableContextMenu();

        this.input.on("pointermove", (pointer: Input.Pointer) => {
            const worldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);
            const unitSquare = this.findClickedHighlightedSquare(worldPoint.x, worldPoint.y);
            if (unitSquare) {
                this.hoveredGridPos = { x: unitSquare.x, y: unitSquare.y };
            } else {
                const gridPos = screenToGrid(worldPoint.x, worldPoint.y);
                if (this.battle.grid.isValidSquare(gridPos.x, gridPos.y)) {
                    this.hoveredGridPos = gridPos;
                } else {
                    this.hoveredGridPos = null;
                }
            }
            this.drawCursor();
        });

        this.input.on("pointerdown", (pointer: Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
            if (this.battle.isAnimatingMove) return;

            // Ignore map clicks if the user clicked on a menu item
            if (currentlyOver && currentlyOver.length > 0) return;

            if (pointer.rightButtonDown()) {
                this.battle.cancelSubState();
                return;
            }

            if (!this.battle.isTargetSelectionState()) {
                return;
            }

            const worldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);
            const clickedSquare = this.findClickedHighlightedSquare(worldPoint.x, worldPoint.y);
            if (!clickedSquare) return;

            this.battle.handleSquareClick(clickedSquare);
        });
    }

    private drawHighlights() {
        this.highlightGraphics.clear();

        // Highlight the active unit's isometric square in gold
        const activeUnit = this.battle.getActiveUnit();
        if (activeUnit && activeUnit.hp > 0) {
            this.drawIsoTile(
                this.highlightGraphics,
                activeUnit.gridX,
                activeUnit.gridY,
                0xf1c40f,
                0.35,
                0xf1c40f,
                0.95
            );
        }

        // Highlight reachable / attackable / item target squares
        let fillColor = 0x3498db;
        if (this.battle.state === 'SELECTING_FIGHT_TARGET' || this.battle.state === 'AI_TURN') {
            fillColor = 0xe74c3c;
        } else if (this.battle.state === 'SELECTING_ITEM_TARGET') {
            fillColor = 0x2ecc71;
        }

        for (const sq of this.battle.highlightedSquares) {
            this.drawIsoTile(this.highlightGraphics, sq.x, sq.y, fillColor, 0.4, fillColor, 0.9);
        }
    }

    private drawCursor() {
        this.cursorGraphics.clear();
        if (!this.hoveredGridPos) return;

        this.drawIsoTile(
            this.cursorGraphics,
            this.hoveredGridPos.x,
            this.hoveredGridPos.y,
            0xffffff,
            0.15,
            0xffffff,
            0.9
        );
    }

    private drawIsoTile(
        graphics: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
        fillColor: number,
        fillAlpha: number,
        strokeColor: number,
        strokeAlpha: number
    ) {
        const { top, right, bottom, left } = getTileCorners(x, y);

        graphics.fillStyle(fillColor, fillAlpha);
        graphics.beginPath();
        graphics.moveTo(top.x, top.y);
        graphics.lineTo(right.x, right.y);
        graphics.lineTo(bottom.x, bottom.y);
        graphics.lineTo(left.x, left.y);
        graphics.closePath();
        graphics.fillPath();

        graphics.lineStyle(1, strokeColor, strokeAlpha);
        graphics.strokePath();
    }

    update() {
        if (!this.cursors || !this.enterKey || !this.escKey || this.battle.isAnimatingMove) return;

        const confirmPressed =
            Input.Keyboard.JustDown(this.enterKey) ||
            (this.spaceKey ? Input.Keyboard.JustDown(this.spaceKey) : false);

        if (this.battle.state === 'GAME_OVER') {
            if (confirmPressed) {
                if (this.battle.arePlayersAlive()) {
                    this.scene.start("City", { spawnAt: { x: 23, y: 6 } });
                } else {
                    this.scene.restart();
                }
            }
            return;
        }

        if (Input.Keyboard.JustDown(this.escKey)) {
            this.battle.cancelSubState();
            return;
        }

        if (this.battle.isInteractiveMenuState()) {
            const count = this.currentMenuOptions.length;
            if (count === 0) return;

            const upPressed =
                Input.Keyboard.JustDown(this.cursors.up) ||
                (this.keyW ? Input.Keyboard.JustDown(this.keyW) : false);
            const downPressed =
                Input.Keyboard.JustDown(this.cursors.down) ||
                (this.keyS ? Input.Keyboard.JustDown(this.keyS) : false);

            if (upPressed) {
                this.actionMenuSelection = (this.actionMenuSelection - 1 + count) % count;
                this.updateMenuVisuals();
            } else if (downPressed) {
                this.actionMenuSelection = (this.actionMenuSelection + 1) % count;
                this.updateMenuVisuals();
            } else if (confirmPressed) {
                this.confirmMenuSelection();
            }
        }
    }
}
