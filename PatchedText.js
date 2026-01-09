// Patch for react-native-reanimated + React Native 0.71+ TextImpl issue
import * as React from 'react';
import { Text as RNText } from 'react-native';

// Wrap Text with forwardRef to make it compatible with createAnimatedComponent
const PatchedText = React.forwardRef((props, ref) => {
  return <RNText {...props} ref={ref} />;
});
PatchedText.displayName = 'PatchedText';

export default PatchedText;
