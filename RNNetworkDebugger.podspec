Pod::Spec.new do |spec|
  spec.name         = 'RNNetworkDebugger'
  spec.version      = '0.3.0'
  spec.summary      = 'Dev-only iOS network capture bridge for React Native Viewer.'
  spec.description  = <<-DESC
  RNNetworkDebugger is a dev-only React Native library that captures
  network activity from JavaScript instrumentation and forwards the
  resulting events to React Native Viewer over a local WebSocket transport.
  DESC
  spec.homepage     = 'https://local.dev/rn_network_debugger'
  spec.license      = { :type => 'MIT', :text => 'Internal development use only.' }
  spec.author       = { 'OpenAI Codex' => 'codex@example.invalid' }
  spec.platform     = :ios, '13.0'
  spec.source       = { :path => '.' }
  spec.source_files = 'ios/native/**/*.{h,m}'
  spec.requires_arc = true

  spec.dependency 'React-Core'

  spec.pod_target_xcconfig = {
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) RNV_NETWORK_DEV_ENABLED=1',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'gnu++17'
  }
end
