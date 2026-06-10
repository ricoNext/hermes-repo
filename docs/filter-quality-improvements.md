# 过滤质量门槛的深度优化方案

## 当前设计的 4 个盲点

### 1. 语言混用导致的信号词覆盖不全

**现象：**
```typescript
const CHINESE_STRONG_SIGNALS = ["修复", "因为", "改成", ...]  // 中文列表
const ENGLISH_STRONG_SIGNAL_PATTERNS = [/\bfix\b/i, ...]      // 英文列表
```

**问题：**
- 混合语言项目（如中文代码注释 + 英文讨论）可能只有一半被检测到
- 假设项目用中文讨论，但代码写成 `// FIXME: xxx`，过滤器看不到信号
- 不同地区团队可能用完全不同的词汇表达同一概念
  - 中文："修复" vs "改正" vs "纠正" vs "fix"
  - 英文："fix" vs "correct" vs "resolve" vs "bugfix"

**改进方案 A：动态关键词库**

```typescript
// 支持项目级别配置，可扩展
interface FilterConfig {
  // 基础（内置）
  strongSignals: {
    zh: string[];
    en: RegExp[];
  };
  // 项目自定义（覆盖基础）
  customSignals?: {
    zh?: string[];
    en?: RegExp[];
  };
  // 领域特定词汇（追加，不覆盖）
  domainSignals?: {
    zh?: string[];
    en?: RegExp[];
  };
}

// 使用示例
const config: FilterConfig = {
  strongSignals: { /* 内置 */ },
  domainSignals: {
    zh: ["脱敏", "加密", "密钥轮换"],  // 安全相关
    en: [/\bkey rotation\b/i, /\bsecret management\b/i]
  }
};
```

**改进方案 B：自动语言检测 + 智能匹配**

```typescript
function detectLanguage(text: string): 'zh' | 'en' | 'mixed' {
  const zhCount = (text.match(/[一-鿿]/g) || []).length;
  const enCount = (text.match(/[a-zA-Z]+/g) || []).length;
  if (zhCount > enCount * 2) return 'zh';
  if (enCount > zhCount * 2) return 'en';
  return 'mixed';
}

function hasStrongSignal(text: string, config: FilterConfig): boolean {
  const lang = detectLanguage(text);
  const lower = text.toLowerCase();
  
  // 根据语言偏好调整优先级
  if (lang === 'zh' || lang === 'mixed') {
    if (config.strongSignals.zh.some(w => lower.includes(w))) return true;
  }
  if (lang === 'en' || lang === 'mixed') {
    if (config.strongSignals.en.some(re => re.test(text))) return true;
  }
  
  // 可选：混合语言时同时检查两个列表
  return false;
}
```

---

### 2. 隐含假设：关键词必然在文本中

**现象：**
```typescript
// 假设：有价值的内容会明确包含关键词
hasStrongSignal(session.text)  // 只看有没有"修复"、"改成"等词
```

**问题：**
- AI 生成的 structured output（JSON/YAML）不含关键词
  ```json
  {
    "type": "decision",      // 结构化字段，not in text
    "category": "architecture",
    "recommendation": "Use pattern X instead of Y"
  }
  ```
- 用户通过 Slack 反应（👍/👎）而不是文本描述
- 代码审查通过 GitHub 的 "Request Changes" 而不是具体说"改成"
- 某些项目的 AI 助手被训练成"简洁回复"，避免重复关键词

**改进方案 A：多源信号融合**

```typescript
interface SessionMetadata {
  // 基础
  messages: SessionMessage[];
  text: string;
  fileChanges: number;
  toolCalls: number;
  
  // 结构化信号（来自 parsed output）
  hasDecision?: boolean;
  hasConflict?: boolean;
  hasUserApproval?: boolean;
  userSentiment?: 'positive' | 'negative' | 'neutral';
  
  // 外部信号（来自 IDE / platform）
  hasUserReaction?: 'thumbsup' | 'thumbsdown' | 'confused';
  hasCodeReview?: 'approved' | 'changes_requested' | 'commented';
}

function hasStrongSignal(session: SessionMetadata): boolean {
  // 文本信号（原有逻辑）
  if (textHasKeyword(session.text)) return true;
  
  // 结构化信号
  if (session.hasDecision || session.hasConflict) return true;
  
  // 外部信号
  if (session.userSentiment === 'negative') return true;  // 用户不满意
  if (session.hasCodeReview === 'changes_requested') return true;
  if (session.hasUserReaction === 'thumbsdown') return true;
  
  return false;
}
```

**改进方案 B：句子级别的语义分析**

