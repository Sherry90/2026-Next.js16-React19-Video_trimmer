import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettierRecommended from "eslint-plugin-prettier/recommended";

const eslintConfig = [
  {
    // 빌드 산출물·vendored 파일은 린트 제외
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "server.cjs",
      "public/ffmpeg/**",
      ".bin/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // 언더스코어 접두(`_`)는 "의도적으로 안 쓰는" 시그니처 유지용 파라미터/변수로 허용.
    // 그 외 미사용은 경고로 남겨 정리 대상을 노출한다.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // 반드시 마지막: Prettier 위반을 lint 에러로 강제(prettier/prettier) + 충돌 포맷 룰 비활성화.
  // → `npm run lint` 통과 = 포맷 통과. 두 게이트가 절대 갈리지 않는다.
  prettierRecommended,
];

export default eslintConfig;
