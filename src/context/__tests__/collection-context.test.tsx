import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { CollectionProvider, useCollection } from '@/context/collection-context';
import { catalogo } from '@/lib/catalogo';

function wrapper({ children }: { children: ReactNode }) {
  return <CollectionProvider>{children}</CollectionProvider>;
}

async function renderReady() {
  const view = await renderHook(() => useCollection(), { wrapper });
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe('CollectionProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('starts empty when nothing is stored', async () => {
    const { result } = await renderReady();

    expect(result.current.tengoCount).toBe(0);
    expect(result.current.percentage).toBe(0);
    expect(result.current.total).toBe(catalogo.length);
  });

  it('toggle marks a card as "tengo" and persists it', async () => {
    const { result } = await renderReady();
    const id = catalogo[0].id;

    await act(async () => {
      await result.current.toggle(id);
    });

    expect(result.current.has(id)).toBe(true);
    expect(result.current.tengoCount).toBe(1);

    const stored = await AsyncStorage.getItem('coleccion-bip:estado');
    expect(JSON.parse(stored as string)).toEqual({ [id]: true });
  });

  it('toggle again flips it back to pendiente', async () => {
    const { result } = await renderReady();
    const id = catalogo[0].id;

    await act(async () => {
      await result.current.toggle(id);
      await result.current.toggle(id);
    });

    expect(result.current.has(id)).toBe(false);
    expect(result.current.tengoCount).toBe(0);
  });

  it('rolls back the optimistic update when persisting fails, and sets a notice', async () => {
    const { result } = await renderReady();
    const id = catalogo[0].id;

    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));

    await act(async () => {
      await result.current.toggle(id);
    });

    expect(result.current.has(id)).toBe(false);
    expect(result.current.tengoCount).toBe(0);
    expect(result.current.notice).toBeTruthy();
  });

  it('a successful toggle clears a previous notice', async () => {
    const { result } = await renderReady();
    const [first, second] = catalogo;

    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await act(async () => {
      await result.current.toggle(first.id);
    });
    expect(result.current.notice).toBeTruthy();

    await act(async () => {
      await result.current.toggle(second.id);
    });
    expect(result.current.notice).toBeNull();
  });

  it('percentage is round(tengoCount / total * 100)', async () => {
    const { result } = await renderReady();
    const ids = catalogo.slice(0, 3).map((c) => c.id);

    await act(async () => {
      for (const id of ids) {
        await result.current.toggle(id);
      }
    });

    expect(result.current.tengoCount).toBe(3);
    expect(result.current.percentage).toBe(Math.round((3 / catalogo.length) * 100));
  });

  it('loads previously persisted state on mount', async () => {
    const id = catalogo[0].id;
    await AsyncStorage.setItem('coleccion-bip:estado', JSON.stringify({ [id]: true }));

    const { result } = await renderReady();

    expect(result.current.has(id)).toBe(true);
    expect(result.current.tengoCount).toBe(1);
  });

  it('useCollection throws outside of a provider', async () => {
    await expect(renderHook(() => useCollection())).rejects.toThrow(
      'useCollection debe usarse dentro de un CollectionProvider'
    );
  });
});
