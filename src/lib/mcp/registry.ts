/**
 * MCP 能力注册入口
 *
 * 所有 MCP 能力都需要在这里引入，这样才能在启动时注册到 MCPCapabilityExecutorFactory 中
 *
 * 新增 MCP 能力时，只需要在这里添加一行 import 即可
 */

// 微信公众号-添加草稿
import './wechat-draft-creator';

// 微信公众号合规审核
import './wechat-compliance-auditor';

// 联网搜索
import './web-search-executor';

// 小红书-生成预览图
import './xiaohongshu-preview-image';

// 后续新增的 MCP 能力在这里添加 import
// import './another-mcp-capability';
