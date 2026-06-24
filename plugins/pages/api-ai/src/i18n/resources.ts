export const apiConsoleResources = {
  'zh-CN': {
    title: 'API & AI',
    subtitle: '通过API控制和管理指纹浏览器',
    loading: '加载中...',
    status: {
      running: '运行中',
      stopped: '已停止',
      status: '状态',
      port: '端口',
      requestsToday: '今日请求',
    },
    service: {
      control: 'API服务控制',
      controlDesc: '启用后将在本地运行HTTP服务器,开发者可通过API接口控制软件功能',
      config: '服务配置',
      port: '端口',
      apiKey: 'API密钥',
      hideKey: '隐藏密钥',
      showKey: '显示密钥',
      copyKey: '复制密钥',
      resetKey: '重置密钥',
      remoteAccess: '远程访问',
      remoteAccessDesc: '启用后可通过局域网IP访问API服务,方便在同一网络下的其他设备调用',
      corsOrigins: '允许的 CORS 来源',
      corsOriginsDesc:
        '每行或使用逗号输入一个来源。使用 * 表示允许任意来源，留空表示不额外放行来源。',
      corsOriginsPlaceholder: 'http://localhost:3000\nhttp://127.0.0.1:5173',
      dailyLimitDesc: '当前密钥每日总调用上限：{{count}} 次。',
    },
    errors: {
      fetchConfig: '获取配置失败',
      fetchMcpConfig: '获取 MCP 配置失败',
      updateStatus: '更新状态失败',
      updateMcpStatus: '更新 MCP 状态失败',
      resetKey: '重置密钥失败',
      copyFailed: '复制失败',
      updatePort: '更新端口失败',
      invalidPortRange: '端口范围应为 1-65535',
      updateRemoteAccess: '更新远程访问设置失败',
      updateCors: '更新CORS设置失败',
    },
    confirm: {
      resetKeyTitle: '重置 API 密钥',
      resetKey: '确定要重置 API 密钥吗？重置后旧的密钥将立即失效。',
      warningTitle: '警告：旧密钥将立即失效',
      warningDescription: '依赖当前密钥的本地 API 调用会立刻失败，请在重置后尽快更新调用方配置。',
      cancel: '取消',
      confirm: '确认',
    },
    cards: {
      rateLimit: 'API接口频率限制',
      rateLimitDesc: 'API 请求频率限制由密钥权限策略控制，并按接口分别生效。',
      upgrade: '升级以获得更多请求次数',
      apiDocs: 'API文档',
      apiDocsDesc: '查看完整的API接口文档，了解所有可用的接口和参数说明。',
      viewFullDocs: '查看完整API文档',
    },
    mcp: {
      control: 'MCP 服务控制',
      controlDesc: '启用后会在本机启动 MCP server，供 Cursor、VS Code、Codex 等客户端调用。',
      clientGrid: '连接客户端',
      clientGridDesc: '选择一个常用 MCP 客户端，右侧会显示对应的接入示例。',
      clientConfigDesc: '将以下配置写入 MCP client，即可通过本机地址连接 Simprint MCP 服务。',
      clients: {
        vscode: {
          title: 'VS Code',
          docs: '查看 VS Code 文档',
        },
        cursor: {
          title: 'Cursor',
          docs: '查看 Cursor 文档',
        },
        claude: {
          title: 'Claude',
          docs: '查看 Claude 文档',
        },
        codex: {
          title: 'Codex',
          docs: '查看 Codex 文档',
        },
      },
    },
  },
  'en-US': {
    title: 'API & AI',
    subtitle: 'Control and manage the browser via API',
    loading: 'Loading...',
    status: {
      running: 'Running',
      stopped: 'Stopped',
      status: 'Status',
      port: 'Port',
      requestsToday: 'Requests Today',
    },
    service: {
      control: 'API Service Control',
      controlDesc:
        'After enabling, an HTTP server will run locally, and developers can control software functions through the API interface',
      config: 'Service Configuration',
      port: 'Port',
      apiKey: 'API Key',
      hideKey: 'Hide Key',
      showKey: 'Show Key',
      copyKey: 'Copy Key',
      resetKey: 'Reset Key',
      remoteAccess: 'Remote Access',
      remoteAccessDesc:
        'After enabling, API services can be accessed via LAN IP, facilitating calls from other devices on the same network',
      corsOrigins: 'Allowed CORS Origins',
      corsOriginsDesc:
        'Enter one origin per line or separated by commas. Use * to allow any origin, or leave empty to allow no extra origins.',
      corsOriginsPlaceholder: 'http://localhost:3000\nhttp://127.0.0.1:5173',
      dailyLimitDesc: 'Daily request limit for the current key: {{count}}.',
    },
    errors: {
      fetchConfig: 'Failed to fetch config',
      fetchMcpConfig: 'Failed to fetch MCP config',
      updateStatus: 'Failed to update status',
      updateMcpStatus: 'Failed to update MCP status',
      resetKey: 'Failed to reset key',
      copyFailed: 'Copy failed',
      updatePort: 'Failed to update port',
      invalidPortRange: 'Port must be between 1 and 65535',
      updateRemoteAccess: 'Failed to update remote access settings',
      updateCors: 'Failed to update CORS settings',
    },
    confirm: {
      resetKeyTitle: 'Reset API Key',
      resetKey:
        'Are you sure you want to reset the API key? The old key will become invalid immediately.',
      warningTitle: 'Warning: the old key will be invalidated immediately',
      warningDescription:
        'Any local API clients using the current key will fail immediately. Update caller configuration after regenerating it.',
      cancel: 'Cancel',
      confirm: 'Confirm',
    },
    cards: {
      rateLimit: 'API Rate Limit',
      rateLimitDesc:
        'API request limits are controlled by key permission policies and applied per interface.',
      upgrade: 'Upgrade to get more requests',
      apiDocs: 'API Documentation',
      apiDocsDesc:
        'View the complete API interface documentation to learn about all available interfaces and parameter descriptions.',
      viewFullDocs: 'View Full API Documentation',
    },
    mcp: {
      control: 'MCP Service Control',
      controlDesc:
        'After enabling, Simprint starts a local MCP server for Cursor, VS Code, Codex, and other MCP clients.',
      clientGrid: 'Client Integrations',
      clientGridDesc:
        'Choose a common MCP client on the left and the matching configuration example will be shown on the right.',
      clientConfigDesc:
        'Add the following configuration to your MCP client to connect to the local Simprint MCP server.',
      clients: {
        vscode: {
          title: 'VS Code',
          docs: 'VS Code Docs',
        },
        cursor: {
          title: 'Cursor',
          docs: 'Cursor Docs',
        },
        claude: {
          title: 'Claude',
          docs: 'Claude Docs',
        },
        codex: {
          title: 'Codex',
          docs: 'Codex Docs',
        },
      },
    },
  },
} as const;