```typescript
// 不只看有没有关键词，而是看句子结构
function hasSemanticDecision(text: string): boolean {
  // 模式 1: "应该/不应该 + 动词"
  if (/应该|不应该|should|shouldn't/.test(text) && 
      /用|使用|改|改成|改为|change|use|switch/i.test(text)) {
    return true;
  }
  
  // 模式 2: "用 X 而不是 Y"
  if (/而不是|instead of|rather than/i.test(text)) {
    return true;
  }
  
  // 模式 3: "这样不对，应该..."
  if (/不对|错了|wrong|incorrect/.test(text) && 
      /应该|should/i.test(text)) {
    return true;
  }
  
  return false;
}

function hasUserCorrectionSemantics(session: SessionMetadata): boolean {
  return session.messages.some((m, idx) => {
    if (m.role !== 'user') return false;
    
    // 是否是对前一条 AI 回复的否定
    if (idx > 0 && session.messages[idx - 1].role === 'assistant') {
      return /不对|错了|wrong|no|that's not|incorrect/i.test(m.text);
    }
    
    return false;
  });
}
```

---

### 3. 领域盲区：不同领域的信号词完全不同

**现象：**
```typescript
// 通用列表只能覆盖常见场景
const SIGNALS = ["修复", "改成", "架构", ...]
```

**问题：**
- **底层系统编程**：关键词应该是 `segfault`, `memory leak`, `buffer overflow`, `GC`, `allocation`
- **DevOps/基础设施**：`deployment`, `rollback`, `scale`, `pod`, `cluster`, `monitoring`
- **数据科学**：`model`, `training`, `overfitting`, `hyperparameter`, `validation`
- **安全审计**：`vulnerability`, `CVE`, `exploit`, `authentication`, `encryption`, `key rotation`
- **金融系统**：`transaction`, `settlement`, `reconciliation`, `audit trail`, `compliance`

通用列表对这些领域完全无效。

**改进方案：自适应领域检测**

```typescript
interface DomainProfile {
  name: string;
  keywords: {
    zh: string[];
    en: RegExp[];
  };
  detectionPatterns: RegExp[];  // 自动识别是否这个领域
  weight: number;  // 0.5 - 1.5，权重倍数
}

const domainProfiles: DomainProfile[] = [
  {
    name: 'systems',
    keywords: {
      zh: ['内存', '指针', '堆栈', '缓冲区溢出', '竞态条件'],
      en: [/\bsegfault\b/i, /\bmemory leak\b/i, /\bbuffer overflow\b/i, /\brace condition\b/i]
    },
    detectionPatterns: [/Rust|C\+\+|unsafe|ptr|malloc|free/i],
    weight: 1.2
  },
  {
    name: 'devops',
    keywords: {
      zh: ['部署', '回滚', '扩容', 'Pod', '集群', '监控'],
      en: [/\bdeployment\b/i, /\brollback\b/i, /\bscale\b/i, /\bpod\b/i]
    },
    detectionPatterns: [/Kubernetes|Docker|Terraform|Helm|CloudFormation/i],
    weight: 1.1
  },
  {
    name: 'security',
    keywords: {
      zh: ['漏洞', '脱敏', '加密', '密钥', '认证'],
      en: [/\bvulnerability\b/i, /\bCVE\b/i, /\bencryption\b/i, /\bauthentication\b/i]
    },
    detectionPatterns: [/security|auth|crypto|ssl|tls|hmac/i],
    weight: 1.3  // 安全问题权重更高
  },
];

function autoDetectDomain(session: SessionMetadata): DomainProfile[] {
  const fullText = [
    session.text,
    ...session.messages.map(m => m.text)
  ].join('\n');
  
  return domainProfiles.filter(profile =>
    profile.detectionPatterns.some(pattern => pattern.test(fullText))
  );
}

function hasStrongSignal(session: SessionMetadata): boolean {
  const domains = autoDetectDomain(session);
  
  for (const domain of domains) {
    const lower = session.text.toLowerCase();
    if (domain.keywords.zh.some(w => lower.includes(w))) {
      return true;  // 命中领域特定信号
    }
    if (domain.keywords.en.some(re => re.test(session.text))) {
      return true;
    }
  }
  
  // 回退到通用信号
  return hasGenericStrongSignal(session);
}
```

---

### 4. 真正的无用过滤没做：只看信号词，不看"用户是否满意"

**现象：**
```typescript
// 只看有没有关键词出现
const hasCorrection = CORRECTION_RE.test(text);
// 但没有判断：这个纠正是有效的吗？用户满意了吗？
```

