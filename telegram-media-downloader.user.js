// ==UserScript==
// @name         Telegram 受限媒体下载器
// @namespace    https://github.com/weiruankeji2025/weiruan-Telegram
// @version      1.5.1
// @description  下载 Telegram Web 中的受限图片和视频，支持分块下载原始视频文件
// @author       WeiRuan Tech
// @match        https://web.telegram.org/*
// @match        https://*.web.telegram.org/*
// @icon         https://telegram.org/favicon.ico
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // 配置选项
    const CONFIG = {
        downloadPath: GM_getValue('downloadPath', 'Telegram'),
        autoDownload: GM_getValue('autoDownload', false),
        notifyOnDownload: GM_getValue('notifyOnDownload', true),
        downloadQuality: GM_getValue('downloadQuality', 'best'), // best, medium, low
        buttonPosition: GM_getValue('buttonPosition', 'top-right'), // top-right, bottom-right
    };

    // 保存配置
    function saveConfig() {
        GM_setValue('downloadPath', CONFIG.downloadPath);
        GM_setValue('autoDownload', CONFIG.autoDownload);
        GM_setValue('notifyOnDownload', CONFIG.notifyOnDownload);
        GM_setValue('downloadQuality', CONFIG.downloadQuality);
        GM_setValue('buttonPosition', CONFIG.buttonPosition);
    }

    // Hash 函数（用于生成文件名）
    const hashCode = (s) => {
        var h = 0, l = s.length, i = 0;
        if (l > 0) {
            while (i < l) {
                h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
            }
        }
        return h >>> 0;
    };

    // Content-Range 正则表达式
    const contentRangeRegex = /^bytes (\d+)-(\d+)\/(\d+)$/;

    // 通知函数
    function notify(title, message, type = 'info') {
        if (!CONFIG.notifyOnDownload) return;

        GM_notification({
            title: title,
            text: message,
            timeout: 3000,
            onclick: () => {}
        });

        // 同时显示页面内通知
        showToast(message, type);
    }

    // 页面内 Toast 通知
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `tg-downloader-toast tg-downloader-toast-${type}`;
        toast.textContent = message;

        const styles = {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '999999',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'slideIn 0.3s ease-out',
            maxWidth: '300px',
            wordWrap: 'break-word'
        };

        const bgColors = {
            'info': '#3390ec',
            'success': '#4caf50',
            'error': '#f44336',
            'warning': '#ff9800'
        };

        Object.assign(toast.style, styles);
        toast.style.backgroundColor = bgColors[type] || bgColors.info;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 添加 CSS 样式
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }

            .tg-download-btn {
                position: absolute;
                z-index: 10000;
                padding: 8px 16px;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.85) 0%, rgba(118, 75, 162, 0.85) 100%);
                color: white;
                border: none;
                border-radius: 20px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 6px;
                backdrop-filter: blur(10px);
                opacity: 0.9;
                pointer-events: auto;
            }

            .tg-download-btn:hover {
                transform: translateY(-2px) scale(1.02);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
                background: linear-gradient(135deg, rgba(118, 75, 162, 0.95) 0%, rgba(102, 126, 234, 0.95) 100%);
                opacity: 1;
            }

            .tg-download-btn:active {
                transform: translateY(0);
            }

            .tg-download-btn.downloading {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                animation: pulse 1.5s infinite;
            }

            .tg-download-btn.success {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            }

            .tg-download-btn-icon {
                width: 16px;
                height: 16px;
                fill: currentColor;
            }

            .tg-settings-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                z-index: 100000;
                min-width: 400px;
                max-width: 500px;
            }

            .tg-settings-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 99999;
                backdrop-filter: blur(4px);
            }

            .tg-settings-title {
                font-size: 20px;
                font-weight: 700;
                margin-bottom: 20px;
                color: #333;
            }

            .tg-settings-option {
                margin-bottom: 16px;
            }

            .tg-settings-label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #555;
                font-size: 14px;
            }

            .tg-settings-input,
            .tg-settings-select {
                width: 100%;
                padding: 10px 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 14px;
                transition: border-color 0.3s;
            }

            .tg-settings-input:focus,
            .tg-settings-select:focus {
                outline: none;
                border-color: #667eea;
            }

            .tg-settings-checkbox {
                margin-right: 8px;
                width: 18px;
                height: 18px;
                cursor: pointer;
            }

            .tg-settings-buttons {
                display: flex;
                gap: 12px;
                margin-top: 24px;
            }

            .tg-settings-btn {
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                font-size: 14px;
            }

            .tg-settings-btn-save {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .tg-settings-btn-save:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }

            .tg-settings-btn-cancel {
                background: #f5f5f5;
                color: #666;
            }

            .tg-settings-btn-cancel:hover {
                background: #e0e0e0;
            }

            .tg-watermark {
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: rgba(0,0,0,0.6);
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 11px;
                z-index: 9999;
                backdrop-filter: blur(10px);
            }
        `;
        document.head.appendChild(style);
    }

    // 设置面板
    function showSettings() {
        const overlay = document.createElement('div');
        overlay.className = 'tg-settings-overlay';

        const panel = document.createElement('div');
        panel.className = 'tg-settings-panel';

        panel.innerHTML = `
            <div class="tg-settings-title">⚙️ Telegram 下载器设置</div>

            <div class="tg-settings-option">
                <label class="tg-settings-label">下载文件夹名称</label>
                <input type="text" class="tg-settings-input" id="downloadPath" value="${CONFIG.downloadPath}" placeholder="例如: Telegram">
            </div>

            <div class="tg-settings-option">
                <label class="tg-settings-label">下载质量</label>
                <select class="tg-settings-select" id="downloadQuality">
                    <option value="best" ${CONFIG.downloadQuality === 'best' ? 'selected' : ''}>最佳质量</option>
                    <option value="medium" ${CONFIG.downloadQuality === 'medium' ? 'selected' : ''}>中等质量</option>
                    <option value="low" ${CONFIG.downloadQuality === 'low' ? 'selected' : ''}>低质量</option>
                </select>
            </div>

            <div class="tg-settings-option">
                <label class="tg-settings-label">按钮位置</label>
                <select class="tg-settings-select" id="buttonPosition">
                    <option value="top-right" ${CONFIG.buttonPosition === 'top-right' ? 'selected' : ''}>右上角</option>
                    <option value="bottom-right" ${CONFIG.buttonPosition === 'bottom-right' ? 'selected' : ''}>右下角</option>
                    <option value="top-left" ${CONFIG.buttonPosition === 'top-left' ? 'selected' : ''}>左上角</option>
                    <option value="bottom-left" ${CONFIG.buttonPosition === 'bottom-left' ? 'selected' : ''}>左下角</option>
                </select>
            </div>

            <div class="tg-settings-option">
                <label>
                    <input type="checkbox" class="tg-settings-checkbox" id="notifyOnDownload" ${CONFIG.notifyOnDownload ? 'checked' : ''}>
                    <span class="tg-settings-label" style="display: inline;">启用下载通知</span>
                </label>
            </div>

            <div class="tg-settings-buttons">
                <button class="tg-settings-btn tg-settings-btn-save">保存设置</button>
                <button class="tg-settings-btn tg-settings-btn-cancel">取消</button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(panel);

        // 保存按钮
        panel.querySelector('.tg-settings-btn-save').addEventListener('click', () => {
            CONFIG.downloadPath = document.getElementById('downloadPath').value || 'Telegram';
            CONFIG.downloadQuality = document.getElementById('downloadQuality').value;
            CONFIG.buttonPosition = document.getElementById('buttonPosition').value;
            CONFIG.notifyOnDownload = document.getElementById('notifyOnDownload').checked;

            saveConfig();
            notify('设置已保存', '您的设置已成功保存！', 'success');

            overlay.remove();
            panel.remove();
        });

        // 取消按钮
        panel.querySelector('.tg-settings-btn-cancel').addEventListener('click', () => {
            overlay.remove();
            panel.remove();
        });

        // 点击遮罩关闭
        overlay.addEventListener('click', () => {
            overlay.remove();
            panel.remove();
        });
    }

    // 检查元素是否在聊天列表或侧边栏中
    function isInChatListOrSidebar(element) {
        // 检查是否在聊天列表中
        const chatListSelectors = [
            '.chat-list',
            '[class*="ChatList"]',
            '[class*="chatlist"]',
            '.left-column',
            '[class*="LeftColumn"]',
            '.sidebar',
            '[class*="Sidebar"]',
            '.dialogs',
            '[class*="Dialog"]'
        ];

        for (const selector of chatListSelectors) {
            if (element.closest(selector)) {
                return true;
            }
        }

        return false;
    }

    // 检查是否是真正的媒体查看器或消息中的媒体
    function isActualMediaContent(element, container) {
        // 必须在媒体查看器或消息媒体容器中
        const validContainers = [
            '.media-viewer',
            '[class*="MediaViewer"]',
            '.message-media',
            '[class*="MessageMedia"]',
            '.album',
            '[class*="Album"]',
            '.attachment',
            '[class*="Attachment"]',
            '.photo',
            '[class*="Photo"]',
            '.video-player',
            '[class*="VideoPlayer"]'
        ];

        for (const selector of validContainers) {
            if (container.closest(selector)) {
                return true;
            }
        }

        return false;
    }

    // 检测容器中是否有头像或重要元素
    function hasAvatarOrImportantElement(container) {
        // 查找常见的头像选择器
        const avatarSelectors = [
            '.avatar',
            '[class*="Avatar"]',
            '[class*="avatar"]',
            '.profile-photo',
            '[class*="ProfilePhoto"]',
            'img[class*="round"]',
            'img[class*="circle"]',
            '[class*="sender-photo"]',
            '[class*="SenderPhoto"]'
        ];

        for (const selector of avatarSelectors) {
            if (container.querySelector(selector)) {
                return true;
            }
        }

        // 检查容器本身是否是头像
        const containerClasses = container.className || '';
        if (containerClasses.includes('avatar') ||
            containerClasses.includes('Avatar') ||
            containerClasses.includes('profile')) {
            return true;
        }

        return false;
    }

    // 智能选择按钮位置（避免遮挡重要内容）
    function getSmartButtonPosition(container) {
        // 检查是否有头像等重要元素
        const hasAvatar = hasAvatarOrImportantElement(container);

        // 如果有头像，优先使用右侧位置
        if (hasAvatar) {
            // 避开左上角（通常是头像位置）
            if (CONFIG.buttonPosition === 'top-left' || CONFIG.buttonPosition === 'bottom-left') {
                return { top: '10px', right: '10px' }; // 强制使用右上角
            }
        }

        const positions = {
            'top-right': { top: '10px', right: '10px' },
            'bottom-right': { bottom: '10px', right: '10px' },
            'top-left': { top: '10px', left: '10px' },
            'bottom-left': { bottom: '10px', left: '10px' }
        };

        return positions[CONFIG.buttonPosition] || positions['top-right'];
    }

    // 获取按钮位置样式
    function getButtonPositionStyle(container) {
        return getSmartButtonPosition(container);
    }

    // 创建下载按钮
    function createDownloadButton(mediaElement, mediaUrl, mediaType, container) {
        const button = document.createElement('button');
        button.className = 'tg-download-btn';
        button.innerHTML = `
            <svg class="tg-download-btn-icon" viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            <span>下载${mediaType === 'video' ? '视频' : '图片'}</span>
        `;

        // 使用智能位置选择
        const positionStyle = getButtonPositionStyle(container);
        Object.assign(button.style, positionStyle);

        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            button.classList.add('downloading');
            button.innerHTML = `
                <svg class="tg-download-btn-icon" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>下载中...</span>
            `;

            try {
                await downloadMedia(mediaUrl, mediaType, mediaElement);

                button.classList.remove('downloading');
                button.classList.add('success');
                button.innerHTML = `
                    <svg class="tg-download-btn-icon" viewBox="0 0 24 24">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                    </svg>
                    <span>下载成功</span>
                `;

                setTimeout(() => {
                    button.classList.remove('success');
                    button.innerHTML = `
                        <svg class="tg-download-btn-icon" viewBox="0 0 24 24">
                            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                        </svg>
                        <span>下载${mediaType === 'video' ? '视频' : '图片'}</span>
                    `;
                }, 2000);

            } catch (error) {
                console.error('下载失败:', error);
                notify('下载失败', error.message, 'error');

                button.classList.remove('downloading');
                button.innerHTML = `
                    <svg class="tg-download-btn-icon" viewBox="0 0 24 24">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                    <span>下载${mediaType === 'video' ? '视频' : '图片'}</span>
                `;
            }
        });

        return button;
    }

    // 检查是否是 Telegram 内部 URL
    function isTelegramInternalUrl(url) {
        return url && (
            url.includes('/a/progressive/') ||
            url.includes('/document') ||
            url.startsWith('/') ||
            url.includes('web.telegram.org/a/')
        );
    }

    // 分块下载视频（核心下载函数 - 使用 Range 请求）
    async function downloadVideoInChunks(url, filename) {
        let blobs = [];
        let nextOffset = 0;
        let totalSize = null;
        let fileExtension = 'mp4';

        // 尝试从URL中提取文件名和MIME类型
        try {
            const metadata = JSON.parse(
                decodeURIComponent(url.split('/')[url.split('/').length - 1])
            );
            if (metadata.fileName) {
                filename = metadata.fileName;
            }
            if (metadata.mimeType) {
                fileExtension = metadata.mimeType.split('/')[1];
            }
        } catch (e) {
            // 无法解析，使用默认值
        }

        const fetchNextPart = async () => {
            try {
                console.log(`[视频下载] 请求分块: bytes=${nextOffset}-`);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Range': `bytes=${nextOffset}-`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    credentials: 'include'
                });

                console.log(`[视频下载] 响应状态: ${response.status}`);
                console.log(`[视频下载] Content-Type: ${response.headers.get('Content-Type')}`);
                console.log(`[视频下载] Content-Range: ${response.headers.get('Content-Range')}`);
                console.log(`[视频下载] Content-Length: ${response.headers.get('Content-Length')}`);

                if (![200, 206].includes(response.status)) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const mime = response.headers.get('Content-Type')?.split(';')[0];
                if (mime && mime.startsWith('video/')) {
                    fileExtension = mime.split('/')[1];
                    const dotIndex = filename.lastIndexOf('.');
                    if (dotIndex !== -1) {
                        filename = filename.substring(0, dotIndex + 1) + fileExtension;
                    } else {
                        filename = filename + '.' + fileExtension;
                    }
                }

                const contentRange = response.headers.get('Content-Range');
                if (contentRange) {
                    const match = contentRange.match(contentRangeRegex);
                    if (match) {
                        const startOffset = parseInt(match[1]);
                        const endOffset = parseInt(match[2]);
                        const size = parseInt(match[3]);

                        if (startOffset !== nextOffset) {
                            console.error(`[视频下载] 分块不连续! 期望: ${nextOffset}, 实际: ${startOffset}`);
                            throw new Error('分块数据不连续');
                        }
                        if (totalSize && size !== totalSize) {
                            console.error(`[视频下载] 文件大小不一致! 之前: ${totalSize}, 现在: ${size}`);
                            throw new Error('文件总大小不一致');
                        }

                        nextOffset = endOffset + 1;
                        totalSize = size;

                        const progress = Math.round((nextOffset * 100) / totalSize);
                        console.log(`[视频下载] 进度: ${progress}% (${nextOffset}/${totalSize} bytes)`);
                        notify('下载进度', `${filename}: ${progress}%`, 'info');
                    }
                } else if (response.status === 200) {
                    // 没有Content-Range，可能是服务器不支持Range请求，返回完整文件
                    console.log('[视频下载] 服务器返回完整文件（不支持Range）');
                    const contentLength = response.headers.get('Content-Length');
                    if (contentLength) {
                        totalSize = parseInt(contentLength);
                    }
                }

                const blob = await response.blob();
                blobs.push(blob);
                console.log(`[视频下载] 已获取 blob，大小: ${blob.size} bytes`);

                // 如果还有更多数据，继续下载
                if (totalSize && nextOffset < totalSize) {
                    return fetchNextPart();
                } else {
                    // 下载完成，合并并保存
                    console.log('[视频下载] 所有分块下载完成，开始合并...');
                    const finalBlob = new Blob(blobs, { type: `video/${fileExtension}` });
                    const blobUrl = URL.createObjectURL(finalBlob);

                    console.log(`[视频下载] 最终文件大小: ${finalBlob.size} bytes`);

                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    setTimeout(() => {
                        URL.revokeObjectURL(blobUrl);
                    }, 100);

                    notify('下载完成', `视频已保存：${filename}`, 'success');
                    console.log('[视频下载] 下载触发完成');
                    return true;
                }
            } catch (error) {
                console.error('[视频下载] 分块下载错误:', error);
                console.error('[视频下载] 错误详情:', error.message, error.stack);
                notify('下载失败', error.message, 'error');
                throw error;
            }
        };

        return fetchNextPart();
    }

    // 检查视频是否可以捕获
    function canCaptureVideo(videoElement) {
        if (!videoElement) return false;

        // 检查视频元素是否有效
        if (videoElement.error) {
            console.warn('视频加载错误:', videoElement.error);
            return false;
        }

        // 检查视频是否真的有数据（不是空的或未加载）
        if (videoElement.readyState === 0) { // HAVE_NOTHING
            console.warn('视频没有任何数据');
            return false;
        }

        // 检查是否有有效的源
        if (!videoElement.src && !videoElement.currentSrc) {
            const sources = videoElement.querySelectorAll('source');
            if (!sources || sources.length === 0) {
                console.warn('视频没有有效的源');
                return false;
            }
        }

        // 检查视频 URL 是否有效
        const videoUrl = videoElement.src || videoElement.currentSrc;
        if (videoUrl && (videoUrl.includes('404') || videoUrl === '' || videoUrl === 'about:blank')) {
            console.warn('视频 URL 无效');
            return false;
        }

        return true;
    }

    // 使用 MediaRecorder 录制视频流
    async function captureVideoWithRecorder(videoElement) {
        return new Promise((resolve, reject) => {
            try {
                notify('开始录制', '正在录制视频...', 'info');

                // 捕获视频流
                const stream = videoElement.captureStream();

                // 检查流是否有效
                if (!stream || stream.getTracks().length === 0) {
                    reject(new Error('无法捕获视频流'));
                    return;
                }

                const chunks = [];
                let mediaRecorder;

                // 尝试不同的编码格式
                const mimeTypes = [
                    'video/webm;codecs=vp9,opus',
                    'video/webm;codecs=vp8,opus',
                    'video/webm',
                    'video/mp4'
                ];

                let selectedMimeType = '';
                for (const mimeType of mimeTypes) {
                    if (MediaRecorder.isTypeSupported(mimeType)) {
                        selectedMimeType = mimeType;
                        break;
                    }
                }

                if (!selectedMimeType) {
                    reject(new Error('浏览器不支持视频录制'));
                    return;
                }

                mediaRecorder = new MediaRecorder(stream, {
                    mimeType: selectedMimeType,
                    videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality
                });

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    try {
                        const blob = new Blob(chunks, { type: selectedMimeType });
                        const blobUrl = URL.createObjectURL(blob);

                        // 停止所有轨道
                        stream.getTracks().forEach(track => track.stop());

                        notify('录制完成', '视频已录制完成！', 'success');
                        resolve(blobUrl);
                    } catch (error) {
                        reject(error);
                    }
                };

                mediaRecorder.onerror = (e) => {
                    reject(new Error('录制过程中出错: ' + e.error));
                };

                // 开始录制
                mediaRecorder.start(1000); // 每秒收集一次数据

                // 确保视频正在播放
                const wasPlaying = !videoElement.paused;
                if (!wasPlaying) {
                    videoElement.play().catch(e => {
                        console.warn('无法播放视频:', e);
                    });
                }

                // 等待视频播放结束或设置超时
                const recordingTimeout = 300000; // 5分钟超时
                const timeoutId = setTimeout(() => {
                    if (mediaRecorder.state !== 'inactive') {
                        mediaRecorder.stop();
                    }
                }, recordingTimeout);

                videoElement.onended = () => {
                    clearTimeout(timeoutId);
                    if (mediaRecorder.state !== 'inactive') {
                        mediaRecorder.stop();
                    }
                };

                // 如果视频已经结束了，立即停止
                if (videoElement.ended) {
                    // 重新播放以录制
                    videoElement.currentTime = 0;
                    videoElement.play().then(() => {
                        // 等待播放完成
                    }).catch(e => {
                        reject(new Error('无法播放视频进行录制: ' + error.message));
                    });
                }

            } catch (error) {
                reject(new Error('录制失败: ' + error.message));
            }
        });
    }

    // 从 blob URL 直接下载
    async function downloadFromBlobUrl(blobUrl) {
        try {
            const response = await fetch(blobUrl);
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (error) {
            throw new Error('无法从 blob URL 下载: ' + error.message);
        }
    }

    // 使用 Canvas 捕获图片
    async function captureImageWithCanvas(imgElement) {
        return new Promise((resolve, reject) => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = imgElement.naturalWidth || imgElement.width;
                canvas.height = imgElement.naturalHeight || imgElement.height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgElement, 0, 0);

                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(URL.createObjectURL(blob));
                    } else {
                        reject(new Error('Canvas 转换失败'));
                    }
                }, 'image/png', 1.0);
            } catch (error) {
                reject(error);
            }
        });
    }

    // 使用 Canvas 捕获视频当前帧
    async function captureVideoFrame(videoElement) {
        return new Promise(async (resolve, reject) => {
            try {
                // 检查视频是否有尺寸
                if (!videoElement.videoWidth || !videoElement.videoHeight) {
                    // 等待视频加载元数据
                    if (videoElement.readyState < 2) { // HAVE_METADATA
                        await new Promise((res, rej) => {
                            const timeout = setTimeout(() => rej(new Error('视频元数据加载超时（可能不支持此视频格式）')), 5000); // 改为5秒
                            videoElement.addEventListener('loadedmetadata', () => {
                                clearTimeout(timeout);
                                res();
                            }, { once: true });

                            // 检查是否有错误
                            videoElement.addEventListener('error', () => {
                                clearTimeout(timeout);
                                rej(new Error('视频加载失败（不支持的格式）'));
                            }, { once: true });

                            // 如果视频暂停，尝试播放一帧
                            if (videoElement.paused) {
                                videoElement.play().catch(() => {});
                            }
                        });
                    }
                }

                // 再次检查尺寸
                const width = videoElement.videoWidth || videoElement.clientWidth || 640;
                const height = videoElement.videoHeight || videoElement.clientHeight || 480;

                if (width === 0 || height === 0) {
                    throw new Error('无法获取视频尺寸');
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');

                // 尝试绘制视频帧
                try {
                    ctx.drawImage(videoElement, 0, 0, width, height);
                } catch (drawError) {
                    console.error('绘制视频帧失败:', drawError);
                    throw new Error('无法绘制视频帧');
                }

                // 检查画布是否为空
                const imageData = ctx.getImageData(0, 0, width, height);
                const isEmpty = imageData.data.every(v => v === 0);
                if (isEmpty) {
                    throw new Error('视频画面为空，请等待视频加载');
                }

                canvas.toBlob((blob) => {
                    if (blob && blob.size > 0) {
                        resolve(URL.createObjectURL(blob));
                    } else {
                        reject(new Error('视频帧转换失败'));
                    }
                }, 'image/png', 1.0);
            } catch (error) {
                console.error('视频捕获错误:', error);
                reject(error);
            }
        });
    }

    // 备用下载方法（使用 fetch + blob）
    async function fallbackDownload(url, filename, mediaType, sourceElement = null) {
        try {
            let blobUrl;

            // 检查是否是 Telegram 内部 URL
            if (isTelegramInternalUrl(url)) {
                // 对于图片，使用 Canvas 捕获
                if (mediaType === 'image' && sourceElement && sourceElement.tagName === 'IMG') {
                    notify('检测到受限内容', '正在使用高级捕获技术...', 'info');

                    // 等待图片完全加载
                    if (!sourceElement.complete) {
                        await new Promise((resolve, reject) => {
                            sourceElement.onload = resolve;
                            sourceElement.onerror = () => reject(new Error('图片加载失败'));
                            setTimeout(() => reject(new Error('图片加载超时')), 10000);
                        });
                    }

                    blobUrl = await captureImageWithCanvas(sourceElement);
                }
                // 对于视频，使用分块下载
                else if (mediaType === 'video') {
                    notify('检测到受限视频', '正在使用分块下载技术...', 'info');

                    try {
                        // 使用分块下载（Range 请求）
                        await downloadVideoInChunks(url, filename);
                        return; // 分块下载函数内部会处理保存
                    } catch (rangeError) {
                        console.error('[下载策略] 分块下载失败:', rangeError.message);

                        // 尝试不同的回退策略
                        let downloadSuccess = false;

                        // 策略1: 尝试普通fetch下载（不使用Range）
                        if (!downloadSuccess) {
                            try {
                                console.log('[下载策略] 尝试普通fetch下载...');
                                notify('尝试替代方法', '正在使用普通下载...', 'info');

                                const response = await fetch(url, {
                                    method: 'GET',
                                    credentials: 'include'
                                });

                                if (response.ok) {
                                    const blob = await response.blob();
                                    blobUrl = URL.createObjectURL(blob);
                                    downloadSuccess = true;
                                    console.log('[下载策略] 普通下载成功');
                                }
                            } catch (fetchError) {
                                console.error('[下载策略] 普通下载失败:', fetchError.message);
                            }
                        }

                        // 策略2: 如果有视频元素，尝试从blob URL下载
                        if (!downloadSuccess && sourceElement && sourceElement.tagName === 'VIDEO') {
                            const videoUrl = sourceElement.src || sourceElement.currentSrc;

                            if (videoUrl && videoUrl.startsWith('blob:')) {
                                try {
                                    console.log('[下载策略] 尝试从blob URL下载...');
                                    notify('尝试替代方法', '正在从缓存获取视频...', 'info');
                                    blobUrl = await downloadFromBlobUrl(videoUrl);
                                    downloadSuccess = true;
                                    console.log('[下载策略] Blob URL下载成功');
                                } catch (blobError) {
                                    console.error('[下载策略] Blob URL下载失败:', blobError.message);
                                }
                            }
                        }

                        // 策略3: 最后尝试录制
                        if (!downloadSuccess && sourceElement && sourceElement.tagName === 'VIDEO') {
                            try {
                                console.log('[下载策略] 尝试录制视频流...');
                                notify('切换到录制模式', '正在录制视频流...', 'info');
                                blobUrl = await captureVideoWithRecorder(sourceElement);
                                filename = filename.replace(/\.(mp4|mov|avi)$/, '.webm');
                                downloadSuccess = true;
                                console.log('[下载策略] 视频录制成功');
                            } catch (recordError) {
                                console.error('[下载策略] 视频录制失败:', recordError.message);
                            }
                        }

                        // 如果所有方法都失败了
                        if (!downloadSuccess) {
                            throw new Error('❌ 视频下载失败\n\n原始错误: ' + rangeError.message + '\n\n✅ 建议：\n1️⃣ 刷新页面后重试\n2️⃣ 使用 Telegram Desktop 下载\n3️⃣ 查看页面上的【查看下载方法】按钮');
                        }
                    }
                }
                else {
                    throw new Error('无法处理此类型的受限内容');
                }
            }
            // 处理 data: URL（如 canvas 转换的图片）
            else if (url.startsWith('data:')) {
                blobUrl = url;
            }
            // 处理 blob: URL
            else if (url.startsWith('blob:')) {
                blobUrl = url;
            }
            // 处理普通 HTTP(S) URL
            else {
                // 对于视频，优先使用分块下载
                if (mediaType === 'video') {
                    try {
                        await downloadVideoInChunks(url, filename);
                        return; // 分块下载函数内部会处理保存
                    } catch (rangeError) {
                        // 分块下载失败，回退到普通下载
                        console.warn('分块下载失败，使用普通下载:', rangeError);
                        notify('下载中', `正在获取视频...`, 'info');
                    }
                }

                // 普通下载（图片或视频回退）
                notify('下载中', `正在获取${mediaType === 'video' ? '视频' : '图片'}...`, 'info');

                const response = await fetch(url, {
                    mode: 'cors',
                    credentials: 'include',
                    headers: {
                        'Accept': mediaType === 'video' ? 'video/*' : 'image/*'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const blob = await response.blob();
                blobUrl = URL.createObjectURL(blob);
            }

            // 创建下载链接
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            // 清理
            setTimeout(() => {
                document.body.removeChild(a);
                // 只清理我们创建的 blob URL
                if (!url.startsWith('data:') && !url.startsWith('blob:')) {
                    URL.revokeObjectURL(blobUrl);
                }
            }, 100);

            notify('下载完成', `${mediaType === 'video' ? '视频' : '图片'}已保存！`, 'success');
        } catch (error) {
            console.error('备用下载错误:', error);
            throw new Error(`备用下载失败: ${error.message}`);
        }
    }

    // 下载媒体文件
    async function downloadMedia(url, mediaType, sourceElement = null) {
        const timestamp = new Date().getTime();
        const extension = mediaType === 'video' ? 'mp4' : 'jpg';
        const baseFilename = `telegram_${mediaType}_${timestamp}.${extension}`;
        const filename = `${CONFIG.downloadPath}/${baseFilename}`;

        notify('开始下载', `正在下载${mediaType === 'video' ? '视频' : '图片'}...`, 'info');

        // 如果是 Telegram 内部 URL，直接使用备用方案（Canvas 捕获）
        if (isTelegramInternalUrl(url)) {
            return fallbackDownload(url, baseFilename, mediaType, sourceElement);
        }

        // 优先使用 GM_download
        return new Promise((resolve, reject) => {
            // 检查是否支持 GM_download
            if (typeof GM_download === 'undefined') {
                // 如果不支持，直接使用备用方案
                fallbackDownload(url, baseFilename, mediaType, sourceElement)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            GM_download({
                url: url,
                name: filename,
                saveAs: true,
                onload: () => {
                    notify('下载完成', `${mediaType === 'video' ? '视频' : '图片'}已保存！`, 'success');
                    resolve();
                },
                onerror: (error) => {
                    console.warn('GM_download 失败，尝试备用方案:', error);
                    // GM_download 失败时使用备用方案
                    fallbackDownload(url, baseFilename, mediaType, sourceElement)
                        .then(resolve)
                        .catch(err => reject(new Error(`下载失败: ${err.message}`)));
                },
                ontimeout: () => {
                    console.warn('GM_download 超时，尝试备用方案');
                    // 超时时使用备用方案
                    fallbackDownload(url, baseFilename, mediaType, sourceElement)
                        .then(resolve)
                        .catch(err => reject(new Error(`下载超时: ${err.message}`)));
                }
            });
        });
    }

    // 获取最佳质量的媒体 URL
    function getBestQualityUrl(element, mediaType) {
        if (mediaType === 'video') {
            // 尝试获取视频源
            const source = element.querySelector('source');
            if (source && source.src) return source.src;
            if (element.src) return element.src;

            // 尝试从属性获取
            const dataSrc = element.getAttribute('data-src') || element.getAttribute('data-video');
            if (dataSrc) return dataSrc;
        } else {
            // 图片处理 - 也接受 blob URL（移除了 blob 过滤）
            if (element.src) return element.src;

            // 尝试获取高清图片
            const srcset = element.srcset;
            if (srcset) {
                const sources = srcset.split(',').map(s => s.trim().split(' '));
                const sorted = sources.sort((a, b) => {
                    const sizeA = parseInt(a[1]) || 0;
                    const sizeB = parseInt(b[1]) || 0;
                    return sizeB - sizeA;
                });
                if (sorted.length > 0) return sorted[0][0];
            }

            // 尝试从背景图获取
            const bgImage = window.getComputedStyle(element).backgroundImage;
            if (bgImage && bgImage !== 'none') {
                const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (match) return match[1];
            }

            // 尝试从 data 属性获取
            const dataSrc = element.getAttribute('data-src') ||
                          element.getAttribute('data-image') ||
                          element.getAttribute('data-full') ||
                          element.getAttribute('data-original');
            if (dataSrc) return dataSrc;
        }

        return null;
    }

    // 处理媒体元素
    function processMediaElement(element, mediaType) {
        // 检查是否已处理
        if (element.hasAttribute('data-tg-downloader-processed')) return;
        element.setAttribute('data-tg-downloader-processed', 'true');

        // 排除聊天列表和侧边栏中的图片（如头像）
        if (isInChatListOrSidebar(element)) {
            return;
        }

        // 查找合适的父容器
        let container = element.closest('.media-viewer-content') ||
                       element.closest('.media-viewer') ||
                       element.closest('.message-media') ||
                       element.closest('[class*="Media"]') ||
                       element.parentElement;

        if (!container) container = element;

        // 检查是否是真正的媒体内容（而非头像等）
        if (!isActualMediaContent(element, container)) {
            // 不是媒体查看器或消息媒体，可能是头像或其他UI元素
            return;
        }

        // 排除头像本身
        if (hasAvatarOrImportantElement(element.parentElement) &&
            element.parentElement.querySelector('.avatar, [class*="Avatar"]') === element) {
            return;
        }

        const url = getBestQualityUrl(element, mediaType);
        if (!url) return;

        // 确保容器有相对定位
        if (window.getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        // 创建并添加下载按钮（传递容器以便智能定位）
        const button = createDownloadButton(element, url, mediaType, container);
        container.appendChild(button);
    }

    // 检测不可播放的视频消息
    function detectUnplayableVideo() {
        // 查找 Telegram 的"无法播放"提示
        const messageSelectors = [
            '[class*="not-supported"]',
            '[class*="unsupported"]',
            'div[class*="MessageMedia"]',
            '.message-content',
            '.media-inner'
        ];

        for (const selector of messageSelectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const text = el.textContent || '';
                // 检测中英文的"无法播放"消息
                if (text.includes("can't be played") ||
                    text.includes("desktop app") ||
                    text.includes("无法播放") ||
                    text.includes("桌面应用")) {

                    // 找到对应的媒体容器
                    const mediaContainer = el.closest('.message') || el.closest('[class*="Message"]');
                    if (mediaContainer && !mediaContainer.hasAttribute('data-tg-unplayable-processed')) {
                        mediaContainer.setAttribute('data-tg-unplayable-processed', 'true');
                        addUnplayableVideoHelp(mediaContainer);
                    }
                }
            });
        }
    }

    // 为不可播放的视频添加帮助按钮
    function addUnplayableVideoHelp(container) {
        // 创建帮助按钮
        const helpButton = document.createElement('button');
        helpButton.className = 'tg-download-btn tg-unplayable-help';
        helpButton.style.cssText = `
            position: relative !important;
            margin: 10px auto;
            display: flex !important;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        `;
        helpButton.innerHTML = `
            <svg class="tg-download-btn-icon" viewBox="0 0 24 24">
                <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
            </svg>
            <span>查看下载方法</span>
        `;

        helpButton.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            showUnplayableVideoGuide();
        });

        // 插入到消息容器中
        const messageContent = container.querySelector('.message-content') ||
                              container.querySelector('[class*="content"]') ||
                              container;
        messageContent.appendChild(helpButton);
    }

    // 显示不可播放视频的下载指南
    function showUnplayableVideoGuide() {
        const overlay = document.createElement('div');
        overlay.className = 'tg-settings-overlay';

        const panel = document.createElement('div');
        panel.className = 'tg-settings-panel';
        panel.style.maxWidth = '600px';

        panel.innerHTML = `
            <div class="tg-settings-title">📹 视频无法播放 - 解决方案</div>

            <div style="margin-bottom: 20px; color: #666; line-height: 1.6;">
                <p>此视频只能在 Telegram 桌面应用中播放。以下是几种下载方法：</p>
            </div>

            <div style="margin-bottom: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px; border-left: 4px solid #667eea;">
                <h4 style="margin: 0 0 8px 0; color: #333;">✅ 方法一：使用 Telegram Desktop（推荐）</h4>
                <ol style="margin: 8px 0; padding-left: 20px; color: #666;">
                    <li>下载并安装 <a href="https://desktop.telegram.org/" target="_blank" style="color: #667eea;">Telegram Desktop</a></li>
                    <li>打开同一条消息</li>
                    <li>右键视频 → 另存为</li>
                    <li>选择保存位置并下载</li>
                </ol>
            </div>

            <div style="margin-bottom: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px; border-left: 4px solid #764ba2;">
                <h4 style="margin: 0 0 8px 0; color: #333;">📱 方法二：使用手机 Telegram</h4>
                <ol style="margin: 8px 0; padding-left: 20px; color: #666;">
                    <li>在手机 Telegram 中打开该消息</li>
                    <li>点击视频播放</li>
                    <li>点击下载图标保存到相册</li>
                    <li>通过数据线或云端传输到电脑</li>
                </ol>
            </div>

            <div style="margin-bottom: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px; border-left: 4px solid #f5576c;">
                <h4 style="margin: 0 0 8px 0; color: #333;">🔧 方法三：使用第三方工具</h4>
                <ol style="margin: 8px 0; padding-left: 20px; color: #666;">
                    <li>复制消息链接</li>
                    <li>使用 Telegram 下载工具（如 @SaveVideoBot）</li>
                    <li>将链接发送给机器人</li>
                    <li>机器人会返回下载链接</li>
                </ol>
            </div>

            <div style="margin-bottom: 16px; padding: 16px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                <h4 style="margin: 0 0 8px 0; color: #856404;">⚠️ 为什么 Web 版无法播放？</h4>
                <p style="margin: 8px 0; color: #856404; font-size: 14px;">
                    某些视频使用了特殊编码格式（如 H.265/HEVC），浏览器可能不支持。
                    Telegram Desktop 使用系统解码器，支持更多格式。
                </p>
            </div>

            <div class="tg-settings-buttons">
                <a href="https://desktop.telegram.org/" target="_blank"
                   class="tg-settings-btn tg-settings-btn-save"
                   style="text-decoration: none; text-align: center;">
                    下载 Telegram Desktop
                </a>
                <button class="tg-settings-btn tg-settings-btn-cancel">关闭</button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(panel);

        // 关闭按钮
        panel.querySelector('.tg-settings-btn-cancel').addEventListener('click', () => {
            overlay.remove();
            panel.remove();
        });

        // 点击遮罩关闭
        overlay.addEventListener('click', () => {
            overlay.remove();
            panel.remove();
        });
    }

    // 扫描页面中的媒体
    function scanForMedia() {
        // 检测不可播放的视频
        detectUnplayableVideo();

        // 扫描图片
        const images = document.querySelectorAll('img:not([data-tg-downloader-processed])');
        images.forEach(img => {
            // 过滤掉太小的图片（可能是图标）
            if (img.naturalWidth > 100 && img.naturalHeight > 100) {
                processMediaElement(img, 'image');
            }
        });

        // 扫描视频
        const videos = document.querySelectorAll('video:not([data-tg-downloader-processed])');
        videos.forEach(video => {
            processMediaElement(video, 'video');
        });

        // 扫描 canvas（某些受限内容可能使用 canvas）
        const canvases = document.querySelectorAll('canvas:not([data-tg-downloader-processed])');
        canvases.forEach(canvas => {
            if (canvas.width > 100 && canvas.height > 100) {
                // Canvas 需要转换为图片 URL
                try {
                    const dataUrl = canvas.toDataURL('image/png');
                    canvas.setAttribute('data-tg-downloader-processed', 'true');

                    let container = canvas.closest('.media-viewer-content') || canvas.parentElement;
                    if (window.getComputedStyle(container).position === 'static') {
                        container.style.position = 'relative';
                    }

                    const button = createDownloadButton(canvas, dataUrl, 'image', container);
                    container.appendChild(button);
                } catch (e) {
                    console.error('Canvas 处理失败:', e);
                }
            }
        });
    }

    // 拦截受限内容的下载保护
    function bypassRestrictions() {
        // 移除右键菜单限制
        document.addEventListener('contextmenu', (e) => {
            e.stopPropagation();
        }, true);

        // 移除选择限制
        document.addEventListener('selectstart', (e) => {
            e.stopPropagation();
        }, true);

        // 移除复制限制
        document.addEventListener('copy', (e) => {
            e.stopPropagation();
        }, true);

        // 移除拖拽限制
        document.addEventListener('dragstart', (e) => {
            e.stopPropagation();
        }, true);
    }

    // 监听 DOM 变化
    function observeDOM() {
        const observer = new MutationObserver((mutations) => {
            let shouldScan = false;

            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        if (node.tagName === 'IMG' || node.tagName === 'VIDEO' || node.tagName === 'CANVAS') {
                            shouldScan = true;
                        } else if (node.querySelector &&
                                 (node.querySelector('img') || node.querySelector('video') || node.querySelector('canvas'))) {
                            shouldScan = true;
                        }
                    }
                });
            });

            if (shouldScan) {
                setTimeout(scanForMedia, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 添加水印
    function addWatermark() {
        const watermark = document.createElement('div');
        watermark.className = 'tg-watermark';
        watermark.textContent = 'Telegram 下载器 v1.5.1';
        document.body.appendChild(watermark);

        // 5秒后隐藏水印
        setTimeout(() => {
            watermark.style.opacity = '0';
            watermark.style.transition = 'opacity 0.5s';
            setTimeout(() => watermark.remove(), 500);
        }, 5000);
    }

    // 初始化
    function init() {
        // 等待页面加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        console.log('🚀 Telegram 媒体下载器已启动');

        // 添加样式
        addStyles();

        // 绕过限制
        bypassRestrictions();

        // 首次扫描
        setTimeout(scanForMedia, 1000);

        // 监听 DOM 变化
        observeDOM();

        // 定期扫描
        setInterval(scanForMedia, 3000);

        // 添加水印
        addWatermark();

        // 注册菜单命令
        GM_registerMenuCommand('⚙️ 打开设置', showSettings);
        GM_registerMenuCommand('🔄 重新扫描媒体', scanForMedia);

        notify('下载器已就绪', 'Telegram 媒体下载器已成功加载！', 'success');
    }

    // 启动脚本
    init();
})();
