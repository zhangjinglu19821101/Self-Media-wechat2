#!/usr/bin/env node
/**
 * postinstall 脚本：修补 lightningcss 让 Turbopack 能正确解析原生模块
 * 
 * 最终方案：在 lightningcss/node/index.js 中使用相对路径 require .node 文件
 * Turbopack 不支持绝对路径，需要使用相对于 index.js 的相对路径
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const nodeModulesDir = path.join(rootDir, 'node_modules');

// ===== 创建符号链接 =====
const platformPackages = [
  'lightningcss-linux-x64-gnu',
  'lightningcss-linux-x64-musl',
  'lightningcss-linux-arm64-gnu',
  'lightningcss-linux-arm64-musl',
  'lightningcss-darwin-x64',
  'lightningcss-darwin-arm64',
  'lightningcss-win32-x64-msvc',
];

for (const pkg of platformPackages) {
  const linkPath = path.join(nodeModulesDir, pkg);
  if (fs.existsSync(linkPath)) continue;
  const pnpmDir = path.join(nodeModulesDir, '.pnpm');
  if (!fs.existsSync(pnpmDir)) continue;
  try {
    const entries = fs.readdirSync(pnpmDir);
    const match = entries.find(e => e.startsWith(pkg + '@'));
    if (match) {
      const targetPath = path.join(pnpmDir, match, 'node_modules', pkg);
      if (fs.existsSync(targetPath)) {
        fs.symlinkSync(targetPath, linkPath, 'junction');
        console.log(`[postinstall] Symlink: ${pkg}`);
      }
    }
  } catch (err) {}
}

// ===== 修补 lightningcss/node/index.js =====

let platformId;
if (process.platform === 'linux') {
  try {
    const { familySync } = require('detect-libc');
    const family = familySync();
    if (family === 'musl') {
      platformId = 'linux-x64-musl';
    } else if (process.arch === 'arm') {
      platformId = 'linux-arm-gnueabihf';
    } else {
      platformId = `${process.platform}-${process.arch}-gnu`;
    }
  } catch {
    platformId = `${process.platform}-${process.arch}-gnu`;
  }
} else if (process.platform === 'win32') {
  platformId = `${process.platform}-${process.arch}-msvc`;
} else {
  platformId = `${process.platform}-${process.arch}`;
}

const nativeModuleName = `lightningcss-${platformId}`;

const pnpmDir = path.join(nodeModulesDir, '.pnpm');
if (!fs.existsSync(pnpmDir)) {
  console.log('[postinstall] .pnpm not found');
  process.exit(0);
}

try {
  const pnpmEntries = fs.readdirSync(pnpmDir);
  
  const lightningcssMatch = pnpmEntries.find(e => e.startsWith('lightningcss@') && !e.includes('linux') && !e.includes('darwin') && !e.includes('win32'));
  if (!lightningcssMatch) {
    console.log('[postinstall] lightningcss not found');
    process.exit(0);
  }

  const lightningcssNodeDir = path.join(pnpmDir, lightningcssMatch, 'node_modules', 'lightningcss', 'node');
  const indexJsPath = path.join(lightningcssNodeDir, 'index.js');
  
  if (!fs.existsSync(indexJsPath)) {
    console.log('[postinstall] index.js not found');
    process.exit(0);
  }

  let content = fs.readFileSync(indexJsPath, 'utf-8');
  if (content.includes('PATCHED FOR TURBOPACK')) {
    console.log('[postinstall] Already patched');
    process.exit(0);
  }

  fs.writeFileSync(indexJsPath + '.bak', content, 'utf-8');

  // 查找 .node 文件
  let nativeFilePath = null;
  
  // 在 pnpm store 中查找平台包
  const nativeMatch = pnpmEntries.find(e => e.startsWith(nativeModuleName + '@'));
  if (nativeMatch) {
    const candidate = path.join(pnpmDir, nativeMatch, 'node_modules', nativeModuleName, `lightningcss.${platformId}.node`);
    if (fs.existsSync(candidate)) {
      nativeFilePath = candidate;
    }
  }
  
  // 在顶层 node_modules 查找（符号链接）
  if (!nativeFilePath) {
    const candidate = path.join(nodeModulesDir, nativeModuleName, `lightningcss.${platformId}.node`);
    if (fs.existsSync(candidate)) {
      nativeFilePath = candidate;
    }
  }

  if (!nativeFilePath) {
    console.log(`[postinstall] WARNING: .node file not found for ${platformId}`);
    process.exit(1);
  }

  // 计算相对路径（从 lightningcss/node/ 到 .node 文件）
  let relativePath = path.relative(lightningcssNodeDir, nativeFilePath);
  // 统一使用正斜杠（Windows 兼容）
  relativePath = relativePath.split(path.sep).join('/');
  // 确保以 ./ 或 ../ 开头
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  console.log(`[postinstall] Native module: ${nativeFilePath}`);
  console.log(`[postinstall] Relative path from lightningcss/node/: ${relativePath}`);

  const patchedContent = `/* PATCHED FOR TURBOPACK - relative path for ${platformId} */
const native = require('${relativePath}');

module.exports.transform = wrap(native.transform);
module.exports.transformStyleAttribute = wrap(native.transformStyleAttribute);
module.exports.bundle = wrap(native.bundle);
module.exports.bundleAsync = wrap(native.bundleAsync);
module.exports.browserslistToTargets = require('./browserslistToTargets');
module.exports.composeVisitors = require('./composeVisitors');
module.exports.Features = require('./flags').Features;

function wrap(call) {
  return (options) => {
    if (typeof options.visitor === 'function') {
      let deps = [];
      options.visitor = options.visitor({
        addDependency(dep) {
          deps.push(dep);
        }
      });
      let result = call(options);
      if (result instanceof Promise) {
        result = result.then(res => {
          if (deps.length) {
            res.dependencies ??= [];
            res.dependencies.push(...deps);
          }
          return res;
        });
      } else if (deps.length) {
        result.dependencies ??= [];
        result.dependencies.push(...deps);
      }
      return result;
    } else {
      return call(options);
    }
  };
}
`;

  fs.writeFileSync(indexJsPath, patchedContent, 'utf-8');
  console.log(`[postinstall] Patched successfully for ${platformId}`);
} catch (err) {
  console.error('[postinstall] Patch failed:', err.message);
}

console.log('[postinstall] Done.');