**问题：**
- AI 被纠正 3 次，但每次都改错了 → 这条对话**无价值**，应该丢弃
- 用户说"不对"，但后来又说"其实之前那个也行" → 虚假的否定
- 长对话中出现 1 次纠正，但其他部分都是废话 → 虚高的价值判断
- 用户和 AI 陷入"改来改去"循环，没有最终确定方案 → 不稳定的记忆

**改进方案 A：对话走向分析**

```typescript
interface CorrectionTrajectory {
  corrections: number;
  converged: boolean;  // 最后达成共识了吗
  finalResolution: 'accepted' | 'rejected' | 'undecided' | 'deferred';
  userSatisfaction: 'high' | 'medium' | 'low' | 'unknown';
}

function analyzeCorrectionTajectory(session: SessionMetadata): CorrectionTrajectory {
  let corrections = 0;
  let lastUserMessage = '';
  let converged = false;
  let finalResolution: 'accepted' | 'rejected' | 'undecided' | 'deferred' = 'undecided';
  
  for (let i = session.messages.length - 1; i >= Math.max(0, session.messages.length - 5); i--) {
    const msg = session.messages[i];
    
    if (msg.role === 'user') {
      lastUserMessage = msg.text;
      
      // 判断最后的态度
      if (/不对|错了|改成|改为|应该/i.test(msg.text)) {
        corrections++;
        finalResolution = 'rejected';
      } else if (/好的|可以|就这样|同意|好|对|yes|ok|sounds good/i.test(msg.text)) {
        converged = true;
        finalResolution = 'accepted';
      } else if (/再想想|等等|先不改|暂时/i.test(msg.text)) {
        finalResolution = 'deferred';
      }
      
      break;  // 只看最后一条用户消息
    }
  }
  
  // 判断用户满意度
  let userSatisfaction: 'high' | 'medium' | 'low' | 'unknown' = 'unknown';
  if (converged) {
    userSatisfaction = corrections === 0 ? 'high' : 'medium';
  } else if (corrections > 2) {
    userSatisfaction = 'low';
  }
  
  return { corrections, converged, finalResolution, userSatisfaction };
}

function shouldCaptureWithTrajectory(session: SessionMetadata): boolean {
  // 基础检查
  if (hasStrongSignal(session)) return true;
  
  // 对话走向分析
  const trajectory = analyzeCorrectionTajectory(session);
  
  // 被纠正但最后没有收敛 → 价值低
  if (trajectory.corrections > 0 && !trajectory.converged) {
    // 多次纠正但没有解决 → 可能是有问题的交互，需要记录来改进 AI
    if (trajectory.corrections > 2) {
      return false;  // 或者标记为"低置信度"
    }
  }
  
  // 最后用户明确同意 → 高价值
  if (trajectory.finalResolution === 'accepted') {
    return true;
  }
  
  // 其他逻辑...
  return session.fileChanges > 0 && session.messages.length >= 3;
}
```

**改进方案 B：质量置信度评分**

```typescript
interface CaptureQualityScore {
  score: 0 - 100;
  reason: string;
  signals: {
    textSignal: number;      // 0-30
    structuralSignal: number; // 0-30
    userSatisfaction: number; // 0-30
    complexity: number;       // 0-10
  };
  recommendation: 'capture' | 'review' | 'skip';
}

function scoreCaptureQuality(session: SessionMetadata): CaptureQualityScore {
  let score = 0;
  const signals = {
    textSignal: 0,
    structuralSignal: 0,
    userSatisfaction: 0,
    complexity: 0
  };
  
  // 文本信号 (0-30)
  if (hasStrongSignal(session)) {
    signals.textSignal = 30;
  } else if (hasWeakSignal(session)) {
    signals.textSignal = 15;
  }
  
  // 结构信号 (0-30)
  signals.structuralSignal = Math.min(30, 
    (session.fileChanges > 0 ? 10 : 0) +
    (session.toolCalls > 5 ? 10 : 0) +
    (session.messages.length >= 5 ? 10 : 0)
  );
  
  // 用户满意度 (0-30)
  const trajectory = analyzeCorrectionTajectory(session);
  if (trajectory.finalResolution === 'accepted') {
    signals.userSatisfaction = 30;
  } else if (trajectory.finalResolution === 'rejected') {
    signals.userSatisfaction = 5;
  } else if (trajectory.finalResolution === 'deferred') {
    signals.userSatisfaction = 10;
  } else {
    signals.userSatisfaction = 15;
  }
  
  // 复杂度加权 (0-10)
  signals.complexity = Math.min(10, (session.messages.length - 2) / 2);
  
  score = 
    signals.textSignal +
    signals.structuralSignal +
    signals.userSatisfaction +
    signals.complexity;
  
  // 转换为推荐
  let recommendation: 'capture' | 'review' | 'skip';
  if (score >= 60) {
    recommendation = 'capture';
  } else if (score >= 40) {
    recommendation = 'review';  // 边界情况，可 LLM 判断
  } else {
    recommendation = 'skip';
  }
  
  return {
    score,
    reason: `text:${signals.textSignal} + struct:${signals.structuralSignal} + satisfaction:${signals.userSatisfaction} + complexity:${signals.complexity}`,
    signals,
    recommendation
  };
}
```

