module.exports = function(api) {
  api.cache.using(() => process.env.NODE_ENV === 'development');

  const presets = [
    ['@babel/preset-env', { modules: false, targets: { node: 8 } }]
  ];

  const plugins = [
    'lodash',
    ['@babel/plugin-proposal-class-properties', { loose: true }]
  ];

  return {
    presets,
    plugins
  };
};
