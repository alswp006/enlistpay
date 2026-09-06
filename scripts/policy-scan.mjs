#!/usr/bin/env node
// 검수 반려 사유 정적 스캔. 의존성 0(순수 node ESM).
//
// scripts/forbidden-patterns.mjs와 역할이 다르다:
//   - forbidden-patterns: UI 품질(간격 리듬, 빈 placeholder, 맨텍스트 로딩) — 사람이 보는 완성도
//   - policy-scan(이 파일): 토스 검수에서 **반려**되는 계약 위반 — 외부 SDK, 외부 이탈,
//     HEX 하드코딩, 설치 유도, 프로모션 지급, TDS 인라인 여백
// 두 스캔의 hex/external-nav 규칙은 의도적으로 겹친다. 게이트 하나가 빠져도 반려 사유는 걸려야 한다.
//
// 사용: node scripts/policy-scan.mjs [스캔할 디렉터리]   (기본: <repo>/src)
// 종료 코드: 위반 0건이면 0, 1건이라도 있으면 1

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCAN_EXTENSIONS = /\.(tsx?|jsx?|mjs|css)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', 'e2e']);

/** `// gate-allow:` 주석이 달린 줄은 의도적 예외로 통과시킨다(사유를 함께 적을 것). */
function hasAllowMarker(line) {
  return /\/\/\s*gate-allow:/.test(line);
}

/** 규칙을 **설명하는 주석**이 규칙 위반으로 잡히는 것을 막는다. */
function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--');
}

