const CodeExtractor = require('./lib/codeExtractor');

// 创建验证码提取器实例
const extractor = new CodeExtractor();

// 模拟一些发送给 lvguaxhip@yglzr.cloud 的验证码邮件
const testEmails = [
    {
        from: 'noreply@github.com',
        subject: 'GitHub 验证码',
        text: '您的 GitHub 验证码是：123456，发送给 lvguaxhip@yglzr.cloud',
        html: '<p>您的 GitHub 验证码是：<strong>123456</strong>，发送给 lvguaxhip@yglzr.cloud</p>',
        date: new Date()
    },
    {
        from: 'service@discord.com',
        subject: 'Discord Verification',
        text: 'Your Discord verification code is: 789012 for account lvguaxhip@yglzr.cloud',
        html: '<p>Your Discord verification code is: <strong>789012</strong> for account lvguaxhip@yglzr.cloud</p>',
        date: new Date()
    },
    {
        from: 'support@steam.com',
        subject: 'Steam 账户验证',
        text: '尊敬的用户 lvguaxhip@yglzr.cloud，您的 Steam 验证码：456789',
        html: '<p>尊敬的用户 <strong>lvguaxhip@yglzr.cloud</strong>，您的 Steam 验证码：<strong>456789</strong></p>',
        date: new Date()
    },
    {
        from: 'notification@twitter.com',
        subject: 'Twitter Login Code',
        text: 'Hello! Your Twitter login code 654321 has been sent to lvguaxhip@yglzr.cloud. Please use this code to verify your account.',
        html: '<div><p>Hello!</p><p>Your Twitter login code <strong>654321</strong> has been sent to <strong>lvguaxhip@yglzr.cloud</strong>.</p><p>Please use this code to verify your account.</p></div>',
        date: new Date()
    }
];

console.log('添加测试验证码...\n');

testEmails.forEach((email, index) => {
    console.log(`添加测试邮件 ${index + 1}:`);
    console.log('发件人:', email.from);
    console.log('主题:', email.subject);
    
    const result = extractor.extractCode(email);
    
    if (result) {
        console.log('✅ 添加成功:');
        console.log('  验证码:', result.codes);
        console.log('  收件人:', result.recipient);
    } else {
        console.log('❌ 添加失败');
    }
    
    console.log('');
});

console.log('测试验证码添加完成！');
console.log('现在可以在网站上搜索 "lvguaxhip@yglzr.cloud" 来查看这些验证码。');
