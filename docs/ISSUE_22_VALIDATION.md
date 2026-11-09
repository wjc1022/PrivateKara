# Issue #22 验证记录

分支：`feat/22-player-touch-controls`，基于获取后的 `origin/main`（`6576ee9`）。

## 实现

- `src/components/playerSheet.js`：视频画面仅通过 click 切换播放栏，避免 pointerdown 和合成 click 重复切换；控件不属于画面点击目标。复用原有显隐、inert 和 3 秒计时规则。拖动期间停止计时，结束或取消后恢复。
- 进度条复用 Pointer Events、Pointer Capture 和现有时间预览。按下及移动只更新 UI，只有匹配指针的 pointerup 提交一次 Seek；越界钳制。取消、丢失捕获、关闭和换曲均清理而不提交。忽略其他指针及非主按钮；捕获失败不进入拖动状态。保留切换音轨、等待元数据时的 Seek 意图处理。
- `src/styles/main.css`：向上扩展透明伪元素至 40 CSS px，保持原有进度条视觉尺寸和布局，不占用下方时间及播放按钮区域。保留 touch-action:none。
- `tests/player-touch.test.mjs`：6 项生产事件/计时例程测试；`tests/browser.html` 和 `tests/video.browser.html` 更新合成指针夹具并增加画面切换和热区命中检查。
- 无新增依赖或运行时文件；现有 Service Worker 为 network-first，不需要缓存版本变更。

## 实际执行

- PowerShell：`$testFiles = (Get-ChildItem tests/*.test.mjs).FullName; node --experimental-vm-modules --test $testFiles`：90/90 通过。
- `node --test tests/player-touch.test.mjs`：6/6 通过。
- `node tests/browser-runner.mjs`：149 项 Chromium 检查通过，包括原唱/伴奏切换、定位、歌词及离线回归。
- `node tests/browser-runner.mjs --video`：354 项 Chromium 检查通过，包括视频、字幕模式、方向布局、播放栏、透明热区命中及音频切换回归。
- `git diff --check`：通过。

失败处理：沙箱中 Chromium GPU 子进程启动失败，改用正常本机权限运行；旧合成指针未声明 isPrimary 且 pointerup 无最终坐标，更新夹具后通过。新增计时测试首次缺失 moreBtn mock，补齐后通过。视频夹具新增变量重名造成脚本无法运行并超时，修正后通过，临时延长的运行超时已还原。检查中移除了会阻断元数据加载期间定位的限制，并增加回归测试。

## 局域网与待人工验收

现有服务：`http://192.168.31.109:8080/`（监听 `0.0.0.0:8080`）。通过此局域网 IP 实际请求首页、播放器 JS 和 CSS 均返回 HTTP 200，内容与当前分支一致。尚未从另一台设备确认网络/防火墙可达性。

HTTP 入口可用于局域网 Safari 页面操作检查；安装版 PWA、Service Worker 和安全上下文相关能力需可信 HTTPS 入口，本轮未配置或验证 HTTPS。

待真实 iPhone Safari 和主屏幕 PWA 验收：画面反复点击、控件独立操作、40px 热区触摸、移出/越界拖动、系统取消、快速连续操作、拖动后播放状态、横竖屏、字幕及歌词同步。原生指针捕获与 iOS 系统触摸取消未由桌面合成事件证明。AirPlay 普通镜像及持续有声播放亦待人工验收。

按用户要求暂不创建 PR；未合并、未关闭 Issue #22。
