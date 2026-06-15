# 调试指南

## VS Code 调试配置

请手动修改 `.vscode/launch.json` 为以下内容：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: 调试开发服务器",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/next/dist/bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}",
      "env": {
        "NODE_ENV": "development",
        "NEXT_TELEMETRY_DISABLED": "1"
      },
      "restart": true,
      "outputCapture": "std",
      "console": "integratedTerminal",
      "sourceMapPathOverrides": {
        "webpack://_N_E/./*": "${workspaceFolder}/*"
      }
    },
    {
      "name": "Next.js: 调试生产服务器",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/next/dist/bin/next",
      "args": ["start"],
      "cwd": "${workspaceFolder}",
      "env": {
        "NODE_ENV": "production",
        "NEXT_TELEMETRY_DISABLED": "1"
      },
      "outputCapture": "std",
      "console": "integratedTerminal",
      "sourceMapPathOverrides": {
        "webpack://_N_E/./*": "${workspaceFolder}/*"
      }
    },
    {
      "name": "Chrome: 调试客户端",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}",
      "sourceMapPathOverrides": {
        "webpack://_N_E/./*": "${webRoot}/*"
      }
    },
    {
      "name": "Next.js: 全栈调试 (服务器 + Chrome)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/next/dist/bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}",
      "env": {
        "NODE_ENV": "development",
        "NEXT_TELEMETRY_DISABLED": "1"
      },
      "console": "integratedTerminal",
      "serverReadyAction": {
        "uriFormat": "http://localhost:3000",
        "pattern": "- Local:.*(http://[^\\s]+)"
      }
    }
  ]
}
```

## 调试认证流程

### 1. 在 auth-context.tsx 中设置断点

建议在以下位置设置断点：

```typescript
// contexts/auth-context.tsx
- useEffect 开始处
- init() 函数中
- fetchProfile() 函数中
- onAuthStateChange 回调中
```

### 2. 在登录页面设置断点

```typescript
// app/login/page.tsx
- handleLogin() 函数开始
- handleLogin() 中 signInWithPassword 调用处
- handleRegister() 函数开始
```

### 3. 在 Dashboard 页面设置断点

```typescript
// app/dashboard/page.tsx
- 组件开始处
- profile 数据使用处
```

## 使用 `debugger` 语句

你也可以直接在代码中插入 `debugger` 语句：

```typescript
// 示例：在 auth-context.tsx 中
useEffect(() => {
  debugger; // 添加这一行
  console.log("[Auth] AuthProvider 开始初始化");
  // ...
}, []);
```

## 浏览器开发者工具调试

1. 打开 Chrome DevTools (F12)
2. 在 **Sources** 标签页中找到你的文件
3. 点击行号设置断点
4. 使用 **Console** 标签查看日志和错误

## 查看 Supabase 日志

1. 在浏览器开发者工具的 **Network** 标签中
2. 筛选 `supabase` 或 `auth`
3. 查看请求和响应

## 常见问题调试

### 1. Profile 数据为 null

- 检查 Supabase RLS 策略是否允许读取
- 确认 users 表中存在对应 id 的记录
- 查看浏览器控制台中 `[Auth]` 开头的日志

### 2. 登录卡住

- 检查 Network 标签中的请求是否完成
- 查看是否有 CORS 错误
- 确认 Supabase 项目配置正确

### 3. 页面跳转后状态未更新

- 确认 session 是否正确写入 localStorage
- 检查 onAuthStateChange 是否被触发
- 确认 loading 状态是否正确设置

## 快速启动调试

1. 在终端运行：`npm run dev`
2. 在 VS Code 按 F5 选择 "Next.js: 调试开发服务器"
3. 在浏览器打开 http://localhost:3000
4. 在代码中设置断点开始调试
