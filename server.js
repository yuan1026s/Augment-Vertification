const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const ImapClient = require('./lib/imapClient');
const CodeExtractor = require('./lib/codeExtractor');
const config = require('./config/default.json');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 初始化服务
const codeExtractor = new CodeExtractor();
const imapClient = new ImapClient(config.imap);

// Socket.IO连接处理
io.on('connection', (socket) => {
    console.log('客户端连接:', socket.id);

    socket.on('disconnect', () => {
        console.log('客户端断开连接:', socket.id);
    });
});

// IMAP事件监听
imapClient.on('newEmail', (emailData) => {
    console.log('收到新邮件:', emailData.subject);

    // 提取验证码，使用配置的邮箱作为默认收件人
    const defaultRecipient = config.imap.user;
    const codeData = codeExtractor.extractCode(emailData, defaultRecipient);

    if (codeData) {
        // 实时推送给所有连接的客户端
        io.emit('newCode', codeData);
        console.log('推送新验证码:', codeData.codes);
    }
});

// API路由

// 获取所有验证码
app.get('/api/codes', (req, res) => {
    try {
        const allCodes = codeExtractor.getAllCodes();
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        // 只返回5分钟内的验证码
        const recentCodes = allCodes.filter(code =>
            new Date(code.timestamp) >= fiveMinutesAgo
        );

        res.json({
            success: true,
            data: recentCodes,
            total: recentCodes.length
        });
    } catch (error) {
        console.error('获取验证码失败:', error);
        res.status(500).json({
            success: false,
            message: '获取验证码失败',
            error: error.message
        });
    }
});

// 获取最新验证码
app.get('/api/codes/latest', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const codes = codeExtractor.getLatestCodes(limit);
        res.json({
            success: true,
            data: codes,
            total: codes.length
        });
    } catch (error) {
        console.error('获取最新验证码失败:', error);
        res.status(500).json({
            success: false,
            message: '获取最新验证码失败',
            error: error.message
        });
    }
});

// 根据收件人搜索验证码
app.get('/api/codes/search/recipient', (req, res) => {
    try {
        const { recipient } = req.query;

        if (!recipient) {
            return res.status(400).json({
                success: false,
                message: '请提供收件人信息'
            });
        }

        const allCodes = codeExtractor.searchByRecipient(recipient);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        // 只返回5分钟内的验证码
        const recentCodes = allCodes.filter(code =>
            new Date(code.timestamp) >= fiveMinutesAgo
        );

        res.json({
            success: true,
            data: recentCodes,
            total: recentCodes.length,
            query: recipient
        });
    } catch (error) {
        console.error('搜索验证码失败:', error);
        res.status(500).json({
            success: false,
            message: '搜索验证码失败',
            error: error.message
        });
    }
});

// 根据发件人搜索验证码
app.get('/api/codes/search/sender', (req, res) => {
    try {
        const { sender } = req.query;

        if (!sender) {
            return res.status(400).json({
                success: false,
                message: '请提供发件人信息'
            });
        }

        const codes = codeExtractor.searchBySender(sender);
        res.json({
            success: true,
            data: codes,
            total: codes.length,
            query: sender
        });
    } catch (error) {
        console.error('搜索验证码失败:', error);
        res.status(500).json({
            success: false,
            message: '搜索验证码失败',
            error: error.message
        });
    }
});

// 根据关键词搜索验证码
app.get('/api/codes/search', (req, res) => {
    try {
        const { keyword } = req.query;

        if (!keyword) {
            return res.status(400).json({
                success: false,
                message: '请提供搜索关键词'
            });
        }

        const codes = codeExtractor.searchByKeyword(keyword);
        res.json({
            success: true,
            data: codes,
            total: codes.length,
            query: keyword
        });
    } catch (error) {
        console.error('搜索验证码失败:', error);
        res.status(500).json({
            success: false,
            message: '搜索验证码失败',
            error: error.message
        });
    }
});

// 获取统计信息
app.get('/api/stats', (req, res) => {
    try {
        const stats = codeExtractor.getStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('获取统计信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取统计信息失败',
            error: error.message
        });
    }
});



// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'running',
        imap: {
            connected: imapClient.isConnected,
            reconnectAttempts: imapClient.reconnectAttempts
        },
        timestamp: new Date().toISOString()
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? err.message : '服务器错误'
    });
});

// 健康检查接口
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '接口不存在'
    });
});

// 启动服务器
const PORT = process.env.SERVER_PORT || config.server.port || 3000;
const HOST = process.env.SERVER_HOST || config.server.host || '0.0.0.0';

server.listen(PORT, HOST, async () => {
    console.log(`服务器运行在 http://${HOST}:${PORT}`);

    // 连接IMAP
    try {
        await imapClient.connect();
        console.log('IMAP客户端连接成功');

        // 不再自动获取历史邮件，只监听新邮件
        console.log('IMAP客户端已准备好接收新邮件');

    } catch (error) {
        console.error('IMAP连接失败:', error);
        console.log('服务器将继续运行，但无法接收新邮件');
    }
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('正在关闭服务器...');
    imapClient.disconnect();
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('正在关闭服务器...');
    imapClient.disconnect();
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});
