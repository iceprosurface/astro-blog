import { useGraphStore, DEFAULT_PREFS } from './store';

export function GraphControlPanel() {
    const {
        repelForce,
        centerForce,
        linkDistance,
        showTags,
        isSettingsOpen,
        toggleSettings,
        setPref,
        resetPrefs
    } = useGraphStore();

    if (!isSettingsOpen) {
        return (
            <button
                className="graph-settings-btn"
                onClick={toggleSettings}
                title="图谱设置"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
            </button>
        );
    }

    return (
        <div className="graph-control-panel">
            <div className="panel-header">
                <h3>图谱设置</h3>
                <button className="panel-close-btn" onClick={toggleSettings}>×</button>
            </div>

            <div className="panel-body">
                <label className="control-row checkbox-row">
                    <span>显示标签 (Tags)</span>
                    <input
                        type="checkbox"
                        checked={showTags}
                        onChange={(e) => setPref({ showTags: e.target.checked })}
                    />
                </label>

                <div className="control-row">
                    <div className="row-label">
                        <span>斥力强度 (Repel)</span>
                        <span className="value">{repelForce}</span>
                    </div>
                    <input
                        type="range"
                        min="0.1" max="4.0" step="0.1"
                        value={repelForce}
                        onChange={(e) => setPref({ repelForce: parseFloat(e.target.value) })}
                    />
                </div>

                <div className="control-row">
                    <div className="row-label">
                        <span>中心引力 (Center)</span>
                        <span className="value">{centerForce}</span>
                    </div>
                    <input
                        type="range"
                        min="0.05" max="1.0" step="0.05"
                        value={centerForce}
                        onChange={(e) => setPref({ centerForce: parseFloat(e.target.value) })}
                    />
                </div>

                <div className="control-row">
                    <div className="row-label">
                        <span>连线距离 (Link)</span>
                        <span className="value">{linkDistance}</span>
                    </div>
                    <input
                        type="range"
                        min="20" max="200" step="10"
                        value={linkDistance}
                        onChange={(e) => setPref({ linkDistance: parseInt(e.target.value, 10) })}
                    />
                </div>

                <button
                    onClick={resetPrefs}
                    style={{
                        marginTop: '8px',
                        padding: '8px',
                        background: 'var(--graph-bg)',
                        border: '1px solid var(--graph-link)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: 'var(--darkgray)',
                        fontSize: '0.85rem'
                    }}
                >
                    重置默认值
                </button>
            </div>
        </div>
    );
}
