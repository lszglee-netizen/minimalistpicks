# 把图片放这里

这个文件夹是放你**本地图片**的地方（不是外链图）。

## 怎么用

1. 把图片文件（`.jpg`、`.png`、`.webp`）拖进这个文件夹
   建议按文章 slug 建子文件夹，比如 `images/bamboo-stand/photo-1.jpg`

2. 在 `.md` 文章里这样引用：

   ```markdown
   ![图片描述](images/bamboo-stand/photo-1.jpg)
   ```

   `图片描述` 那段是 alt 文本，给视障读者 + 搜索引擎看的，建议认真写。

## 图片建议

- **尺寸**：宽度 1200–1600px 足够。再大没必要，加载慢
- **格式**：照片用 `.jpg`（小），透明背景用 `.png`；现代浏览器都支持 `.webp`（体积最小，推荐）
- **大小**：单张控制在 200KB 以内。可以用 [tinypng.com](https://tinypng.com) 在线压缩
- **命名**：纯小写英文 + 短横线，不要中文、空格、大写

## 也可以不用本地图

直接用外链图（比如 Unsplash 上的免费图）也完全可以：

```markdown
![A wooden desk](https://images.unsplash.com/photo-xxxxx?w=1200)
```

外链优势：免费、不占仓库空间；劣势：依赖图床、可能哪天失效。

混着用也行 —— 封面图用 Unsplash 高质图，正文用自己拍的实物图。
