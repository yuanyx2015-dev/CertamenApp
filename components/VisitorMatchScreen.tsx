import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export function VisitorMatchScreen() {
  return (
    <View style={styles.container}>
      {/* Centered Content */}
      <View style={styles.contentContainer}>
        {/* Title Text */}
        <Text style={styles.titleText}>Enter Friend's Name</Text>

        {/* Code Input Box */}
        <TextInput
          style={styles.input}
          placeholder="Type Here"
          placeholderTextColor="#6a6a6a"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  contentContainer: {
    width: '100%',
    gap: 24,
    alignItems: 'center',
  },
  titleText: {
    color: '#3a3a3a',
    fontSize: 22,
    letterSpacing: 0.5,
    fontWeight: '500',
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    width: '100%',
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});