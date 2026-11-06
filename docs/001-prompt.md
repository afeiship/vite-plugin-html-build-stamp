# prompt


## content
~~~
你是一名前端工程开发工程师，现在帮我开发一个 Vite 插件，项目名称：vite-plugin-html-build-stamp
插件描述：Inject lightweight build stamp comment into html for vite app

需求规则：
1. 插件作用：在构建阶段，往 index.html 顶部插入一段 HTML 注释，只保留少量对外安全的必要构建信息，不包含敏感信息。
2. 注释内固定字段：
name：读取 package.json 的 name
version：读取 package.json 的 version
build_time：构建时间，格式 YYYY-MM-DD HH:mm:ss，使用本地时区
git_commit：git short commit hash（7位）
git_branch：当前 git 分支名称
build_hash：Vite 本次构建产物 hash
3. 注释模板示例：
<!--
 * name: frontend
 * version: 2.1.0
 * build_time: 2026-11-06 12:38:09
 * git_commit: a729f41
 * git_branch: main
 * build_hash: 3fa2c71d
-->
4. 约束要求：
- 信息精简，面向外部用户可见，不要增加 CI、打包人、node版本、内网相关信息
- 使用 vite transformIndexHtml 钩子实现
- 兼容开发环境和生产环境，支持配置开关，允许用户关闭注入
- 提供 TS 类型，支持配置项自定义：可以自定义注释位置、是否开启各个字段
- 读取 git 信息需要兼容没有 git 仓库的场景，不存在时对应字段值显示为空或者 skip
- build_hash 获取方式优先使用 rollup/vite 构建相关产物hash，做好降级处理
- 代码规范，输出标准 npm 插件结构，包含 package.json、README、tsconfig
- README 提供简单使用示例，说明配置项
- 处理特殊字符转义，防止 git commit message、分支名破坏 html 注释结构
- 不要引入多余重型依赖，尽量轻量
5. 输出交付：插件完整可运行源码，附带使用示例 vite.config.ts

开始开发，先输出项目整体结构，再逐步实现代码。
~~~
