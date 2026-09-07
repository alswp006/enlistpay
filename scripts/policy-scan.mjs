#!/usr/bin/env node
// 토스 검수에서 **반려**되는 계약 위반을 잡는 정적 스캔. 의존성 0(순수 node ESM).
//
// scripts/forbidden-patterns.mjs와 역할이 다르다:
//   - forbidden-patterns: UI 품질(간격 리듬, 빈 placeholder, 맨텍스트 로딩) — 사람이 보는 완성도
//   - policy-scan(이 파일): 반려 사유 — 외부 SDK, 외부 이탈, HEX 하드코딩,
//     스토어 유도 문구, 프로모션 지급, TDS 인라인 여백
//
// 자기검출 방지가 이 파일의 설계 제약이다:
//   1) 디렉터리 스캔은 src의 .ts/.tsx만 본다 — 자기 자신이 있는 scripts/,
//      node_modules, dist, e2e, 밑줄(__) 디렉터리는 대상에서 제외.
//   2) 금지 토큰과 HEX 정규식은 **런타임에 조각을 합쳐** 만든다. 소스 어디에도
//      'stripe' 같은 완성된 토큰이나 hex 리터럴이 통째로 등장하지 않는다.
//   덕분에 `node scripts/policy-scan.mjs scripts/policy-scan.mjs`도 0건으로 통과한다.
//
// 사용: node scripts/policy-scan.mjs [스캔할 디렉터리 또는 파일]   (기본: <repo>/src)
// 종료 코드: 위반 0건이면 0, 1건이라도 있으면 1

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 토큰을 조각으로 나눠 합친다 — 소스에 완성 토큰이 남지 않게 하는 유일한 목적. */
const j = (...parts) => parts.join('');
/** 색상 리터럴 접두 문자. 정규식 소스에 직접 쓰면 자기 자신이 걸린다. */
const HASH = String.fromCharCode(35);
/** 한글 금지어도 코드포인트로 조립 — 메시지·규칙 어디에도 통짜로 두지 않는다. */
const kr = (...codes) => String.fromCharCode(...codes);

const SCAN_EXTENSIONS = /\.tsx?$/;
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'scripts',
  'e2e',
  'artifacts',
  'test-results',
  'playwright-report',
]);

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

/** `var(--tds-color-grey500, ...)`의 색상 폴백은 CSS 변수 정석 사용법이라 통과시킨다. */
function stripVarFallbacks(line) {
  return line.replace(/var\(\s*--[\w-]+\s*,[^)]*\)/g, 'var(--x)');
}

// 결제·인증·광고·분석 등 외부 SDK — 앱인토스는 자체 SDK만 허용(즉시 반려)
const FORBIDDEN_SDK = [
  [j('str', 'ipe'), 'Stripe'],
  [j('iam', 'port'), '아임포트'],
  [j('boot', 'pay'), '부트페이'],
  [j('@toss', 'payments'), '토스페이먼츠(미니앱은 IAP만)'],
  [j('ad', 'mob'), 'AdMob'],
  [j('ad', 'sense'), 'AdSense'],
  [j('kak', 'ao'), '카카오 SDK'],
  [j('nav', 'er'), '네이버 SDK'],
  [j('fire', 'base'), 'Firebase'],
  [j('@react', '-oauth'), '외부 OAuth'],
];

// TDS를 흉내 낸 외부 UI 라이브러리 — 검수 즉시 반려
// 짧은 토큰(mui·antd)은 경로 경계로 감싸 오탐을 막는다.
const bounded = (token) => new RegExp(`(^|[/\\-])@?${token}([/\\-]|$)`, 'i');
const FORBIDDEN_UI_LIB = [
  [(s) => s.toLowerCase().includes(j('shad', 'cn')), 'shadcn/ui'],
  [(s) => bounded(j('m', 'ui')).test(s), 'MUI'],
  [(s) => bounded(j('an', 'td')).test(s), 'Ant Design'],
  [(s) => s.toLowerCase().includes(j('@chakra', '-ui')), 'Chakra UI'],
];

