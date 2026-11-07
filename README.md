# L站舆情仪表（Chrome 扩展）

在 linux.do 页面上做**本地**文本分析：每层楼一个戾气分，主题页右侧一个面板，列表页一行一个标题分。不联网、不上传任何文本。

## 装

1. 打开 `chrome://extensions`
2. 右上角开「开发者模式」
3. 「加载已解压的扩展程序」→ 选这个目录（`~/projects/ld-sentiment`）
4. 打开任意 `https://linux.do/t/topic/...`，右下角出现面板

## 它给什么

- **主题页**：均分、P90、攻击性/阴阳条数、四档分布条、最刺的三条（点击跳楼）、每楼的 `戾气 NN` 标记（≥55 的楼层左侧红条）
- **列表页**：每行回复数旁一个分数（标题信号弱，按 0.6 折算，只是导航用）
- **本地累计**：按天、按分类存 `{帖数, 总分, 攻击性数, 阴阳数}`，只存计数，不存原文

## 两套判定，别混着看

| 头 | 依据 | 用途 |
|---|---|---|
| **戾气分**（规则） | 手写信号：指向人、贬义称谓、阴阳套话、反问、立场贬损、标点/emoji | 论坛日常语气，覆盖“不明骂但阴阳” |
| **强攻击**（模型） | 在 COLD 上训练的字符 2/3-gram + 可解释特征逻辑回归，p≥0.85 才亮 | 只在明确脏话/侮辱时标红，避免误伤 |

实测（COLD test, 5323 条，攻击性占比 39.6%）：

| 方法 | acc | prec | recall | F1 |
|---|---|---|---|---|
| 纯规则（阈值 10） | 0.672 | 0.709 | 0.290 | 0.412 |
| 逻辑回归 p≥0.5 | 0.702 | 0.595 | 0.778 | **0.674** |
| 逻辑回归 p≥0.85（扩展里用的档） | — | **0.889** | 0.228 | — |

参考与数据源：

- **COLD**（thu-coai/COLDataset，EMNLP 2022）：中文攻击性语言基准，Weibo 语料，`label 1=offensive`
- **ToxiCN**（DUT-lujunyu/ToxiCN，ACL 2023）：中文有毒语言层级标注 + `lexicon/{general,sexism,racism,region,LGBT}.json`，脏话/蔑称表按“无歧义”筛过再并入
- 反讽方向可用的公开集：**NTU-Irony-Corpus**、**Dataset_Chinese_Ciron**（尚未接入，规则里的阴阳词表是手工的）

## 规则头怎么打分

不是关键词黑名单，是**信号加权 + 指向判定**：

| 信号 | 权重 | 例子 |
|---|---|---|
| 指向人的攻击 | 40 | 「你这人」「你也配」「谁给你勇气」；词附近 14 字内出现 你/您/他/楼主 才算满权重，否则 ×0.45 |
| 贬义称谓 | 16 | 垃圾、小丑、水军、孝子；指向人时 ×1.6 |
| 阴阳套话 | 11 | 典、赢麻了、您可真、已严肃学习、说得对、多读点书 |
| 反问 | 7 | 凭什么、哪来的、这也叫 |
| 立场贬损 | 9 | 智商税、洗地、晦气、割韭菜 |
| 脏话 | 26 | 他妈的、傻逼、煞笔（词表 + `啥逼样` 这类变体正则） |
| 暴力威胁 | 30 | 邦邦两拳、揍你、弄死 |
| 居高临下 | 7 | 水硕、水中水、就这、自欺欺人、低能 |
| 问号密度 | 4 | 一句里 ≥2 个问号，最多叠两档 |
| 绝对化 / 阴阳 emoji / 标点轰炸 | 4 / 8 / 4 | 一点都…、🙃😅🤡、？？？ |

`raw` 累加后映射成 0–100（`100·(1-e^(-raw/60))`），分档：`<12 平和 / <30 有火药味 / <55 阴阳/对立 / ≥55 攻击性`。

**防误伤**：`垃圾佬` 先屏蔽（社区褒义）；`典`、`菜`、`绷` 用带边界正则；单字词不参与子串匹配。

## 已知限制（写清楚，别当判决）

0. **域偏移**：模型学的是微博骂战，论坛语气更温和。在本机 156 条真实论坛回复上，模型 p 的中位数 0.25、最高 0.61——所以它基本不会在正常帖上亮“强攻击”，但也意味着论坛里那种不带动词的反讽它抓不到，那部分仍靠规则头。
1. **反讽靠套路词**，遇到没有套路的冷嘲（纯陈述句）会漏；遇到「说得对」这种真心话会误伤，权重压得低。
2. **看不到的内容它也算不出**：被删的楼、TL2/TL3 才可见的帖、待审核的帖——扩展只读当前 DOM。
3. **列表页只有标题**，分数只能当热度参考。
4. 面板按页算，不做跨帖聚类；跨帖只看 `chrome.storage` 里的日/分类计数。

## 目录

```
manifest.json          MV3，只申请 storage + linux.do 权限
src/classifier.js      打分器（纯函数，可单测）
src/core.js            DOM 抽取 + 汇总
src/ui.js              面板、行内标记
src/content.js         入口：识别页面、串联、写存储
src/panel.css
src/model.js           COLD 训练的权重（200KB）
test/classifier.test.js  11 条单测（含对抗样例）
test/model.test.js       模型高置信档的行为测试
test/train.js            训练脚本（COLD → src/model.js）
test/eval-cold.js        规则头在 COLD 上的基线
test/compare.js          规则头 vs 模型在真实论坛语料上的对照
test/fixture.html        假 DOM 集成测试
test/real-harness.html   真实抓取页面的回放测试（?f=real-xxx.html）
test/real-topic.html     真实页面快照（匿名态）
```

## 重训

```bash
curl -L -o /tmp/cold/train.csv https://raw.githubusercontent.com/thu-coai/COLDataset/main/COLDataset/train.csv
curl -L -o /tmp/cold/dev.csv   .../dev.csv
curl -L -o /tmp/cold/test.csv  .../test.csv
/opt/homebrew/bin/node test/train.js /tmp/cold
```

## 测

```bash
/opt/homebrew/bin/node test/classifier.test.js
/opt/homebrew/bin/node test/model.test.js
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --dump-dom "file://$PWD/test/fixture.html" | grep '<pre id="out">'
```

## 数据与许可

- 代码 MIT。`src/model.js` 是在 **COLD**（thu-coai/COLDataset）上训练的派生权重，数据集仓库未声明许可证；若作者有异议，删掉 `src/model.js` 并运行 `test/train.js` 自行重训即可，规则头不受影响。
- 词表参考 **ToxiCN** 的 `lexicon/*.json`（ACL 2023），只取了其中无歧义条目。
- `test/real-*.html` 是从站内抓的页面快照，**不入库**（.gitignore），仅本地回归用。

## 想更准的话

最省事的一步是把 `classifier.js` 的 `score()` 输出（文本 + 特征）接到一个本地小模型/LLM 上做二分类，用人工标注的 200 条做校准；扩展本身不联网，所以要么手动导出 JSON，要么另外写一个只在本地跑的 API。
