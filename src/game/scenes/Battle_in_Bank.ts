import { EventBus } from "../EventBus";
import { Input, Scene, Types } from "phaser";
import { TILE_HEIGHT, TILE_WIDTH, gridToScreen, screenToGrid, getTileCorners } from "../bank_level/GridConversion";
import { BattleGrid, BattleSquare, getReachableCells, findPath, getAttackableCells, getItemTargetCells } from "../bank_level/Battlefield";
import { Kombatant } from "../bank_level/Kombatant";

interface MenuOption {
    label: string;
    enabled: boolean;
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
    private enterKey?: Input.Keyboard.Key;
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
        this.camera.centerOn(mapConverted.x, mapConverted.y);
        this.camera.setZoom(2.5);

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

        // Spawn player and enemy units onto the isometric battlefield
        this.units = [];
        this.spawnUnit("Hero", 5, 6, 12, true);
        this.spawnUnit("Ally", 5, 8, 10, true);
        this.spawnUnit("Bank Guard", 11, 5, 9, false);
        this.spawnUnit("Chief Teller", 11, 8, 8, false);

        // Build UI (Turn banner, Info bar, and FFT-style Options Menu)
        this.createUI();
        this.setupInput();

        this.state = 'WAITING_FOR_TURN';
        this.advanceTurnOrder();

