import React from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';

// Catches any render/runtime error in the tree below it and shows the message on screen,
// instead of the app silently closing on launch. Without this, a JS error in release
// builds just kills the process with no clue why.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {error: null};
  }

  static getDerivedStateFromError(error) {
    return {error};
  }

  render() {
    if (this.state.error) {
      const e = this.state.error;
      return (
        <ScrollView contentContainerStyle={styles.wrap}>
          <Text style={styles.title}>Something went wrong on startup</Text>
          <Text style={styles.msg}>{String(e && e.message ? e.message : e)}</Text>
          {e && e.stack ? <Text style={styles.stack}>{String(e.stack)}</Text> : null}
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff'},
  title: {fontSize: 18, fontWeight: '700', color: '#c62828', marginBottom: 12},
  msg: {fontSize: 14, color: '#2c2420', marginBottom: 16},
  stack: {fontSize: 11, color: '#776b63', fontFamily: 'monospace'},
});
