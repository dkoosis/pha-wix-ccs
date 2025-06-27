# 🚀 Wix Webhook Test Suite - Quick Reference

## Essential URLs (Update with Your Domain)

```bash
# Check if test system is working
https://ccs.powerhousearts.org/_functions/testHealth

# Run all tests (admin only)
https://ccs.powerhousearts.org/_functions/runTests

# Run specific test (admin only)
https://ccs.powerhousearts.org/_functions/runTest?test=contactCreation
https://ccs.powerhousearts.org/_functions/runTest?test=memberCreation
https://ccs.powerhousearts.org/_functions/runTest?test=fullWebhookFlow

# Basic connectivity test
https://ccs.powerhousearts.org/_functions/hello
```

## Google Apps Script Commands

```javascript
// One-time setup
setupSecureConfig();  // Store API keys securely

// Test commands
runAllTests();              // Complete test suite
testWebhookExternal();      // Single webhook test
testErrorScenarios();       // All error cases
performanceTest();          // Benchmark performance
testHealthCheck();          // System health
```

## Common Tasks

### 🧪 Before Deploying Changes
```javascript
// In Google Apps Script
runAllTests();

// Or in browser (as admin)
https://yoursite.com/_functions/runTests
```

### 📊 Check Performance
```javascript
// Run performance test
performanceTest();

// Expected results:
// Average: < 2000ms
// Min: < 1000ms  
// Max: < 3000ms
```

### 🐛 Debug a Failed Test
1. Check Wix Logs: Dashboard → Settings → Site Monitoring → Logs
2. Look for `[TEST]` tags
3. Find the specific error message
4. Run individual test: `/_functions/runTest?test=failedTestName`

### 🧹 Clean Up Test Data
```javascript
// Automatic in test suite
// For manual cleanup, in Wix data manager:
// 1. Filter by email containing "test_"
// 2. Bulk delete test records
```

## Test Naming Convention

All test data uses these patterns:
- **Email**: `test_[timestamp]_[random]@example.com`
- **App ID**: `test_[timestamp]_[random]`
- **Names**: First: "Test" or "GAS Test", Last: "User"

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| 403 on test endpoints | Log in as Wix admin |
| Tests timeout | Check function timeout settings |
| Can't find test data | Check correct collection names |
| External test fails | Verify API key is correct |
| Performance degraded | Check Wix service status |

## Emergency Checklist

If webhook stops working:

1. ✓ Run health check: `/_functions/testHealth`
2. ✓ Verify API key hasn't changed
3. ✓ Check Fillout webhook settings
4. ✓ Run external test from GAS
5. ✓ Check Wix service status
6. ✓ Review recent code changes
7. ✓ Check collection permissions

## Key Files Location

```
src/
└── backend/
    ├── http-functions.js    # Main webhook + test endpoints
    ├── testing.jsw          # Test suite
    └── webhook.jsw          # (if separated from http-functions)
```

## Test Result Structure

```json
{
  "totalTests": 6,
  "passed": 5,
  "failed": 1,
  "errors": 0,
  "timestamp": "2025-01-20T10:30:00Z",
  "results": [
    {
      "testName": "Contact Creation",
      "status": "pass",
      "duration": 245,
      "message": "Successfully created contact xyz123"
    }
  ]
}
```

## Security Reminders

- 🔐 Never commit API keys
- 🔐 Test endpoints are admin-only
- 🔐 Use test emails only (never real user data)
- 🔐 Rotate API keys quarterly
- 🔐 Clean up test data regularly

---

**Remember**: A tested webhook is a reliable webhook! 🎯