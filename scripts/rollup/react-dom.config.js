import {
  resolvePkgPath,
  getPackageJSON,
  getBaseRollupPlugins
} from './utils';
import generatePackageJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';

const { name, module, peerDependencies } =
  getPackageJSON('react-dom');
// react-dom 包的路径
const pkgPath = resolvePkgPath(name);
// react-dom 产物路径
const pkgDistPath = resolvePkgPath(name, true);

export default [
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${pkgDistPath}/index.js`,
        name: 'index.js',
        format: 'umd'
      },
      {
        file: `${pkgDistPath}/client.js`,
        name: 'client.js',
        format: 'umd'
      }
    ],
    external: [...Object.keys(peerDependencies), 'scheduler'],
    plugins: [
      ...getBaseRollupPlugins(),
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`,
        }
      }),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: pkgDistPath,
        baseContents: ({
          name,
          description,
          version
        }) => ({
          name,
          version,
          description,
          main: 'index.js',
          peerDependencies: {
            react: version
          }
        })
      })
    ]
  }
];
