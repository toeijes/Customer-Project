import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Login from './Login';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('shows an API error when login is rejected', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'Invalid credentials' })
  });
  vi.stubGlobal('fetch', fetchMock);

  const { container } = render(<Login onLoginSuccess={vi.fn()} />);
  const inputs = container.querySelectorAll('input');
  fireEvent.change(inputs[0], { target: { value: 'demo-user' } });
  fireEvent.change(inputs[1], { target: { value: 'invalid-password' } });
  fireEvent.submit(container.querySelector('form'));

  expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
    credentials: 'include',
    method: 'POST'
  }));
});