---

## 综合改进方案

### 实现建议（按优先级）

**Phase 1（v0.3）：多源信号融合 + 质量评分**
```typescript
// src/capture/qualityScore.ts（新文件）
export function scoreCaptureQuality(session: SessionMetadata): CaptureQualityScore
export function analyzeUserSatisfaction(session: SessionMetadata): UserSatisfactionAnalysis

// src/capture/shouldCapture.ts（改进）
export function shouldCapture(session: SessionMetadata): boolean {
  const score = scoreCaptureQuality(session);
  return score.recommendation === 'capture';
}
```

**Phase 2（v0.4）：动态领域检测 + 自定义配置**
```typescript
// .memory/config.json 扩展
{
  "filter": {
    "mode": "auto" | "strict" | "lenient",
    "customDomains": [...],
    "customSignals": {...}
  }
}

// src/capture/domainDetection.ts（新文件）
export function autoDetectDomain(session: SessionMetadata): DomainProfile[]
```

**Phase 3（v0.5）：用户反馈微调**
```typescript
// 允许用户标记某条捕获为"应该丢弃"
// 系统学习：如果某类型的会话经常被标记为无用，
// 自动调整过滤器参数
```

---

## 短期快速赢（可立即实现）

### 改进 1：添加"部分否定"检测

当前：用户说"不对"就标记为纠正。
改进：检查后续是否有"其实可以"、"先这样"等软化措辞。

```typescript
function hasUserCorrectionWithoutConvergence(session: SessionMetadata): boolean {
  for (let i = 0; i < session.messages.length; i++) {
    if (session.messages[i].role === 'user' && /不对|错了/i.test(session.messages[i].text)) {
      // 检查后续消息是否"撤回"了这个纠正
      for (let j = i + 1; j < session.messages.length; j++) {
        if (session.messages[j].role === 'user' && 
            /其实|算了|先这样|也行|暂时/i.test(session.messages[j].text)) {
          return false;  // 纠正被软化了
        }
      }
      return true;
    }
  }
  return false;
}
```

### 改进 2：文件修改类型权重

不是所有文件修改都等价。

```typescript
function scoreFileModifications(session: SessionMetadata, fileChanges: FileChange[]): number {
  let score = 0;
  
  for (const file of fileChanges) {
    if (isConfigFile(file.path)) score += 2;     // 配置/架构相关
    else if (isTestFile(file.path)) score += 1;   // 测试文件
    else if (isDocFile(file.path)) score += 3;    // 文档 = 高价值
    else score += 1;                               // 代码文件
  }
  
  return Math.min(10, score);
}
```

### 改进 3：消息角色分析

不只数消息条数，更要看**谁在说什么**。

```typescript
function analyzeMessagePattern(session: SessionMetadata): 'clarification' | 'iteration' | 'decision' | 'exploration' {
  let userCorrections = 0;
  let aiRevisions = 0;
  
  for (const msg of session.messages) {
    if (msg.role === 'user' && /不对|改|改成/i.test(msg.text)) {
      userCorrections++;
    }
    if (msg.role === 'assistant' && hasApology(msg.text)) {
      aiRevisions++;
    }
  }
  
  // 迭代多次但最后收敛 = decision（高价值）
  if ((userCorrections + aiRevisions) >= 3 && hasConvergence(session)) {
    return 'decision';
  }
  
  // 多次修改但没有结论 = exploration（低价值）
  if ((userCorrections + aiRevisions) >= 3 && !hasConvergence(session)) {
    return 'exploration';
  }
  
  // 一两次改动 = clarification（中等价值）
  return 'clarification';
}
```

---

## 配置示例

项目可以在 `.memory/config.json` 中自定义过滤策略：

```json
{
  "version": 1,
  "filter": {
    "mode": "balanced",
    "scoreThreshold": 50,
    "signals": {
      "strongWeight": 1.0,
      "weakWeight": 0.5
    },
    "domainAware": true,
    "trackUserSatisfaction": true,
    "customDomains": [
      {
        "name": "database_migrations",
        "keywords": ["migration", "schema", "alter table", "backfill"],
        "weight": 1.3
      }
    ]
  }
}
```

