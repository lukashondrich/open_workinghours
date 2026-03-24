import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
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
  subtitle?: string;
  pinned?: boolean;
}

interface PickerProps {
  label?: string;
  value: string | null;
  options: PickerOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchMinChars?: number;
  searchHint?: string;
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
  searchMinChars = 0,
  searchHint,
  error,
  testID,
  containerStyle,
}: PickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const expandAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  const open = useCallback(() => {
    if (isOpen) return;
    setIsOpen(true);
    setSearchQuery('');
    Animated.timing(expandAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isOpen, expandAnim]);

  const close = useCallback(() => {
    if (!isOpen) return;
    setIsOpen(false);
    setSearchQuery('');
    searchInputRef.current?.blur();
    Animated.timing(expandAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [isOpen, expandAnim]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
      if (searchable) {
        // Focus the input after opening
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
  }, [isOpen, open, close, searchable]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onSelect(optionValue);
      close();
    },
    [onSelect, close],
  );

  const selectedOption = options.find((o) => o.value === value);

  const meetsMinChars = !searchMinChars || searchQuery.length >= searchMinChars;
  const pinnedOptions = options.filter((o) => o.pinned);
  const regularOptions = options.filter((o) => !o.pinned);

  const filteredOptions = (() => {
    if (!searchable) return options;
    // When searchMinChars is set and not met, only show pinned options
    if (searchMinChars > 0 && !meetsMinChars) return pinnedOptions;
    // Filter regular options by search query, always include pinned
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matched = regularOptions.filter(
        (o) =>
          o.label.toLowerCase().includes(query) ||
          (o.subtitle && o.subtitle.toLowerCase().includes(query)),
      );
      return [...matched, ...pinnedOptions];
    }
    return options;
  })();

  const maxHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, searchable ? 260 : Math.min(options.length * 48, 260)],
  });

  // Display text for the trigger
  const displayText = selectedOption
    ? selectedOption.subtitle
      ? `${selectedOption.label} — ${selectedOption.subtitle}`
      : selectedOption.label
    : placeholder;

  return (
    <View
      style={[styles.container, containerStyle]}
      accessible={false}
      collapsable={false}
    >
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Trigger: TextInput for searchable, TouchableOpacity for regular */}
      {searchable ? (
        <TouchableOpacity
          testID={testID}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={label ? `${label}: ${displayText}` : undefined}
          onPress={toggle}
          style={[
            styles.trigger,
            isOpen && styles.triggerOpen,
            error && styles.triggerError,
          ]}
          activeOpacity={1}
        >
          {isOpen ? (
            <TextInput
              ref={searchInputRef}
              testID={testID ? `${testID}-search` : undefined}
              accessible={true}
              style={styles.triggerInput}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : (
            <Text
              style={[
                styles.triggerText,
                !selectedOption && styles.triggerPlaceholder,
              ]}
              numberOfLines={1}
            >
              {displayText}
            </Text>
          )}
          <ChevronDown
            size={20}
            color={colors.text.tertiary}
            style={isOpen ? styles.chevronRotated : undefined}
          />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          testID={testID}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={label ? `${label}: ${displayText}` : undefined}
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
            {displayText}
          </Text>
          <ChevronDown
            size={20}
            color={colors.text.tertiary}
            style={isOpen ? styles.chevronRotated : undefined}
          />
        </TouchableOpacity>
      )}

      <Animated.View
        style={[styles.dropdown, { maxHeight }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <ScrollView
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          {searchMinChars > 0 && !meetsMinChars && searchHint ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.hintText}>{searchHint}</Text>
            </View>
          ) : filteredOptions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No results</Text>
            </View>
          ) : null}
          {filteredOptions.map((item) => (
            <TouchableOpacity
              key={item.value}
              testID={testID ? `${testID}-option-${item.value}` : undefined}
              accessible={true}
              accessibilityRole="button"
              onPress={() => handleSelect(item.value)}
              style={[
                styles.option,
                item.value === value && styles.optionSelected,
                item.pinned && styles.optionPinned,
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
              {item.subtitle && (
                <Text
                  style={[
                    styles.optionSubtitle,
                    item.value === value && styles.optionSubtitleSelected,
                  ]}
                  numberOfLines={1}
                >
                  {item.subtitle}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
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
  triggerInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
    padding: 0,
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
  optionSubtitle: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  optionSubtitleSelected: {
    color: colors.primary[500],
  },
  optionPinned: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  emptyContainer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  hintText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  error: {
    fontSize: fontSize.xs,
    color: colors.error.main,
    marginTop: spacing.xs,
  },
});
