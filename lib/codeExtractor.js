const moment = require('moment');

class CodeExtractor {
    constructor() {
        // 验证码存储
        this.codes = new Map();

        // 验证码正则表达式模式 - 更精确的匹配
        this.patterns = [
            // 明确的验证码格式：Your verification code is: 123456
            /(?:verification code is[：:\s]*|verification code[：:\s]*is[：:\s]*)([0-9]{4,8})/gi,
            /(?:验证码[：:\s]*是[：:\s]*|验证码[：:\s]*)([0-9]{4,8})/gi,

            // 6位数字验证码
            /(?:验证码|verification code|code)[：:\s]*([0-9]{6})/gi,
            /([0-9]{6})(?:\s*(?:是|为|就是)?(?:您的|你的|your)?(?:验证码|verification code))/gi,

            // 4位数字验证码
            /(?:验证码|verification code|code)[：:\s]*([0-9]{4})/gi,
            /([0-9]{4})(?:\s*(?:是|为|就是)?(?:您的|你的|your)?(?:验证码|verification code))/gi,

            // 5位数字验证码
            /(?:验证码|verification code|code)[：:\s]*([0-9]{5})/gi,
            /([0-9]{5})(?:\s*(?:是|为|就是)?(?:您的|你的|your)?(?:验证码|verification code))/gi,

            // 8位数字验证码
            /(?:验证码|verification code|code)[：:\s]*([0-9]{8})/gi,
            /([0-9]{8})(?:\s*(?:是|为|就是)?(?:您的|你的|your)?(?:验证码|verification code))/gi
        ];

        // 启动定期清理
        this.startCleanup();
    }

    // 从邮件中提取验证码
    extractCode(emailData, defaultRecipient = null) {
        const { from, subject, text, html, date, recipient: emailRecipient } = emailData;

        // 优先使用邮件头部的收件人信息
        let recipient = emailRecipient;

        // 如果邮件头部没有收件人，从邮件内容中查找
        if (!recipient) {
            recipient = this.extractRecipient(text, html);
        }

        // 如果还是没有找到收件人，使用默认收件人
        if (!recipient && defaultRecipient) {
            recipient = defaultRecipient;
            console.log('使用默认收件人:', recipient);
        } else if (recipient) {
            console.log('使用邮件收件人:', recipient);
        }

        // 合并文本内容进行搜索
        const content = `${subject} ${text} ${this.htmlToText(html)}`;

        const codes = [];

        // 使用所有模式匹配验证码
        for (const pattern of this.patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const code = match[1];
                if (this.isValidCode(code)) {
                    codes.push(code);
                }
            }
        }

        // 去重并保存验证码
        const uniqueCodes = [...new Set(codes)];

        if (uniqueCodes.length > 0) {
            // 检查是否已存在相同的验证码
            const isDuplicate = this.isDuplicateCode(uniqueCodes, from, recipient, subject);

            if (isDuplicate) {
                console.log('跳过重复验证码:', {
                    codes: uniqueCodes,
                    from: from,
                    recipient: recipient,
                    subject: subject
                });
                return null; // 返回null表示跳过重复验证码
            }

            const codeData = {
                codes: uniqueCodes,
                from: from,
                recipient: recipient,
                subject: subject,
                content: content.substring(0, 200), // 保存前200字符作为预览
                timestamp: date || new Date(),
                id: this.generateId()
            };

            // 保存到内存
            this.codes.set(codeData.id, codeData);

            console.log('提取到验证码:', {
                codes: uniqueCodes,
                from: from,
                recipient: recipient,
                subject: subject
            });

            return codeData;
        }

