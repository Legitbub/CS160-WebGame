export type PowerUpType =
    | "shield"
    | "boost"
    | "magnet"
    | "double";

export interface CarObstacle {
    x: number;
    y: number;
    width: number;
    height: number;
    lane: number;
    nearMissAwarded: boolean;
}

export interface RunnerState {
    score: number;
    coins: number;
    combo: number;
    lap: number;
    speed: number;
    packageCondition: number;
    activePowerUps: string[];
}