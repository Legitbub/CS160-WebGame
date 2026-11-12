import {
    BattleGrid,
    BattleSquare,
    getReachableCells,
    findPath,
    getAttackableCells,
    getItemTargetCells
} from "./Battlefield";
import { Kombatant } from "./Kombatant";

export type BattleState =
    | 'WAITING_FOR_TURN'
    | 'UNIT_MENU'
    | 'SELECTING_MOVE'
    | 'SELECTING_ACTION'
    | 'SELECTING_FIGHT_TARGET'
    | 'SELECTING_ITEM_TARGET'
    | 'AI_TURN'
    | 'GAME_OVER';

export interface MenuOption {
    label: string;
    enabled: boolean;
    disabledReason?: string;
    action: () => void;
}

export interface ItemDefinition {
    name: string;
    description: string;
    count: number;
    effect: 'heal' | 'damage';
    amount: number;
}

export interface UnitSpawnConfig {
    name: string;
    x: number;
    y: number;
    speed: number;
    moveRange: number;
    isPlayer: boolean;
    textureKey: string;
    hasGunAttack?: boolean;
    shootingTextureKey?: string;
}

export const INITIAL_BANK_UNITS: UnitSpawnConfig[] = [
    { name: "You", x: 2, y: 11, speed: 12, moveRange: 6, isPlayer: true, textureKey: "player_stationary" },
    { name: "Bandit", x: 16, y: 2, speed: 11, moveRange: 4, isPlayer: false, textureKey: "robber_stationary" },
    { name: "Security Guard", x: 3, y: 13, speed: 10, moveRange: 5, isPlayer: true, textureKey: "security_guard_stationary" },
    {
        name: "Bandit Captain",
        x: 18,
        y: 3,
        speed: 9,
        moveRange: 3,
        isPlayer: false,
        textureKey: "robber_stationary",
        hasGunAttack: true,
        shootingTextureKey: "robber_shooting"
    }
];

export function createInitialInventory(): ItemDefinition[] {
    return [
        { name: "Lollipop", description: "Restores 40 HP to a unit", count: 3, effect: 'heal', amount: 40 },
        { name: "5 Hour Energy", description: "Restores 80 HP to a unit", count: 1, effect: 'heal', amount: 80 },
        { name: "Coin Toss", description: "Deals 25 DMG to a target", count: 3, effect: 'damage', amount: 25 }
    ];
}

/**
 * Interface implemented by the Phaser scene so BankBattleLogic can trigger
 * UI updates and visual animations without owning rendering objects.
 */
export interface BankBattleView {
    setTurnBanner(text: string): void;
    setInfoText(text: string): void;
    updateUnitStatusPanel(): void;
    showMenu(title: string, options: MenuOption[]): void;
    hideMenu(): void;
    updateHighlights(): void;
    animateMove(unit: Kombatant, steps: BattleSquare[], onComplete: () => void): void;
    animateAttack(
        attacker: Kombatant,
        defender: Kombatant,
        targetSquare: BattleSquare,
        onHit: () => void,
        onComplete: () => void
    ): void;
    showDamageOrHealEffect(target: Kombatant, delta: number, actualDelta: number): void;
    showBattleTextBox?(message: string, onComplete: () => void): void;
    delay(ms: number, callback: () => void): void;
    onVictory(): void;
}

export class BankBattleLogic {
    readonly grid: BattleGrid;
    readonly units: Kombatant[];
    readonly inventory: ItemDefinition[];
    private readonly view: BankBattleView;

    activeUnitIndex: number = 0;
    state: BattleState = 'WAITING_FOR_TURN';
    highlightedSquares: BattleSquare[] = [];
    selectedItem: ItemDefinition | null = null;
    isAnimatingMove: boolean = false;

    constructor(grid: BattleGrid, units: Kombatant[], view: BankBattleView) {
        this.grid = grid;
        this.units = units;
        this.view = view;
        this.inventory = createInitialInventory();
    }

