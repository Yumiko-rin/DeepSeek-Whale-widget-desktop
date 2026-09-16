# 第三方素材与组件声明（THIRD_PARTY_NOTICES）

本仓库的**代码**按 MIT 许可（见 [`LICENSE`](LICENSE)）。本文件登记从其它项目引入的第三方资源与设计借鉴来源。
`frontend/assets/images/**`（角色美术）的既有说明见 [`PROVENANCE.md`](PROVENANCE.md)。

## 1. 音效（均为 MIT）

| 文件 | 来源 | 许可 |
| --- | --- | --- |
| `frontend/assets/audio/duck-press.mp3` / `duck-release.mp3` | 原 DSH 插件的 `Ya1.mp3` / `Ya2.mp3`（[MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)） | MIT |
| `frontend/assets/audio/fx1-press.mp3` / `fx1-release.mp3` | 同上（`D1.mp3` / `D2.mp3`） | MIT |
| `frontend/assets/audio/click.wav` | [MerZlin/dsh-pet-indesktop](https://github.com/MerZlin/dsh-pet-indesktop) 的 `assets/sounds/click.wav` | MIT |
| `frontend/assets/audio/agent-start.wav` / `agent-error.wav` / `agent-done.wav` | 同上，`assets/sounds/agent/*.wav` | MIT |

以上文件均取自 MIT 许可的仓库，本仓库保留其来源与许可说明。

## 2. 借鉴的设计（代码为本项目自行实现）

- **事件音效与按压音分离**、**单发音效组（点击音）**：思路参考 MerZlin/dsh-pet-indesktop 的
  「点击音效包 + Agent 联动音效」，落到本挂件自身真实存在的事件上（余额变化 / 刷新失败）。

## 3. 有意未引入的素材

- MerZlin/dsh-pet-indesktop 的 `assets/characters/**`：106 个 WebM 动画，角色 OC「溟月」出自画师**上善无形**，
  素材由社区成员整理。按其 `THIRD_PARTY_NOTICES.md`，该类同人素材属 **CC BY-NC-SA 类条款：仅限个人非商业使用、
  须保留署名与来源、不得用于任何商业/盈利场景**。
  本项目**未打包**这些素材——打包会让本仓库的美术资产一并落入非商业约束。如需要，请自行获取并遵守其条款。
