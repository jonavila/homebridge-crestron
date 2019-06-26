import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

const extensions = ['.ts', '.js'];

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs'
  },
  external: ['net'],
  plugins: [
    nodeResolve({ mainFields: ['module', 'main', 'jsnext:main'], extensions }),
    commonjs({ include: 'node_modules/**' }),
    babel({
      extensions,
      exclude: 'node_modules/**' // only transpile our source code
    })
  ]
};