    startBattle() {
        this.state = 'WAITING_FOR_TURN';
        this.view.updateUnitStatusPanel();
        this.advanceTurnOrder();
    }

    getActiveUnit(): Kombatant | undefined {
        return this.units[this.activeUnitIndex];
    }

    arePlayersAlive(): boolean {
        return this.units.some(u => u.isPlayer && u.hp > 0 && u.name === "You");
    }

    isInteractiveMenuState(): boolean {
        return (
            this.state === 'UNIT_MENU' ||
            this.state === 'SELECTING_ACTION' ||
            this.state === 'SELECTING_MOVE' ||
            this.state === 'SELECTING_FIGHT_TARGET' ||
            this.state === 'SELECTING_ITEM_TARGET'
        );
    }

    isTargetSelectionState(): boolean {
        return (
            this.state === 'SELECTING_MOVE' ||
            this.state === 'SELECTING_FIGHT_TARGET' ||
            this.state === 'SELECTING_ITEM_TARGET'
        );
    }

    handleSquareClick(clickedSquare: BattleSquare) {
        const activeUnit = this.getActiveUnit();
        if (!activeUnit) return;

        if (this.state === 'SELECTING_MOVE') {
            this.executeMove(activeUnit, clickedSquare);
        } else if (this.state === 'SELECTING_FIGHT_TARGET') {
            this.executeFight(activeUnit, clickedSquare);
        } else if (this.state === 'SELECTING_ITEM_TARGET') {
            this.executeItem(activeUnit, clickedSquare);
        }
    }

