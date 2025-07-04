// グローバル変数
let currentOperation = null;

// DOM要素の取得
const elements = {
    portSelect: document.getElementById('port-select'),
    baudRate: document.getElementById('baud-rate'),
    refreshPortsBtn: document.getElementById('refresh-ports'),
    getChipInfoBtn: document.getElementById('get-chip-info'),
    chipInfoSection: document.getElementById('chip-info-section'),
    chipInfoContent: document.getElementById('chip-info-content'),
    backupBtn: document.getElementById('backup-btn'),
    backupProgress: document.getElementById('backup-progress'),
    backupResult: document.getElementById('backup-result'),
    backupStatus: document.getElementById('backup-status'),
    estimatedTimeSpan: document.getElementById('estimated-time'),
    restoreBtn: document.getElementById('restore-btn'),
    restoreFile: document.getElementById('restore-file'),
    restoreAddress: document.getElementById('restore-address'),
    restoreProgress: document.getElementById('restore-progress'),
    restoreResult: document.getElementById('restore-result'),
    eraseBtn: document.getElementById('erase-btn'),
    eraseProgress: document.getElementById('erase-progress'),
    eraseResult: document.getElementById('erase-result'),
    logContainer: document.getElementById('log-container'),
    clearLogBtn: document.getElementById('clear-log'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    modalCancel: document.getElementById('modal-cancel'),
    modalConfirm: document.getElementById('modal-confirm'),
    modalClose: document.querySelector('.close')
};

// ユーティリティ関数
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
        <span class="timestamp">[${timestamp}]</span>
        <span class="message">${message}</span>
    `;
    elements.logContainer.appendChild(logEntry);
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
}

function showResult(container, message, type = 'info') {
    container.className = `result-container ${type}`;
    container.innerHTML = message;
    container.style.display = 'block';
}

function hideResult(container) {
    container.style.display = 'none';
}

function showProgress(container, text = '処理中...') {
    container.style.display = 'block';
    container.querySelector('.progress-text').textContent = text;
    container.querySelector('.progress-fill').style.width = '100%';
}

function hideProgress(container) {
    container.style.display = 'none';
    container.querySelector('.progress-fill').style.width = '0%';
}

function setButtonState(button, disabled, text = null) {
    button.disabled = disabled;
    if (text) {
        const icon = button.querySelector('i');
        const iconClass = icon ? icon.className : '';
        button.innerHTML = text;
        if (icon) {
            button.insertAdjacentHTML('afterbegin', `<i class="${iconClass}"></i> `);
        }
    }
}

function showModal(title, message, onConfirm) {
    elements.modalTitle.textContent = title;
    elements.modalMessage.textContent = message;
    elements.modal.style.display = 'block';
    
    elements.modalConfirm.onclick = () => {
        elements.modal.style.display = 'none';
        onConfirm();
    };
}

function hideModal() {
    elements.modal.style.display = 'none';
}

// API呼び出し関数
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`/api/esp32${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        addLog(`API呼び出しエラー: ${error.message}`, 'error');
        throw error;
    }
}

// ポート関連の関数
async function refreshPorts() {
    try {
        addLog('シリアルポートを検索中...');
        const result = await apiCall('/ports');
        
        elements.portSelect.innerHTML = '<option value="">ポートを選択してください</option>';
        
        if (result.success && result.ports.length > 0) {
            result.ports.forEach(port => {
                const option = document.createElement('option');
                option.value = port.port;
                option.textContent = `${port.port} - ${port.description}`;
                elements.portSelect.appendChild(option);
            });
            addLog(`${result.ports.length}個のポートが見つかりました`, 'success');
        } else {
            addLog('利用可能なポートが見つかりませんでした', 'warning');
        }
    } catch (error) {
        addLog('ポートの取得に失敗しました', 'error');
    }
}

async function getChipInfo() {
    const port = elements.portSelect.value;
    const baudRate = elements.baudRate.value;
    
    if (!port) {
        addLog('ポートを選択してください', 'warning');
        return;
    }
    
    try {
        setButtonState(elements.getChipInfoBtn, true, 'チップ情報取得中...');
        addLog(`チップ情報を取得中... (ポート: ${port})`);
        
        const result = await apiCall('/chip_info', {
            method: 'POST',
            body: JSON.stringify({ port, baud_rate: parseInt(baudRate) })
        });
        
        if (result.success) {
            displayChipInfo(result.chip_info);
            addLog('チップ情報の取得が完了しました', 'success');
        } else {
            addLog(`チップ情報の取得に失敗しました: ${result.error}`, 'error');
        }
    } catch (error) {
        addLog('チップ情報の取得中にエラーが発生しました', 'error');
    } finally {
        setButtonState(elements.getChipInfoBtn, false, 'チップ情報を取得');
    }
}