        return null;
    }

    // 从邮件内容中提取收件人信息
    extractRecipient(text, html) {
        const content = `${text} ${this.htmlToText(html)}`;

        // 调试输出（可选）
        // console.log('=== 收件人提取调试 ===');
        // console.log('邮件文本内容:', text ? text.substring(0, 200) + '...' : '无');
        // console.log('邮件HTML内容:', html ? this.htmlToText(html).substring(0, 200) + '...' : '无');
        // console.log('合并内容:', content.substring(0, 300) + '...');

        // 更精确的收件人提取模式，优先匹配@yglzr.cloud域名
        const recipientPatterns = [
            // 优先匹配@yglzr.cloud域名
            /([a-zA-Z0-9._%+-]+@yglzr\.cloud)/gi,

            // 常见的收件人提取模式
            /(?:发送(?:给|至|到)|sent to|to|for)[：:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
            /(?:邮箱|email|address)[：:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
            /(?:账户|account)[：:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,

            // 在邮件内容中查找所有邮箱地址
            /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,

            // 手机号模式
            /(?:发送(?:给|至|到)|sent to|to)[：:\s]*(1[3-9]\d{9})/gi,
            /手机号[：:\s]*(1[3-9]\d{9})/gi,

            // 用户名模式（不包含@符号的）
            /(?:用户|账户|账号|user)[：:\s]*([a-zA-Z0-9._%+-]+)(?!@)/gi
        ];

        const foundEmails = [];

        for (const pattern of recipientPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (match[1]) {
                    const email = match[1].trim();
                    // 排除发件人邮箱
                    if (!email.includes('noreply') &&
                        !email.includes('support@') &&
                        !email.includes('no-reply') &&
                        !email.includes('donotreply') &&
                        !email.includes('augmentcode.com')) {
                        foundEmails.push(email);
                    }
                }
            }
        }

        // 优先返回@yglzr.cloud域名的邮箱
        const yglzrEmail = foundEmails.find(email => email.includes('@yglzr.cloud'));
        if (yglzrEmail) {
            return yglzrEmail;
        }

        // 返回第一个找到的邮箱
        if (foundEmails.length > 0) {
            return foundEmails[0];
        }

        return null;
    }

    // HTML转文本
    htmlToText(html) {
        if (!html) return '';
        return html
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    // 验证码有效性检查
    isValidCode(code) {
        if (!code || typeof code !== 'string') return false;

        // 必须是纯数字
        if (!/^\d+$/.test(code)) return false;

        // 长度检查
        if (code.length < 4 || code.length > 8) return false;

        // 排除一些明显不是验证码的数字
        const invalidCodes = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999'];
        if (invalidCodes.includes(code)) return false;

        // 排除日期格式
        if (/^\d{4}$/.test(code) && parseInt(code) > 2020 && parseInt(code) < 2030) return false;

        // 排除明显的英文单词
        const invalidWords = ['your', 'with', 'code', 'logo', 'icon', 'generati', 'bases'];
        if (invalidWords.includes(code.toLowerCase())) return false;

        return true;
    }

    // 检查是否为重复验证码
    isDuplicateCode(codes, from, recipient, subject) {
        const existingCodes = Array.from(this.codes.values());

        // 检查是否存在相同的验证码组合
        for (const existingCode of existingCodes) {
            // 比较验证码、发件人、收件人和主题
            const sameFrom = existingCode.from === from;
            const sameRecipient = existingCode.recipient === recipient;
            const sameSubject = existingCode.subject === subject;

            // 检查是否有相同的验证码
            const hasSameCodes = codes.some(code =>
                existingCode.codes.includes(code)
            );

            // 如果发件人、收件人、主题都相同，且有相同的验证码，则认为是重复
            if (sameFrom && sameRecipient && sameSubject && hasSameCodes) {
                return true;
            }
        }

        return false;
    }

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 获取所有验证码
    getAllCodes() {
        const codes = Array.from(this.codes.values());
        return codes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    // 根据收件人搜索验证码
    searchByRecipient(recipient) {
        if (!recipient) return [];

        const codes = Array.from(this.codes.values());
        const filtered = codes.filter(codeData => {
            if (!codeData.recipient) return false;

            // 精确匹配
            if (codeData.recipient.toLowerCase() === recipient.toLowerCase()) {
                return true;
            }

            // 部分匹配（用于邮箱地址）
            if (codeData.recipient.toLowerCase().includes(recipient.toLowerCase()) ||
                recipient.toLowerCase().includes(codeData.recipient.toLowerCase())) {
                return true;
            }

            return false;
        });

        return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    // 根据发件人搜索验证码
    searchBySender(sender) {
        if (!sender) return [];

        const codes = Array.from(this.codes.values());
        const filtered = codes.filter(codeData => {
            return codeData.from && codeData.from.toLowerCase().includes(sender.toLowerCase());
        });

        return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    // 根据关键词搜索验证码
    searchByKeyword(keyword) {
        if (!keyword) return [];

        const codes = Array.from(this.codes.values());
        const filtered = codes.filter(codeData => {
            const searchText = `${codeData.subject} ${codeData.content} ${codeData.from}`.toLowerCase();
            return searchText.includes(keyword.toLowerCase());
        });

        return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    // 获取最新的验证码
    getLatestCodes(limit = 10) {
        const codes = this.getAllCodes();
        return codes.slice(0, limit);
    }

    // 清理过期验证码
    cleanup(maxAge = 5 * 60 * 1000) { // 默认5分钟
        const now = new Date();
        const toDelete = [];

        for (const [id, codeData] of this.codes.entries()) {
            const age = now - new Date(codeData.timestamp);
            if (age > maxAge) {
                toDelete.push(id);
            }
        }

        toDelete.forEach(id => this.codes.delete(id));

        if (toDelete.length > 0) {
            console.log(`清理了 ${toDelete.length} 个过期验证码`);
        }
    }

    // 启动定期清理
    startCleanup(interval = 5 * 60000) { // 默认5分钟清理一次
        setInterval(() => {
            this.cleanup();
        }, interval);
    }

    // 获取统计信息
    getStats() {
        const codes = Array.from(this.codes.values());
        const now = new Date();

        return {
            total: codes.length,
            last24h: codes.filter(c => (now - new Date(c.timestamp)) < 24 * 60 * 60 * 1000).length,
            lastHour: codes.filter(c => (now - new Date(c.timestamp)) < 60 * 60 * 1000).length,
            recipients: [...new Set(codes.map(c => c.recipient).filter(Boolean))].length,
            senders: [...new Set(codes.map(c => c.from).filter(Boolean))].length
        };
    }
}

module.exports = CodeExtractor;
