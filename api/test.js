#!/usr/bin/env node

/**
 * 后端 API 测试脚本
 * 用于验证 API 端点的功能
 */

const API_BASE_URL = process.argv[2] || 'http://localhost:3000';

console.log('🧪 开始测试后端 API...');
console.log(`📍 API 地址: ${API_BASE_URL}\n`);

// 测试用例
const tests = [
  {
    name: '健康检查',
    method: 'GET',
    url: '/health',
    expected: { status: 'ok' }
  },
  {
    name: '获取空预约列表',
    method: 'GET',
    url: '/api/bookings',
    expected: []
  },
  {
    name: '创建预约',
    method: 'POST',
    url: '/api/bookings',
    body: {
      id: 'test-' + Date.now(),
      studio: '无影棚1号',
      date: '2026-01-28',
      startTime: '10:00',
      endTime: '12:00',
      photographer: '测试摄影师',
      contact: '13800138000',
      notes: '自动化测试'
    }
  },
  {
    name: '获取预约列表（应有1条）',
    method: 'GET',
    url: '/api/bookings'
  },
  {
    name: '测试时间冲突',
    method: 'POST',
    url: '/api/bookings',
    body: {
      id: 'test-conflict-' + Date.now(),
      studio: '无影棚1号',
      date: '2026-01-28',
      startTime: '11:00',
      endTime: '13:00',
      photographer: '测试摄影师2',
      contact: '13900139000',
      notes: '冲突测试'
    },
    expectError: true,
    expectedStatus: 409
  }
];

async function runTests() {
  let passed = 0;
  let failed = 0;
  let createdId = null;

  for (const test of tests) {
    try {
      console.log(`\n📝 测试: ${test.name}`);

      const options = {
        method: test.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (test.body) {
        options.body = JSON.stringify(test.body);
        if (test.name === '创建预约') {
          createdId = test.body.id;
        }
      }

      const response = await fetch(`${API_BASE_URL}${test.url}`, options);
      const data = await response.json();

      if (test.expectError) {
        if (response.status === test.expectedStatus) {
          console.log(`✅ 通过 - 正确返回错误状态码 ${test.expectedStatus}`);
          console.log(`   错误信息: ${data.error}`);
          passed++;
        } else {
          console.log(`❌ 失败 - 期望状态码 ${test.expectedStatus}，实际 ${response.status}`);
          failed++;
        }
      } else {
        if (response.ok) {
          console.log(`✅ 通过`);
          console.log(`   响应:`, JSON.stringify(data, null, 2).substring(0, 200));
          passed++;
        } else {
          console.log(`❌ 失败 - 状态码: ${response.status}`);
          console.log(`   错误:`, data);
          failed++;
        }
      }
    } catch (error) {
      console.log(`❌ 失败 - ${error.message}`);
      failed++;
    }
  }

  // 清理测试数据
  if (createdId) {
    console.log(`\n🧹 清理测试数据...`);
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings/${createdId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        console.log(`✅ 测试数据已清理`);
      }
    } catch (error) {
      console.log(`⚠️  清理失败: ${error.message}`);
    }
  }

  // 总结
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`);
  console.log(`${'='.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('❌ 测试执行失败:', error);
  process.exit(1);
});