// 외부 이탈 — 조각 조립으로 이 파일의 정규식 소스가 스스로 걸리지 않게 한다.
const OPEN_RE = new RegExp(`${j('win', 'dow')}\\s*\\.\\s*${j('op', 'en')}\\s*\\(`);
const LOCATION_RE = new RegExp(
  `(?:^|[^\\w$.])(?:(?:${j('win', 'dow')}|self|top|parent|globalThis|document)\\s*\\.\\s*)?` +
    `${j('loca', 'tion')}\\s*\\.\\s*(?:${j('hr', 'ef')}\\s*=|assign\\s*\\(|replace\\s*\\()`
);

// 스토어 유도 문구 — 한글 금지어를 코드포인트로 조립(자기검출 방지)
const INSTALL_WORDS = [kr(0xc124, 0xce58), kr(0xb2e4, 0xc6b4, 0xb85c, 0xb4dc)];

// 색상 리터럴(3·6자리) — `#`을 변수로 두어 이 줄 자체가 패턴에 걸리지 않는다.
const HEX_RE = new RegExp(`${HASH}(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\\b`);

// 프로모션 지급 호출 — 콘솔 코드·한도 확인이 필요해 리포트한다.
const PROMOTION_RE = new RegExp(`\\b${j('grant', 'PromotionReward')}\\s*\\(`);

// 인라인 style로 여백을 덮으면 내장 스타일이 깨지는 TDS 컴포넌트들
const TDS_COMPONENTS =
  'ListRow|Button|IconButton|TextField|Top|Chip|Switch|Checkbox|Paragraph|Spacing|Asset|BottomSheet|AlertDialog|Toast|Tab|Skeleton|FixedBottomCTA|Border|Badge|Loader|Dialog|Icon';
const TDS_SPACING_RE = new RegExp(`<(${TDS_COMPONENTS})[.\\w]*\\b[^>]*style=\\{\\{[^}]*(padding|margin)`);

const RULES = [
  {
    id: 'forbidden-sdk',
    message: '외부 SDK import — 결제는 IAP, 광고는 TossAds, 분석은 Analytics만 허용(검수 반려)',
    test: (line) => {
      for (const spec of moduleSpecifiers(line)) {
        const lower = spec.toLowerCase();
        const hit = FORBIDDEN_SDK.find(([token]) => lower.includes(token));
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
        const hit = FORBIDDEN_UI_LIB.find(([match]) => match(spec));
        if (hit) return hit[1];
      }
      return null;
    },
  },
  {
    id: 'external-nav',
    message: '외부 도메인 이탈 — 모든 흐름은 앱 안에서 처리해야 한다(검수 반려)',
    test: (line) => {
      if (OPEN_RE.test(line)) return j('win', 'dow.', 'op', 'en');
      if (LOCATION_RE.test(line)) return `${j('loca', 'tion')} 이동`;
      return null;
    },
  },
  {
    id: 'install-prompt',
    message: '앱 스토어 유도 문구 — 미니앱은 앱을 내려받게 권유할 수 없다(검수 반려)',
    test: (line) => INSTALL_WORDS.find((word) => line.includes(word)) ?? null,
  },
  {
    id: 'hardcoded-hex',
    message: '색상 하드코딩 — var(--tds-color-*) / var(--adaptive*) 사용(다크모드 깨짐)',
    test: (line) => stripVarFallbacks(line).match(HEX_RE)?.[0] ?? null,
  },
  {
    id: 'promotion-reward',
    message: '프로모션 지급 호출 — 콘솔 발급 코드·1인 누적 5,000원 한도 확인 필요',
    test: (line) => (PROMOTION_RE.test(line) ? j('grant', 'PromotionReward') : null),
  },
  {
    id: 'tds-inline-spacing',
    message: 'TDS 컴포넌트에 인라인 여백 — 내장 스타일이 깨진다. Spacing 컴포넌트 사용',
    test: (line) => {
      const m = line.match(TDS_SPACING_RE);
      return m ? `<${m[1]}> ${m[2]}` : null;
    },
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    // `__tests__`·`__helpers__` 등 밑줄 디렉터리·임시 파일은 제외 — 테스트 픽스처
    // 문자열이 스캔에 걸려 영구 실패하는 오탐을 막는다.
    if (entry.startsWith('__') || entry.startsWith('.') || SKIP_DIRS.has(entry)) continue;
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
  // 파일을 직접 지정하면 확장자와 무관하게 그 파일만 본다(자기 자신 검증용).
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
