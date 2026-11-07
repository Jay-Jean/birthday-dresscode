# 彩色通行证 / 生日 Dress Code 裁判

一个纯静态、适配手机和微信浏览器的黑白灰穿搭检测网页。用户拍照/上传全身照，手机端使用 MediaPipe SelfieMulticlass 分割**可见服装像素**，再用固定 CIE Lab 颜色算法计算黑/白/灰占比，并按主持人设置的比例向上取整计算趣味惩罚点。图片不上传到后端。

## GitHub Pages 部署（无需购买服务器、无需自己的域名）

1. 登录 GitHub，点击 **New repository**，新建公开仓库，推荐名 `birthday-dresscode`，默认分支 `main`。
2. 将本项目的**所有文件及目录**上传到仓库根目录，包括隐藏的 `.github/workflows/pages.yml`。建议先解压，然后使用电脑上的 Git 提交，或者在 GitHub 网页中上传文件，留意 `.github` 不要漏掉。
3. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
4. 打开 **Actions**，查看 `Publish Birthday Dress Code Judge` 工作流。它会自动安装 MediaPipe、下载模型到 GitHub Pages 产物内，并部署静态站点。首次触发如需在 Actions 页面手动运行，请选择 **Run workflow**。
5. 部署成功后地址一般为 `https://你的GitHub用户名.github.io/birthday-dresscode/`。直接在手机浏览器打开或把链接转成二维码即可。

> 注意：这里只是打包好的项目，**没有代替你上传到 GitHub**，也没有生成真实部署网址。GitHub Pages 在中国大陆的访问因网络而异，聚会前请在移动网络和微信内置浏览器中实际测试。

## 为什么不用谷歌 CDN？

打包时在 **GitHub Actions 服务器**中下载 MediaPipe JavaScript 包、WASM 文件和约 16MB 的模型，再与网页一起发布。参加聚会的人运行时只请求自己的 `github.io` 网站，避免直接请求 Google 模型存储或 npm CDN。因此构建失败时请看 GitHub Actions 日志，而不是让参与者更换网络。

## 主持人统一判罚参数

主持人先打开普通链接，调整惩罚比例、上限以及颜色识别容差，然后点击「复制统一规则链接」。分享的链接包含 `?rule=1` 等规则参数，来宾访问时所有设置自动锁定，确保同一套设置。此锁定是游戏界面的便利约束，不是防作弊的安全认证；有技术经验的人仍能修改链接，因此现场以趣味活动为主。

## 测量口径

- 分母：AI 分割为 `4=clothes` 的可见像素；勾选配饰后另包含 `5=others`。其他区域（皮肤、背景、头发）不计。
- 分类：RGB 转 CIE Lab；色度 `C*` 不高于设定阈值的像素视为黑白灰；根据 L* 值细分黑/白/灰。彩色像素计入分母但不计入黑白灰。
- 黑白灰占比 = (黑像素 + 白像素 + 灰像素) / 服饰总像素 × 100%。
- 趣味惩罚点 = min(ceil(黑白灰百分数 / 每点百分点), 最高点数)。可调整规则，最多 8 点。建议仅以自愿参与的小游戏或无酒精饮品兑换，不强制饮酒。
- 这里测量的是照片中的**可见投影像素占比**，不是衣服真实的平方厘米面积；模型不保证完整识别鞋袜，也可能把背景或阴影误判。不同拍摄条件会导致波动。

## 本地开发

```bash
npm install
npm test
npm run build
npx serve dist
```

`npm run build` 需要能访问 npm 和 Google 模型文件；最终 `dist/` 不依赖外部静态资源加载。若使用其他静态服务器，可直接提供 `dist/` 目录。

## 代码目录

- `web/index.html`：网页入口
- `web/style.css`：手机优先的派对主题界面
- `web/app.js`：上传图片、运行分割、绘制高亮、交互和导出
- `web/color.js`：可测试的固定 Lab 颜色判定、计算公式
- `scripts/build-pages.mjs`：自动下载模型及构建静态网站
- `.github/workflows/pages.yml`：一键 GitHub Pages 发布
- `tests/`：颜色算法和计分基础测试

## 隐私和适用性

此项目无账号、无后端、无云端排行榜，照片不会由本项目主动发送到服务器。MediaPipe 官方运行时可能采集部分使用指标，详情参阅 MediaPipe 隐私说明。用户可下载个人判罚截图，但若主动分享，照片会由用户自行传递。

模型和库参考：
- https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter
- https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
