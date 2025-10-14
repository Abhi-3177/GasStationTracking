import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import { Notification as NotificationType } from '../context/NotificationContext';

interface NotificationProps {
  notification: NotificationType;
  onDismiss: (id: string) => void;
}

const NOTIFICATION_TIMEOUT = 4000;

const Notification: React.FC<NotificationProps> = ({ notification, onDismiss }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-50);

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    translateY.value = withTiming(0, { duration: 300 });

    const timer = setTimeout(() => {
      handleDismiss();
    }, NOTIFICATION_TIMEOUT);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    opacity.value = withTiming(0, { duration: 300 });
    translateY.value = withTiming(-50, { duration: 300 });
    setTimeout(() => onDismiss(notification.id), 300);
  };

  const { type, message } = notification;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={24} color="#fff" />;
      case 'error':
        return <AlertTriangle size={24} color="#fff" />;
      case 'info':
        return <Info size={24} color="#fff" />;
      default:
        return null;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#059669'; // Green
      case 'error':
        return '#dc2626'; // Red
      case 'info':
        return '#2563eb'; // Blue
      default:
        return '#6b7280'; // Gray
    }
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: getBackgroundColor() }, containerStyle]}>
      <View style={styles.iconContainer}>{getIcon()}</View>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
        <X size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  iconContainer: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    marginLeft: 12,
    padding: 4,
  },
});

export default Notification;
