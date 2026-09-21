'use client';

import { useRef, useState } from 'react';
import type { Scene } from 'phaser';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';

function App()
{
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [currentSceneKey, setCurrentSceneKey] = useState<string>('Boot');

    // Callback fired whenever a scene emits 'current-scene-ready'
    const onSceneChange = (scene: Scene) => {
        setCurrentSceneKey(scene.scene.key);
    };

    // React button to manually start the game scene if desired
    const handleStartGame = () => {
        if (phaserRef.current && phaserRef.current.scene) {
            phaserRef.current.scene.scene.start('Game');
        }
    };

    return (
        <div id="app" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
            <PhaserGame ref={phaserRef} currentActiveScene={onSceneChange} />
            
            <div style={{ marginTop: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#888' }}>
                    Active Scene: <strong>{currentSceneKey}</strong>
                </span>

                {currentSceneKey === 'MainMenu' && (
                    <button 
                        className="button"
                        onClick={handleStartGame}
                        style={{
                            padding: '8px 16px',
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                            backgroundColor: '#e74c3c',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px'
                        }}
                    >
                        Start Game (React Bridge)
                    </button>
                )}
            </div>
        </div>
    );
}

export default App;