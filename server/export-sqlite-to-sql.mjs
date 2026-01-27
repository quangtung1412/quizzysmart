#!/usr/bin/env node
/**
 * Export SQLite Database to MySQL-compatible SQL File
 * Usage: node export-sqlite-to-sql.mjs [sqlite-file] [output-file]
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const sqliteFile = process.argv[2] || './prisma/dev.db';
const outputFile = process.argv[3] || `./backup_sqlite_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;

console.log('============================================');
console.log('SQLite to MySQL SQL Export');
console.log('============================================\n');
console.log(`Input:  ${sqliteFile}`);
console.log(`Output: ${outputFile}\n`);

// Open SQLite database
const db = new Database(sqliteFile, { readonly: true });

// Helper function to escape SQL values
function escapeSQLValue(value) {
    if (value === null || value === undefined) {
        return 'NULL';
    }
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    // Escape string - handle UTF-8 properly
    const str = String(value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\0/g, '\\0');
    return `'${str}'`;
}

// Helper to generate INSERT statement
function generateInsert(tableName, rows) {
    if (!rows || rows.length === 0) return '';

    const columns = Object.keys(rows[0]);
    let sql = '';

    // Insert in batches of 100 for better performance
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        sql += `-- Batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)\n`;
        sql += `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES\n`;

        const values = batch.map(row => {
            const vals = columns.map(col => escapeSQLValue(row[col]));
            return `  (${vals.join(', ')})`;
        });

        sql += values.join(',\n');
        sql += ';\n\n';
    }

    return sql;
}

// Start SQL output
let sqlOutput = `-- ============================================
-- MySQL Database Export from SQLite
-- Generated: ${new Date().toISOString()}
-- Source: ${sqliteFile}
-- ============================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';
SET @OLD_TIME_ZONE=@@TIME_ZONE, TIME_ZONE='+00:00';

-- ============================================
-- Disable keys for faster import
-- ============================================

`;

// Table order (respecting foreign key dependencies)
const tables = [
    { name: 'User', title: 'Users' },
    { name: 'KnowledgeBase', title: 'Knowledge Bases' },
    { name: 'Question', title: 'Questions' },
    { name: 'Test', title: 'Tests' },
    { name: 'Attempt', title: 'Test Attempts' },
    { name: 'AttemptAnswer', title: 'Attempt Answers' },
    { name: 'TestAssignment', title: 'Test Assignments' },
    { name: 'StudyPlan', title: 'Study Plans' },
    { name: 'QuestionProgress', title: 'Question Progress' },
    { name: 'SubscriptionPlan', title: 'Subscription Plans' },
    { name: 'Subscription', title: 'Subscriptions' },
    { name: 'documents', title: 'Documents' },
    { name: 'chunks', title: 'Document Chunks' },
    { name: 'ChatMessage', title: 'Chat Messages' },
    { name: 'GeminiApiCall', title: 'Gemini API Calls' },
    { name: 'AiSearchHistory', title: 'AI Search History' },
];

let totalRows = 0;

for (const { name: tableName, title } of tables) {
    try {
        console.log(`Processing ${title}...`);

        // Check if table exists
        const tableExists = db.prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        ).get(tableName);

        if (!tableExists) {
            console.log(`  ⚠ Table '${tableName}' not found, skipping`);
            continue;
        }

        // Get all rows
        const rows = db.prepare(`SELECT * FROM ${tableName}`).all();

        if (rows.length === 0) {
            console.log(`  ⊘ No data in ${title}`);
            sqlOutput += `-- No data in ${tableName}\n\n`;
            continue;
        }

        console.log(`  ✓ Exporting ${rows.length} rows`);
        totalRows += rows.length;

        // Add to SQL output
        sqlOutput += `-- ============================================\n`;
        sqlOutput += `-- Table: ${tableName} (${rows.length} rows)\n`;
        sqlOutput += `-- ============================================\n\n`;
        sqlOutput += `DELETE FROM \`${tableName}\`;\n`;
        sqlOutput += `ALTER TABLE \`${tableName}\` DISABLE KEYS;\n\n`;
        sqlOutput += generateInsert(tableName, rows);
        sqlOutput += `ALTER TABLE \`${tableName}\` ENABLE KEYS;\n\n`;

    } catch (error) {
        console.error(`  ✗ Error processing ${tableName}:`, error.message);
    }
}

// Footer
sqlOutput += `
-- ============================================
-- Restore settings
-- ============================================

SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET SQL_MODE=@OLD_SQL_MODE;
SET TIME_ZONE=@OLD_TIME_ZONE;

-- ============================================
-- Export completed successfully
-- Total rows exported: ${totalRows}
-- ============================================
`;

// Write to file
fs.writeFileSync(outputFile, sqlOutput, 'utf8');

// Stats
const fileSize = fs.statSync(outputFile).size;
const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

console.log('\n============================================');
console.log('Export Completed Successfully!');
console.log('============================================');
console.log(`Total rows: ${totalRows}`);
console.log(`File size:  ${fileSizeMB} MB`);
console.log(`Output:     ${outputFile}`);
console.log('\nTo import into MySQL:');
console.log(`  mysql -u root -p quizzysmart < ${path.basename(outputFile)}`);
console.log('\nOr via Docker:');
console.log(`  docker compose exec -T mysql mysql -u root -prootpassword quizzysmart < ${path.basename(outputFile)}`);
console.log('');

db.close();