function displayChipInfo(chipInfo) {
    if (!chipInfo) {
        elements.chipInfoContent.innerHTML = '<div class="chip-info-item" style="color: #dc3545;">Error: Received no chip info from server.</div>';
        elements.chipInfoSection.style.display = 'block';
        return;
    }

    const formatValue = (value) => {
        if (typeof value === 'string' && value.startsWith('Error:')) {
            return `<span style="color: #dc3545;">${value}</span>`;
        }
        return value || 'N/A';
    };

    let html = `
        <table class="chip-info-table">
            <tr>
                <td><strong>Chip Type</strong></td>
                <td>${formatValue(chipInfo.chip_type)}</td>
            </tr>
            <tr>
                <td><strong>Chip Description</strong></td>
                <td>${formatValue(chipInfo.chip_description)}</td>
            </tr>
            <tr>
                <td><strong>MAC Address</strong></td>
                <td>${formatValue(chipInfo.mac_address)}</td>
            </tr>
            <tr>
                <td><strong>Flash Manufacturer</strong></td>
                <td>${formatValue(chipInfo.flash_manufacturer)}</td>
            </tr>
            <tr>
                <td><strong>Flash Device</strong></td>
                <td>${formatValue(chipInfo.flash_device)}</td>
            </tr>
        </table>
        <div class="chip-info-item raw-output-container">
            <button id="toggle-raw-output" class="btn btn-secondary btn-sm">Show Raw Output</button>
            <pre id="raw-output-pre" class="raw-output-pre" style="display: none;">${chipInfo.raw_output || 'No raw output available.'}</pre>
        </div>
    `;
    
    elements.chipInfoContent.innerHTML = html;
    elements.chipInfoSection.style.display = 'block';

    // Add event listener for the toggle button
    const toggleBtn = document.getElementById('toggle-raw-output');
    const rawOutputPre = document.getElementById('raw-output-pre');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = rawOutputPre.style.display === 'none';
            rawOutputPre.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? 'Hide Raw Output' : 'Show Raw Output';
        });
    }
}

// バックアップ関数
async function backupFlash() {
    const port = elements.portSelect.value;
    const baudRate = elements.baudRate.value;
    
    if (!port) {
        addLog('ポートを選択してください', 'warning');
        return;
    }
    
    try {
        setButtonState(elements.backupBtn, true, 'バックアップ中...');
        showProgress(elements.backupProgress, 'フラッシュをバックアップ中...');
        hideResult(elements.backupResult);
        addLog(`フラッシュバックアップを開始 (ポート: ${port})`);
        
        const result = await apiCall('/backup', {
            method: 'POST',
            body: JSON.stringify({ port, baud_rate: parseInt(baudRate) })
        });
        
        if (result.success) {
            const fileSizeMB = (result.file_size / 1024 / 1024).toFixed(2);
            const message = `
                <strong>バックアップが完了しました！</strong><br>
                ファイルサイズ: ${fileSizeMB} MB<br>
                <a href="/api/esp32/download/${result.file_path}" 
                   class="btn btn-primary" download="esp32_backup.bin">
                    <i class="fas fa-download"></i> ダウンロード
                </a>
            `;
            showResult(elements.backupResult, message, 'success');
            addLog(`バックアップが完了しました (${fileSizeMB} MB)`, 'success');
        } else {
            showResult(elements.backupResult, `<strong>エラー:</strong> ${result.error}`, 'error');
            addLog(`バックアップに失敗しました: ${result.error}`, 'error');
        }
    } catch (error) {
        showResult(elements.backupResult, `<strong>エラー:</strong> ${error.message}`, 'error');
        addLog('バックアップ中にエラーが発生しました', 'error');
    } finally {
        setButtonState(elements.backupBtn, false, 'バックアップ開始');
        hideProgress(elements.backupProgress);
    }
}

// リストア関数
async function restoreFlash() {
    const port = elements.portSelect.value;
    const baudRate = elements.baudRate.value;
    const file = elements.restoreFile.files[0];
    const address = elements.restoreAddress.value;
    
    if (!port) {
        addLog('ポートを選択してください', 'warning');
        return;
    }
    
    if (!file) {
        addLog('リストアファイルを選択してください', 'warning');
        return;
    }
    
    try {
        setButtonState(elements.restoreBtn, true, 'リストア中...');
        showProgress(elements.restoreProgress, 'フラッシュをリストア中...');
        hideResult(elements.restoreResult);
        addLog(`フラッシュリストアを開始 (ポート: ${port}, ファイル: ${file.name})`);
        
        const formData = new FormData();
        formData.append('port', port);
        formData.append('baud_rate', baudRate);
        formData.append('address', address);
        formData.append('file', file);
        
        const response = await fetch('/api/esp32/restore', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showResult(elements.restoreResult, '<strong>リストアが完了しました！</strong>', 'success');
            addLog('リストアが完了しました', 'success');
        } else {
            showResult(elements.restoreResult, `<strong>エラー:</strong> ${result.error}`, 'error');
            addLog(`リストアに失敗しました: ${result.error}`, 'error');
        }
    } catch (error) {
        showResult(elements.restoreResult, `<strong>エラー:</strong> ${error.message}`, 'error');
        addLog('リストア中にエラーが発生しました', 'error');
    } finally {
        setButtonState(elements.restoreBtn, false, 'リストア開始');
        hideProgress(elements.restoreProgress);
    }
}

