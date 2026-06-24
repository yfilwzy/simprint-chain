const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function resolveEnv() {
  // 优先使用显式传入的 ENV_NAME（例如手工在终端里设置）
  if (process.env.ENV_NAME) {
    return process.env.ENV_NAME;
  }

  // 其次尝试读取由后端 build.rs 生成的构建环境提示文件
  try {
    const hintPath = path.join(__dirname, ".build-env");
    if (fs.existsSync(hintPath)) {
      const content = fs.readFileSync(hintPath, "utf8").trim();
      if (content) {
        return content;
      }
    }
  } catch (_) {
    // 忽略读取失败，退回默认值
  }

  // 默认按生产环境构建
  return "production";
}

const env = resolveEnv();
console.log(`Building frontend with mode: ${env}`);

// Ensure Slotkit generated imports exist for Vite build (CI/build machines won't have them).
// This generates: src/core/plugin/loader/plugin-imports.generated.ts
execSync(`pnpm run generate-imports`, { stdio: "inherit" });

execSync(`pnpm run build:${env}`, { stdio: "inherit" });