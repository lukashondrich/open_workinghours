import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';

export interface PickerOption {
  value: string;
  label: string;
}

interface PickerProps {
  label?: string;
  value: string | null;
  options: PickerOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  error?: string;
  testID?: string;
  containerStyle?: ViewStyle;
}

export function Picker({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select...',
  searchable = false,
  searchPlaceholder = 'Search...',
  error,
  testID,
  containerStyle,
}: PickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const expandAnim = useRef(new Animated.Value(0)).current;

  const toggle = useCallback(() => {
    const toValue = isOpen ? 0 : 1;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery('');
    }
    Animated.timing(expandAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isOpen, expandAnim]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onSelect(optionValue);
      setIsOpen(false);
      Animated.timing(expandAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
    },
    [onSelect, expandAnim],
  );

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = searchable && searchQuery
    ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  const maxHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, searchable ? 260 : Math.min(options.length * 48, 260)],
  });

  return (
    <View
      style={[styles.container, containerStyle]}
      accessible={false}
      collapsable={false}
    >
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        testID={testID}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${selectedOption?.label || placeholder}` : undefined}
        onPress={toggle}
        style={[
          styles.trigger,
          isOpen && styles.triggerOpen,
          error && styles.triggerError,
        ]}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.triggerText,
            !selectedOption && styles.triggerPlaceholder,
          ]}
          numberOfLines={1}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <ChevronDown
          size={20}
          color={colors.text.tertiary}
          style={isOpen ? styles.chevronRotated : undefined}
        />
      </TouchableOpacity>

      <Animated.View
        style={[styles.dropdown, { maxHeight }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        {searchable && (
          <View style={styles.searchContainer}>
            <TextInput
              testID={testID ? `${testID}-search` : undefined}
              accessible={true}
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        <FlatList
          data={filteredOptions}
          keyExtractor={(item) => item.value}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={testID ? `${testID}-option-${item.value}` : undefined}
              accessible={true}
              accessibilityRole="button"
              onPress={() => handleSelect(item.value)}
              style={[
                styles.option,
                item.value === value && styles.optionSelected,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.optionText,
                  item.value === value && styles.optionTextSelected,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No results</Text>
            </View>
          }
        />
      </Animated.View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.paper,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  triggerOpen: {
    borderColor: colors.primary[500],
    borderWidth: 2,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  triggerError: {
    borderColor: colors.error.main,
  },
  triggerText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  triggerPlaceholder: {
    color: colors.text.tertiary,
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  dropdown: {
    overflow: 'hidden',
    backgroundColor: colors.background.paper,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.primary[500],
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  searchInput: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.grey[100],
    borderRadius: borderRadius.sm,
  },
  option: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  optionSelected: {
    backgroundColor: colors.primary[50],
  },
  optionText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  optionTextSelected: {
    color: colors.primary[700],
    fontWeight: fontWeight.semibold,
  },
  emptyContainer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  error: {
    fontSize: fontSize.xs,
    color: colors.error.main,
    marginTop: spacing.xs,
  },
});
