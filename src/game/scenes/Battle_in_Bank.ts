import { EventBus } from "../EventBus";
import * as Phaser from "phaser";
import { Input, Scene, Types } from "phaser";
import { TILE_HEIGHT, TILE_WIDTH, gridToScreen, screenToGrid, getTileCorners } from "../bank_level/GridConversion";
import { BattleGrid, BattleSquare, getReachableCells, findPath, getAttackableCells, getItemTargetCells } from "../bank_level/Battlefield";
import { Kombatant } from "../bank_level/Kombatant";

interface MenuOption {
    label: string;
    enabled: boolean;
    disabledReason?: string;
    action: () => void;
}

interface ItemDefinition {
    name: string;
    description: string;
    count: number;
    effect: 'heal' | 'damage';
    amount: number;
}

export class Battle_in_Bank extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    gameText: Phaser.GameObjects.Text;
    
    private grid!: BattleGrid;
    private units: Kombatant[] = [];
    private activeUnitIndex: number = 0;
    private state: 'WAITING_FOR_TURN' | 'UNIT_MENU' | 'SELECTING_MOVE' | 
    'SELECTING_ACTION' | 'SELECTING_FIGHT_TARGET' | 'SELECTING_ITEM_TARGET' |
     'AI_TURN' | 'GAME_OVER' = 'WAITING_FOR_TURN';

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

    private highlightedSquares: BattleSquare[] = [];
    private hoveredGridPos: { x: number; y: number } | null = null;
    private isAnimatingMove: boolean = false;

    private inventory: ItemDefinition[] = [];
    private selectedItem: ItemDefinition | null = null;

    private cursors?: Types.Input.Keyboard.CursorKeys;
    private keyW?: Input.Keyboard.Key;
    private keyS?: Input.Keyboard.Key;
    private enterKey?: Input.Keyboard.Key;
    private spaceKey?: Input.Keyboard.Key;
    private escKey?: Input.Keyboard.Key;

    constructor() {
        super("Battle_in_Bank");
    }

    preload() {
        this.load.image("floors", "/scene_tilemaps/Bank_Isometric_Tileset/Floors.png");
        this.load.image("walls", "/scene_tilemaps/Bank_Isometric_Tileset/Walls.png");
        this.load.tilemapTiledJSON("bank_battle_map", "/assets/bank_level.json");
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

        // Initialize battle grid matching the 19x14 isometric map
        this.grid = new BattleGrid(tilemap.width, tilemap.height);

        // Graphics layers for isometric tile highlights and hover cursor
        this.highlightGraphics = this.add.graphics().setDepth(2);
        this.cursorGraphics = this.add.graphics().setDepth(3);

        // Initialize player inventory for the "Items" option
        this.inventory = [
            { name: "Potion", description: "Restores 40 HP to a unit", count: 3, effect: 'heal', amount: 40 },
            { name: "Hi-Potion", description: "Restores 80 HP to a unit", count: 1, effect: 'heal', amount: 80 },
            { name: "Coin Toss", description: "Deals 25 DMG to a target", count: 3, effect: 'damage', amount: 25 }
        ];

        // Spawn player and enemy units with interleaved speeds so turns alternate Player <-> Enemy
        this.units = [];
        this.spawnUnit("Hero", 6, 5, 12, true);
        this.spawnUnit("Bank Guard", 9, 5, 11, false);
        this.spawnUnit("Ally", 6, 8, 10, true);
        this.spawnUnit("Chief Teller", 9, 8, 9, false);

        // Build UI (Turn banner, Controls Guide, Unit Status HUD, Info bar, and FFT-style Options Menu)
        this.createUI();
        this.setupInput();

        this.state = 'WAITING_FOR_TURN';
        this.advanceTurnOrder();

        EventBus.emit('current-scene-ready', this);
    }

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

    private spawnUnit(name: string, x: number, y: number, speed: number, isPlayer: boolean): Kombatant {
        const unit = new Kombatant(this, name, x, y, speed, isPlayer, 'player_stationary');
        // Face players right (toward enemies) and enemies left (toward players)
        unit.sprite.setFrame(isPlayer ? 3 : 2);
        this.grid.squares[x][y].occupiedBy = unit;
        this.units.push(unit);
        return unit;
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
        this.updateUnitStatusPanel();

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

    private updateUnitStatusPanel() {
        if (!this.unitStatusText) return;
        const lines: string[] = ["UNIT STATUS"];
        for (const u of this.units) {
            const side = u.isPlayer ? "ALLY " : "ENEMY";
            const status = u.hp > 0 ? `HP ${u.hp}/${u.maxHp}` : "DEFEATED";
            lines.push(`[${side}] ${u.name}: ${status}`);
        }
        this.unitStatusText.setText(lines.join("\n"));
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

    private openUnitMenu() {
        const unit = this.units[this.activeUnitIndex];
        if (!unit || !unit.isPlayer) return;

        // If the unit has both moved and acted, automatically end its turn
        if (unit.hasMoved && unit.hasActed) {
            this.endTurn();
            return;
        }

        this.state = 'UNIT_MENU';
        this.selectedItem = null;
        this.highlightedSquares = [];
        this.drawHighlights();

        const hasItemsLeft = this.inventory.some(item => item.count > 0);
        const enemyInRange = getAttackableCells(unit, this.grid).some(
            sq => sq.occupiedBy && sq.occupiedBy.isPlayer !== unit.isPlayer
        );

        this.populateMenu(`${unit.name} (HP ${unit.hp}/${unit.maxHp})`, [
            {
                label: "Move",
                enabled: !unit.hasMoved,
                disabledReason: "Already moved this turn!",
                action: () => this.startSelectingMove()
            },
            {
                label: enemyInRange || unit.hasActed ? "Fight" : "Fight (Out of Range)",
                enabled: !unit.hasActed,
                disabledReason: "Already acted this turn!",
                action: () => this.startSelectingFight()
            },
            {
                label: "Items",
                enabled: !unit.hasActed && hasItemsLeft,
                disabledReason: unit.hasActed ? "Already acted this turn!" : "No items remaining!",
                action: () => this.openItemsMenu()
            },
            {
                label: "Wait (End Turn)",
                enabled: true,
                action: () => this.endTurn()
            }
        ]);

        this.turnBannerText.setText(`★ ${unit.name}'s Turn (Player)`);
        this.infoText.setText("Use ↑/↓ (or W/S) + ENTER, or click an option in the menu.");
    }

    private openItemsMenu() {
        const unit = this.units[this.activeUnitIndex];
        this.state = 'SELECTING_ACTION';
        this.highlightedSquares = [];
        this.drawHighlights();

        const itemOptions: MenuOption[] = this.inventory.map(item => ({
            label: `${item.name} x${item.count}`,
            enabled: item.count > 0,
            disabledReason: `Out of ${item.name}!`,
            action: () => this.startSelectingItemTarget(item)
        }));

        itemOptions.push({
            label: "← Back",
            enabled: true,
            action: () => this.openUnitMenu()
        });

        this.populateMenu(`${unit.name} - Items`, itemOptions);
        this.infoText.setText("Select an item with ↑/↓ + ENTER or Click (ESC to go back)");
    }

    private startSelectingMove() {
        const unit = this.units[this.activeUnitIndex];
        this.state = 'SELECTING_MOVE';
        this.highlightedSquares = getReachableCells(unit, this.grid);
        this.drawHighlights();

        this.populateMenu(`${unit.name} - Move`, [
            {
                label: "← Back to Menu",
                enabled: true,
                action: () => this.cancelSubState()
            },
            {
                label: "Wait (End Turn)",
                enabled: true,
                action: () => this.endTurn()
            }
        ]);
        this.infoText.setText("Click any BLUE isometric tile to move there (or ESC to cancel)");
    }

    private startSelectingFight() {
        const unit = this.units[this.activeUnitIndex];
        this.state = 'SELECTING_FIGHT_TARGET';
        this.highlightedSquares = getAttackableCells(unit, this.grid);
        this.drawHighlights();

        const enemySquares = this.highlightedSquares.filter(
            sq => sq.occupiedBy && sq.occupiedBy.isPlayer !== unit.isPlayer && sq.occupiedBy.hp > 0
        );

        const fightOptions: MenuOption[] = enemySquares.map(sq => {
            const enemy = sq.occupiedBy!;
            return {
                label: `⚔ Attack ${enemy.name} (${enemy.hp} HP)`,
                enabled: true,
                action: () => this.executeFight(unit, sq)
            };
        });

        fightOptions.push(
            {
                label: "← Back to Menu",
                enabled: true,
                action: () => this.cancelSubState()
            },
            {
                label: "Wait (End Turn)",
                enabled: true,
                action: () => this.endTurn()
            }
        );

        this.populateMenu(`${unit.name} - Fight`, fightOptions);

        if (enemySquares.length > 0) {
            this.infoText.setText("Press ENTER, click '⚔ Attack' in menu, or click the enemy to attack!");
        } else {
            this.infoText.setText("No enemy in adjacent RED tiles! Move closer first, or choose Wait.");
        }
    }

    private startSelectingItemTarget(item: ItemDefinition) {
        const unit = this.units[this.activeUnitIndex];
        this.selectedItem = item;
        this.state = 'SELECTING_ITEM_TARGET';
        this.highlightedSquares = getItemTargetCells(unit, this.grid);
        this.drawHighlights();

        const unitSquares = this.highlightedSquares.filter(
            sq => sq.occupiedBy && sq.occupiedBy.hp > 0
        );

        const targetOptions: MenuOption[] = unitSquares.map(sq => {
            const target = sq.occupiedBy!;
            return {
                label: `✦ Use on ${target.name} (${target.hp}/${target.maxHp})`,
                enabled: true,
                action: () => this.executeItem(unit, sq)
            };
        });

        targetOptions.push({
            label: "← Back to Items",
            enabled: true,
            action: () => this.cancelSubState()
        });

        this.populateMenu(`${unit.name} - ${item.name}`, targetOptions);
        this.infoText.setText(`${item.name}: ${item.description} — Press ENTER or click target!`);
    }

    /**
     * Resolves a click in world coordinates to a highlighted BattleSquare.
     * Checks both the isometric floor diamond AND the sprite bounds of units
     * standing on highlighted squares (since character sprites extend above their floor diamond).
     */
    private findClickedHighlightedSquare(worldX: number, worldY: number): BattleSquare | undefined {
        // 1. Check if the user clicked directly on a unit's sprite standing on a highlighted square
        for (const sq of this.highlightedSquares) {
            if (sq.occupiedBy && sq.occupiedBy.hp > 0) {
                const bounds = sq.occupiedBy.sprite.getBounds();
                if (bounds.contains(worldX, worldY)) {
                    return sq;
                }
            }
        }

        // 2. Otherwise check the isometric floor tile diamond
        const { x, y } = screenToGrid(worldX, worldY);
        if (!this.grid.isValidSquare(x, y)) return undefined;
        return this.highlightedSquares.find(s => s.x === x && s.y === y);
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
                if (this.grid.isValidSquare(gridPos.x, gridPos.y)) {
                    this.hoveredGridPos = gridPos;
                } else {
                    this.hoveredGridPos = null;
                }
            }
            this.drawCursor();
        });

        this.input.on("pointerdown", (pointer: Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
            if (this.isAnimatingMove) return;

            // Ignore map clicks if the user clicked on a menu item
            if (currentlyOver && currentlyOver.length > 0) return;

            if (pointer.rightButtonDown()) {
                this.cancelSubState();
                return;
            }

            if (
                this.state !== 'SELECTING_MOVE' &&
                this.state !== 'SELECTING_FIGHT_TARGET' &&
                this.state !== 'SELECTING_ITEM_TARGET'
            ) {
                return;
            }

            const worldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);
            const clickedSquare = this.findClickedHighlightedSquare(worldPoint.x, worldPoint.y);
            if (!clickedSquare) return;

            if (this.state === 'SELECTING_MOVE') {
                this.executeMove(this.units[this.activeUnitIndex], clickedSquare);
            } else if (this.state === 'SELECTING_FIGHT_TARGET') {
                this.executeFight(this.units[this.activeUnitIndex], clickedSquare);
            } else if (this.state === 'SELECTING_ITEM_TARGET') {
                this.executeItem(this.units[this.activeUnitIndex], clickedSquare);
            }
        });
    }

    private cancelSubState() {
        if (this.state === 'SELECTING_ITEM_TARGET') {
            this.openItemsMenu();
        } else if (
            this.state === 'SELECTING_MOVE' ||
            this.state === 'SELECTING_FIGHT_TARGET' ||
            this.state === 'SELECTING_ACTION'
        ) {
            this.openUnitMenu();
        }
    }

    private executeMove(unit: Kombatant, targetSquare: BattleSquare, onComplete?: () => void) {
        const path = findPath(unit, targetSquare, this.grid);
        if (path.length <= 1) {
            onComplete?.();
            return;
        }

        this.isAnimatingMove = true;
        this.highlightedSquares = [];
        this.drawHighlights();
        if (unit.isPlayer) {
            this.actionMenuContainer.setVisible(false);
        }

        this.grid.squares[unit.gridX][unit.gridY].occupiedBy = undefined;

        const steps = path.slice(1);
        const stepNext = (index: number) => {
            if (index >= steps.length) {
                this.grid.squares[unit.gridX][unit.gridY].occupiedBy = unit;
                unit.hasMoved = true;
                this.isAnimatingMove = false;
                if (onComplete) {
                    onComplete();
                } else if (unit.isPlayer) {
                    this.openUnitMenu();
                }
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

    private updateSpriteDirection(unit: Kombatant, dx: number, dy: number) {
        // Stationary frames: 0 = down, 1 = up, 2 = left, 3 = right
        if (dx > 0) {
            unit.sprite.setFrame(3);
        } else if (dx < 0) {
            unit.sprite.setFrame(2);
        } else if (dy > 0) {
            unit.sprite.setFrame(0);
        } else if (dy < 0) {
            unit.sprite.setFrame(1);
        }
    }

    private executeFight(attacker: Kombatant, targetSquare: BattleSquare, onComplete?: () => void) {
        const defender = targetSquare.occupiedBy;
        if (!defender || defender.isPlayer === attacker.isPlayer) {
            this.infoText.setText("No enemy on that tile! Click an enemy or select '⚔ Attack' in the menu.");
            onComplete?.();
            return;
        }

        this.isAnimatingMove = true;
        this.actionMenuContainer.setVisible(false);
        this.highlightedSquares = [];
        this.drawHighlights();

        const dx = targetSquare.x - attacker.gridX;
        const dy = targetSquare.y - attacker.gridY;
        this.updateSpriteDirection(attacker, dx, dy);

        const damage = attacker.isPlayer ? 35 : 25;
        const origScreen = gridToScreen(attacker.gridX, attacker.gridY);
        const defScreen = gridToScreen(defender.gridX, defender.gridY);
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
                this.applyDamageOrHeal(defender, -damage);
                this.infoText.setText(
                    `${attacker.name} hit ${defender.name} for ${damage} DMG! (${defender.name} HP: ${defender.hp}/${defender.maxHp})`
                );
            },
            onUpdate: () => {
                attacker.syncOverheadUI();
            },
            onComplete: () => {
                attacker.setPosition(attacker.gridX, attacker.gridY);
                attacker.hasActed = true;
                this.isAnimatingMove = false;

                if (this.checkBattleEnd()) {
                    return;
                }

                if (onComplete) {
                    onComplete();
                } else if (attacker.isPlayer) {
                    // Automatically finish the player's turn after attacking so the next unit (enemy) acts
                    this.time.delayedCall(550, () => {
                        if (this.state !== 'GAME_OVER') {
                            this.endTurn();
                        }
                    });
                }
            }
        });
    }

    private executeItem(user: Kombatant, targetSquare: BattleSquare) {
        if (!this.selectedItem) return;
        const target = targetSquare.occupiedBy;
        if (!target) {
            this.infoText.setText("Select a green tile occupied by a unit!");
            return;
        }

        const item = this.selectedItem;
        this.selectedItem = null;
        this.isAnimatingMove = true;
        this.actionMenuContainer.setVisible(false);
        this.highlightedSquares = [];
        this.drawHighlights();

        if (item.effect === 'heal') {
            const healed = this.applyDamageOrHeal(target, item.amount);
            this.infoText.setText(
                `${user.name} used ${item.name} on ${target.name}! (+${healed} HP -> ${target.hp}/${target.maxHp})`
            );
        } else {
            const dealt = Math.abs(this.applyDamageOrHeal(target, -item.amount));
            this.infoText.setText(
                `${user.name} threw ${item.name} at ${target.name} for ${dealt} DMG! (${target.hp}/${target.maxHp} HP)`
            );
        }

        item.count = Math.max(0, item.count - 1);
        user.hasActed = true;

        this.time.delayedCall(600, () => {
            this.isAnimatingMove = false;
            if (!this.checkBattleEnd() && user.isPlayer) {
                this.endTurn();
            }
        });
    }

    private applyDamageOrHeal(target: Kombatant, delta: number): number {
        const prevHp = target.hp;
        target.hp = Math.max(0, Math.min(target.maxHp, prevHp + delta));
        const actualDelta = target.hp - prevHp;

        target.updateHpText();
        this.updateUnitStatusPanel();

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
                    if (target.isPlayer) {
                        target.sprite.clearTint();
                    } else {
                        target.sprite.setTint(0xff5555);
                    }
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

        if (target.hp <= 0) {
            this.grid.squares[target.gridX][target.gridY].occupiedBy = undefined;
            target.sprite.setVisible(false);
            target.hpText?.setVisible(false);
            target.hpBar?.clear();
        }

        return actualDelta;
    }

    private checkBattleEnd(): boolean {
        const playersAlive = this.units.some(u => u.isPlayer && u.hp > 0);
        const enemiesAlive = this.units.some(u => !u.isPlayer && u.hp > 0);

        if (!enemiesAlive) {
            this.state = 'GAME_OVER';
            this.actionMenuContainer.setVisible(false);
            this.turnBannerText.setText("VICTORY!");
            this.infoText.setText("All bank guards defeated! Press ENTER to return to City.");
            return true;
        }

        if (!playersAlive) {
            this.state = 'GAME_OVER';
            this.actionMenuContainer.setVisible(false);
            this.turnBannerText.setText("DEFEAT...");
            this.infoText.setText("Your party was defeated! Press ENTER to retry.");
            return true;
        }

        return false;
    }

    private endTurn() {
        const activeUnit = this.units[this.activeUnitIndex];
        if (activeUnit) {
            activeUnit.ct = Math.max(0, activeUnit.ct - 100);
            activeUnit.hasMoved = false;
            activeUnit.hasActed = false;
        }

        this.actionMenuContainer.setVisible(false);
        this.highlightedSquares = [];
        this.drawHighlights();

        if (!this.checkBattleEnd()) {
            this.state = 'WAITING_FOR_TURN';
            this.advanceTurnOrder();
        }
    }

    private advanceTurnOrder() {
        const aliveUnits = this.units.filter(u => u.hp > 0);
        if (aliveUnits.length === 0) return;

        // Tick CT (Charge Time) until a unit reaches >= 100
        let readyUnit: Kombatant | undefined;
        while (!readyUnit) {
            for (const unit of aliveUnits) {
                unit.ct += unit.speed;
                if (unit.ct >= 100 && (!readyUnit || unit.ct > readyUnit.ct)) {
                    readyUnit = unit;
                }
            }
        }

        this.activeUnitIndex = this.units.indexOf(readyUnit);
        readyUnit.hasMoved = false;
        readyUnit.hasActed = false;

        if (readyUnit.isPlayer) {
            this.openUnitMenu();
        } else {
            this.runAITurn(readyUnit);
        }
    }

    private runAITurn(aiUnit: Kombatant) {
        this.state = 'AI_TURN';
        this.actionMenuContainer.setVisible(false);
        this.highlightedSquares = [];
        this.drawHighlights();
        this.turnBannerText.setText(`⚔ ${aiUnit.name}'s Turn (Enemy)`);
        this.infoText.setText(`${aiUnit.name} is moving...`);

        this.time.delayedCall(500, () => {
            if (this.state === 'GAME_OVER') return;

            const playerTargets = this.units.filter(u => u.isPlayer && u.hp > 0);
            if (playerTargets.length === 0) {
                this.endTurn();
                return;
            }

            // Find closest player unit by Manhattan distance
            let closestPlayer = playerTargets[0];
            let bestDist = Math.abs(aiUnit.gridX - closestPlayer.gridX) + Math.abs(aiUnit.gridY - closestPlayer.gridY);
            for (const p of playerTargets) {
                const d = Math.abs(aiUnit.gridX - p.gridX) + Math.abs(aiUnit.gridY - p.gridY);
                if (d < bestDist) {
                    bestDist = d;
                    closestPlayer = p;
                }
            }

            const performAttackAndFinish = () => {
                if (this.state === 'GAME_OVER') return;
                this.drawHighlights();

                const attackSquares = getAttackableCells(aiUnit, this.grid);
                const targetSquare = attackSquares.find(
                    sq => sq.occupiedBy && sq.occupiedBy.isPlayer && sq.occupiedBy.hp > 0
                );
                if (targetSquare && targetSquare.occupiedBy) {
                    this.executeFight(aiUnit, targetSquare, () => {
                        this.time.delayedCall(600, () => {
                            if (this.state !== 'GAME_OVER') {
                                this.endTurn();
                            }
                        });
                    });
                } else {
                    this.infoText.setText(`${aiUnit.name} ends their turn.`);
                    this.time.delayedCall(500, () => {
                        if (this.state !== 'GAME_OVER') {
                            this.endTurn();
                        }
                    });
                }
            };

            // Move closer if not already adjacent
            const reachable = getReachableCells(aiUnit, this.grid);
            if (bestDist > aiUnit.attackRange && reachable.length > 0) {
                let bestSquare = reachable[0];
                let minAfterMove = Infinity;
                for (const sq of reachable) {
                    const d = Math.abs(sq.x - closestPlayer.gridX) + Math.abs(sq.y - closestPlayer.gridY);
                    if (d < minAfterMove) {
                        minAfterMove = d;
                        bestSquare = sq;
                    }
                }

                this.executeMove(aiUnit, bestSquare, () => {
                    this.time.delayedCall(250, performAttackAndFinish);
                });
            } else {
                performAttackAndFinish();
            }
        });
    }

    private drawHighlights() {
        this.highlightGraphics.clear();

        // Highlight the active unit's isometric square in gold
        const activeUnit = this.units[this.activeUnitIndex];
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
        if (this.state === 'SELECTING_FIGHT_TARGET') {
            fillColor = 0xe74c3c;
        } else if (this.state === 'SELECTING_ITEM_TARGET') {
            fillColor = 0x2ecc71;
        }

        for (const sq of this.highlightedSquares) {
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
        if (!this.cursors || !this.enterKey || !this.escKey || this.isAnimatingMove) return;

        const confirmPressed =
            Input.Keyboard.JustDown(this.enterKey) ||
            (this.spaceKey ? Input.Keyboard.JustDown(this.spaceKey) : false);

        if (this.state === 'GAME_OVER') {
            if (confirmPressed) {
                const playersAlive = this.units.some(u => u.isPlayer && u.hp > 0);
                if (playersAlive) {
                    this.scene.start("City");
                } else {
                    this.scene.restart();
                }
            }
            return;
        }

        if (Input.Keyboard.JustDown(this.escKey)) {
            this.cancelSubState();
            return;
        }

        if (
            this.state === 'UNIT_MENU' ||
            this.state === 'SELECTING_ACTION' ||
            this.state === 'SELECTING_MOVE' ||
            this.state === 'SELECTING_FIGHT_TARGET' ||
            this.state === 'SELECTING_ITEM_TARGET'
        ) {
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

    changeScene() {
        this.scene.start("City");
    }
}
