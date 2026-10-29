# 部署到 GitHub Pages

这个游戏是纯静态网页：不需要 Node、不需要后端、不需要构建命令。  
仓库根目录就是网站根目录，`index.html` 必须留在根目录。

我已经准备好了：

- `.nojekyll`：让 GitHub Pages 原样发布文件，不经过 Jekyll
- `.gitignore`：忽略 `.DS_Store`、日志等无用文件
- Git 仓库：已经初始化
- 第一个本地提交：已经创建
- 远程地址：已经设置为 `https://github.com/yummyagents/meiwei-pixel-world.git`

---

## 现在只差两步

### 第 1 步：创建远程仓库

在你截图的页面确认：

- Owner：`yummyagents`
- Repository name：`meiwei-pixel-world`
- 选择 **Public**
- Add README / .gitignore / license 都保持关闭

点击 **Create repository**。

### 第 2 步：推送本地代码

#### 方案 A：GitHub Desktop（最省事）

1. 下载并安装：https://desktop.github.com/
2. 打开 GitHub Desktop，登录 GitHub
3. 菜单 **File → Add Local Repository**
4. 选择：
   `/Users/babyruimac/Documents/deepseek-harness/default-workspace`
5. 仓库已经有提交，且远程 `origin` 已经设置好
6. 直接点击顶部 **Push origin**
7. 等它把约 19MB 的文件上传完

以后每次改完游戏：

- GitHub Desktop 会显示改动
- 填说明 → **Commit to main**
- 点击 **Push origin**
- Pages 会自动重新发布

#### 方案 B：终端

只需要执行：

```bash
cd /Users/babyruimac/Documents/deepseek-harness/default-workspace
git push -u origin main
```

如果要求输入密码，GitHub 不接受账户密码，需要用 **Personal Access Token**：

1. GitHub 头像 → **Settings**
2. **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. **Generate new token (classic)**
4. Note 填 `meiwei-pages`
5. 过期时间选 90 天
6. 勾选 **repo**
7. 生成后复制 `ghp_...`
8. 回到终端，用户名填 `yummyagents`，密码处粘贴这个 token

### 第 2 步：开启 Pages

推送完成后，打开：

`https://github.com/yummyagents/meiwei-pixel-world`

进入：

**Settings → Pages**

在 **Build and deployment** 下设置：

- Source：**Deploy from a branch**
- Branch：**main**
- Folder：**/ (root)**

点击 **Save**，等 1～3 分钟。

你的游戏地址是：

```text
https://yummyagents.github.io/meiwei-pixel-world/
```

---

## 部署完成后的检查

打开：

`https://<你的用户名>.github.io/meiwei-pixel-world/`

检查这几项：

- 首页能打开
- 选择特工时显示四张照片，而不是旧 Emoji
- 能进入游戏
- 按 M 能看到地图和“美味科技城”
- 按 E 能看到 41 种方块
- 控制台没有 404

如果看到的是旧页面：

- 等 1～2 分钟再刷新
- 按 **Cmd + Shift + R**（Mac）或 **Ctrl + Shift + R**（Windows）强制刷新

---

## 常见问题

### 打开是 404

依次检查：

1. 仓库是 **Public**
2. Pages 的 Source 是 **Deploy from a branch**
3. Branch 是 **main**
4. Folder 是 **/ (root)**
5. `index.html` 在仓库根目录，不在子文件夹里

### 页面能开，但角色还是旧 Emoji

先强制刷新。GitHub Pages 有缓存，刚发布时可能还会拿到旧文件。

### 角色照片 404

确认仓库里存在这些文件：

```
assets/images/characters/burger.jpg
assets/images/characters/fries.jpg
assets/images/characters/popcorn.jpg
assets/images/characters/witch.jpg
```

### 私有仓库能开 Pages 吗？

免费账号的私有仓库不能直接用 Pages，建议用 Public 仓库。游戏本身不需要任何秘密信息。

### 要不要用 GitHub Actions？

不需要。这个项目没有构建步骤，直接用 **Deploy from a branch / main / root** 最简单。

---

## 发布地址格式

普通项目仓库：

```
https://<用户名>.github.io/<仓库名>/
```

例如：

```
https://xiaoming.github.io/meiwei-pixel-world/
```

游戏内部的资源路径都是相对路径，所以放在 `/meiwei-pixel-world/` 这种子路径下也能正常运行。
