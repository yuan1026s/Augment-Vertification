const Imap = require('imap');
const { simpleParser } = require('mailparser');
const EventEmitter = require('events');

class ImapClient extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.imap = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.imap = new Imap(this.config);

            this.imap.once('ready', () => {
                console.log('IMAP连接成功');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.openInbox();
                resolve();
            });

            this.imap.once('error', (err) => {
                console.error('IMAP连接错误:', err);
                this.isConnected = false;
                this.handleReconnect();
                reject(err);
            });

            this.imap.once('end', () => {
                console.log('IMAP连接结束');
                this.isConnected = false;
                this.handleReconnect();
            });

            this.imap.connect();
        });
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => {
                this.connect().catch(console.error);
            }, this.reconnectDelay);
        } else {
            console.error('达到最大重连次数，停止重连');
        }
    }

    openInbox() {
        this.imap.openBox('INBOX', false, (err, box) => {
            if (err) {
                console.error('打开收件箱失败:', err);
                return;
            }
            console.log('收件箱打开成功');
            this.listenForNewMails();
        });
    }

    listenForNewMails() {
        // 监听新邮件事件
        this.imap.on('mail', (numNewMsgs) => {
            console.log(`收到 ${numNewMsgs} 封新邮件`);
            this.fetchLatestEmails(numNewMsgs);
        });

        // 启用定期检查新邮件（更可靠的方式）
        console.log('启用定期邮件检查（每15秒检查一次）');
        this.pollInterval = setInterval(() => {
            this.checkForNewEmails();
        }, 15000); // 每15秒检查一次新邮件
    }

    // 定期检查新邮件（当不支持IDLE时使用）
    checkForNewEmails() {
        if (!this.isConnected) {
            return;
        }

        this.imap.search(['UNSEEN'], (err, results) => {
            if (err) {
                console.error('检查新邮件失败:', err);
                return;
            }

            if (results && results.length > 0) {
                console.log(`定期检查发现 ${results.length} 封新邮件`);
                this.fetchLatestEmails(results.length);
            }
        });
    }

    fetchLatestEmails(count = 5) {
        if (!this.isConnected) {
            console.log('IMAP未连接，无法获取邮件');
            return;
        }

        this.imap.search(['UNSEEN'], (err, results) => {
            if (err) {
                console.error('搜索邮件失败:', err);
                return;
            }

            if (!results || results.length === 0) {
                console.log('没有未读邮件');
                return;
            }

            // 获取最新的几封邮件
            const latestResults = results.slice(-count);
            const fetch = this.imap.fetch(latestResults, {
                bodies: ['HEADER', 'TEXT'],
                markSeen: true,
                struct: true
            });

            fetch.on('message', (msg, seqno) => {
                let buffer = '';
                let attrs = null;

                msg.on('body', (stream, info) => {
                    stream.on('data', (chunk) => {
                        buffer += chunk.toString('utf8');
                    });
                });

                msg.once('attributes', (attribs) => {
                    attrs = attribs;
                });

                msg.once('end', () => {
                    this.parseEmail(buffer, attrs);
                });
            });

            fetch.once('error', (err) => {
                console.error('获取邮件失败:', err);
            });
        });
    }

    async parseEmail(rawEmail, attrs = null) {
        try {
            const parsed = await simpleParser(rawEmail);

            // 提取收件人信息
            let recipient = null;
            if (parsed.to && parsed.to.value && parsed.to.value.length > 0) {
                // 从 To 字段获取收件人
                recipient = parsed.to.value[0].address;
            } else if (parsed.to && parsed.to.text) {
                // 备用方法：从 to.text 提取
                const emailMatch = parsed.to.text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                if (emailMatch) {
                    recipient = emailMatch[1];
                }
            }

            const emailData = {
                from: parsed.from?.text || '',
                subject: parsed.subject || '',
                text: parsed.text || '',
                html: parsed.html || '',
                date: parsed.date || new Date(),
                recipient: recipient  // 添加收件人信息
            };

            console.log('解析邮件:', {
                from: emailData.from,
                subject: emailData.subject,
                recipient: emailData.recipient,
                date: emailData.date
            });

            this.emit('newEmail', emailData);
        } catch (error) {
            console.error('解析邮件失败:', error);
        }
    }

    disconnect() {
        if (this.imap && this.isConnected) {
            this.isConnected = false;

            // 清理定时器
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
            }

            this.imap.end();
        }
    }

    // 手动获取最近的邮件
    getRecentEmails(days = 1) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                reject(new Error('IMAP未连接'));
                return;
            }

            // 获取最近的邮件，使用更简单的方法
            this.imap.search(['ALL'], (err, results) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!results || results.length === 0) {
                    resolve([]);
                    return;
                }

                // 只获取最近的10封邮件
                const recentResults = results.slice(-10);
                const emails = [];
                const fetch = this.imap.fetch(recentResults, { bodies: ['HEADER', 'TEXT'] });

                fetch.on('message', (msg, seqno) => {
                    let buffer = '';

                    msg.on('body', (stream, info) => {
                        stream.on('data', (chunk) => {
                            buffer += chunk.toString('utf8');
                        });
                    });

                    msg.once('end', async () => {
                        try {
                            const parsed = await simpleParser(buffer);

                            // 提取收件人信息
                            let recipient = null;
                            if (parsed.to && parsed.to.value && parsed.to.value.length > 0) {
                                recipient = parsed.to.value[0].address;
                            } else if (parsed.to && parsed.to.text) {
                                const emailMatch = parsed.to.text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                                if (emailMatch) {
                                    recipient = emailMatch[1];
                                }
                            }

                            emails.push({
                                from: parsed.from?.text || '',
                                subject: parsed.subject || '',
                                text: parsed.text || '',
                                html: parsed.html || '',
                                date: parsed.date || new Date(),
                                recipient: recipient
                            });
                        } catch (error) {
                            console.error('解析邮件失败:', error);
                        }
                    });
                });

                fetch.once('end', () => {
                    resolve(emails);
                });

                fetch.once('error', (err) => {
                    reject(err);
                });
            });
        });
    }
}

module.exports = ImapClient;
