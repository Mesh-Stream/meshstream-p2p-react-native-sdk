# React Native 0.76 uses fmt 11.0.2, whose consteval formatting fails with
# current Apple Clang. fmt supports C++17; React Native itself remains C++20.
def meshstream_ios_build_settings(installer)
  installer.pods_project.targets.each do |target|
    next unless target.name == 'fmt'

    target.build_configurations.each do |config|
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
    end
  end
end
