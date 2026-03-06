---
description: 初始化一个长期运行项目 — 生成功能列表、启动脚本、项目骨架
---

# 初始化长期运行项目

本 workflow 基于 Anthropic 文章 "Effective harnesses for long-running agents" 的核心模式，在当前工作区初始化一个可跨多轮对话增量开发的项目。

## 步骤

### 1. 确认项目需求

向用户确认以下信息（如果用户没有提供）：
- 要构建什么应用？（简要描述即可）
- 技术栈偏好？（如 React + Node.js、Vue + Python 等）
- 项目目录在哪里？（默认使用当前工作区）

### 2. 创建 `feature_list.json`

这是最关键的文件。基于用户描述，生成一个 JSON 数组，每个元素是一个功能测试用例：

```json
[
  {
    "id": 1,
    "category": "functional",
    "priority": "high",
    "description": "功能描述",
    "steps": ["步骤1", "步骤2", "步骤3"],
    "passes": false
  }
]
```

规则：
- 至少 50 个功能（复杂项目可 100-200 个）
- 按优先级排列：基础功能在前
- 分为 `functional` 和 `style` 两类
- **所有** `passes` 字段初始为 `false`
- 每个功能必须有可验证的测试步骤

### 3. 创建 `claude-progress.txt`

写入初始内容：

```
# 项目进度

## Session 1 - 初始化 (日期)
- 创建了 feature_list.json，共 N 个功能测试用例
- 搭建了项目骨架
- 待开始实现功能
```

### 4. 搭建项目骨架

根据技术栈创建基础项目结构，包含：
- 必要的配置文件（package.json、tsconfig.json 等）
- 目录结构（src/、public/ 等）
- 基础的开发服务器启动配置

// turbo
### 5. 初始化 Git 仓库

```bash
git init && git add . && git commit -m "Initial setup: feature_list.json and project structure"
```

### 6. 通知用户

告知用户：
- 已创建 `feature_list.json`，共多少个功能
- 项目骨架已就绪
- 下一步使用 `/continue` 命令开始逐个实现功能
