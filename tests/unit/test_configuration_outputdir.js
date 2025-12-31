import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { Configuration } from '../../src/models/configuration.js';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Configuration outputDir auto-creation', () => {
  test('should create outputDir when it does not exist', () => {
    const testDir = resolve('./test-output-dir');
    
    // Ensure test directory doesn't exist before test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    
    try {
      // Create configuration with non-existent directory
      const config = new Configuration({ outputDir: testDir });
      
      // Directory should be created automatically
      assert.ok(existsSync(testDir), 'outputDir should be created automatically');
      assert.strictEqual(config.outputDir, testDir, 'outputDir should be set correctly');
    } finally {
      // Clean up
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
    }
  });

  test('should create nested outputDir when parent directories do not exist', () => {
    const testDir = resolve('./test-nested/sub/output-dir');
    
    // Ensure test directory doesn't exist before test
    if (existsSync('./test-nested')) {
      rmSync('./test-nested', { recursive: true });
    }
    
    try {
      // Create configuration with nested non-existent directory
      const config = new Configuration({ outputDir: testDir });
      
      // Nested directory should be created automatically
      assert.ok(existsSync(testDir), 'nested outputDir should be created automatically');
      assert.strictEqual(config.outputDir, testDir, 'outputDir should be set correctly');
    } finally {
      // Clean up
      if (existsSync('./test-nested')) {
        rmSync('./test-nested', { recursive: true });
      }
    }
  });

  test('should not fail when outputDir already exists', () => {
    const testDir = resolve('./test-existing-dir');
    
    // Create directory before test
    mkdirSync(testDir, { recursive: true });
    
    try {
      // Create configuration with existing directory
      const config = new Configuration({ outputDir: testDir });
      
      // Should work without errors
      assert.ok(existsSync(testDir), 'outputDir should still exist');
      assert.strictEqual(config.outputDir, testDir, 'outputDir should be set correctly');
    } finally {
      // Clean up
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
    }
  });

  test('should throw error when directory cannot be created due to permissions', () => {
    // This test is platform-specific and may not work in all environments
    // Skip on Windows or if running as root
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      return;
    }

    const testDir = '/root/cannot-create-here';
    
    // Attempt to create configuration with invalid directory
    assert.throws(
      () => new Configuration({ outputDir: testDir }),
      /Cannot create output directory/,
      'Should throw error when directory cannot be created'
    );
  });

  test('should use current working directory as default when no outputDir specified', () => {
    const config = new Configuration();
    
    assert.strictEqual(config.outputDir, process.cwd(), 'Should default to current working directory');
  });

  test('should resolve relative paths correctly', () => {
    const relativeDir = './relative-output';
    const expectedDir = resolve(relativeDir);
    
    // Ensure test directory doesn't exist before test
    if (existsSync(expectedDir)) {
      rmSync(expectedDir, { recursive: true });
    }
    
    try {
      const config = new Configuration({ outputDir: relativeDir });
      
      // Should resolve to absolute path and create directory
      assert.strictEqual(config.outputDir, expectedDir, 'Should resolve relative path to absolute');
      assert.ok(existsSync(expectedDir), 'Directory should be created');
    } finally {
      // Clean up
      if (existsSync(expectedDir)) {
        rmSync(expectedDir, { recursive: true });
      }
    }
  });
});