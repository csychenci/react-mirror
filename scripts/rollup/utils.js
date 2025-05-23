import path from 'path'
import fs from 'fs'
// typescirpt 的 plugin
import ts from 'rollup-plugin-typescript2'
// commonjs 的 plugin
import cjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'

const pkgPath = path.resolve(__dirname, '../../packages')
const distPath = path.resolve(__dirname, '../../dist/node_modules')

function resolvePkgPath(pkgName, isDist) {
  if (isDist) {
    return `${distPath}/${pkgName}`
  }
  return `${pkgPath}/${pkgName}`
}

function getPackageJSON(pkgName) {
  // 获取package.json文件
  const path = `${resolvePkgPath(pkgName)}/package.json`
  const str = fs.readFileSync(path, {
    encoding: 'utf-8'
  })
  return JSON.parse(str)
}

function getBaseRollupPlugins({
  alias = {
    __DEV__: true,
    preventAssignment: true
  },
  typescript = {},
} = {}) {
  return [replace(alias), cjs(), ts(typescript)]
}

export { resolvePkgPath, getPackageJSON, getBaseRollupPlugins }
