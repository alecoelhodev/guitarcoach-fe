import type { components } from '@/types/api';

export type PaginationMeta = components['schemas']['PaginationMetaDto'];

export type Paginated<T> = {
  data: T[];
  meta: PaginationMeta;
};
