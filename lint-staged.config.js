export default {
  "*.{js,ts,tsx,json,md,mdx,yml,yaml,sol}": ["prettier --write"],
  "*.{ts,tsx,js}": ["eslint --fix --max-warnings=0"]
};
