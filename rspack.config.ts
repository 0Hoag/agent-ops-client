import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { rspack } from '@rspack/core';
import type { Configuration } from '@rspack/core';

const mode = process.env.RSPACK_MODE || 'local';
const root = process.cwd();
for (const envFile of ['.env', `.env.${mode}`, '.env.local']) {
  const envPath = path.resolve(root, envFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

const config: Configuration = {
  entry: './src/main.tsx',
  experiments: { css: true },
  output: { publicPath: '/' },
  resolve: { extensions: ['.tsx', '.ts', '.js'], alias: { '@': path.resolve(root, 'src') } },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'builtin:swc-loader',
          options: { jsc: { transform: { react: { runtime: 'automatic' } } } },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        type: 'css',
        use: [{ loader: 'postcss-loader', options: { postcssOptions: { config: './postcss.config.mjs' } } }],
      },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({ template: './index.html' }),
    new rspack.DefinePlugin({ 'process.env.APP_API_URL': JSON.stringify(process.env.APP_API_URL || '') }),
  ],
  devServer: { historyApiFallback: true, proxy: [{ context: ['/healthz'], target: 'http://localhost:8080' }] },
};
export default config;