/** import/require/동적 import 줄에서 모듈 specifier만 뽑는다(변수명·JSX 텍스트 오탐 방지). */
function moduleSpecifiers(line) {
  if (!/\b(?:import|require)\b/.test(line)) return [];
  return [...line.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/** `var(--tds-color-grey500, #6B7684)`의 hex는 CSS 변수 **폴백**이라 정석 사용법이다. */
function stripVarFallbacks(line) {
  return line.replace(/var\(\s*--[\w-]+\s*,[^)]*\)/g, 'var(--x)');
}

// 결제·인증·광고·분석 등 외부 SDK — 앱인토스는 자체 SDK만 허용(즉시 반려)
const FORBIDDEN_SDK = [
  [/stripe/i, 'Stripe'],
  [/iamport/i, '아임포트'],
  [/bootpay/i, '부트페이'],
  [/@tosspayments/i, '토스페이먼츠(미니앱은 IAP만)'],
  [/admob/i, 'AdMob'],
  [/adsense/i, 'AdSense'],
  [/kakao/i, '카카오 SDK'],
  [/naver/i, '네이버 SDK'],
  [/firebase/i, 'Firebase'],
  [/@react-oauth/i, '외부 OAuth'],
];

// TDS를 흉내 낸 외부 UI 라이브러리 — 검수 즉시 반려
const FORBIDDEN_UI_LIB = [
  [/shadcn/i, 'shadcn/ui'],
  [/(^|[/\-])@?mui([/\-]|$)/i, 'MUI'],
  [/(^|[/\-])antd([/\-]|$)/i, 'Ant Design'],
  [/@chakra-ui/i, 'Chakra UI'],
];

// 인라인 style로 여백을 덮으면 내장 스타일이 깨지는 TDS 컴포넌트들
const TDS_COMPONENTS =
  'ListRow|Button|IconButton|TextField|Top|Chip|Switch|Checkbox|Paragraph|Spacing|Asset|BottomSheet|AlertDialog|Toast|Tab|Skeleton|FixedBottomCTA|Border|Badge|Loader|Dialog|Icon';

const RULES = [
  {
    id: 'forbidden-sdk',
    message: '외부 SDK import — 결제는 IAP, 광고는 TossAds, 분석은 Analytics만 허용(검수 반려)',
    test: (line) => {
      for (const spec of moduleSpecifiers(line)) {
        const hit = FORBIDDEN_SDK.find(([re]) => re.test(spec));
        if (hit) return hit[1];
      }
      return null;
    },
  },
  {
    id: 'forbidden-ui-lib',
    message: '외부 UI 라이브러리 import — 모든 UI는 @toss/tds-mobile로(검수 즉시 반려)',
    test: (line) => {
      for (const spec of moduleSpecifiers(line)) {
        const hit = FORBIDDEN_UI_LIB.find(([re]) => re.test(spec));
        if (hit) return hit[1];
      }
      return null;
    },
  },
  {
    id: 'external-nav',
    message: '외부 도메인 이탈(window.open / location.href) — 모든 흐름은 앱 안에서(검수 반려)',
    test: (line) =>
      /window\s*\.\s*open\s*\(/.test(line)
        ? 'window.open'
        : /(?:^|[^\w$.])(?:(?:window|self|top|parent|globalThis|document)\s*\.\s*)?location\s*\.\s*(?:href\s*=|assign\s*\(|replace\s*\()/.test(line)
          ? 'location 이동'
          : null,
  },
  {
    id: 'install-prompt',
    message: '앱 설치·다운로드 유도 문구 — 미니앱은 설치 유도 금지(검수 반려)',
    test: (line) => {
      const m = line.match(/설치|다운로드/);
      return m ? m[0] : null;
    },
  },
  {
    id: 'hardcoded-hex',
    message: 'HEX 색상 하드코딩 — var(--tds-color-*) / var(--adaptive*) 사용(다크모드 깨짐)',
    test: (line) => {
      const bare = stripVarFallbacks(line);
      const m = bare.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
      return m ? m[0] : null;
    },
  },
  {
    id: 'promotion-reward',
    message: 'grantPromotionReward 호출 — 콘솔 발급 코드·1인 누적 5,000원 한도 확인 필요',
    test: (line) => (/\bgrantPromotionReward\s*\(/.test(line) ? 'grantPromotionReward' : null),
  },
  {
    id: 'tds-inline-spacing',
    message: 'TDS 컴포넌트에 인라인 padding/margin — 내장 여백이 깨진다. Spacing 컴포넌트 사용',
    test: (line) => {
      const re = new RegExp(`<(${TDS_COMPONENTS})[.\\w]*\\b[^>]*style=\\{\\{[^}]*(padding|margin)`);
      const m = line.match(re);
      return m ? `<${m[1]}> ${m[2]}` : null;
    },
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    // `__tests__`·`__helpers__` 등 밑줄 디렉터리는 제외 — 테스트 픽스처 문자열이
    // 자기 스캔에 걸려 영구 실패하는 자기 오탐을 막는다.
    if (entry.startsWith('__') || SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXTENSIONS.test(entry)) out.push(full);
  }
  return out;
}

function scanFile(path) {
  const violations = [];
  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (isCommentLine(line) || hasAllowMarker(line)) return;
    for (const rule of RULES) {
      const detail = rule.test(line);
      if (detail) violations.push({ rule, line: i + 1, detail, text: line.trim().slice(0, 100) });
    }
  });
  return violations;
}

const root = resolve(process.argv[2] ?? join(fileURLToPath(new URL('..', import.meta.url)), 'src'));

let files = [];
try {
  files = statSync(root).isDirectory() ? walk(root) : [root];
} catch {
  console.error(`정책 스캔: 경로를 열 수 없습니다 — ${root}`);
  process.exit(1);
}

let total = 0;
console.log(`정책 스캔 — ${basename(root)} (파일 ${files.length}개)`);

for (const file of files) {
  const violations = scanFile(file);
  if (violations.length === 0) continue;
  const rel = relative(root, file) || basename(file);
  for (const v of violations) {
    total += 1;
    console.log(`\n✗ ${rel}:${v.line}  [${v.rule.id}] ${v.detail}`);
    console.log(`  ${v.text}`);
    console.log(`  → ${v.rule.message}`);
  }
}

if (total > 0) {
  console.log(`\n검수 반려 사유 ${total}건 — 고친 뒤 다시 실행하세요.`);
  process.exit(1);
}

console.log('통과 — 검수 반려 사유 0건');
