# EmbyTok

EmbyTok 是一个为 Emby 媒体服务器设计的竖屏视频浏览客户端，提供类似 TikTok 的体验，让用户能够以更现代、便捷的方式浏览个人媒体库。

![EmbyTok Screenshot](https://example.com/embytok-screenshot.png) <!-- 可选的截图 -->

## 功能特性

- 📱 **TikTok 式浏览体验**：全屏竖屏视频浏览，上下滑动切换视频
- 🎵 **音频控制**：一键静音/取消静音，支持旋转专辑封面
- ❤️ **收藏功能**：点赞并收藏喜欢的视频
- 🔍 **多种浏览模式**：
  - 最新视频
  - 随机推荐
  - 收藏夹
- 📁 **媒体库管理**：支持多个媒体库的浏览和隐藏
- 🌐 **响应式设计**：适配移动端和桌面端
- ⏩ **滑动控制进度**：左右滑动调整视频播放进度
- 📦 **Android 应用**：可通过 Capacitor 构建为原生 Android 应用

## 技术栈

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Capacitor (用于构建 Android 应用)
- Lucide React (图标)

## 安装和设置

### 前置要求

- Node.js (v14 或更高版本)
- npm 或 yarn

### 安装步骤

1. 克隆仓库：
   ```bash
   git clone <repository-url>
   cd embytok
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

4. 构建生产版本：
   ```bash
   npm run build
   ```

## 使用方法

1. 启动应用后，在登录界面输入您的 Emby 服务器信息：
   - 服务器地址（例如：http://192.168.1.100:8096）
   - 用户名
   - 密码（如果需要）

2. 登录成功后，您可以：
   - 上下滑动浏览视频
   - 点击视频播放/暂停
   - 使用右侧控制栏点赞、查看信息、控制音频
   - 通过左上角菜单切换媒体库和浏览模式
   - 左右滑动控制视频播放进度
   - 点击网格图标切换到网格视图

## 构建 Android 应用

1. 确保您已安装 Android Studio 和 Android SDK

2. 添加 Android 平台：
   ```bash
   npm run cap:add
   ```

3. 同步项目：
   ```bash
   npm run cap:sync
   ```

4. 构建 APK：
   ```bash
   ./build-apk.sh
   ```

## Docker 部署

项目包含 Docker 支持，可以轻松部署为 Web 应用：

```bash
docker-compose up -d
```

默认情况下，应用将在端口 8080 上可用。

## 配置

应用使用 localStorage 存储以下用户配置：
- 服务器配置（URL、用户ID、访问令牌）
- 隐藏的媒体库列表

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 许可证

[MIT License](LICENSE)

## 免责声明

EmbyTok 是一个非官方的 Emby 客户端，与 Emby 官方没有关联。使用时请确保遵守您所在地区的相关法律法规。
