# 多人房间服务

## 启动

```bash
node server/server.js
```

默认地址：`http://127.0.0.1:8080/`

- 静态游戏文件从仓库根目录提供
- 房间数据保存在 `server/data/rooms/`
- 房间码 6 位，最多 6 人
- 页面和 WebSocket 同源时，客户端会自动使用当前站点

## 云主机部署

在 Render / Railway / Fly.io / VPS 上：

```bash
node server/server.js
```

设置环境变量 `PORT`（平台通常会自动设置）。服务会自动提供游戏静态文件，因此可以直接访问服务地址开始游戏。

如果游戏静态页放在 GitHub Pages，请在联机弹窗里把“联机服务器”填成云服务地址，或使用：

```text
https://你的名字.github.io/meiwei-pixel-world/?mp=https://你的多人服务.com
```

## 数据

每个房间会保存：

- 共享种子
- 方块修改
- 最近 30 条快捷聊天

修改会在 350ms 防抖后写入 `server/data/rooms/CODE.json`。

## 限制

- 当前是房间原型，不是账号系统
- 私密房间码；没有公开大厅
- 方块同步使用客户端广播，正式运营建议改成服务器权威校验
- 公网部署建议使用 HTTPS/WSS 和反向代理
