const http = require('http');
const path = require('path');

function testUrl(url) {
  return new Promise((resolve) => {
    const options = {
      method: 'GET',
      hostname: 'localhost',
      port: 4321,
      path: encodeURI(url),
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          url,
          statusCode: res.statusCode,
          location: res.headers.location,
          success: res.statusCode < 400,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        url,
        statusCode: 'ERROR',
        error: err.message,
        success: false,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        url,
        statusCode: 'TIMEOUT',
        success: false,
      });
    });

    req.setTimeout(5000);
    req.end();
  });
}

async function testRedirects() {
  const fs = require('fs');
  const redirectsPath = path.join(__dirname, '../src/redirects.json');
  const redirects = JSON.parse(fs.readFileSync(redirectsPath, 'utf-8'));

  const entries = Object.entries(redirects).filter(([_, target]) => target !== null);

  console.log(`Testing ${entries.length} redirect URLs...\n`);

  const results = [];

  for (const [source, target] of entries) {
    if (source === target) {
      const targetResult = await testUrl(target);
      results.push({ url: target, type: 'same', ...targetResult });

      if (targetResult.success) {
        if (targetResult.statusCode === 200) {
          console.log(`✓ Direct: ${target} (status: ${targetResult.statusCode})`);
        } else {
          console.log(`⚠️  Unexpected: ${target} (status: ${targetResult.statusCode})`);
        }
      } else {
        console.log(`✗ Failed: ${target} (${targetResult.statusCode || targetResult.error})`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }

    const sourceResult = await testUrl(source);

    if (!sourceResult.success) {
      results.push({ url: source, target, type: 'source_failed', ...sourceResult });
      console.log(`✗ Source failed: ${source} -> ${target} (${sourceResult.statusCode || sourceResult.error})`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }

    const targetResult = await testUrl(target);

    results.push({ url: source, target, type: 'redirect', sourceResult, targetResult });

    if (sourceResult.statusCode === 301) {
      console.log(`✓ Redirected: ${source} -> ${target} (301)`, targetResult.success ? ` -> target accessible (200)` : ` -> target failed (${targetResult.statusCode})`);
    } else if (sourceResult.statusCode === 200) {
      console.log(`✓ Direct: ${source} (200)`);
    } else {
      console.log(`⚠️  Unexpected: ${source} (${sourceResult.statusCode})`);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log('\n=== Test Results ===');

  const success = results.filter((r) => r.sourceResult?.success);
  const failed = results.filter((r) => !r.sourceResult?.success || !r.targetResult?.success);

  console.log(`Total tested: ${results.length}`);
  console.log(`✓ Fully successful: ${results.filter((r) => r.type === 'same' || (r.sourceResult?.success && r.targetResult?.success)).length}`);
  console.log(`✓ Source OK, target failed: ${results.filter((r) => r.sourceResult?.success && !r.targetResult?.success).length}`);
  console.log(`✗ Source failed: ${results.filter((r) => !r.sourceResult?.success).length}`);

  const sourceFailed = results.filter((r) => r.type === 'source_failed');
  const targetFailed = results.filter((r) => r.type === 'redirect' && !r.targetResult?.success);

  if (sourceFailed.length > 0) {
    console.log(`\n❌ Source URLs failed: ${sourceFailed.length}`);
    if (sourceFailed.length <= 10) {
      sourceFailed.forEach((f) => {
        console.log(`  ${f.url}`);
      });
    } else {
      console.log(`  First 10 examples:`);
      sourceFailed.slice(0, 10).forEach((f) => {
        console.log(`  ${f.url}`);
      });
      console.log(`  ... and ${sourceFailed.length - 10} more`);
    }
  }

  if (targetFailed.length > 0) {
    console.log(`\n❌ Target URLs failed: ${targetFailed.length}`);
    if (targetFailed.length <= 10) {
      targetFailed.forEach((f) => {
        console.log(`  ${f.target}`);
      });
    } else {
      console.log(`  First 10 examples:`);
      targetFailed.slice(0, 10).forEach((f) => {
        console.log(`  ${f.target}`);
      });
      console.log(`  ... and ${targetFailed.length - 10} more`);
    }
  }

  if (sourceFailed.length > 0 || targetFailed.length > 0) {
    process.exit(1);
  } else {
    console.log('\n✅ All redirects and targets working!');
    process.exit(0);
  }
}

testRedirects();
