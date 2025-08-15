const ImapClient = require('./lib/imapClient');
const CodeExtractor = require('./lib/codeExtractor');
const config = require('./config/default.json');

async function debugEmailContent() {
    const imapClient = new ImapClient(config.imap);
    const codeExtractor = new CodeExtractor();

    try {
        console.log('连接IMAP...');
        await imapClient.connect();
        console.log('IMAP连接成功');

        // 等待一下确保邮箱已打开
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('获取最近的邮件...');
        const emails = await imapClient.getRecentEmails(1);
        console.log(`获取到 ${emails.length} 封邮件`);

        if (emails.length > 0) {
            console.log('\n=== 分析第一封邮件 ===');
            const email = emails[0];
            console.log('发件人:', email.from);
            console.log('主题:', email.subject);
            console.log('日期:', email.date);
            console.log('文本内容长度:', email.text ? email.text.length : 0);
            console.log('HTML内容长度:', email.html ? email.html.length : 0);

            if (email.text) {
                console.log('\n--- 文本内容 ---');
                console.log(email.text);
            }

            if (email.html) {
                console.log('\n--- HTML内容 ---');
                console.log(email.html);
            }

            console.log('\n=== 提取验证码 ===');
            const result = codeExtractor.extractCode(email);

            if (result) {
                console.log('提取结果:', result);
            } else {
                console.log('未提取到验证码');
            }
        }

    } catch (error) {
        console.error('错误:', error);
    } finally {
        imapClient.disconnect();
        process.exit(0);
    }
}

debugEmailContent();