// 消去関数
async function eraseFlash() {
    const port = elements.portSelect.value;
    const baudRate = elements.baudRate.value;
    
    if (!port) {
        addLog('ポートを選択してください', 'warning');
        return;
    }
    
    showModal(
        'フラッシュ消去の確認',
        'ESP32のフラッシュメモリ全体が消去されます。この操作は元に戻せません。続行しますか？',
        async () => {
            try {
                setButtonState(elements.eraseBtn, true, '消去中...');
                showProgress(elements.eraseProgress, 'フラッシュを消去中...');
                hideResult(elements.eraseResult);
                addLog(`フラッシュ消去を開始 (ポート: ${port})`);
                
                const result = await apiCall('/erase', {
                    method: 'POST',
                    body: JSON.stringify({ port, baud_rate: parseInt(baudRate) })
                });
                
                if (result.success) {
                    showResult(elements.eraseResult, '<strong>フラッシュの消去が完了しました！</strong>', 'success');
                    addLog('フラッシュの消去が完了しました', 'success');
                } else {
                    showResult(elements.eraseResult, `<strong>エラー:</strong> ${result.error}`, 'error');
                    addLog(`フラッシュの消去に失敗しました: ${result.error}`, 'error');
                }
            } catch (error) {
                showResult(elements.eraseResult, `<strong>エラー:</strong> ${error.message}`, 'error');
                addLog('フラッシュ消去中にエラーが発生しました', 'error');
            } finally {
                setButtonState(elements.eraseBtn, false, 'フラッシュ消去');
                hideProgress(elements.eraseProgress);
            }
        }
    );
}

// バックアップ予想時間の計算
const updateEstimatedTime = () => {
    const baudRate = parseInt(elements.baudRate.value, 10);
    // ESP32の一般的なフラッシュサイズである4MBを基準に計算
    const flashSizeMb = 4;
    const flashSizeBytes = flashSizeMb * 1024 * 1024;
    
    // 1バイトの送信には約10ビット（スタートビット、データビット、ストップビット）が必要と仮定
    const estimatedSeconds = (flashSizeBytes * 10) / baudRate;

    if (isNaN(estimatedSeconds) || !isFinite(estimatedSeconds)) {
        elements.estimatedTimeSpan.textContent = 'N/A';
        return;
    }

    const minutes = Math.floor(estimatedSeconds / 60);
    const seconds = Math.round(estimatedSeconds % 60);

    if (minutes > 0) {
        elements.estimatedTimeSpan.textContent = `${minutes}分 ${seconds}秒`;
    } else {
        elements.estimatedTimeSpan.textContent = `${seconds}秒`;
    }
};

// イベントリスナーの設定
function setupEventListeners() {
    elements.refreshPortsBtn.addEventListener('click', refreshPorts);
    elements.getChipInfoBtn.addEventListener('click', getChipInfo);
    elements.baudRate.addEventListener('change', updateEstimatedTime);
    elements.backupBtn.addEventListener('click', backupFlash);
    elements.restoreBtn.addEventListener('click', restoreFlash);
    elements.eraseBtn.addEventListener('click', eraseFlash);
    elements.clearLogBtn.addEventListener('click', () => {
        elements.logContainer.innerHTML = '';
        addLog('ログがクリアされました');
    });
    
    // モーダル関連
    elements.modalCancel.addEventListener('click', hideModal);
    elements.modalClose.addEventListener('click', hideModal);
    
    // モーダル外クリックで閉じる
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            hideModal();
        }
    });
    
    // ESCキーでモーダルを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modal.style.display === 'block') {
            hideModal();
        }
    });
}

// 初期化
function init() {
    setupEventListeners();
    refreshPorts(); // ポート一覧を初期読み込み
    updateEstimatedTime(); // 予想時間を初期表示
    addLog('ESP32 Flash Toolが起動しました');
}

// DOMが読み込まれたら初期化
document.addEventListener('DOMContentLoaded', init);
