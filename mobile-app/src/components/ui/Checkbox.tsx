import React from 'react';
import { TouchableOpacity, View, StyleSheet, ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '@/theme';

interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  testID?: string;
}

export function Checkbox({
  checked,
  onPress,
  disabled = false,
  size = 'md',
  style,
  testID,
}: CheckboxProps) {
  const sizeValue = size === 'sm' ? 20 : size === 'lg' ? 28 : 24;
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      testID={testID}
      style={style}
    >
      <View
        style={[
          styles.box,
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius: borderRadius.sm,
          },
          checked && styles.checked,
          disabled && styles.disabled,
        ]}
      >
        {checked && (
          <Check
            size={iconSize}
            color={colors.white}
            strokeWidth={3}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    borderColor: colors.grey[400],
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  disabled: {
    opacity: 0.5,
  },
});