        EventBus.emit('current-scene-ready', this);
    }

    private spawnUnit(name: string, x: number, y: number, speed: number, isPlayer: boolean): Kombatant {
        const unit = new Kombatant(this, name, x, y, speed, isPlayer, 'player_stationary');
        this.grid.squares[x][y].occupiedBy = unit;
        this.units.push(unit);
        return unit;
    }

    private createUI() {
        const invZoom = 1 / this.camera.zoom; // Scale UI so it renders crisply at camera zoom 2.5
        const view = this.camera.worldView;

        // Top turn banner
        this.turnBannerText = this.add.text(view.centerX, view.top + 14, "", {
            fontFamily: "Courier New, monospace",
            fontSize: "22px",
            fontStyle: "bold",
            color: "#f1c40f",
            backgroundColor: "#0d1322cc",
            padding: { x: 14, y: 6 },
            stroke: "#000000",
            strokeThickness: 3,
            resolution: 2
        })
        .setOrigin(0.5, 0)
        .setScale(invZoom)
        .setDepth(1000);

        // Bottom info/help text bar
        this.infoText = this.add.text(view.centerX, view.bottom - 12, "", {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: "#ecf0f1",
            backgroundColor: "#0d1322dd",
            padding: { x: 12, y: 5 },
            stroke: "#000000",
            strokeThickness: 2,
            resolution: 2
        })
        .setOrigin(0.5, 1)
        .setScale(invZoom)
        .setDepth(1000);

        // FFT-style Command Options Menu Container (pinned to bottom-left of camera view)
        this.actionMenuContainer = this.add.container(view.left + 14, view.bottom - 135)
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

        // First enabled option is selected by default
        const firstEnabled = options.findIndex(o => o.enabled);
        if (firstEnabled !== -1) {
            this.actionMenuSelection = firstEnabled;
        }

        // Remove previous text items
        this.actionMenuItems.forEach(item => item.destroy());
        this.actionMenuItems = [];

        this.menuTitleText.setText(title);

        const menuWidth = 230;
        const rowHeight = 30;
        const menuHeight = 48 + options.length * rowHeight;

        // Draw FFT-inspired dark blue parchment/window frame
        this.menuBg.clear();
        this.menuBg.fillStyle(0x10182b, 0.92);
        this.menuBg.fillRoundedRect(0, 0, menuWidth, menuHeight, 6);
        this.menuBg.lineStyle(2, 0xc8b078, 1);
        this.menuBg.strokeRoundedRect(0, 0, menuWidth, menuHeight, 6);
        this.menuBg.lineStyle(1, 0x4a5a80, 0.8);
        this.menuBg.lineBetween(10, 34, menuWidth - 10, 34);

        // Reposition container so it stays anchored to bottom-left of the viewport
        const view = this.camera.worldView;
        const invZoom = 1 / this.camera.zoom;
        this.actionMenuContainer.setPosition(view.left + 14, view.bottom - (menuHeight * invZoom) - 34);

        options.forEach((opt, idx) => {
            const itemY = 42 + idx * rowHeight;
            const textObj = this.add.text(36, itemY, opt.label, {
                fontFamily: "Courier New, monospace",
                fontSize: "18px",
                color: opt.enabled ? "#ecf0f1" : "#6c7a89",
                resolution: 2
            });

            if (opt.enabled) {
                textObj.setInteractive({ useHandCursor: true });
                textObj.on("pointerover", () => {
                    this.actionMenuSelection = idx;
                    this.updateMenuVisuals();
                });
                textObj.on("pointerdown", (pointer: Input.Pointer, localX: number, localY: number, event: Types.Input.EventData) => {
                    event.stopPropagation();
                    this.actionMenuSelection = idx;
                    this.updateMenuVisuals();
                    this.confirmMenuSelection();
                });
            }

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
                item.setColor("#6c7a89");
                item.setScale(1.0);
            } else if (isSelected) {
                item.setColor("#f39c12");
                item.setScale(1.04);
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
        if (chosen && chosen.enabled) {
            chosen.action();
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

        this.populateMenu(`${unit.name} (HP ${unit.hp}/${unit.maxHp})`, [
            {
                label: "Move",
                enabled: !unit.hasMoved,
                action: () => this.startSelectingMove()
            },
            {
                label: "Fight",
                enabled: !unit.hasActed,
                action: () => this.startSelectingFight()
            },
            {
                label: "Items",
                enabled: !unit.hasActed && hasItemsLeft,
                action: () => this.openItemsMenu()
            },
            {
                label: "Wait",
                enabled: true,
                action: () => this.endTurn()
            }
        ]);

        this.turnBannerText.setText(`${unit.name}'s Turn`);
        this.infoText.setText("Choose a command (Arrow Keys + Enter, or Click)");
    }

    private openItemsMenu() {
        const unit = this.units[this.activeUnitIndex];
        this.state = 'SELECTING_ACTION';
        this.highlightedSquares = [];
        this.drawHighlights();

        const itemOptions: MenuOption[] = this.inventory.map(item => ({
            label: `${item.name} x${item.count}`,
            enabled: item.count > 0,
            action: () => this.startSelectingItemTarget(item)
        }));

        itemOptions.push({
            label: "Back",
            enabled: true,
            action: () => this.openUnitMenu()
        });

        this.populateMenu(`${unit.name} - Items`, itemOptions);
        this.infoText.setText("Select an item to use (ESC to go back)");
    }

    private startSelectingMove() {
        const unit = this.units[this.activeUnitIndex];
        this.state = 'SELECTING_MOVE';
        this.actionMenuContainer.setVisible(false);
        this.highlightedSquares = getReachableCells(unit, this.grid);
        this.drawHighlights();
        this.infoText.setText("Click a blue tile to move (Right-click or ESC to cancel)");
    }

    private startSelectingFight() {
        const unit = this.units[this.activeUnitIndex];
        this.state = 'SELECTING_FIGHT_TARGET';
        this.actionMenuContainer.setVisible(false);
        this.highlightedSquares = getAttackableCells(unit, this.grid);
        this.drawHighlights();
        this.infoText.setText("Click a red tile with an enemy to attack (Right-click or ESC to cancel)");
    }

    private startSelectingItemTarget(item: ItemDefinition) {
        const unit = this.units[this.activeUnitIndex];
        this.selectedItem = item;
        this.state = 'SELECTING_ITEM_TARGET';
        this.actionMenuContainer.setVisible(false);
        this.highlightedSquares = getItemTargetCells(unit, this.grid);
        this.drawHighlights();
        this.infoText.setText(`${item.name}: ${item.description} — Click a green tile (ESC to cancel)`);
    }

    private setupInput() {
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.enterKey = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ENTER);
            this.escKey = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ESC);
        }

        this.input.mouse?.disableContextMenu();

        this.input.on("pointermove", (pointer: Input.Pointer) => {
            const worldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);
            const gridPos = screenToGrid(worldPoint.x, worldPoint.y);

            if (this.grid.isValidSquare(gridPos.x, gridPos.y)) {
                this.hoveredGridPos = gridPos;
            } else {
                this.hoveredGridPos = null;
            }
            this.drawCursor();
        });

        this.input.on("pointerdown", (pointer: Input.Pointer) => {
            if (this.isAnimatingMove) return;

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
            const { x, y } = screenToGrid(worldPoint.x, worldPoint.y);

            if (!this.grid.isValidSquare(x, y)) return;

            const clickedSquare = this.highlightedSquares.find(s => s.x === x && s.y === y);
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

    private executeMove(unit: Kombatant, targetSquare: BattleSquare) {
        const path = findPath(unit, targetSquare, this.grid);
        if (path.length <= 1) return;

        this.isAnimatingMove = true;
        this.highlightedSquares = [];
        this.drawHighlights();

        this.grid.squares[unit.gridX][unit.gridY].occupiedBy = undefined;

        const steps = path.slice(1);
        const stepNext = (index: number) => {
            if (index >= steps.length) {
                this.grid.squares[unit.gridX][unit.gridY].occupiedBy = unit;
                unit.hasMoved = true;
                this.isAnimatingMove = false;
                if (unit.isPlayer) {
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
                    if (unit.hpText) {
                        unit.hpText.setPosition(unit.sprite.x, unit.sprite.y - 22);
                    }
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

    private executeFight(attacker: Kombatant, targetSquare: BattleSquare) {
        const defender = targetSquare.occupiedBy;
        if (!defender || defender.isPlayer === attacker.isPlayer) {
            this.infoText.setText("Select a tile occupied by an enemy!");
            return;
        }

        const dx = targetSquare.x - attacker.gridX;
        const dy = targetSquare.y - attacker.gridY;
        this.updateSpriteDirection(attacker, dx, dy);

        const damage = 35;
        this.applyDamageOrHeal(defender, -damage);
        attacker.hasActed = true;

        this.highlightedSquares = [];
        this.drawHighlights();

        if (!this.checkBattleEnd() && attacker.isPlayer) {
            this.openUnitMenu();
        }
    }

    private executeItem(user: Kombatant, targetSquare: BattleSquare) {
        if (!this.selectedItem) return;
        const target = targetSquare.occupiedBy;
        if (!target) {
            this.infoText.setText("Select a tile with a unit!");
            return;
        }

        if (this.selectedItem.effect === 'heal') {
            this.applyDamageOrHeal(target, this.selectedItem.amount);
        } else {
            this.applyDamageOrHeal(target, -this.selectedItem.amount);
        }

        this.selectedItem.count = Math.max(0, this.selectedItem.count - 1);
        user.hasActed = true;
        this.selectedItem = null;

        this.highlightedSquares = [];
        this.drawHighlights();

        if (!this.checkBattleEnd() && user.isPlayer) {
            this.openUnitMenu();
        }
    }

    private applyDamageOrHeal(target: Kombatant, delta: number) {
        target.hp = Phaser.Math.Clamp(target.hp + delta, 0, target.maxHp);
        target.updateHpText();

        const screen = gridToScreen(target.gridX, target.gridY);
        const label = delta >= 0 ? `+${delta} HP` : `${delta} HP`;
        const color = delta >= 0 ? "#2ecc71" : "#ff4d4d";

        const popText = this.add.text(screen.x, screen.y - 28, label, {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            fontStyle: "bold",
            color,
            stroke: "#000000",
            strokeThickness: 3,
            resolution: 2
        }).setOrigin(0.5).setScale(0.5).setDepth(999);

        this.tweens.add({
            targets: popText,
            y: popText.y - 16,
            alpha: 0,
            duration: 900,
            onComplete: () => popText.destroy()
        });

        if (target.hp <= 0) {
            this.grid.squares[target.gridX][target.gridY].occupiedBy = undefined;
            target.sprite.setVisible(false);
            target.hpText?.setVisible(false);
        }
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
        this.turnBannerText.setText(`${aiUnit.name}'s Turn (Enemy)`);
        this.infoText.setText(`${aiUnit.name} is thinking...`);
        this.drawHighlights();

        this.time.delayedCall(600, () => {
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

                this.grid.squares[aiUnit.gridX][aiUnit.gridY].occupiedBy = undefined;
                aiUnit.setPosition(bestSquare.x, bestSquare.y);
                this.grid.squares[aiUnit.gridX][aiUnit.gridY].occupiedBy = aiUnit;
                aiUnit.hasMoved = true;
            }

            // Attack if a player is now in attack range
            const attackSquares = getAttackableCells(aiUnit, this.grid);
            const targetSquare = attackSquares.find(sq => sq.occupiedBy && sq.occupiedBy.isPlayer);
            if (targetSquare) {
                this.executeFight(aiUnit, targetSquare);
            }

            this.time.delayedCall(500, () => {
                if (this.state !== 'GAME_OVER') {
                    this.endTurn();
                }
            });
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

        if (this.state === 'GAME_OVER') {
            if (Input.Keyboard.JustDown(this.enterKey)) {
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

        if (this.state === 'UNIT_MENU' || this.state === 'SELECTING_ACTION') {
            const count = this.currentMenuOptions.length;
            if (count === 0) return;

            if (Input.Keyboard.JustDown(this.cursors.up)) {
                this.actionMenuSelection = (this.actionMenuSelection - 1 + count) % count;
                this.updateMenuVisuals();
            } else if (Input.Keyboard.JustDown(this.cursors.down)) {
                this.actionMenuSelection = (this.actionMenuSelection + 1) % count;
                this.updateMenuVisuals();
            } else if (Input.Keyboard.JustDown(this.enterKey)) {
                this.confirmMenuSelection();
            }
        }
    }

    changeScene() {
        this.scene.start("City");
    }
}