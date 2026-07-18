import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  // 반드시 마지막: Prettier와 충돌하는 포맷팅 룰 비활성화
  prettier,
];

export default eslintConfig;