    cancelSubState() {
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

    openUnitMenu() {
        const unit = this.getActiveUnit();
        if (!unit || !unit.isPlayer) return;

        // If the unit has both moved and acted, automatically end its turn
        if (unit.hasMoved && unit.hasActed) {
            this.endTurn();
            return;
        }

        this.state = 'UNIT_MENU';
        this.selectedItem = null;
        this.highlightedSquares = [];
        this.view.updateHighlights();

        const hasItemsLeft = this.inventory.some(item => item.count > 0);
        const enemyInRange = getAttackableCells(unit, this.grid).some(
            sq => sq.occupiedBy && sq.occupiedBy.isPlayer !== unit.isPlayer
        );

        this.view.showMenu(`${unit.name} (HP ${unit.hp}/${unit.maxHp})`, [
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

        this.view.setTurnBanner(`★ ${unit.name}'s Turn (Player)`);
        this.view.setInfoText("Use ↑/↓ (or W/S) + ENTER, or click an option in the menu.");
    }

    openItemsMenu() {
        const unit = this.getActiveUnit();
        if (!unit) return;

        this.state = 'SELECTING_ACTION';
        this.highlightedSquares = [];
        this.view.updateHighlights();

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

        this.view.showMenu(`${unit.name} - Items`, itemOptions);
        this.view.setInfoText("Select an item with ↑/↓ + ENTER or Click (ESC to go back)");
    }

    startSelectingMove() {
        const unit = this.getActiveUnit();
        if (!unit) return;

        this.state = 'SELECTING_MOVE';
        this.highlightedSquares = getReachableCells(unit, this.grid);
        this.view.updateHighlights();

        this.view.showMenu(`${unit.name} - Move`, [
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
        this.view.setInfoText("Click any BLUE isometric tile to move there (or ESC to cancel)");
    }

    startSelectingFight() {
        const unit = this.getActiveUnit();
        if (!unit) return;

        this.state = 'SELECTING_FIGHT_TARGET';
        this.highlightedSquares = getAttackableCells(unit, this.grid);
        this.view.updateHighlights();

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

        this.view.showMenu(`${unit.name} - Fight`, fightOptions);

        if (enemySquares.length > 0) {
            this.view.setInfoText("Press ENTER, click '⚔ Attack' in menu, or click the enemy to attack!");
        } else {
            this.view.setInfoText("No enemy in adjacent RED tiles! Move closer first, or choose Wait.");
        }
    }

    startSelectingItemTarget(item: ItemDefinition) {
        const unit = this.getActiveUnit();
        if (!unit) return;

        this.selectedItem = item;
        this.state = 'SELECTING_ITEM_TARGET';
        this.highlightedSquares = getItemTargetCells(unit, this.grid);
        this.view.updateHighlights();

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

        this.view.showMenu(`${unit.name} - ${item.name}`, targetOptions);
        this.view.setInfoText(`${item.name}: ${item.description} — Press ENTER or click target!`);
    }

    executeMove(unit: Kombatant, targetSquare: BattleSquare, onComplete?: () => void) {
        const path = findPath(unit, targetSquare, this.grid);
        if (path.length <= 1) {
            onComplete?.();
            return;
        }

        this.isAnimatingMove = true;
        this.highlightedSquares = [];
        this.view.updateHighlights();
        if (unit.isPlayer) {
            this.view.hideMenu();
        }

        this.grid.squares[unit.gridX][unit.gridY].occupiedBy = undefined;

        const steps = path.slice(1);
        this.view.animateMove(unit, steps, () => {
            this.grid.squares[unit.gridX][unit.gridY].occupiedBy = unit;
            unit.hasMoved = true;
            this.isAnimatingMove = false;
            if (onComplete) {
                onComplete();
            } else if (unit.isPlayer) {
                this.openUnitMenu();
            }
        });
    }

    executeFight(attacker: Kombatant, targetSquare: BattleSquare, onComplete?: () => void) {
        const defender = targetSquare.occupiedBy;
        if (!defender || defender.isPlayer === attacker.isPlayer) {
            this.view.setInfoText("No enemy on that tile! Click an enemy or select '⚔ Attack' in the menu.");
            onComplete?.();
            return;
        }

        this.isAnimatingMove = true;
        this.view.hideMenu();
        this.highlightedSquares = [];
        this.view.updateHighlights();

        const damage = attacker.hasGunAttack ? 80 : (attacker.isPlayer ? 95 : 25);
        let bulletproofVestTriggered = false;

        this.view.animateAttack(
            attacker,
            defender,
            targetSquare,
            () => {
                if (
                    attacker.hasGunAttack &&
                    defender.name === "Security Guard" &&
                    defender.hp <= damage &&
                    !defender.hasUsedBulletproofVest
                ) {
                    defender.hasUsedBulletproofVest = true;
                    bulletproofVestTriggered = true;
                    const nonLethalDelta = Math.min(-1, -(defender.hp - 1));
                    this.applyDamageOrHeal(defender, nonLethalDelta, 1);
                } else {
                    this.applyDamageOrHeal(defender, -damage);
                }
                const verb = attacker.hasGunAttack ? "shot" : "hit";
                this.view.setInfoText(
                    `${attacker.name} ${verb} ${defender.name} for ${damage} DMG! (${defender.name} HP: ${defender.hp}/${defender.maxHp})`
                );
            },
            () => {
                attacker.setPosition(attacker.gridX, attacker.gridY);
                attacker.hasActed = true;

                const finishAttack = () => {
                    this.isAnimatingMove = false;

                    if (this.checkBattleEnd()) {
                        return;
                    }

                    if (onComplete) {
                        onComplete();
                    } else if (attacker.isPlayer) {
                        // Automatically finish the player's turn after attacking so the next unit (enemy) acts
                        this.view.delay(550, () => {
                            if (this.state !== 'GAME_OVER') {
                                this.endTurn();
                            }
                        });
                    }
                };

                if (bulletproofVestTriggered && this.view.showBattleTextBox) {
                    this.view.showBattleTextBox(
                        "The bulletproof vest prevented an insta-kill!",
                        finishAttack
                    );
                } else {
                    finishAttack();
                }
            }
        );
    }

    executeItem(user: Kombatant, targetSquare: BattleSquare) {
        if (!this.selectedItem) return;
        const target = targetSquare.occupiedBy;
        if (!target) {
            this.view.setInfoText("Select a green tile occupied by a unit!");
            return;
        }

        const item = this.selectedItem;
        this.selectedItem = null;
        this.isAnimatingMove = true;
        this.view.hideMenu();
        this.highlightedSquares = [];
        this.view.updateHighlights();

        if (item.effect === 'heal') {
            const healed = this.applyDamageOrHeal(target, item.amount);
            this.view.setInfoText(
                `${user.name} used ${item.name} on ${target.name}! (+${healed} HP -> ${target.hp}/${target.maxHp})`
            );
        } else {
            const dealt = Math.abs(this.applyDamageOrHeal(target, -item.amount));
            this.view.setInfoText(
                `${user.name} threw ${item.name} at ${target.name} for ${dealt} DMG! (${target.hp}/${target.maxHp} HP)`
            );
        }

        item.count = Math.max(0, item.count - 1);
        user.hasActed = true;

        this.view.delay(600, () => {
            this.isAnimatingMove = false;
            if (!this.checkBattleEnd() && user.isPlayer) {
                this.endTurn();
            }
        });
    }

    private applyDamageOrHeal(target: Kombatant, delta: number, minHp: number = 0): number {
        const prevHp = target.hp;
        target.hp = Math.max(minHp, Math.min(target.maxHp, prevHp + delta));
        const actualDelta = target.hp - prevHp;

        target.updateHpText();
        this.view.updateUnitStatusPanel();

        if (target.hp <= 0) {
            this.grid.squares[target.gridX][target.gridY].occupiedBy = undefined;
            target.sprite.setVisible(false);
            target.hpText?.setVisible(false);
            target.hpBar?.clear();
        }

        this.view.showDamageOrHealEffect(target, delta, actualDelta);
        return actualDelta;
    }

    checkBattleEnd(): boolean {
        const playersAlive = this.arePlayersAlive();
        const enemiesAlive = this.units.some(u => !u.isPlayer && u.hp > 0);

        if (!playersAlive) {
            this.state = 'GAME_OVER';
            this.view.hideMenu();
            this.view.setTurnBanner("DEFEAT...");
            this.view.setInfoText("You were defeated! Press ENTER to retry.");
            return true;
        }

        if (!enemiesAlive) {
            this.state = 'GAME_OVER';
            this.view.onVictory();
            this.view.hideMenu();
            this.view.setTurnBanner("VICTORY!");
            this.view.setInfoText("All bank robbers defeated! Press ENTER to return to City.");
            return true;
        }

        return false;
    }

    endTurn() {
        const activeUnit = this.getActiveUnit();
        if (activeUnit) {
            activeUnit.ct = Math.max(0, activeUnit.ct - 100);
            activeUnit.hasMoved = false;
            activeUnit.hasActed = false;
        }

        this.view.hideMenu();
        this.highlightedSquares = [];
        this.view.updateHighlights();

        if (!this.checkBattleEnd()) {
            this.state = 'WAITING_FOR_TURN';
            this.advanceTurnOrder();
        }
    }

    advanceTurnOrder() {
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
        this.view.hideMenu();
        this.highlightedSquares = [];
        this.view.updateHighlights();
        this.view.setTurnBanner(`⚔ ${aiUnit.name}'s Turn (Enemy)`);
        this.view.setInfoText(`${aiUnit.name} is moving...`);

        this.view.delay(500, () => {
            if (this.state === 'GAME_OVER') return;

            const playerTargets = this.units.filter(u => u.isPlayer && u.hp > 0);
            if (playerTargets.length === 0) {
                this.endTurn();
                return;
            }

            // Helper to compute shortest path distance around obstacles (falls back to Manhattan if unreachable)
            const getPathDistance = (fromX: number, fromY: number, toX: number, toY: number): number => {
                if (fromX === toX && fromY === toY) return 0;
                const visited = new Set<string>([`${fromX},${fromY}`]);
                const queue: { x: number; y: number; dist: number }[] = [{ x: fromX, y: fromY, dist: 0 }];
                const dirs = [
                    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
                    { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
                ];
                while (queue.length > 0) {
                    const curr = queue.shift()!;
                    for (const d of dirs) {
                        const nx = curr.x + d.dx;
                        const ny = curr.y + d.dy;
                        if (nx === toX && ny === toY) {
                            return curr.dist + 1;
                        }
                        const key = `${nx},${ny}`;
                        if (!visited.has(key) && this.grid.isValidSquare(nx, ny)) {
                            const sq = this.grid.squares[nx][ny];
                            const canPass = sq.accessible && (!sq.occupiedBy || sq.occupiedBy.isPlayer === aiUnit.isPlayer);
                            if (canPass) {
                                visited.add(key);
                                queue.push({ x: nx, y: ny, dist: curr.dist + 1 });
                            }
                        }
                    }
                }
                return Math.abs(fromX - toX) + Math.abs(fromY - toY) + 100;
            };

            // Find closest player unit by path distance around obstacles
            let closestPlayer = playerTargets[0];
            let bestDist = getPathDistance(aiUnit.gridX, aiUnit.gridY, closestPlayer.gridX, closestPlayer.gridY);
            for (const p of playerTargets) {
                const d = getPathDistance(aiUnit.gridX, aiUnit.gridY, p.gridX, p.gridY);
                if (d < bestDist) {
                    bestDist = d;
                    closestPlayer = p;
                }
            }

            const performAttackAndFinish = () => {
                if (this.state === 'GAME_OVER') return;

                const attackSquares = getAttackableCells(aiUnit, this.grid);
                const targetSquare = attackSquares.find(
                    sq => sq.occupiedBy && sq.occupiedBy.isPlayer && sq.occupiedBy.hp > 0
                );
                if (targetSquare && targetSquare.occupiedBy) {
                    this.highlightedSquares = attackSquares;
                    this.view.updateHighlights();
                    if (aiUnit.hasGunAttack) {
                        this.view.setInfoText(`${aiUnit.name} takes aim at ${targetSquare.occupiedBy.name}!`);
                    }

                    this.view.delay(aiUnit.hasGunAttack ? 300 : 0, () => {
                        if (this.state === 'GAME_OVER') return;
                        this.executeFight(aiUnit, targetSquare, () => {
                            this.view.delay(600, () => {
                                if (this.state !== 'GAME_OVER') {
                                    this.endTurn();
                                }
                            });
                        });
                    });
                } else {
                    this.view.updateHighlights();
                    this.view.setInfoText(`${aiUnit.name} ends their turn.`);
                    this.view.delay(500, () => {
                        if (this.state !== 'GAME_OVER') {
                            this.endTurn();
                        }
                    });
                }
            };

            const currentAttackSquares = getAttackableCells(aiUnit, this.grid);
            const canAttackFromCurrentPos = currentAttackSquares.some(
                sq => sq.occupiedBy && sq.occupiedBy.isPlayer && sq.occupiedBy.hp > 0
            );

            // Move closer if no player is currently in attack range
            const reachable = getReachableCells(aiUnit, this.grid);
            if (!canAttackFromCurrentPos && reachable.length > 0) {
                let bestSquare = reachable[0];
                let bestCanAttack = false;
                let minAfterMove = Infinity;

                for (const sq of reachable) {
                    const canAttackFromSq = getAttackableCells(aiUnit, this.grid, sq.x, sq.y).some(
                        targetSq => targetSq.occupiedBy && targetSq.occupiedBy.isPlayer && targetSq.occupiedBy.hp > 0
                    );
                    const d = getPathDistance(sq.x, sq.y, closestPlayer.gridX, closestPlayer.gridY);

                    if (canAttackFromSq && !bestCanAttack) {
                        bestCanAttack = true;
                        minAfterMove = d;
                        bestSquare = sq;
                    } else if (canAttackFromSq === bestCanAttack && d < minAfterMove) {
                        minAfterMove = d;
                        bestSquare = sq;
                    }
                }

                this.executeMove(aiUnit, bestSquare, () => {
                    this.view.delay(250, performAttackAndFinish);
                });
            } else {
                performAttackAndFinish();
            }
        });
    }
}

