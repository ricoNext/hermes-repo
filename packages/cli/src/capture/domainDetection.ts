import type { ParsedSession } from "./types.js";

/**
 * 修复 4：领域自适应关键词
 * 自动检测项目领域，加载对应的领域特定关键词
 * 支持项目级别的自定义配置
 */

export interface DomainProfile {
  name: string;
  keywords: {
    zh: string[];
    en: RegExp[];
  };
  detectionPatterns: RegExp[];  // 自动识别是否这个领域
  weight: number;  // 0.5 - 1.5，权重倍数
}

// 内置领域profiles
const BUILTIN_DOMAINS: DomainProfile[] = [
  {
    name: "systems",
    keywords: {
      zh: [
        "内存",
        "指针",
        "堆栈",
        "缓冲区溢出",
        "竞态条件",
        "segfault",
        "内存泄漏",
      ],
      en: [
        /\bsegfault\b/i,
        /\bmemory\s+leak\b/i,
        /\bbuffer\s+overflow\b/i,
        /\brace\s+condition\b/i,
        /\bpointer\b/i,
        /\bheap\b/i,
      ],
    },
    detectionPatterns: [
      /Rust|C\+\+|unsafe|ptr|malloc|free|stack|heap/i,
    ],
    weight: 1.2,
  },
  {
    name: "devops",
    keywords: {
      zh: ["部署", "回滚", "扩容", "Pod", "集群", "监控"],
      en: [
        /\bdeployment\b/i,
        /\brollback\b/i,
        /\bscale\b/i,
        /\bpod\b/i,
        /\bcluster\b/i,
        /\bmonitoring\b/i,
      ],
    },
    detectionPatterns: [
      /Kubernetes|Docker|Terraform|Helm|CloudFormation|prometheus/i,
    ],
    weight: 1.1,
  },
  {
    name: "security",
    keywords: {
      zh: ["漏洞", "脱敏", "加密", "密钥", "认证", "授权"],
      en: [
        /\bvulnerability\b/i,
        /\bCVE\b/i,
        /\bencryption\b/i,
        /\bauthentication\b/i,
        /\bauthorization\b/i,
        /\bsecret\b/i,
      ],
    },
    detectionPatterns: [/security|auth|crypto|ssl|tls|hmac|oauth/i],
    weight: 1.3,  // 安全问题权重更高
  },
  {
    name: "datascience",
    keywords: {
      zh: ["模型", "训练", "过拟合", "超参数", "验证"],
      en: [
        /\bmodel\b/i,
        /\btraining\b/i,
        /\boverfitting\b/i,
        /\bhyperparameter\b/i,
        /\bvalidation\b/i,
      ],
    },
    detectionPatterns: [/tensorflow|pytorch|sklearn|numpy|pandas|jupyter/i],
    weight: 1.1,
  },
];

/**
 * 自动检测会话所属的领域
 * 优先检查关键词，如无匹配再检查detection patterns（代码特征）
 */
export function detectDomains(session: ParsedSession): DomainProfile[] {
  const fullText = [
    session.text,
    ...session.messages.map((m) => m.text),
  ].join("\n");

  // 首先检查是否有明确的领域关键词
  const matchedByKeyword = BUILTIN_DOMAINS.filter((profile) => {
    const lower = fullText.toLowerCase();
    // 检查中文关键词
    if (profile.keywords.zh.some((w) => lower.includes(w))) {
      return true;
    }
    // 检查英文关键词
    if (profile.keywords.en.some((re) => re.test(fullText))) {
      return true;
    }
    return false;
  });

  if (matchedByKeyword.length > 0) {
    return matchedByKeyword;
  }

  // 如果没有关键词匹配，再检查detection patterns（源代码特征）
  return BUILTIN_DOMAINS.filter((profile) =>
    profile.detectionPatterns.some((pattern) => pattern.test(fullText))
  );
}

/**
 * 检查会话中是否包含领域特定的关键词
 */
export function hasDomainSpecificKeyword(
  session: ParsedSession,
  domain: DomainProfile
): boolean {
  const lower = session.text.toLowerCase();

  // 检查中文关键词
  if (domain.keywords.zh.some((w) => lower.includes(w))) {
    return true;
  }

  // 检查英文关键词
  if (domain.keywords.en.some((re) => re.test(session.text))) {
    return true;
  }

  return false;
}

/**
 * 计算领域特定关键词的加权得分
 * 如果匹配多个领域，最高权重者胜
 */
export function getDomainSignalWeight(session: ParsedSession): number {
  const domains = detectDomains(session);

  if (domains.length === 0) {
    return 1.0;  // 无领域匹配，使用默认权重
  }

  // 找到权重最高的领域
  let maxWeight = 1.0;
  for (const domain of domains) {
    if (hasDomainSpecificKeyword(session, domain)) {
      maxWeight = Math.max(maxWeight, domain.weight);
    }
  }

  return maxWeight;
}

/**
 * 根据领域特定信号和通用信号计算综合信号强度
 * 返回 0-100 的分数
 */
export function computeDomainAwareScore(
  baseScore: number,
  session: ParsedSession
): number {
  const weight = getDomainSignalWeight(session);
  return Math.min(100, baseScore * weight);
}
