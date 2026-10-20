Pod::Spec.new do |s|
  s.name         = 'MeshStreamP2P'
  s.version      = '1.0.0'
  s.summary      = 'MeshStream P2P playback URL bridge for React Native.'
  s.homepage     = 'https://github.com/Mesh-Stream/meshstream-p2p-react-native-sdk'
  s.license      = { :type => 'Apache-2.0' }
  s.author       = { 'MeshStream' => 'support@meshstream.net' }
  s.platforms    = { :ios => '13.0' }
  s.source       = { :git => 'https://github.com/Mesh-Stream/meshstream-p2p-react-native-sdk.git', :tag => s.version.to_s }
  s.source_files = 'ios/**/*.{h,m}'
  s.public_header_files = 'ios/MeshStreamP2P.h'
  s.private_header_files = 'ios/MeshStreamP2PValidation.h'
  s.dependency 'React-Core'
  s.dependency 'MeshStreamKit', '= 1.0.2'
  s.frameworks = 'Foundation', 'Network', 'Security'

  s.test_spec 'Validation' do |test_spec|
    test_spec.source_files = 'tests/ios/MeshStreamP2PValidationTests.m'
  end
end
