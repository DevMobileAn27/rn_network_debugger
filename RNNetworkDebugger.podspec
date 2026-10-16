Pod::Spec.new do |spec|
  spec.name         = 'RNNetworkDebugger'
  spec.version      = '0.4.6'
  spec.summary      = 'Dev-only iOS network capture bridge for React Native Viewer.'
  spec.description  = <<-DESC
  RNNetworkDebugger is a dev-only React Native library that captures
  network activity from JavaScript instrumentation and forwards the
  resulting events to React Native Viewer over a local WebSocket transport.
  DESC
  spec.homepage     = 'https://github.com/DevMobileAn27/rn_network_debugger'
  spec.license      = { :type => 'Apache-2.0', :file => 'LICENSE' }
  spec.author       = 'DevMobileAn27'
  spec.platform     = :ios, '13.0'
  spec.source       = { :git => 'https://github.com/DevMobileAn27/rn_network_debugger.git', :tag => "v#{spec.version}" }
  spec.source_files = 'ios/native/**/*.{h,m}'
  spec.requires_arc = true

  spec.dependency 'React-Core'

  spec.pod_target_xcconfig = {
    'GCC_PREPROCESSOR_DEFINITIONS[config=Debug]' => '$(inherited) DEBUG=1',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'gnu++17'
  }
end
