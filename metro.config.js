const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Handle react-i18next ICU module resolution
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle the ICU module that doesn't exist in React Native
  if (moduleName === './IcuTransWithoutContext.js' || moduleName === './IcuTransWithoutContext') {
    return {
      type: 'empty',
    };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

