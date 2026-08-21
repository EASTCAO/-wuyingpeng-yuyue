#!/usr/bin/env node

/**
 * 数据库迁移脚本
 * 删除旧表并重新创建（修复列名大小写问题）
 */

const { Pool } = require('pg');

const DATABASE_URL = process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ 请提供数据库连接字符串');
  console.error('用法: node migrate.js "postgresql://..."');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false
});

async function migrate() {
  console.log('🔄 开始数据库迁移...\n');

  try {
    // 1. 删除旧表
    console.log('📝 步骤 1: 删除旧表...');
    await pool.query('DROP TABLE IF EXISTS bookings');
    console.log('✅ 旧表已删除\n');

    // 2. 创建新表（带双引号的列名）
    console.log('📝 步骤 2: 创建新表...');
    await pool.query(`
      CREATE TABLE bookings (
        id TEXT PRIMARY KEY,
        studio TEXT NOT NULL,
        date TEXT NOT NULL,
        "startTime" TEXT NOT NULL,
        "endTime" TEXT NOT NULL,
        photographer TEXT NOT NULL,
        contact TEXT NOT NULL,
        notes TEXT,
        "needsSimpleVideo" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TEXT NOT NULL
      )
    `);
    console.log('✅ 新表已创建\n');

    // 3. 验证表结构
    console.log('📝 步骤 3: 验证表结构...');
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      ORDER BY ordinal_position
    `);

    console.log('表结构:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    console.log('\n✅ 数据库迁移完成！');

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
