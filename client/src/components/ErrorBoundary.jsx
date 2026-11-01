import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('[Lumen UI]', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="container" style={{ padding: '90px 20px', textAlign: 'center' }}>
          <span className="empty-icon">
            <i className="bi bi-exclamation-triangle" />
          </span>
          <h1 style={{ marginTop: 18 }}>Something went wrong</h1>
          <p>The storefront hit an unexpected error. Reloading usually fixes it.</p>
          <button className="btn btn-brand" type="button" onClick={() => window.location.reload()}>
            Reload the page <i className="bi bi-arrow-clockwise ms-1" />
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
