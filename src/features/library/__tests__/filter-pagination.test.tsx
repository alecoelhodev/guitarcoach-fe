import { act, renderHook, waitFor } from '@testing-library/react-native';

import { listTasks } from '@/api/tasks';
import { useTasks } from '@/api/tasks.queries';
import { makePage, makeTask } from '@/test/fixtures';
import { withQueryClient } from '@/test/query-client';
import type { TaskCategory } from '@/types/task';

jest.mock('@/api/tasks', () => ({ listTasks: jest.fn() }));

it('starts a new filter at page one after loading multiple catalog pages', async () => {
  const list = jest.mocked(listTasks);
  list.mockImplementation(async (query) =>
    makePage([makeTask({ id: `${query?.category}-${query?.page}` })], {
      page: query?.page ?? 1,
      totalPages: 3,
    }),
  );
  const { wrapper } = withQueryClient();
  const { result, rerender } = await renderHook(
    ({ category }: { category?: TaskCategory }) => {
      const query = useTasks({ category });
      return {
        data: query.data,
        isSuccess: query.isSuccess,
        isPlaceholderData: query.isPlaceholderData,
        fetchNextPage: query.fetchNextPage,
      };
    },
    { wrapper, initialProps: { category: undefined } },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await act(async () => {
    await result.current.fetchNextPage();
  });
  await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

  await rerender({ category: 'theory' });
  // The previous filter's pages stand in as placeholder data, which also reads as success.
  await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
  expect(list).toHaveBeenLastCalledWith({ category: 'theory', page: 1 });
  expect(result.current.data?.pages).toHaveLength(1);
});
