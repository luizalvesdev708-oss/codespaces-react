import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import PwaControls from './PwaControls';

test('exibe o comando de instalação quando o navegador oferece o prompt PWA', async () => {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice,
  });
  render(<PwaControls />);

  window.dispatchEvent(event);
  fireEvent.click(await screen.findByRole('button', { name: 'Instalar app' }));

  expect(prompt).toHaveBeenCalledOnce();
  expect(await screen.findByText('Instalação iniciada.')).toBeDefined();
});
