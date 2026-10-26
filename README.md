# 轻体日志 2.0

给 Amber 的血糖、运动、饮食和身体记录小程序，二楞和发财陪着一起动起来。

这是一个纯静态网页：没有服务器，也没有账号。所有记录只保存在手机的浏览器里，自己上传的背景照片也一样，不会传到任何地方。截图识别同样在手机上离线完成。

## 放到 GitHub Pages

1. 在 GitHub 新建一个仓库，例如 `qingti`，可以设为 Public。
2. 把这个文件夹里的**全部内容**上传到仓库根目录，包括隐藏文件 `.nojekyll`。网页上传时，直接把文件夹里的文件拖进「Add file → Upload files」即可。
3. 打开仓库的 **Settings → Pages**，Source 选 **Deploy from a branch**，Branch 选 `main`，目录选 `/ (root)`，然后保存。
4. 等一两分钟，页面顶部会出现网址，形如 `https://你的用户名.github.io/qingti/`。

## 在 iPhone 上使用

1. 用 **Safari** 打开上面的网址。
2. 点底部的「分享」按钮 →「添加到主屏幕」。
3. 之后从主屏幕的图标打开，用起来像一个 App。第一次打开后，没有网络也能用。

另外两点：

- 截图识别第一次使用时，会下载约 10 MB 的识别引擎，建议在 Wi-Fi 下先试一次。
- 也可以在相册里用 iPhone 的「实况文本」拷贝文字，再粘贴进来，这种方式最准。

## 数据和隐私

- 记录保存在这台手机的 Safari 里。换手机或者清理 Safari 网站数据之前，先在「我的 → 导出备份」保存一份。
- 页面背景照片只存在手机里，不在备份文件中，换手机后需要重新设置。
- 程序里没有内置任何个人数据。首页的「看示例」载入的是虚构数据，随时可以清除。

## 更新

以后有新版本时，用新文件覆盖仓库里的旧文件即可，手机上的记录不受影响。打开页面时会自动取到新版本，少数情况下需要关掉再打开一次。

## 文件说明

- `index.html`：页面
- `js/`：程序
- `img/`：首页天空照片，二楞和发财的插画
- `fonts/`：数字字体 Newsreader
- `vendor/`：离线文字识别引擎 Tesseract.js 和中文识别数据
- `icons/`：主屏幕图标
- `sw.js`、`manifest.json`：离线缓存和「添加到主屏幕」

## 第三方组件

- [Tesseract.js](https://github.com/naptha/tesseract.js) 和 tesseract.js-core，Apache License 2.0，许可证见 `vendor/`
- 中文识别数据 chi_sim，来自 [tessdata_best](https://github.com/tesseract-ocr/tessdata_best)，Apache License 2.0
- [Newsreader](https://github.com/productiontype/Newsreader) 字体，SIL Open Font License 1.1，许可证见 `fonts/`

健康建议仅供参考，不能替代医生的诊疗意见。
