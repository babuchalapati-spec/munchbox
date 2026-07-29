const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: [
      /node-fetch/,
      /^crypto$/,
      /^fs$/,
      /^path$/,
      /^stream$/,
      /^util$/,
      /^events$/,
      /^buffer$/,
      /^os$/,
      /^net$/,
      /^http$/,
      /^https$/,
      /^zlib$/,
      /^dgram$/,
      /^dns$/,
      /^domain$/,
      /^querystring$/,
      /^repl$/,
      /^tls$/,
      /^v8$/,
      /^vm$/,
    ]
  }
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
