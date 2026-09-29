import { Alert, AlertButton, Platform } from 'react-native';

/**
 * An options menu built on the native Alert.
 *
 * React Native's Android Alert shows AT MOST THREE buttons (the rest are
 * silently dropped, `Alert.js` → `buttons.slice(0, 3)`) and is NOT dismissable
 * by Back or tap-outside unless `cancelable` is set. A four-button menu with a
 * trailing "Cancel" therefore loses its Cancel and traps the user (found by
 * the Android E2E suite, 2026-09-28; the tracking-record long-press menu had
 * shipped that way).
 *
 * On Android: the 'cancel'-style button is dropped when there are more than
 * three, and the dialog is always cancelable (Back / tap-outside = cancel, and
 * the cancel button's onPress, if any, runs via onDismiss). iOS shows every
 * button as given.
 */
export function showOptionsAlert(title: string, message: string | undefined, buttons: AlertButton[]): void {
  if (Platform.OS !== 'android') {
    Alert.alert(title, message, buttons);
    return;
  }
  const cancel = buttons.find((b) => b.style === 'cancel');
  const shown = buttons.length > 3 ? buttons.filter((b) => b.style !== 'cancel') : buttons;
  Alert.alert(title, message, shown.slice(0, 3), {
    cancelable: true,
    onDismiss: () => cancel?.onPress?.(),
  });
}
