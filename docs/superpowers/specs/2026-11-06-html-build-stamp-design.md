# vite-plugin-html-build-stamp 设计文档

日期：2026-11-06

## 目标

在 Vite 构建阶段往 `index.html` 顶部注入一段轻量 HTML 注释，仅包含对外安全的构建信息（无 CI、打包人、node 版本、内网信息）。

## 注释模板

```
<!--
 * name: frontend
 * version: 2.1.0
 * build_time: 2026-11-06 12:38:09
 * build_hash: 3fa2c71d
 * git_commit: a7f2c71d
 * git_branch: main
-->
```

字段按固定顺序输出：`name, version, build_time, build_hash, git_commit, git_branch`；`fields` 默认顺序同此。

- `name` / `version`：读取 package.json
- `build_time`：`YYYY-MM-DD HH:mm:ss`，本地时区
- `git_commit`：`git rev-parse --short=7 HEAD`
- `git_branch`：`git rev-parse --abbrev-ref HEAD`
- `build_hash`：汇总本次产物文件名 hash 段的 8 位 FNV-1a

## 关键决策

1. **字段缺失整行跳过**（不显示空值或 skip）
2. **字段输出按固定顺序**：`name, version, build_time, build_hash, git_commit, git_branch`；`fields` 默认值同此顺序
3. **build_hash**：`generateBundle` 遍历产物文件名收集 `-[0-9a-f]{8,}` hash 段 → FNV-1a 8 位；无产物（dev）降级为其余字段内容 hash
4. **字段开关用数组白名单**：`fields: FieldName[]`
5. **注释固定注入文档最顶部（top）**，不提供 position 配置
6. **dev 默认不注入**：`enableInDev` 默认 `false`

## API

```ts
type FieldName = 'name' | 'version' | 'build_time' | 'git_commit' | 'git_branch' | 'build_hash';

interface Options {
  fields?: FieldName[];             // 默认全部 6 个，按固定顺序
  enable?: boolean;                 // 默认 true
  enableInDev?: boolean;            // 默认 false
}
```

默认导出 factory `(options?) => Plugin`。

## 结构

```
src/
  index.ts        # 插件入口、Options、factory
  git-info.ts     # git commit/branch 读取（spawnSync，无仓库返回 null）
  stamp.ts        # 注释生成（转义、字段过滤、FNV-1a hash）
__tests__/
  stamp.spec.ts
  git-info.spec.ts
```

实现钩子：`buildStart`（读 package.json + git，一次性）、`generateBundle`（收集产物 hash）、`transformIndexHtml`（生成并注入注释）。

## 错误处理

- git 静默失败：无仓库 / 命令不可用 → 对应行不显示，不阻塞构建
- package.json 读取失败 → name/version 行不显示
- 值转义：移除 `--`、`<`、`>`、换行等，防破坏注释结构

## 测试

- stamp：模板生成、字段白名单过滤、转义、hash 降级
- git-info：成功 / 无仓库 / 命令失败路径
- 手动验证：dev + build 示例项目各跑一次，确认注入位置与内容

## 交付物

完整源码、README（配置项 + 使用示例）、示例 `vite.config.ts`。零运行时依赖，保留现有 tsup + bun test 结构。
