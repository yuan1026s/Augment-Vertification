const CodeExtractor = require('./lib/codeExtractor');

// 创建验证码提取器实例
const extractor = new CodeExtractor();

// 测试邮件数据
const testEmails = [
    {
        from: 'noreply@example.com',
        subject: '验证码',
        text: '您的验证码是：123456，发送给 lvguaxhip@yglzr.cloud',
        html: '<p>您的验证码是：<strong>123456</strong>，发送给 lvguaxhip@yglzr.cloud</p>',
        date: new Date()
    },
    {
        from: 'service@test.com',
        subject: 'Verification Code',
        text: 'Your verification code is: 789012 for account lvguaxhip@yglzr.cloud',
        html: '<p>Your verification code is: <strong>789012</strong> for account lvguaxhip@yglzr.cloud</p>',
        date: new Date()
    },
    {
        from: 'support@company.com',
        subject: '账户验证',
        text: '尊敬的用户 lvguaxhip@yglzr.cloud，您的验证码：456789',
        html: '<p>尊敬的用户 <strong>lvguaxhip@yglzr.cloud</strong>，您的验证码：<strong>456789</strong></p>',
        date: new Date()
    },
    {
        from: 'notification@service.com',
        subject: 'Email Verification',
        text: 'Hello! Your verification code 654321 has been sent to lvguaxhip@yglzr.cloud. Please use this code to verify your account.',
        html: '<div><p>Hello!</p><p>Your verification code <strong>654321</strong> has been sent to <strong>lvguaxhip@yglzr.cloud</strong>.</p><p>Please use this code to verify your account.</p></div>',
        date: new Date()
    }
];

console.log('测试收件人提取功能...\n');

testEmails.forEach((email, index) => {
    console.log(`=== 测试邮件 ${index + 1} ===`);
    console.log('发件人:', email.from);
    console.log('主题:', email.subject);
    console.log('内容:', email.text.substring(0, 100) + '...');
    
    const result = extractor.extractCode(email);
    
    if (result) {
        console.log('✅ 提取结果:');
        console.log('  验证码:', result.codes);
        console.log('  收件人:', result.recipient);
        console.log('  发件人:', result.from);
    } else {
        console.log('❌ 未提取到验证码');
    }
    
    console.log('');
});

console.log('测试完成！');
