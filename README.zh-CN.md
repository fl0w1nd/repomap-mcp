# repomap-mcp

<p align="center">
  <img src="public/cover.jpg" alt="repomap-mcp" width="100%" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/repomap-mcp"><img src="https://img.shields.io/npm/v/repomap-mcp.svg" alt="npm version" /></a>
  <a href="https://github.com/fl0w1nd/repomap-mcp/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/repomap-mcp.svg" alt="license" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/repomap-mcp.svg" alt="node" /></a>
</p>

> **[English](./README.md)**

一个 MCP 服务器 + CLI 工具，使用 Tree-sitter AST 分析和 PageRank 算法生成**按重要性排序、受 token 预算约束的代码结构地图**。专为需要快速理解陌生代码库的 AI Agent 设计。

灵感来源于 [aider](https://github.com/Aider-AI/aider) 的 repo map 功能，基于 [RepoMapper](https://github.com/pdavis68/RepoMapper) 用 TypeScript 重新实现。

## 为什么需要 repomap-mcp？

AI 编程 Agent 面临一个根本问题：**大型代码库塞不进上下文窗口**。缺乏结构感知时，Agent 只能逐个 `cat` 文件碰运气、读到大量无关代码、或者反过来问用户该看哪里。

| | 没有 repomap-mcp | 有 repomap-mcp |
|---|---|---|
| **理解代码库** | 逐个 `cat` 文件盲猜 | 一次调用获得按重要性排序的结构概览 |
| **查找关联代码** | grep 字符串，遗漏语义关联 | PageRank 自动浮现跨文件依赖关系 |
| **Token 效率** | 读完整文件，撑爆上下文预算 | Token 预算约束输出，只保留关键部分 |
| **多语言仓库** | 每种语言写一套正则 hack | 40+ 语言 Tree-sitter AST 解析，零配置 |
| **任务聚焦** | 每次返回同样的扁平文件列表 | 根据 focus 文件和标识符个性化排名 |

### 核心特性

- **语义级分析** — 基于 Tree-sitter AST 提取真实的定义和引用，而非字符串匹配
- **PageRank 排名** — 被广泛引用的文件排名更高，如同重要网页的排名逻辑
- **邻居传播** — 聚焦类型定义文件时，*使用*这些类型的代码也会被自动提升
- **Token 预算约束** — 二分搜索自动选出预算内最大量的相关代码
- **上下文感知渲染** — 定义附带父级作用域签名（类/函数），而非原始行转储
- **磁盘缓存** — 按文件 mtime 缓存解析结果，后续运行近乎即时
- **零配置** — 自动检测 MCP 模式，自动遵循 `.gitignore`，按扩展名识别语言

## 使用场景

### 1. 探索陌生代码库

> *"我刚 clone 了这个项目，给我一个结构概览。"*

Agent 只传 `projectRoot` 调用 `repo_map`。输出是整个代码库中最重要的定义列表——入口函数、核心类型、关键函数——全部在 token 预算内。

### 2. 围绕已知文件发现关联代码

> *"我已经读过 `src/lib/db.ts` 了，还应该看哪些文件？"*

Agent 设置 `focusFiles: ["src/lib/db.ts"]`。地图以 `db.ts` 为中心——导入了它的类型的文件、调用了它的导出函数的代码——而 `db.ts` 本身被排除（Agent 已经有了）。

### 3. 定位特定符号

> *"`handleWebSocket` 在哪里定义的？谁调用了它？"*

Agent 调用 `search_identifiers`，传入 `query: "handleWebSocket"`。返回定义位置和所有引用位置，附带代码上下文。

### 4. 任务聚焦的深度探索

> *"重构认证流程。核心类型在 `src/auth/types.ts`，主逻辑是 `AuthService`。"*

Agent 组合多个参数：

```json
{
  "projectRoot": "/path/to/repo",
  "focusFiles": ["src/auth/types.ts"],
  "priorityIdentifiers": ["AuthService"],
  "tokenLimit": 4096
}
```

输出优先展示：与 `src/auth/types.ts` 关联的代码（邻居传播）、任何定义或大量使用 `AuthService` 的文件（×10 提升），全部限制在 4096 token 内。

### Prompt 示例

以下是一段系统 prompt 片段，展示 AI Agent 如何利用 repomap-mcp：

```
你可以使用 `repo_map` 工具。在修改代码前，先用它理解代码库：

1. 首次接触项目时，只传 projectRoot 调用 repo_map 获取全局概览。
2. 读完关键文件后，将它们作为 focusFiles 传入，发现尚未了解的关联代码。
3. 当用户提到特定函数或类时，将其作为 priorityIdentifiers 传入，
   使其定义和使用模式浮现到输出顶部。
4. 使用 search_identifiers 精确定位任何符号的定义和引用位置。
```

## 工作原理

```
源文件 ──扫描──▶ Tree-sitter AST ──提取──▶ 定义 & 引用
                                                │
                                                ▼
                                        跨文件引用图
                                                │
                                                ▼
Token 预算内的输出 ◀──筛选── 排序后的定义 ◀──PageRank──┘
```

1. **文件发现** — 递归扫描目录，遵循 `.gitignore` 规则
2. **AST 解析** — 使用 Tree-sitter (WASM) 配合 [Aider 的 SCM 查询](https://github.com/Aider-AI/aider/tree/main/aider/queries)，支持 40+ 语言
3. **图构建** — 构建跨文件引用边（文件 A 引用了文件 B 中定义的标识符 → A→B）
4. **PageRank** — 个性化排名，支持邻居传播，可配置 focus/priority 文件权重
5. **Token 预算** — 二分搜索，在 token 限制内选出最相关的定义
6. **上下文渲染** — 代码片段附带父级作用域上下文和省略标记

## 快速开始

### 作为 MCP 服务器

在 MCP 客户端（Claude Desktop、Cursor、Windsurf 等）的配置中添加：

```json
{
  "mcpServers": {
    "repomap": {
      "command": "npx",
      "args": ["-y", "repomap-mcp"]
    }
  }
}
```

当 stdin 为管道输入时自动进入 MCP 模式，无需额外参数。

### 作为 CLI 工具

```bash
# 为当前目录生成 repo map
npx repomap-mcp --root .

# 指定 token 限制并输出报告
npx repomap-mcp --root /path/to/repo --map-tokens 4096 --verbose

# 聚焦已知文件，提升特定标识符权重
npx repomap-mcp --root . --focus-files src/db.ts --priority-idents "UserService"
```

## MCP 工具

### `repo_map`

生成按重要性排序的代码定义地图。

| 参数 | 类型 | 说明 |
|------|------|------|
| `projectRoot` | `string` | **必填。** 仓库根目录的绝对路径 |
| `focusFiles` | `string[]` | 已知文件，作为排名锚点（×20 权重），从输出中排除 |
| `additionalFiles` | `string[]` | 额外纳入分析的文件 |
| `priorityFiles` | `string[]` | 重要文件，提升排名权重（×5） |
| `priorityIdentifiers` | `string[]` | 重要标识符名，提升排名权重（×10） |
| `tokenLimit` | `number` | 输出最大 token 数（默认 `8192`） |
| `excludeUnranked` | `boolean` | 排除 PageRank 为 0 的文件（默认 `false`） |
| `forceRefresh` | `boolean` | 跳过缓存重新解析（默认 `false`） |

### `search_identifiers`

通过 AST 分析搜索仓库中的代码标识符。

| 参数 | 类型 | 说明 |
|------|------|------|
| `projectRoot` | `string` | **必填。** 仓库根目录的绝对路径 |
| `query` | `string` | **必填。** 标识符名称（大小写不敏感的子串匹配） |
| `maxResults` | `number` | 最大返回数量（默认 `50`） |
| `includeDefinitions` | `boolean` | 包含定义位置（默认 `true`） |
| `includeReferences` | `boolean` | 包含引用位置（默认 `true`） |

## CLI 选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--root <dir>` | `.` | 仓库根目录 |
| `--map-tokens <n>` | `8192` | 输出最大 token 数 |
| `--focus-files <files...>` | — | 已知文件；排名锚点，从输出中排除（×20） |
| `--additional-files <files...>` | — | 额外纳入分析的文件 |
| `--priority-files <files...>` | — | 重要文件，提升排名（×5） |
| `--priority-idents <idents...>` | — | 重要标识符，提升排名（×10） |
| `--verbose` | `false` | 在 stderr 输出统计报告 |
| `--force-refresh` | `false` | 跳过标签缓存 |
| `--exclude-unranked` | `false` | 隐藏 PageRank 为 0 的文件 |
| `--serve` | — | 强制进入 MCP 服务器模式 |

## 支持的语言

Python、JavaScript、TypeScript、Go、Rust、Java、C、C++、C#、Ruby、PHP、Swift、Kotlin、Scala、Dart、Lua、Elixir、Elm、OCaml、Haskell、Julia、Fortran、Clojure、R、Zig、HCL/Terraform、Solidity 等 — 通过 Tree-sitter WASM 语法支持 **40+ 语言**。

## 本地开发

```bash
git clone https://github.com/fl0w1nd/repomap-mcp.git
cd repomap-mcp
pnpm install
pnpm build
```

### 使用 MCP Inspector 调试

```bash
pnpm inspect
```

在 `http://localhost:6274` 打开 Web UI，可交互式测试工具。配置文件为项目根目录的 `mcp.json`。

### 项目结构

```
src/
├── index.ts           入口 — CLI / MCP 模式分发
├── server.ts          MCP 服务器与工具注册
├── cli.ts             CLI 参数解析
├── repomap.ts         核心管线编排
├── tags.ts            Tree-sitter 标签提取
├── pagerank.ts        PageRank 算法
├── tree-context.ts    带上下文的代码片段渲染
├── file-discovery.ts  递归文件扫描 + .gitignore
├── languages.ts       文件扩展名语言检测
├── token-counter.ts   Token 计数 (gpt-tokenizer)
├── cache.ts           磁盘标签缓存
└── utils.ts           共享类型
queries/               Tree-sitter SCM 查询文件（来自 Aider）
```

## 许可证

[MIT](./LICENSE)
