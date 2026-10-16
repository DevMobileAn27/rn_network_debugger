const disabled = process.env.RNV_DISABLE_AUTOLINK === '1';

module.exports = {
  dependency: {
    platforms: {
      ios: disabled
        ? null
        : {
            podspecPath: 'RNNetworkDebugger.podspec',
          },
      android: disabled
        ? null
        : {
            packageImportPath:
              'import com.reactnativeviewer.rnvnetwork.RNVNetworkDevPackage;',
            packageInstance: 'new RNVNetworkDevPackage()',
            sourceDir: './android',
          },
    },
  },
};
