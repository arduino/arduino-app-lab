import '@testing-library/jest-dom';

import { act, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React, { Component, ErrorInfo, ReactNode, useEffect } from 'react';
import { describe, expect, it } from 'vitest';

import App from '../App';
import { MessageDialog } from './message';

interface Props {
  children?: ReactNode;
}
interface State {
  hasError: boolean;
}
// Error boundary to be used as a wrapper for a failing app (here, a mock of <App />)
class SimpleErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return <h1>Something went wrong</h1>;
    }

    return this.props.children;
  }
}

// used to load different markdown or generate a errors
let mockedVersion = '0.0.0';

const mdWithNoFrontMatter = `# Updates available

We're aware of an issue with the current version of App Lab.

Please download the latest version from our website

[Download](https://www.arduino.cc/en/software#app-lab)

Thank you for you understanding`;

const mdWithSimpleFrontMatter = `---
title: Dialog title
---
${mdWithNoFrontMatter}`;

const mdWithInvalidFrontMatter = `- - -
title: Dialog title with invalid frontmatter
---
${mdWithNoFrontMatter}`;

const mdWithComplexFrontMatter = `---

title: Dialog title

date: 2026-01-01
info: Some extra info

---
${mdWithNoFrontMatter}`;

const handlers = [
  http.get('*message_0.5.0*', () => {
    return HttpResponse.text(mdWithSimpleFrontMatter);
  }),

  http.get('*message_0.5.1*', () => {
    return HttpResponse.error();
  }),
  http.get('*message_0.5.2*', () => {
    return new HttpResponse('Not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }),
  http.get('*message_0.5.3*', () => {
    return HttpResponse.text(mdWithNoFrontMatter);
  }),
  http.get('*message_0.5.4*', () => {
    return HttpResponse.text(mdWithComplexFrontMatter);
  }),
  http.get('*message_0.5.5*', () => {
    return HttpResponse.text(mdWithInvalidFrontMatter);
  }),
];

const server = setupServer(...handlers);

vi.mock('../App', () => ({
  default: (): JSX.Element => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      throw new Error('error in mock component');
    }, []);
    return <div>App here </div>;
  },
}));

vi.mock('../../wailsjs/go/app/App', () => {
  return {
    GetCurrentVersion(): string {
      return mockedVersion;
    },
  };
});

beforeAll(() => {
  // we must use function, an arrow function will have the incorrect value for `this`
  HTMLDialogElement.prototype.show = vi.fn(function mock(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
  HTMLDialogElement.prototype.showModal = vi.fn(function mock(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function mock(
    this: HTMLDialogElement,
  ) {
    this.open = false;
  });

  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
function getDialog(scr: typeof screen): HTMLDialogElement {
  return scr.getByRole('dialog', {
    hidden: true,
  });
}

describe('Message dialog with error in AppLab', () => {
  it('opens the dialog when version is 0.5.0', async () => {
    mockedVersion = '0.5.0';
    await act(async () => {
      render(
        <>
          <MessageDialog />
          <SimpleErrorBoundary>
            <App />
          </SimpleErrorBoundary>
        </>,
      );
    });

    const dialog = getDialog(screen);
    await waitFor(() => {
      expect(dialog.open).toBe(true);
    });
  });
});

describe('Message dialog', () => {
  it('opens the dialog when version is 0.5.0', async () => {
    mockedVersion = '0.5.0';
    await act(async () => {
      render(<MessageDialog />);
    });

    const dialog = getDialog(screen);
    await waitFor(() => {
      expect(dialog.open).toBe(true);
    });
  });

  it('does not open the dialog when version is 0.5.1 (with network error)', async () => {
    mockedVersion = '0.5.1';
    await act(async () => {
      render(<MessageDialog />);
    });

    const dialog = getDialog(screen);
    await waitFor(() => {
      expect(dialog.open).toBe(false);
    });
  });

  it('does not open the dialog when version is 0.5.2 (network send a 404)', async () => {
    mockedVersion = '0.5.2';
    await act(async () => {
      render(<MessageDialog />);
    });

    const dialog = getDialog(screen);
    await waitFor(() => {
      expect(dialog.open).toBe(false);
    });
  });
});

describe('Message dialog shows a markdown', () => {
  it('shows the markdown with frontmatter (0.5.0)', async () => {
    mockedVersion = '0.5.0';
    await act(async () => {
      render(<MessageDialog />);
    });

    const dialog = getDialog(screen);
    await waitFor(() => {
      expect(dialog.open).toBe(true);
    });

    expect(() => screen.getByText('Arduino App Lab v.0.5.0')).not.toThrow();
    expect(() => screen.getByText('Dialog title')).not.toThrow();
    expect(() => screen.getByRole('heading', { level: 1 })).not.toThrow();
    expect(() => screen.getByText('Updates available')).not.toThrow();
  });

  it('shows the markdown without frontmatter (0.5.3)', async () => {
    mockedVersion = '0.5.3';
    await act(async () => {
      render(<MessageDialog />);
    });

    const dialog = getDialog(screen);
    await waitFor(() => {
      expect(dialog.open).toBe(true);
    });

    expect(() => screen.getByText('Arduino App Lab v.0.5.3')).not.toThrow();
    expect(() => screen.getByText('Dialog title')).toThrow();
    expect(() => screen.getByText('Warning')).not.toThrow();
    expect(() => screen.getByRole('heading', { level: 1 })).not.toThrow();
    expect(() => screen.getByText('Updates available')).not.toThrow();
  });

  it('shows the markdown with complex frontmatter (0.5.4)', async () => {
    mockedVersion = '0.5.4';
    await act(async () => {
      render(<MessageDialog />);
    });

    const dialog = getDialog(screen);
    await waitFor(() => {
      expect(dialog.open).toBe(true);
    });

    expect(() => screen.getByText('Arduino App Lab v.0.5.4')).not.toThrow();
    expect(() => screen.getByText('Dialog title')).not.toThrow();
    expect(() => screen.getByRole('heading', { level: 1 })).not.toThrow();
    expect(() => screen.getByText('Updates available')).not.toThrow();
  });

  it('shows the markdown with invalid frontmatter (0.5.5)', async () => {
    mockedVersion = '0.5.5';
    await act(async () => {
      render(<MessageDialog />);
    });

    const dialog = getDialog(screen);
    await waitFor(() => {
      expect(dialog.open).toBe(true);
    });

    expect(() => screen.getByText('Arduino App Lab v.0.5.5')).not.toThrow();
    expect(() => screen.getByText('Dialog title')).toThrow();
    expect(() => screen.getByText('Warning')).not.toThrow();
    expect(() => screen.getByRole('heading', { level: 1 })).not.toThrow();
    expect(() => screen.getByText('Updates available')).not.toThrow();
  });
});
