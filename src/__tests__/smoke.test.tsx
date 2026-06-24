import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Test infrastructure', () => {
  it('vitest runs and happy-dom works', () => {
    render(<div data-testid="test">hello</div>);
    expect(screen.getByTestId('test')).toHaveTextContent('hello');
  });

  it('global mockSupabase is accessible', () => {
    const mock = (globalThis as any).__mockSupabase;
    expect(mock).toBeDefined();
    expect(mock.channels).toBeDefined();
    expect(typeof mock.client.channel).toBe('function');
  });

  it('mock channel works', () => {
    const mock = (globalThis as any).__mockSupabase;
    const ch = mock.client.channel('test-chan');
    expect(ch).toBeDefined();
    expect(ch.name).toBe('test-chan');
  });

  it('mock tables can store and query data', async () => {
    const mock = (globalThis as any).__mockSupabase;
    const data = [{ id: '1', name: 'test' }];
    mock.setTableData('test_table', data);

    const { data: result } = await mock.client
      .from('test_table')
      .select('*')
      .eq('id', '1')
      .single();

    expect(result.name).toBe('test');
  });
});
