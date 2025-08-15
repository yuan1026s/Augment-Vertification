// 全局变量
let socket;
let allCodes = [];
let filteredCodes = [];

// DOM元素
const elements = {
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    clearBtn: document.getElementById('clearBtn'),
    searchTip: document.getElementById('searchTip'),
    refreshBtn: document.getElementById('refreshBtn'),

    codesContainer: document.getElementById('codesContainer'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    notificationContainer: document.getElementById('notificationContainer'),
    codeModal: document.getElementById('codeModal'),
    modalClose: document.getElementById('modalClose'),
    modalBody: document.getElementById('modalBody')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeSocket();
    initializeEventListeners();
    // 自动加载验证码
    loadCodes();
});

// Socket.IO初始化
function initializeSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Socket连接成功');
        updateConnectionStatus(true);
    });

    socket.on('disconnect', () => {
        console.log('Socket连接断开');
        updateConnectionStatus(false);
    });

    socket.on('newCode', (codeData) => {
        console.log('收到新验证码:', codeData);

        // 添加到所有验证码列表
        allCodes.unshift(codeData);

        // 检查是否应该显示通知
        const searchQuery = elements.searchInput.value.trim();
        let shouldShowNotification = false;
        let shouldPlaySound = false;

        if (searchQuery) {
            // 如果有搜索条件，只对匹配的验证码显示通知
            if (codeData.recipient &&
                (codeData.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    searchQuery.toLowerCase().includes(codeData.recipient.toLowerCase()))) {
                // 新验证码匹配当前搜索条件，添加到搜索结果
                filteredCodes.unshift(codeData);
                shouldShowNotification = true;
                shouldPlaySound = true;
            }
        } else {
            // 如果没有搜索条件，不显示通知（避免弹窗太多）
            // 用户可以通过刷新按钮或者搜索来查看新验证码
            shouldShowNotification = false;
            shouldPlaySound = false;
        }

        // 只对匹配搜索条件的验证码显示通知
        if (shouldShowNotification) {
            showNotification(`收到新验证码！收件人: ${codeData.recipient || '未知'}`, 'success');
        }

        // 重新渲染验证码列表（会显示所有验证码或搜索结果）
        renderCodes();

        // 只对匹配搜索条件的验证码播放音效
        if (shouldPlaySound) {
            playNotificationSound();
        }
    });
}

// 更新连接状态
function updateConnectionStatus(connected) {
    if (connected) {
        elements.statusDot.className = 'status-dot connected';
        elements.statusText.textContent = '已连接';
    } else {
        elements.statusDot.className = 'status-dot disconnected';
        elements.statusText.textContent = '连接断开';
    }
}

// 事件监听器初始化
function initializeEventListeners() {

    // 搜索按钮
    elements.searchBtn.addEventListener('click', performSearch);

    // 清空按钮
    elements.clearBtn.addEventListener('click', clearSearch);

    // 搜索输入框回车
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // 刷新按钮
    elements.refreshBtn.addEventListener('click', () => {
        loadCodes();
    });



    // 模态框关闭
    elements.modalClose.addEventListener('click', closeModal);
    elements.codeModal.addEventListener('click', (e) => {
        if (e.target === elements.codeModal) {
            closeModal();
        }
    });

    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}



