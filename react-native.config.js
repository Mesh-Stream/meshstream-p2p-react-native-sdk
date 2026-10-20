module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import net.meshstream.reactnative.MeshStreamP2PPackage;',
        packageInstance: 'new MeshStreamP2PPackage()',
      },
    },
  },
};
