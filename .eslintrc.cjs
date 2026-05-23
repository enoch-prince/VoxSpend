module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2024: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  globals: {
    APP_VERSION: 'readonly',
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    extraFileExtensions: ['.vue'],
    ecmaVersion: 2024,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['vue', '@typescript-eslint', 'prettier'],
  rules: {
    'prettier/prettier': 'error',
    'vue/html-self-closing': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
  },
  settings: {
    'vue/setup-compiler-macros': true,
  },
  ignorePatterns: ['dist/', 'node_modules/', 'public/'],
}