// 执行搜索
async function performSearch() {
    const query = elements.searchInput.value.trim();
    if (!query) {
        showNotification('请输入搜索内容', 'error');
        return;
    }

    showLoading();

    try {
        const url = `/api/codes/search/recipient?recipient=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            filteredCodes = result.data;
            renderCodes();
            showNotification(`找到 ${result.total} 个相关验证码`, 'success');
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('搜索失败:', error);
        showNotification('搜索失败: ' + error.message, 'error');
        hideLoading();
    }
}

// 清空搜索
function clearSearch() {
    elements.searchInput.value = '';
    filteredCodes = [];
    renderCodes(); // 清空搜索后重新渲染（会显示空状态）
}

// 加载验证码列表
async function loadCodes() {
    showLoading();

    try {
        const response = await fetch('/api/codes/latest?limit=50');
        const result = await response.json();

        if (result.success) {
            allCodes = result.data;
            filteredCodes = [];
            renderCodes();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('加载验证码失败:', error);
        showNotification('加载验证码失败: ' + error.message, 'error');
        hideLoading();
    }
}



// 渲染验证码列表
function renderCodes() {
    // 如果有搜索结果，显示搜索结果；否则显示所有验证码
    const hasSearchQuery = elements.searchInput.value.trim() !== '';
    const codesToShow = hasSearchQuery ? filteredCodes : allCodes;

    hideLoading();

    if (codesToShow.length === 0) {
        showEmptyState();
        return;
    }

    elements.emptyState.style.display = 'none';
    elements.codesContainer.style.display = 'block';

    const html = codesToShow.map(codeData => createCodeCard(codeData)).join('');
    elements.codesContainer.innerHTML = html;

    // 添加点击事件
    document.querySelectorAll('.code-card').forEach((card, index) => {
        card.addEventListener('click', () => {
            showCodeDetails(codesToShow[index]);
        });
    });

    // 添加验证码复制事件
    document.querySelectorAll('.code-value').forEach(codeElement => {
        codeElement.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(codeElement.textContent);
        });
    });
}

// 显示空状态
function showEmptyState() {
    elements.codesContainer.style.display = 'none';
    elements.emptyState.style.display = 'block';
}

// 创建验证码卡片HTML
function createCodeCard(codeData) {
    const timeAgo = getTimeAgo(new Date(codeData.timestamp));
    const recipientDisplay = codeData.recipient || '未知';
    const senderDisplay = codeData.from || '未知发件人';

    return `
        <div class="code-card">
            <div class="code-header">
                <div class="code-info">
                    <h3>${escapeHtml(codeData.subject || '无主题')}</h3>
                    <div class="code-meta">
                        发件人: ${escapeHtml(senderDisplay)} | 收件人: ${escapeHtml(recipientDisplay)}
                    </div>
                </div>
                <div class="code-time">
                    ${timeAgo}
                </div>
            </div>

            <div class="code-values">
                ${codeData.codes.map(code => `<span class="code-value" title="点击复制">${escapeHtml(code)}</span>`).join('')}
            </div>

            <div class="code-details">
                <div class="detail-item">
                    <span class="detail-label">接收时间</span>
                    <span class="detail-value">${formatDateTime(new Date(codeData.timestamp))}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">内容预览</span>
                    <span class="detail-value">${escapeHtml(codeData.content.substring(0, 100))}${codeData.content.length > 100 ? '...' : ''}</span>
                </div>
            </div>
        </div>
    `;
}

// 显示验证码详情
function showCodeDetails(codeData) {
    const html = `
        <div class="code-detail-content">
            <h4>验证码信息</h4>
            <div class="detail-grid">
                <div class="detail-row">
                    <strong>验证码:</strong>
                    <div class="codes-list">
                        ${codeData.codes.map(code => `<span class="code-badge" onclick="copyToClipboard('${code}')">${escapeHtml(code)}</span>`).join('')}
                    </div>
                </div>
                <div class="detail-row">
                    <strong>邮件主题:</strong>
                    <span>${escapeHtml(codeData.subject || '无主题')}</span>
                </div>
                <div class="detail-row">
                    <strong>发件人:</strong>
                    <span>${escapeHtml(codeData.from || '未知')}</span>
                </div>
                <div class="detail-row">
                    <strong>收件人:</strong>
                    <span>${escapeHtml(codeData.recipient || '未知')}</span>
                </div>
                <div class="detail-row">
                    <strong>接收时间:</strong>
                    <span>${formatDateTime(new Date(codeData.timestamp))}</span>
                </div>
                <div class="detail-row">
                    <strong>邮件内容:</strong>
                    <div class="content-preview">${escapeHtml(codeData.content)}</div>
                </div>
            </div>
        </div>

        <style>
            .detail-grid { margin-top: 20px; }
            .detail-row { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
            .detail-row:last-child { border-bottom: none; }
            .codes-list { margin-top: 5px; }
            .code-badge {
                background: #3b82f6; color: white; padding: 5px 10px; border-radius: 6px;
                margin-right: 8px; cursor: pointer; font-family: monospace; font-weight: bold;
                display: inline-block; margin-bottom: 5px;
            }
            .code-badge:hover { background: #2563eb; }
            .content-preview {
                background: #f8fafc; padding: 15px; border-radius: 8px;
                max-height: 200px; overflow-y: auto; margin-top: 5px;
                font-family: monospace; font-size: 0.9rem; line-height: 1.4;
            }
        </style>
    `;

    elements.modalBody.innerHTML = html;
    elements.codeModal.style.display = 'block';
}

// 关闭模态框
function closeModal() {
    elements.codeModal.style.display = 'none';
}



// 显示加载状态
function showLoading() {
    elements.loading.style.display = 'block';
    elements.codesContainer.style.display = 'none';
    elements.emptyState.style.display = 'none';
}

// 隐藏加载状态
function hideLoading() {
    elements.loading.style.display = 'none';
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    elements.notificationContainer.appendChild(notification);

    // 3秒后自动移除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// 复制到剪贴板
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification(`已复制验证码: ${text}`, 'success');
    } catch (error) {
        console.error('复制失败:', error);

        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();

        try {
            document.execCommand('copy');
            showNotification(`已复制验证码: ${text}`, 'success');
        } catch (fallbackError) {
            showNotification('复制失败，请手动复制', 'error');
        }

        document.body.removeChild(textArea);
    }
}

// HTML转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 格式化时间差
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}天前`;
    } else if (hours > 0) {
        return `${hours}小时前`;
    } else if (minutes > 0) {
        return `${minutes}分钟前`;
    } else {
        return '刚刚';
    }
}

// 格式化日期时间
function formatDateTime(date) {
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 播放通知音效
function playNotificationSound() {
    try {
        // 创建简单的提示音
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
        // 忽略音频播放错误
        console.log('无法播放通知音效:', error);
    }
}


